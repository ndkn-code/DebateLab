-- =============================================================================
-- WS-6.0.2 — IELTS adaptive service-role grant hardening
-- =============================================================================
-- Supabase projects can carry broad default grants for service_role on new public
-- tables. Tighten the two WS-6.0.2 tables explicitly:
--   * evidence ledger: SELECT + INSERT only (append-only by grants)
--   * skill states: SELECT + INSERT + UPDATE only (derived current state)
-- =============================================================================

begin;

revoke all on table public.ielts_adaptive_evidence
  from anon, authenticated, service_role;
grant select on table public.ielts_adaptive_evidence to authenticated;
grant select, insert on table public.ielts_adaptive_evidence to service_role;

revoke all on table public.ielts_skill_states
  from anon, authenticated, service_role;
grant select on table public.ielts_skill_states to authenticated;
grant select, insert, update on table public.ielts_skill_states to service_role;

commit;
