-- =============================================================================
-- WS-6.1.2 — IELTS study-plan pointer FK indexes
-- =============================================================================
-- Keep nullable plan-item pointers covered for deletes/lookups from their source
-- rows. These are additive and intentionally partial to stay small while content
-- is sparse.
-- =============================================================================

begin;

create index if not exists idx_ielts_study_plan_items_question
  on public.ielts_study_plan_items(ielts_question_id)
  where ielts_question_id is not null;

create index if not exists idx_ielts_study_plan_items_assignment
  on public.ielts_study_plan_items(assignment_id)
  where assignment_id is not null;

create index if not exists idx_ielts_study_plan_items_activity_attempt
  on public.ielts_study_plan_items(activity_attempt_id)
  where activity_attempt_id is not null;

create index if not exists idx_ielts_study_plan_items_ielts_attempt
  on public.ielts_study_plan_items(ielts_attempt_id)
  where ielts_attempt_id is not null;

create index if not exists idx_ielts_study_plan_items_writing_response
  on public.ielts_study_plan_items(writing_response_id)
  where writing_response_id is not null;

create index if not exists idx_ielts_study_plan_items_speaking_response
  on public.ielts_study_plan_items(speaking_response_id)
  where speaking_response_id is not null;

commit;
