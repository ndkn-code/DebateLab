from __future__ import annotations

from app.telemetry import _otlp_config, sanitize_attributes


def test_otlp_config_requires_complete_https_grafana_configuration() -> None:
    assert _otlp_config({}) is None
    assert _otlp_config(
        {
            "GRAFANA_OTLP_TRACES_ENDPOINT": "https://otlp.grafana.net/otlp/v1/traces",
            "GRAFANA_OTLP_AUTH_HEADER": "Basic instance-token",
        }
    ) == (
        "https://otlp.grafana.net/otlp/v1/traces",
        "Basic instance-token",
    )
    assert _otlp_config(
        {
            "GRAFANA_OTLP_TRACES_ENDPOINT": "http://localhost:4318/v1/traces",
            "GRAFANA_OTLP_AUTH_HEADER": "Basic local",
        }
    ) is None


def test_telemetry_attributes_redact_sensitive_or_unbounded_values() -> None:
    assert sanitize_attributes(
        {
            "bug.service": "thinkfy-web",
            "bug.fingerprint": "deadbeef",
            "request.body": "private",
            "authorization": "Bearer secret",
            "long": "x" * 300,
            "invalid key": "discard",
        }
    ) == {
        "bug.service": "thinkfy-web",
        "bug.fingerprint": "deadbeef",
        "long": "x" * 200,
    }
