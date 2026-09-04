-- Reconcile the table/view grant map with production.
--
-- WHY THIS IS A SECOND FILE
-- -------------------------
-- 20260902145000_reconcile_legacy_schema_with_production.sql fixes table *shape*, and has
-- to run before 20260902150000_organization_curriculum.sql. Grants cannot be fixed there:
-- several migrations between that point and production's head deliberately revoke
-- privileges (organization_curriculum.sql:32-33,152 among them), and anything set earlier
-- would simply be overwritten by them. The grant map is therefore reconciled at
-- production's applied head -- after 20260902230000_lms_operation_receipts_denial.sql, the
-- last migration production has actually run, and before the pending 20260903* files.
--
-- WHAT WAS WRONG
-- --------------
-- The chain is uniformly STRICTER than production. Of production's 633 (object, role)
-- pairs, ~324 diverge from a chain-built database, and every one of them is the chain
-- revoking something production still grants. Nothing is granted locally that production
-- withholds.
--
-- The practical damage: a rebuilt database is unusable for QA. The chain never grants
-- `authenticated` SELECT on `public.profiles`. Production has it, from the 2026-03
-- dashboard era that was never captured as a migration. Without it every signed-in user
-- reads zero profile rows and is bounced to /onboarding. Found by B1 walking this stack.
--
-- SECURITY NOTE -- READ THIS
-- --------------------------
-- This file replicates production's grant map so QA stops producing false failures. It is
-- NOT an endorsement of that map. The divergence runs one way, which means the reverse
-- statement is also true: production is missing grant hardening this repo believes is
-- applied -- `anon` holds INSERT/UPDATE/DELETE on ~120 tables there, restrained only by
-- RLS. Whether to tighten production is a separate decision that needs a human. A
-- reconciliation migration must not make it silently. See the OPS1 report.
--
-- SAFETY
-- ------
-- Applying this to production changes nothing: every grant restores a privilege
-- production already holds, and every revoke removes one it already lacks. Object
-- existence is checked before each statement, so it is safe to re-run.

begin;

-- 1. Supabase's default: full privileges to the three API roles on every table and view.
--    This is the state production is in for 426 of its 633 (object, role) pairs.
do $$
declare
  r record;
begin
  for r in
    select c.relname as obj
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v')
  loop
    execute format('grant all on public.%I to anon, authenticated, service_role', r.obj);
  end loop;
end $$;

