-- =============================================================================
-- WS-6.0.2 — IELTS adaptive FK index hardening
-- =============================================================================
-- Primary already received the evidence/state migration before advisor review.
-- These indexes cover the new subskill foreign keys directly. The main migration
-- also contains the same IF NOT EXISTS indexes so fresh databases converge.
-- =============================================================================

begin;

create index if not exists idx_ielts_adaptive_evidence_subskill
  on public.ielts_adaptive_evidence(subskill_key);

create index if not exists idx_ielts_skill_states_subskill
  on public.ielts_skill_states(subskill_key);

commit;
