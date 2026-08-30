from pathlib import Path


SQL = (Path(__file__).parents[3] / "supabase/migrations/20260830170000_observability_bug_incidents.sql").read_text()


def test_dedupe_is_atomic_and_delivery_based() -> None:
    lowered = SQL.lower()
    assert "primary key (fingerprint, service, environment)" in lowered
    assert "delivery_id text primary key" in lowered
    assert "for update" in lowered
    assert "on conflict (delivery_id) do nothing" in lowered
    assert "lease_expires_at" in lowered


def test_registry_does_not_have_raw_or_pii_columns() -> None:
    table_block = SQL.split("create table if not exists public.observability_bug_incidents", 1)[1].split(");", 1)[0]
    for forbidden in ("message", "description", "email", "stack", "trace", "url", "payload", "body"):
        assert forbidden not in table_block.lower()


def test_rpcs_are_service_role_only() -> None:
    lowered = SQL.lower()
    assert "revoke all on function public.claim_observability_bug_incident" in lowered
    assert "grant execute on function public.claim_observability_bug_incident" in lowered
    assert "to service_role" in lowered