-- 2. Production's deliberate exceptions: 129 (object, role) pairs holding no privileges
--    at all, and 78 holding a reduced set. Applied revoke-then-grant so the result is
--    exact regardless of the state the object arrived in.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('active_practice_topic_catalog', 'anon', ''),
      ('active_practice_topic_catalog', 'authenticated', 'SELECT'),
      ('activities', 'authenticated', 'REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('admin_class_list_rows', 'anon', ''),
      ('admin_class_list_rows', 'authenticated', 'SELECT'),
      ('admin_club_assignment_rows', 'anon', ''),
      ('admin_club_assignment_rows', 'authenticated', 'SELECT'),
      ('admin_club_list_rows', 'anon', ''),
      ('admin_club_list_rows', 'authenticated', 'SELECT'),
      ('ai_coach_turns', 'anon', ''),
      ('ai_coach_turns', 'authenticated', ''),
      ('ai_grading_benchmark_release_attestations', 'anon', ''),
      ('ai_grading_benchmark_release_attestations', 'authenticated', ''),
      ('ai_grading_benchmark_release_attestations', 'service_role', 'DELETE,INSERT,REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('ai_grading_benchmark_run_claims', 'anon', ''),
      ('ai_grading_benchmark_run_claims', 'authenticated', ''),
      ('ai_grading_benchmark_run_claims', 'service_role', ''),
      ('ai_grading_benchmark_withdrawals', 'anon', ''),
      ('ai_grading_benchmark_withdrawals', 'authenticated', ''),
      ('ai_grading_benchmark_withdrawals', 'service_role', ''),
      ('ai_grading_benchmarks', 'anon', ''),
      ('ai_grading_benchmarks', 'authenticated', ''),
      ('ai_grading_checkpoints', 'anon', ''),
      ('ai_grading_checkpoints', 'authenticated', ''),
      ('ai_grading_checkpoints', 'service_role', 'REFERENCES,SELECT,TRIGGER'),
      ('ai_grading_evaluation_runs', 'anon', ''),
      ('ai_grading_evaluation_runs', 'authenticated', ''),
      ('ai_grading_evaluations', 'anon', ''),
      ('ai_grading_evaluations', 'authenticated', ''),
      ('ai_grading_operational_claims', 'anon', ''),
      ('ai_grading_operational_claims', 'authenticated', ''),
      ('ai_grading_operational_claims', 'service_role', 'SELECT'),
      ('ai_grading_operational_evidence', 'anon', ''),
      ('ai_grading_operational_evidence', 'authenticated', ''),
      ('ai_grading_operational_evidence', 'service_role', 'SELECT'),
      ('ai_grading_operational_scenarios', 'anon', ''),
      ('ai_grading_operational_scenarios', 'authenticated', ''),
      ('ai_grading_operational_scenarios', 'service_role', 'SELECT'),
      ('ai_grading_operational_transitions', 'anon', ''),
      ('ai_grading_operational_transitions', 'authenticated', ''),
      ('ai_grading_operational_transitions', 'service_role', 'SELECT'),
      ('ai_grading_runtime_attestations', 'anon', ''),
      ('ai_grading_runtime_attestations', 'authenticated', ''),
      ('ai_grading_runtime_attestations', 'service_role', 'SELECT'),
      ('ai_grading_verified_withdrawal_receipts', 'anon', ''),
      ('ai_grading_verified_withdrawal_receipts', 'authenticated', ''),
      ('ai_grading_verified_withdrawal_receipts', 'service_role', ''),
      ('ai_grading_withdrawal_operator_key_revocations', 'anon', ''),
      ('ai_grading_withdrawal_operator_key_revocations', 'authenticated', ''),
      ('ai_grading_withdrawal_operator_key_revocations', 'service_role', ''),
      ('ai_grading_withdrawal_operator_keys', 'anon', ''),
      ('ai_grading_withdrawal_operator_keys', 'authenticated', ''),
      ('ai_grading_withdrawal_operator_keys', 'service_role', ''),
      ('ai_knowledge_collection_versions', 'anon', ''),
      ('ai_knowledge_collection_versions', 'authenticated', ''),
      ('ai_knowledge_collections', 'anon', ''),
      ('ai_knowledge_collections', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('ai_knowledge_embeddings', 'anon', ''),
      ('ai_knowledge_embeddings', 'authenticated', 'SELECT'),
      ('ai_knowledge_items', 'anon', ''),
      ('ai_knowledge_items', 'authenticated', 'SELECT'),
      ('ai_knowledge_retrieval_logs', 'anon', ''),
      ('ai_knowledge_retrieval_logs', 'authenticated', 'SELECT'),
      ('ai_knowledge_sources', 'anon', ''),
      ('ai_knowledge_sources', 'authenticated', 'SELECT'),
      ('ai_provider_requests', 'anon', ''),
      ('ai_provider_requests', 'authenticated', 'SELECT'),
      ('ai_quality_ratings', 'anon', ''),
      ('ai_quality_ratings', 'authenticated', 'INSERT,SELECT,UPDATE'),
      ('ai_quality_runs', 'anon', ''),
      ('ai_quality_runs', 'authenticated', 'INSERT,SELECT'),
      ('ai_workflow_runs', 'anon', ''),
      ('ai_workflow_runs', 'authenticated', 'SELECT'),
      ('assignment_submission_files', 'authenticated', 'REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('class_attendance_correction_events', 'anon', ''),
      ('class_attendance_correction_events', 'authenticated', 'SELECT'),
      ('club_assignment_grade_events', 'anon', ''),
      ('club_assignment_grade_events', 'authenticated', 'SELECT'),
      ('club_assignment_submissions', 'anon', ''),
      ('club_assignment_submissions', 'authenticated', 'INSERT,SELECT'),
      ('club_assignments', 'anon', ''),
      ('club_assignments', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('club_events', 'anon', ''),
      ('club_events', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('club_invitations', 'anon', ''),
      ('club_invitations', 'authenticated', 'SELECT'),
      ('club_memberships', 'anon', ''),
      ('club_memberships', 'authenticated', 'SELECT'),
      ('clubs', 'anon', ''),
      ('clubs', 'authenticated', 'INSERT,SELECT,UPDATE'),
      ('coach_reviews', 'anon', ''),
      ('coach_reviews', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('course_modules', 'authenticated', 'REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('courses', 'authenticated', 'REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('debate_corpus_documents', 'anon', ''),
      ('debate_corpus_documents', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('debate_corpus_embeddings', 'anon', ''),
      ('debate_corpus_embeddings', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('debate_corpus_import_batches', 'anon', ''),
      ('debate_corpus_import_batches', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('debate_corpus_items', 'anon', ''),
      ('debate_corpus_items', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('debate_corpus_matches', 'anon', ''),
      ('debate_corpus_matches', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('debate_corpus_motion_candidates', 'anon', ''),
      ('debate_corpus_motion_candidates', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('debate_corpus_retrieval_logs', 'anon', ''),
      ('debate_corpus_retrieval_logs', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('debate_corpus_sources', 'anon', ''),
      ('debate_corpus_sources', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('email_campaign_recipients', 'anon', ''),
      ('email_campaigns', 'anon', ''),
      ('ielts_adaptive_evidence', 'anon', ''),
      ('ielts_adaptive_evidence', 'authenticated', 'SELECT'),
      ('ielts_adaptive_evidence', 'service_role', 'INSERT,SELECT'),
      ('ielts_attempt_question_blueprints', 'anon', ''),
      ('ielts_attempt_question_blueprints', 'authenticated', 'SELECT'),
      ('ielts_attempt_question_group_blueprints', 'anon', ''),
      ('ielts_attempt_question_group_blueprints', 'authenticated', 'SELECT'),
      ('ielts_attempt_question_keys', 'anon', ''),
      ('ielts_attempt_question_keys', 'authenticated', ''),
      ('ielts_content_versions', 'anon', ''),
      ('ielts_criterion_evidence', 'anon', ''),
      ('ielts_criterion_evidence', 'authenticated', ''),
      ('ielts_criterion_evidence', 'service_role', 'INSERT,SELECT'),
      ('ielts_micro_item_drafts', 'anon', ''),
      ('ielts_micro_item_drafts', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('ielts_published_criterion_feedback', 'anon', ''),
      ('ielts_question_groups', 'anon', 'SELECT'),
      ('ielts_question_keys', 'anon', ''),
      ('ielts_review_events', 'anon', ''),
      ('ielts_review_events', 'authenticated', 'SELECT'),
      ('ielts_review_items', 'anon', ''),
      ('ielts_review_items', 'authenticated', 'SELECT'),
      ('ielts_scoring_retry_events', 'anon', ''),
      ('ielts_scoring_retry_events', 'authenticated', ''),
      ('ielts_scoring_retry_events', 'service_role', 'INSERT,SELECT'),
      ('ielts_skill_states', 'anon', ''),
      ('ielts_skill_states', 'authenticated', 'SELECT'),
      ('ielts_skill_states', 'service_role', 'INSERT,SELECT,UPDATE'),
      ('ielts_study_plan_items', 'anon', ''),
      ('ielts_study_plan_items', 'authenticated', 'SELECT'),
      ('ielts_study_plan_revisions', 'anon', ''),
      ('ielts_study_plan_revisions', 'authenticated', 'SELECT'),
      ('ielts_study_plans', 'anon', ''),
      ('ielts_study_plans', 'authenticated', 'SELECT'),
      ('ielts_subskills', 'anon', ''),
      ('ielts_subskills', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('ielts_teacher_review_events', 'authenticated', 'REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('ielts_teacher_review_feedback_history', 'anon', 'REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('ielts_teacher_review_feedback_history', 'authenticated', 'REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('ielts_teacher_reviews', 'authenticated', 'REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('lessons', 'authenticated', 'REFERENCES,SELECT,TRIGGER,TRUNCATE'),
      ('lms_lesson_occurrences', 'anon', ''),
      ('lms_material_audiences', 'authenticated', ''),
      ('lms_material_audit_events', 'authenticated', ''),
      ('lms_material_placements', 'authenticated', ''),
      ('lms_material_renditions', 'authenticated', ''),
      ('lms_material_rights_approvals', 'authenticated', ''),
      ('lms_material_unlock_rules', 'authenticated', ''),
      ('lms_material_versions', 'authenticated', ''),
      ('lms_materials', 'authenticated', ''),
      ('lms_occurrence_assignments', 'anon', ''),
      ('lms_occurrence_resources', 'anon', ''),
      ('lms_occurrence_roster_snapshots', 'anon', ''),
      ('lms_operation_audit_events', 'anon', ''),
      ('lms_operation_audit_events', 'authenticated', 'SELECT'),
      ('lms_operation_receipts', 'anon', ''),
      ('lms_operation_receipts', 'authenticated', ''),
      ('monthly_usage_summary', 'anon', ''),
      ('observability_bug_deliveries', 'anon', ''),
      ('observability_bug_deliveries', 'authenticated', ''),
      ('observability_bug_incidents', 'anon', ''),
      ('observability_bug_incidents', 'authenticated', ''),
      ('organization_audit_events', 'anon', ''),
      ('organization_audit_events', 'authenticated', 'SELECT'),
      ('organization_operation_idempotency', 'anon', ''),
      ('organization_operation_idempotency', 'authenticated', ''),
      ('performance_attempts', 'anon', ''),
      ('performance_attempts', 'authenticated', 'INSERT,SELECT,UPDATE'),
      ('practice_topic_category_translations', 'anon', ''),
      ('practice_topic_category_translations', 'authenticated', 'SELECT'),
      ('practice_topic_sources', 'anon', ''),
      ('practice_topic_sources', 'authenticated', 'SELECT'),
      ('practice_topic_translations', 'anon', ''),
      ('practice_topic_translations', 'authenticated', 'SELECT'),
      ('practice_topics', 'anon', ''),
      ('practice_topics', 'authenticated', 'SELECT'),
      ('profile_blocks', 'anon', ''),
      ('profile_blocks', 'authenticated', 'DELETE,INSERT,SELECT'),
      ('profile_connections', 'anon', ''),
      ('profile_connections', 'authenticated', 'SELECT'),
      ('profile_featured_achievements', 'anon', ''),
      ('profile_featured_achievements', 'authenticated', 'DELETE,INSERT,SELECT,UPDATE'),
      ('profile_friend_codes', 'anon', ''),
      ('profile_friend_codes', 'authenticated', 'SELECT'),
      ('profile_privacy_settings', 'anon', ''),
      ('profile_privacy_settings', 'authenticated', 'INSERT,SELECT,UPDATE'),
      ('profile_reports', 'anon', ''),
      ('profile_reports', 'authenticated', 'INSERT,SELECT,UPDATE'),
      ('profile_social_audit_log', 'anon', ''),
      ('profile_social_audit_log', 'authenticated', 'SELECT'),
      ('quiz_questions', 'authenticated', 'DELETE,INSERT,REFERENCES,TRIGGER,TRUNCATE,UPDATE'),
      ('support_issue_reports', 'anon', ''),
      ('support_issue_reports', 'authenticated', 'SELECT,UPDATE'),
      ('teacher_workspace_class_preferences', 'anon', ''),
      ('teacher_workspace_preferences', 'anon', '')
    ) as t(obj, role_name, privs)

  loop
    if exists (
      select 1 from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = r.obj and c.relkind in ('r', 'v')
    ) then
      execute format('revoke all on public.%I from %I', r.obj, r.role_name);
      if r.privs <> '' then
        execute format('grant %s on public.%I to %I', r.privs, r.obj, r.role_name);
      end if;
    end if;
  end loop;
end $$;

-- 3. Routine EXECUTE privileges.
--
--    Production reaches its state through Supabase's default privileges, which grant
--    EXECUTE on new functions to anon, authenticated AND service_role. The migrations
--    then `revoke all ... from public, anon` and `grant execute ... to authenticated`,
--    which leaves service_role's default grant untouched. A local stack does not apply
--    the same default, so service_role ends up with EXECUTE on nothing it was not
--    granted explicitly -- 73 RPCs that work in production fail in QA under the
--    service-role key.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f', 'p')
  loop
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

--    The only two functions production withholds from service_role.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('load_ielts_coach_prepared_context', 'review_ai_knowledge_record')
  loop
    execute format('revoke execute on function %s from service_role', r.sig);
  end loop;
end $$;

--    duel_phase_duration is the one routine the chain leaves with no EXECUTE at all.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'duel_phase_duration'
  loop
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

commit;
