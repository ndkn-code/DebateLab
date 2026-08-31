from pathlib import Path


SCRIPT = (Path(__file__).parents[1] / "deploy-gcp.sh").read_text()


def test_push_subscription_ack_deadline_exceeds_worker_timeout() -> None:
    worker_timeout_seconds = 60
    ack_deadline_seconds = 90
    assert SCRIPT.count(f"--ack-deadline {ack_deadline_seconds}") == 2
    assert ack_deadline_seconds > worker_timeout_seconds
    assert f'--timeout {worker_timeout_seconds}s' in SCRIPT


def test_otlp_secret_is_optional_and_only_bound_when_endpoint_is_configured() -> None:
    assert (
        "required_secrets=(grafana-webhook-secret supabase-url supabase-service-role-key "
        "clickup-api-token clickup-list-id)"
    ) in SCRIPT
    assert 'if [[ -n "${GRAFANA_OTLP_TRACES_ENDPOINT:-}" ]]; then' in SCRIPT
    assert (
        "Missing Secret Manager secret: grafana-otlp-auth-header "
        "(required when OTLP is enabled)"
    ) in SCRIPT
    assert (
        'secret_bindings+=("grafana-otlp-auth-header:${WEBHOOK_SA}" '
        '"grafana-otlp-auth-header:${WORKER_SA}")'
    ) in SCRIPT
    assert 'webhook_secret_refs="GRAFANA_WEBHOOK_SECRET=grafana-webhook-secret:latest"' in SCRIPT
    assert 'webhook_secret_refs+=",GRAFANA_OTLP_AUTH_HEADER=grafana-otlp-auth-header:latest"' in SCRIPT


def test_deploy_script_validates_otlp_endpoint_shape() -> None:
    assert 'https://*/v1/traces' in SCRIPT
    assert 'GRAFANA_OTLP_TRACES_ENDPOINT must be an HTTPS URL ending in /v1/traces' in SCRIPT
