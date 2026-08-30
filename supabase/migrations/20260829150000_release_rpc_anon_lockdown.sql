begin;

-- Hosted Supabase projects can carry explicit EXECUTE grants for the API roles
-- through their default-privilege configuration. Revoking from PUBLIC alone is
-- therefore insufficient. Keep every release RPC limited to its explicit
-- authenticated or service-role grant from the migration that created it.
do $$
declare
  target record;
begin
  for target in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'archive_class_schedule_transaction',
        'archive_class_transaction',
        'claim_ai_workflow_run',
        'claim_lms_outbox_events',
        'cleanup_stale_homework_submissions',
        'complete_lms_outbox_event',
        'create_class_transaction',
        'delete_class_attendance_transaction',
        'enqueue_lms_due_soon_events',
        'fail_homework_submission',
        'finalize_homework_submission',
        'get_homework_submission_roster',
        'grade_homework_submission',
        'increment_ai_workflow_provider_attempt',
        'manage_class_course_transaction',
        'manage_class_student_transaction',
        'manage_class_teacher_transaction',
        'mark_homework_submission_uploading',
        'prepare_ai_knowledge_collection_draft',
        'publish_ai_knowledge_collection_version',
        'publish_ielts_teacher_review',
        'reserve_homework_submission',
        'return_ielts_teacher_review',
        'save_class_attendance_transaction',
        'save_class_schedule_transaction',
        'save_ielts_teacher_review',
        'search_ai_knowledge_hybrid',
        'search_debate_corpus_items_lexical',
        'update_class_transaction'
      ])
  loop
    execute format(
      'revoke execute on function %s from public, anon',
      target.signature
    );
  end loop;
end;
$$;

commit;
