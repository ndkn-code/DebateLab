from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone

from .models import BugEventV1, GrafanaAlert, GrafanaWebhook
from .security import safe_https_url, sanitize_route, sanitize_text


ALLOWED_SEVERITIES = {"p0", "p1", "p2", "p3"}
_IDENTITY_COMPONENT = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}\Z")
_STABLE_FINGERPRINT_PREFIX = "thinkfy-bug-v1:"
_CANONICAL_HASH_LABELS = ("error_fingerprint", "attribute_hash", "hash")


def _int(value: str | None, default: int, maximum: int = 1_000_000_000) -> int:
    try:
        return max(0, min(int(value or default), maximum))
    except (TypeError, ValueError):
        return default


def _valid_identity_component(value: str, maximum: int) -> bool:
    return len(value) <= maximum and _IDENTITY_COMPONENT.fullmatch(value) is not None


def _canonical_source_hash(alert: GrafanaAlert) -> str | None:
    for key in _CANONICAL_HASH_LABELS:
        candidate = (alert.labels.get(key) or "").strip()
        if candidate and _valid_identity_component(candidate, 128):
            return candidate
    return None


def _fingerprint(alert: GrafanaAlert) -> str:
    labels = alert.labels
    error_hash = _canonical_source_hash(alert) or ""

    environment = (
        labels.get("environment") or labels.get("deployment_environment") or "production"
    ).strip().lower()
    service = (labels.get("service_name") or labels.get("service") or "thinkfy-web").strip().lower()
    if (
        _valid_identity_component(environment, 40)
        and _valid_identity_component(service, 100)
        and _valid_identity_component(error_hash, 128)
    ):
        identity = "\x1f".join((_STABLE_FINGERPRINT_PREFIX, environment, service, error_hash))
        digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()
        return f"{_STABLE_FINGERPRINT_PREFIX}{digest}"

    supplied = (alert.fingerprint or alert.labels.get("fingerprint") or "").strip()
    if supplied and 8 <= len(supplied) <= 128 and all(c.isalnum() or c in "_.:-" for c in supplied):
        return supplied
    identity = "|".join(
        (
            labels.get("alertname", "unknown"),
            labels.get("service", "unknown"),
            labels.get("environment", "unknown"),
            alert.annotations.get("source", ""),
        )
    )
    return hashlib.sha256(identity.encode()).hexdigest()[:32]


def _frames(value: str | None) -> list[str]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        values = parsed if isinstance(parsed, list) else [value]
    except json.JSONDecodeError:
        values = value.splitlines()
    return [sanitized for item in values[:20] if (sanitized := sanitize_text(str(item), 300))]


def _release_sha(value: str | None) -> str | None:
    candidate = (value or "").strip()
    if 7 <= len(candidate) <= 64 and all(character in "0123456789abcdefABCDEF" for character in candidate):
        return candidate
    return None


def _http_status(*values: str | None) -> int | None:
    for value in values:
        parsed = _int(value, 0, 599)
        if 100 <= parsed <= 599:
            return parsed
    return None


def transform_webhook(payload: GrafanaWebhook, raw_body: bytes) -> list[BugEventV1]:
    body_digest = hashlib.sha256(raw_body).hexdigest()
    events: list[BugEventV1] = []
    now = datetime.now(timezone.utc)
    for alert in payload.alerts:
        labels = alert.labels
        annotations = alert.annotations
        fingerprint = _fingerprint(alert)
        source_hash = _canonical_source_hash(alert)
        severity = labels.get("severity", "p2").lower()
        if severity not in ALLOWED_SEVERITIES:
            severity = "p2"
        first_seen = alert.startsAt
        last_seen_text = annotations.get("last_seen_at")
        try:
            last_seen = datetime.fromisoformat(last_seen_text.replace("Z", "+00:00")) if last_seen_text else now
        except ValueError:
            last_seen = now
        title = sanitize_text(
            annotations.get("error_title")
            or labels.get("value_template")
            or annotations.get("summary")
            or labels.get("alertname")
            or "Grafana alert",
            240,
        ) or "Grafana alert"
        alert_identity = (
            (alert.fingerprint or labels.get("fingerprint") or labels.get("alertname") or payload.receiver)
            .strip()
        )
        delivery_id = hashlib.sha256(
            f"{body_digest}\x1f{fingerprint}\x1f{alert_identity}".encode("utf-8")
        ).hexdigest()
        events.append(
            BugEventV1.model_validate(
                {
                    "schemaVersion": 1,
                    "deliveryId": delivery_id,
                    "fingerprint": fingerprint,
                    "sourceHash": source_hash,
                    "alertRule": sanitize_text(labels.get("alertname") or payload.receiver, 180),
                    "severity": severity,
                    "status": alert.status,
                    "service": sanitize_text(
                        labels.get("service_name") or labels.get("service") or "thinkfy-web", 100
                    ),
                    "environment": sanitize_text(
                        labels.get("environment")
                        or labels.get("deployment_environment")
                        or "production",
                        40,
                    ),
                    "releaseSha": _release_sha(
                        labels.get("release_sha")
                        or labels.get("service_version")
                        or labels.get("app_release")
                    ),
                    "errorTitle": title,
                    "sanitizedMessage": sanitize_text(annotations.get("description"), 2000),
                    "firstSeenAt": first_seen,
                    "lastSeenAt": last_seen,
                    "occurrenceCount": max(1, _int(annotations.get("occurrence_count"), 1)),
                    "affectedSessions": _int(annotations.get("affected_sessions"), 0),
                    "route": sanitize_route(
                        labels.get("route")
                        or labels.get("page_id")
                        or annotations.get("route")
                    ),
                    "featureArea": sanitize_text(
                        labels.get("feature_area")
                        or labels.get("context_featureArea")
                        or annotations.get("feature_area"),
                        80,
                    ),
                    "failureStage": sanitize_text(
                        labels.get("failure_stage")
                        or labels.get("context_failureStage")
                        or annotations.get("failure_stage"),
                        80,
                    ),
                    "httpStatus": _http_status(
                        labels.get("http_status"),
                        labels.get("context_status"),
                        annotations.get("http_status"),
                    ),
                    "requestId": sanitize_text(
                        labels.get("request_id")
                        or labels.get("context_requestId")
                        or annotations.get("request_id"),
                        128,
                    ),
                    "sourceFrames": _frames(annotations.get("source_frames")),
                    "traceId": sanitize_text(labels.get("trace_id"), 64),
                    "faroSessionId": sanitize_text(
                        labels.get("faro_session_id") or labels.get("session_id"), 128
                    ),
                    "debugId": sanitize_text(labels.get("debug_id"), 128),
                    "grafanaUrl": safe_https_url(alert.generatorURL, payload.externalURL),
                }
            )
        )
    return events
