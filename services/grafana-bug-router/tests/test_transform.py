from __future__ import annotations

import json

import pytest
from pydantic import ValidationError

from app.models import BugEventV1, GrafanaWebhook
from app.transform import transform_webhook


def test_webhook_transforms_to_allowlisted_sanitized_event(grafana_payload: dict) -> None:
    body = json.dumps(grafana_payload).encode()
    event = transform_webhook(GrafanaWebhook.model_validate(grafana_payload), body)[0]
    assert event.schema_version == 1
    assert len(event.delivery_id) == 64
    assert event.fingerprint == "deadbeef12345678"
    assert event.severity == "p1"
    assert event.occurrence_count == 3
    assert event.affected_sessions == 2
    assert str(event.route) == "/practice"
    assert "user@example.com" not in (event.sanitized_message or "")
    assert "Bearer-secret" not in (event.sanitized_message or "")
    assert "user@example.com" not in event.source_frames[0]


def test_delivery_id_is_stable_for_retries(grafana_payload: dict) -> None:
    body = json.dumps(grafana_payload, sort_keys=True).encode()
    parsed = GrafanaWebhook.model_validate(grafana_payload)
    assert transform_webhook(parsed, body)[0].delivery_id == transform_webhook(parsed, body)[0].delivery_id


def test_invalid_fingerprint_is_replaced_with_stable_hash(grafana_payload: dict) -> None:
    grafana_payload["alerts"][0]["fingerprint"] = "not valid pii@example.com"
    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]
    assert len(event.fingerprint) == 32
    assert "@" not in event.fingerprint


def test_unknown_severity_falls_back_to_p2(grafana_payload: dict) -> None:
    grafana_payload["alerts"][0]["labels"]["severity"] = "urgent"
    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]
    assert event.severity == "p2"


def test_service_name_is_canonical_router_service_label(grafana_payload: dict) -> None:
    grafana_payload["alerts"][0]["labels"]["service_name"] = "thinkfy-api"
    grafana_payload["alerts"][0]["labels"].pop("service")
    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]
    assert event.service == "thinkfy-api"


def test_missing_generator_url_stays_unavailable(grafana_payload: dict) -> None:
    grafana_payload["externalURL"] = None
    grafana_payload["alerts"][0]["generatorURL"] = None
    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]
    assert event.grafana_url is None


def test_schema_rejects_unknown_fields(grafana_payload: dict) -> None:
    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]
    data = event.model_dump(by_alias=True)
    data["rawAlert"] = {"email": "user@example.com"}
    with pytest.raises(ValidationError):
        BugEventV1.model_validate(data)


def test_sensitive_annotation_content_never_enters_bug_event(grafana_payload: dict) -> None:
    grafana_payload["alerts"][0]["annotations"]["description"] = (
        "analysis failed prompt=private student essay, with commas; token remains private"
    )
    grafana_payload["alerts"][0]["annotations"]["source_frames"] = json.dumps(
        ["app/scorer.ts:42 request_body=private response text, more private text"]
    )
    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]
    serialized = event.model_dump_json(by_alias=True)
    assert "private student" not in serialized
    assert "private response" not in serialized
    assert "more private" not in serialized
    assert serialized.count("[redacted-content]") == 2


@pytest.mark.parametrize("alerts", [[], [{}] * 101])
def test_webhook_schema_enforces_alert_batch_bounds(grafana_payload: dict, alerts: list) -> None:
    grafana_payload["alerts"] = alerts
    with pytest.raises(ValidationError):
        GrafanaWebhook.model_validate(grafana_payload)
