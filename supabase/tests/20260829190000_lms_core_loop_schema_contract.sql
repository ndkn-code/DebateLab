-- Run after 20260829190000_lms_core_loop_schema.sql.
begin;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'lms_lesson_occurrences',
    'lms_occurrence_resources',
    'lms_occurrence_assignments',
    'lms_occurrence_roster_snapshots'
  ] loop
    if to_regclass('public.' || table_name) is null then
      raise exception 'Missing LMS core-loop table: %', table_name;
    end if;
    if not exists (
      select 1 from pg_class
      where oid = to_regclass('public.' || table_name) and relrowsecurity
    ) then
      raise exception 'RLS must be enabled on public.%', table_name;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'class_attendance_sessions'
      and column_name = 'occurrence_id'
  ) then
    raise exception 'Attendance occurrence link is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ielts_teacher_reviews'
      and column_name = 'criterion_feedback' and data_type = 'jsonb'
  ) then
    raise exception 'Criterion teacher feedback is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'speaking_responses'
      and column_name = 'audio_verified_at'
  ) then
    raise exception 'Verified speaking evidence metadata is missing';
  end if;
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'club_assignment_submissions'
      and column_name = 'cleanup_status'
  ) then
    raise exception 'Homework cleanup observability is missing';
  end if;

  if to_regprocedure('private.is_assigned_class_teacher(uuid,uuid)') is null then
    raise exception 'Assigned class teacher authorization helper is missing';
  end if;
  if to_regprocedure('private.was_class_student_on_date(uuid,uuid,date)') is null then
    raise exception 'Historical enrollment helper is missing';
  end if;
  if to_regprocedure('public.retry_homework_submission(uuid,uuid)') is null then
    raise exception 'Homework retry RPC is missing';
  end if;
  if to_regprocedure('public.record_homework_cleanup_result(uuid,boolean,text)') is null then
    raise exception 'Homework cleanup outcome RPC is missing';
  end if;
  if to_regprocedure('public.update_ielts_teacher_review_feedback(uuid,integer,jsonb,uuid)') is null then
    raise exception 'Criterion feedback RPC is missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.ielts_teacher_reviews'::regclass
      and tgname = 'enforce_ielts_review_teacher_authority'
      and not tgisinternal
  ) then
    raise exception 'Teacher review authority trigger is missing';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.lms_lesson_occurrences'::regclass
      and tgname = 'capture_lms_occurrence_roster'
      and not tgisinternal
  ) then
    raise exception 'Occurrence roster capture trigger is missing';
  end if;

  if has_table_privilege(
    'authenticated',
    'public.lms_occurrence_roster_snapshots',
    'insert,update,delete'
  ) then
    raise exception 'Historical occurrence roster must be server-controlled';
  end if;
  if not has_function_privilege(
    'authenticated',
    'public.retry_homework_submission(uuid,uuid)',
    'execute'
  ) then
    raise exception 'Authenticated learners require the retry RPC';
  end if;
  if has_function_privilege(
    'authenticated',
    'public.record_homework_cleanup_result(uuid,boolean,text)',
    'execute'
  ) then
    raise exception 'Cleanup outcomes must remain service-role only';
  end if;
end;
$$;

rollback;
