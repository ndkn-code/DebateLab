from pathlib import Path


SQL = (Path(__file__).parents[3] / "supabase/migrations/20260830170000_observability_bug_incidents.sql").read_text()


def test_dedupe_is_atomic_and_delivery_based() -> None:
    lowered = SQL.lower()
    assert "primary key (fingerprint, service, environment)" in lowered
    assert "delivery_id text primary key" in lowered
    assert "for update" in lowered
    assert "on conflict (delivery_id) do nothing" in lowered
    assert "lease_expires_at" in lowered


def test_active_incomplete_delivery_lease_defers_instead_of_acknowledging() -> None:
    completed_branch = SQL.split("if v_delivery.completed_at is not null then", 1)[1].split("end if;", 1)[0]
    active_lease_branch = SQL.split(
        "if v_delivery.lease_expires_at is not null and v_delivery.lease_expires_at > now() then",
        1,
    )[1].split("end if;", 1)[0]
    assert "'noop'::text" in completed_branch
    assert "'defer'::text" in active_lease_branch
    assert "'noop'::text" not in active_lease_branch


def test_registry_does_not_have_raw_or_pii_columns() -> None:
    table_block = SQL.split("create table if not exists public.observability_bug_incidents", 1)[1].split(");", 1)[0]
    for forbidden in ("message", "description", "email", "stack", "trace", "url", "payload", "body"):
        assert forbidden not in table_block.lower()


def test_rpcs_are_service_role_only() -> None:
    lowered = SQL.lower()
    assert "revoke all on function public.claim_observability_bug_incident" in lowered
    assert "grant execute on function public.claim_observability_bug_incident" in lowered
    assert "to service_role" in lowered


def test_registry_has_explicit_deny_all_browser_role_policies() -> None:
    lowered = SQL.lower()
    for table in ("observability_bug_incidents", "observability_bug_deliveries"):
        policy = lowered.split(f"create policy {table}_deny_browser_roles", 1)[1].split(";", 1)[0]
        assert f"on public.{table}" in policy
        assert "as restrictive" in policy
        assert "for all" in policy
        assert "to anon, authenticated" in policy
        assert "using (false)" in policy
        assert "with check (false)" in policy
