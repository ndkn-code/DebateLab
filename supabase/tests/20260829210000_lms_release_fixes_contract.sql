-- Run after 20260829210000_lms_release_fixes.sql.
begin;
select plan(5);

select has_table('public', 'ielts_teacher_review_feedback_history', 'feedback history exists');
select has_view('public', 'ielts_published_criterion_feedback', 'published learner projection exists');
select has_trigger(
  'public', 'class_attendance_sessions', 'require_lms_attendance_occurrence',
  'new attendance sessions require an occurrence trigger'
);
select has_trigger(
  'public', 'ielts_teacher_reviews', 'audit_ielts_teacher_review_feedback',
  'criterion feedback history trigger exists'
);

do $$
declare
  attendance_policy text;
  projection_definition text;
  occurrence_definition text;
begin
  select string_agg(coalesce(qual, '') || coalesce(with_check, ''), ' ')
    into attendance_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'class_attendance_records';
  if attendance_policy ilike '%can_manage_club%' then
    raise exception 'attendance records must not use club-wide manager authorization';
  end if;
  select pg_get_viewdef('public.ielts_published_criterion_feedback'::regclass, true)
    into projection_definition;
  if lower(projection_definition) not like '%status = ''published''%' then
    raise exception 'learner criterion projection must be publication gated';
  end if;
  select pg_get_functiondef(
    'private.require_lms_attendance_occurrence()'::regprocedure
  ) into occurrence_definition;
  if lower(occurrence_definition) not like '%tg_op = ''insert''%'
     or lower(occurrence_definition) not like '%occurrence_id is null%' then
    raise exception 'occurrence requirement must apply to inserts only';
  end if;
end;
$$;
select pass('LMS release authorization and projection contracts are satisfied');
select * from finish();
rollback;
