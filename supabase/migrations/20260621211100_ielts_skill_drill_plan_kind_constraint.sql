-- =============================================================================
-- WS-6.3a — skill_drill reference constraint
-- =============================================================================
-- Separate from the enum-value add (…_skill_drill_plan_kind.sql): Postgres
-- forbids referencing a new enum value in the same transaction that introduced
-- it, so the CHECK that requires skill_drill items to carry an ielts_test_id
-- must run in its own migration after the value is committed.
-- =============================================================================

do $$ begin
  alter table public.ielts_study_plan_items
    add constraint ielts_study_plan_items_skill_drill_reference_check
    check (kind <> 'skill_drill' or ielts_test_id is not null);
exception when duplicate_object then null; end $$;
