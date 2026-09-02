-- Manager-scoped calendar roster projection.  This is deliberately narrower than
-- profiles SELECT: it returns only the fields needed by the event drawer.
create or replace function public.load_teacher_calendar_roster(
  p_class_id uuid,
  p_occurrence_id uuid default null,
  p_session_date date default null
)
returns table (
  user_id uuid,
  display_name text,
  enrollment_status text,
  attendance_status text
)
language plpgsql
security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  event_class uuid;
  attendance_session uuid;
begin
  if actor is null or p_class_id is null
     or not private.can_manage_class(p_class_id, actor) then
    raise exception 'FORBIDDEN';
  end if;

  if p_occurrence_id is not null then
    select o.class_id into event_class
    from public.lms_lesson_occurrences o
    where o.id = p_occurrence_id;
    if event_class is distinct from p_class_id then
      raise exception 'OCCURRENCE_CLASS_MISMATCH';
    end if;
    select s.id into attendance_session
    from public.class_attendance_sessions s
    where s.occurrence_id = p_occurrence_id
      and s.class_id = p_class_id;
  elsif p_session_date is not null then
    select s.id into attendance_session
    from public.class_attendance_sessions s
    where s.class_id = p_class_id
      and s.session_date = p_session_date
      and s.occurrence_id is null
    order by s.id
    limit 1;
  end if;

  return query
  with roster as (
    select snapshot.user_id, snapshot.enrollment_status
    from public.lms_occurrence_roster_snapshots snapshot
    where p_occurrence_id is not null
      and snapshot.occurrence_id = p_occurrence_id
    union all
    select cm.user_id, 'enrolled'::text
    from public.class_memberships cm
    where p_occurrence_id is null
      and cm.class_id = p_class_id
      and cm.member_role = 'student'
      and cm.status = 'active'
  )
  select r.user_id,
         coalesce(nullif(trim(profile.display_name), ''), 'Student')::text,
         r.enrollment_status,
         coalesce(record.status, 'unmarked')::text
  from roster r
  join public.profiles profile on profile.id = r.user_id
  left join public.class_attendance_records record
    on record.user_id = r.user_id and record.session_id = attendance_session
  order by lower(coalesce(profile.display_name, '')), r.user_id;
end;
$$;

revoke all on function public.load_teacher_calendar_roster(uuid, uuid, date) from public, anon;
grant execute on function public.load_teacher_calendar_roster(uuid, uuid, date) to authenticated;

create or replace function public.teacher_workspace_reschedule_occurrence(
  p_occurrence_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_timezone text,
  p_expected_updated_at timestamptz,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer
set search_path = public, private
as $$
declare
  actor uuid := auth.uid();
  occurrence public.lms_lesson_occurrences%rowtype;
  result jsonb;
  claimed jsonb;
  local_start date;
  local_end date;
begin
  if actor is null then raise exception 'UNAUTHORIZED'; end if;
  if p_timezone is null or not exists (select 1 from pg_timezone_names where name = p_timezone) then raise exception 'INVALID_TIMEZONE'; end if;
  if p_starts_at is null or p_ends_at is null or p_ends_at <= p_starts_at then raise exception 'INVALID_SCHEDULE_RANGE'; end if;
  local_start := p_starts_at at time zone p_timezone;
  local_end := p_ends_at at time zone p_timezone;
  if local_start is distinct from local_end then raise exception 'INVALID_SCHEDULE_RANGE'; end if;
  if extract(epoch from (p_ends_at - p_starts_at)) < 900 or extract(epoch from (p_ends_at - p_starts_at)) > 28800 then raise exception 'INVALID_SCHEDULE_RANGE'; end if;
  claimed := private.lms_operation_claim(p_idempotency_key, actor, 'reschedule_occurrence', jsonb_build_object('id', p_occurrence_id, 'startsAt', p_starts_at, 'endsAt', p_ends_at, 'timezone', p_timezone, 'expected', p_expected_updated_at));
  if claimed is not null then return claimed; end if;
  select * into occurrence from public.lms_lesson_occurrences where id = p_occurrence_id for update;
  if not found or not private.can_manage_class(occurrence.class_id, actor) then raise exception 'FORBIDDEN'; end if;
  if occurrence.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_UPDATE'; end if;
  update public.lms_lesson_occurrences
  set occurrence_date = local_start, starts_at = p_starts_at, ends_at = p_ends_at,
      timezone = p_timezone, updated_by = actor, updated_at = now()
  where id = occurrence.id;
  update public.class_attendance_sessions
  set session_date = local_start, updated_at = now()
  where occurrence_id = occurrence.id;
  result := jsonb_build_object('occurrenceId', occurrence.id, 'updatedAt', (select updated_at from public.lms_lesson_occurrences where id = occurrence.id));
  perform private.lms_operation_audit('reschedule_occurrence', actor, occurrence.class_id, occurrence.id, p_idempotency_key, to_jsonb(occurrence), result);
  return private.lms_operation_store(actor, 'reschedule_occurrence', p_idempotency_key, result);
end;
$$;

revoke all on function public.teacher_workspace_reschedule_occurrence(uuid, timestamptz, timestamptz, text, timestamptz, text) from public, anon;
grant execute on function public.teacher_workspace_reschedule_occurrence(uuid, timestamptz, timestamptz, text, timestamptz, text) to authenticated;
