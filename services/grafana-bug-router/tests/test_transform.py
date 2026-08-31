from __future__ import annotations

import copy
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
    assert event.fingerprint.startswith("thinkfy-bug-v1:")
    assert event.source_hash == "faro-error-1234"
    assert event.severity == "p1"
    assert event.occurrence_count == 3
    assert event.affected_sessions == 2
    assert str(event.route) == "/practice"
    assert event.release_sha == "5c555d0936178ed3208aa5c98521547784022838"
    assert event.faro_session_id == "session-1234"
    assert "user@example.com" not in (event.sanitized_message or "")
    assert "Bearer-secret" not in (event.sanitized_message or "")
    assert "user@example.com" not in event.source_frames[0]


def test_delivery_id_is_stable_for_retries(grafana_payload: dict) -> None:
    body = json.dumps(grafana_payload, sort_keys=True).encode()
    parsed = GrafanaWebhook.model_validate(grafana_payload)
    assert transform_webhook(parsed, body)[0].delivery_id == transform_webhook(parsed, body)[0].delivery_id


def test_invalid_supplied_fingerprint_does_not_override_stable_source_hash(
    grafana_payload: dict,
) -> None:
    grafana_payload["alerts"][0]["fingerprint"] = "not valid pii@example.com"
    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]
    assert event.fingerprint.startswith("thinkfy-bug-v1:")
    assert event.source_hash == "faro-error-1234"
    assert "@" not in event.fingerprint


def test_stable_error_hash_deduplicates_rule_and_severity_variants(grafana_payload: dict) -> None:
    p2_payload = copy.deepcopy(grafana_payload)
    p1_payload = copy.deepcopy(grafana_payload)
    for payload, rule, severity in (
        (p2_payload, "Browser exception P2", "p2"),
        (p1_payload, "Browser exception P1", "p1"),
    ):
        payload["alerts"][0]["labels"].update(
            {"alertname": rule, "severity": severity, "hash": "error-identity-1234"}
        )
        payload["alerts"][0]["fingerprint"] = f"grafana-{severity}-1234"

    p2 = transform_webhook(
        GrafanaWebhook.model_validate(p2_payload), json.dumps(p2_payload).encode()
    )[0]
    p1 = transform_webhook(
        GrafanaWebhook.model_validate(p1_payload), json.dumps(p1_payload).encode()
    )[0]

    assert p2.fingerprint == p1.fingerprint
    assert p2.fingerprint.startswith("thinkfy-bug-v1:")
    assert "error-identity-1234" not in p2.fingerprint


def test_canonical_hash_precedence_prefers_error_fingerprint(grafana_payload: dict) -> None:
    labels = grafana_payload["alerts"][0]["labels"]
    labels.update(
        {
            "error_fingerprint": "canonical-error-1234",
            "attribute_hash": "attribute-error-5678",
            "hash": "legacy-error-9012",
        }
    )

    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]

    expected_labels = labels.copy()
    expected_labels["attribute_hash"] = "ignored"
    expected_labels["hash"] = "ignored"
    expected = copy.deepcopy(grafana_payload)
    expected["alerts"][0]["labels"] = expected_labels
    expected["alerts"][0]["labels"]["error_fingerprint"] = "canonical-error-1234"
    expected_event = transform_webhook(
        GrafanaWebhook.model_validate(expected), json.dumps(expected).encode()
    )[0]

    assert event.fingerprint == expected_event.fingerprint
    assert "canonical-error-1234" not in event.fingerprint


def test_stable_fingerprint_normalizes_environment_and_service(grafana_payload: dict) -> None:
    normalized_payload = copy.deepcopy(grafana_payload)
    normalized_payload["alerts"][0]["labels"].update(
        {"environment": "production", "service_name": "thinkfy-web", "hash": "same-error-1234"}
    )
    normalized_event = transform_webhook(
        GrafanaWebhook.model_validate(normalized_payload), json.dumps(normalized_payload).encode()
    )[0]

    variant_payload = copy.deepcopy(normalized_payload)
    variant_payload["alerts"][0]["labels"].update(
        {"environment": " Production ", "service_name": " Thinkfy-Web "}
    )
    variant_event = transform_webhook(
        GrafanaWebhook.model_validate(variant_payload), json.dumps(variant_payload).encode()
    )[0]

    assert normalized_event.fingerprint == variant_event.fingerprint


