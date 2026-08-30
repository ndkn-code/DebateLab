from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from .models import BugEventV1, GrafanaAlert, GrafanaWebhook
from .security import safe_https_url, sanitize_route, sanitize_text


ALLOWED_SEVERITIES = {"p0", "p1", "p2", "p3"}


def _int(value: str | None, default: int, maximum: int = 1_000_000_000) -> int:
    try:
        return max(0, min(int(value or default), maximum))
    except (TypeError, ValueError):
        return default


def _fingerprint(alert: GrafanaAlert) -> str:
    supplied = (alert.fingerprint or alert.labels.get("fingerprint") or "").strip()
    if supplied and 8 <= len(supplied) <= 128 and all(c.isalnum() or c in "_.:-" for c in supplied):
        return supplied
    identity = "|".join(
        (
            alert.labels.get("alertname", "unknown"),
            alert.labels.get("service", "unknown"),
            alert.labels.get("environment", "unknown"),
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


def transform_webhook(payload: GrafanaWebhook, raw_body: bytes) -> list[BugEventV1]:
    body_digest = hashlib.sha256(raw_body).hexdigest()
    events: list[BugEventV1] = []
    now = datetime.now(timezone.utc)
    for alert in payload.alerts:
        labels = alert.labels
        annotations = alert.annotations
        fingerprint = _fingerprint(alert)
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
            annotations.get("summary") or labels.get("alertname") or "Grafana alert",
            240,
        ) or "Grafana alert"
        delivery_id = hashlib.sha256(f"{body_digest}:{fingerprint}".encode()).hexdigest()
        events.append(
            BugEventV1.model_validate(
                {
                    "schemaVersion": 1,
                    "deliveryId": delivery_id,
                    "fingerprint": fingerprint,
                    "alertRule": sanitize_text(labels.get("alertname") or payload.receiver, 180),
                    "severity": severity,
                    "status": alert.status,
                    "service": sanitize_text(labels.get("service") or "thinkfy-web", 100),
                    "environment": sanitize_text(labels.get("environment") or "production", 40),
                    "releaseSha": _release_sha(labels.get("release_sha")),
                    "errorTitle": title,
                    "sanitizedMessage": sanitize_text(annotations.get("description"), 2000),
                    "firstSeenAt": first_seen,
                    "lastSeenAt": last_seen,
                    "occurrenceCount": max(1, _int(annotations.get("occurrence_count"), 1)),
                    "affectedSessions": _int(annotations.get("affected_sessions"), 0),
                    "route": sanitize_route(labels.get("route") or annotations.get("route")),
                    "sourceFrames": _frames(annotations.get("source_frames")),
                    "traceId": sanitize_text(labels.get("trace_id"), 64),
                    "faroSessionId": sanitize_text(labels.get("faro_session_id"), 128),
                    "debugId": sanitize_text(labels.get("debug_id"), 128),
                    "grafanaUrl": safe_https_url(alert.generatorURL, payload.externalURL),
                }
            )
        )
    return events