def test_same_canonical_fingerprint_keeps_alert_delivery_ids_distinct(
    grafana_payload: dict,
) -> None:
    second_alert = copy.deepcopy(grafana_payload["alerts"][0])
    grafana_payload["alerts"][0]["labels"]["hash"] = "same-error-1234"
    grafana_payload["alerts"][0]["fingerprint"] = "grafana-rule-p2"
    second_alert["labels"].update({"hash": "same-error-1234", "severity": "p1"})
    second_alert["fingerprint"] = "grafana-rule-p1"
    grafana_payload["alerts"].append(second_alert)

    events = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )

    assert events[0].fingerprint == events[1].fingerprint
    assert events[0].delivery_id != events[1].delivery_id


def test_different_stable_error_hashes_do_not_deduplicate(grafana_payload: dict) -> None:
    first_payload = copy.deepcopy(grafana_payload)
    second_payload = copy.deepcopy(grafana_payload)
    first_payload["alerts"][0]["labels"]["hash"] = "error-identity-1234"
    second_payload["alerts"][0]["labels"]["hash"] = "different-error-5678"

    first = transform_webhook(
        GrafanaWebhook.model_validate(first_payload), json.dumps(first_payload).encode()
    )[0]
    second = transform_webhook(
        GrafanaWebhook.model_validate(second_payload), json.dumps(second_payload).encode()
    )[0]

    assert first.fingerprint != second.fingerprint


def test_attribute_hash_is_used_when_hash_is_absent(grafana_payload: dict) -> None:
    labels = grafana_payload["alerts"][0]["labels"]
    labels.pop("hash", None)
    labels["attribute_hash"] = "error-identity-1234"

    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]

    assert event.fingerprint.startswith("thinkfy-bug-v1:")


def test_supplied_grafana_fingerprint_is_fallback_without_stable_error_hash(
    grafana_payload: dict,
) -> None:
    labels = grafana_payload["alerts"][0]["labels"]
    labels.pop("hash", None)
    labels.pop("attribute_hash", None)
    grafana_payload["alerts"][0]["fingerprint"] = "fallback12345678"

    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]

    assert event.fingerprint == "fallback12345678"


def test_invalid_stable_error_hash_uses_supplied_fingerprint_fallback(
    grafana_payload: dict,
) -> None:
    grafana_payload["alerts"][0]["labels"]["hash"] = "error identity contains spaces"
    grafana_payload["alerts"][0]["fingerprint"] = "fallback12345678"

    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]

    assert event.fingerprint == "fallback12345678"


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


def test_live_faro_label_aliases_are_preserved_for_agent_triage(grafana_payload: dict) -> None:
    labels = grafana_payload["alerts"][0]["labels"]
    labels.pop("environment")
    labels.pop("route")
    labels.pop("release_sha", None)
    labels.pop("faro_session_id", None)
    labels.update(
        {
            "deployment_environment": "production",
            "service_version": "5c555d0936178ed3208aa5c98521547784022838",
            "page_id": "/chat?secret=redacted",
            "session_id": "session-live-1",
            "value_template": "Chat request failed",
            "context_requestId": "123e4567-e89b-12d3-a456-426614174000",
            "context_status": "500",
            "context_featureArea": "ai-coach",
        }
    )

    event = transform_webhook(
        GrafanaWebhook.model_validate(grafana_payload), json.dumps(grafana_payload).encode()
    )[0]

    assert event.environment == "production"
    assert event.error_title == "Chat request failed"
    assert event.route == "/chat"
    assert event.faro_session_id == "session-live-1"
    assert event.request_id == "123e4567-e89b-12d3-a456-426614174000"
    assert event.http_status == 500
    assert event.feature_area == "ai-coach"


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
