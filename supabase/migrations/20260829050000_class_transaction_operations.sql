-- Atomic class/cohort operations. Each RPC re-checks authorization, performs
-- all related writes in one transaction, and records its audit event before
-- returning. Direct table writes remain protected by class RLS.

begin;

create table if not exists public.class_attendance_correction_events (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  session_id uuid references public.class_attendance_sessions(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('saved', 'deleted')),
  status text check (status is null or status in ('present', 'late', 'absent')),
  notes text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists class_attendance_correction_events_class_idx
  on public.class_attendance_correction_events(class_id, created_at desc);
create index if not exists class_attendance_correction_events_session_idx
  on public.class_attendance_correction_events(session_id, created_at desc);

alter table public.class_attendance_correction_events enable row level security;
revoke all on public.class_attendance_correction_events from anon, authenticated;
grant select on public.class_attendance_correction_events to authenticated;

drop policy if exists "Class managers view attendance correction events"
  on public.class_attendance_correction_events;
create policy "Class managers view attendance correction events"
  on public.class_attendance_correction_events for select
  to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())));

create or replace function private.write_class_operation_audit(
  p_actor_id uuid,
  p_action text,
  p_class_id uuid,
  p_changes jsonb
)
returns void
language plpgsql
security definer
set search_path = public, private
as $$
begin
  insert into public.admin_activity_log (
    admin_user_id, action, entity_type, entity_id, changes
  ) values (
    p_actor_id, p_action, 'class', p_class_id, coalesce(p_changes, '{}'::jsonb)
  );
end;
$$;

-- Create a club class (owners) or a global class (admins).
create or replace function public.create_class_transaction(
  p_club_id uuid,
  p_code text,
  p_title text,
  p_description text,
  p_program_type text,
  p_grade_level text,
  p_status text,
  p_start_date date,
  p_end_date date,
  p_meeting_schedule text,
  p_room text,
  p_max_students integer
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  class_id uuid;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  if p_club_id is null then
    if not private.is_admin(uid) then raise exception 'FORBIDDEN'; end if;
  elsif not exists (
    select 1 from public.club_memberships cm
    where cm.club_id = p_club_id and cm.user_id = uid
      and cm.role = 'owner' and cm.status = 'active'
  ) and not private.is_admin(uid) then
    raise exception 'FORBIDDEN';
  end if;
  if nullif(btrim(p_title), '') is null then raise exception 'CLASS_TITLE_REQUIRED'; end if;

  insert into public.classes (
    club_id, code, title, description, program_type, grade_level, status,
    start_date, end_date, meeting_schedule, room, max_students, created_by
  ) values (
    p_club_id, p_code, btrim(p_title), p_description, p_program_type,
    p_grade_level, p_status, p_start_date, p_end_date, p_meeting_schedule,
    p_room, p_max_students, uid
  ) returning id into class_id;

  perform private.write_class_operation_audit(uid, 'create_class', class_id,
    jsonb_build_object('club_id', p_club_id, 'code', p_code, 'title', btrim(p_title), 'program_type', p_program_type));
  return class_id;
end;
$$;

create or replace function public.update_class_transaction(
  p_class_id uuid,
  p_title text,
  p_description text,
  p_program_type text,
  p_grade_level text,
  p_status text,
  p_start_date date,
  p_end_date date,
  p_meeting_schedule text,
  p_room text,
  p_max_students integer
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not private.can_manage_class(p_class_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'CLASS_TITLE_REQUIRED'; end if;
  perform 1 from public.classes where id = p_class_id for update;
  if not found then raise exception 'CLASS_NOT_FOUND'; end if;
  if p_program_type <> 'ielts' and exists (
    select 1
    from public.class_course_assignments cca
    join public.courses c on c.id = cca.course_id
    where cca.class_id = p_class_id and c.subject = 'ielts'
  ) then
    raise exception 'IELTS_CLASS_HAS_IELTS_DEPENDENCIES';
  end if;
  if p_program_type <> 'ielts' and (
    exists (select 1 from public.club_assignments where class_id = p_class_id and (assignment_type = 'ielts_mock' or ielts_test_id is not null))
    or exists (select 1 from public.ielts_attempts where class_id = p_class_id)
    or exists (select 1 from public.lms_pilot_flags where class_id = p_class_id)
    or exists (select 1 from public.lms_announcements where class_id = p_class_id)
    or exists (select 1 from public.lms_outbox_events where class_id = p_class_id)
    or exists (select 1 from public.lms_resources where scope_class_id = p_class_id)
    or exists (select 1 from public.lms_resource_assignments where class_id = p_class_id)
    or exists (select 1 from public.lms_vocabulary_sets where scope_class_id = p_class_id)
    or exists (select 1 from public.lms_vocabulary_assignments where class_id = p_class_id)
  ) then
    raise exception 'IELTS_CLASS_HAS_IELTS_DEPENDENCIES';
  end if;
  update public.classes
  set title = btrim(p_title), description = p_description, program_type = p_program_type,
      grade_level = p_grade_level, status = p_status, start_date = p_start_date,
      end_date = p_end_date, meeting_schedule = p_meeting_schedule, room = p_room,
      max_students = p_max_students, updated_at = now()
  where id = p_class_id;
  if not found then raise exception 'CLASS_NOT_FOUND'; end if;
  perform private.write_class_operation_audit(uid, 'update_class', p_class_id,
    jsonb_build_object('title', btrim(p_title), 'status', p_status));
  return p_class_id;
end;
$$;

create or replace function public.archive_class_transaction(p_class_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not private.can_manage_class(p_class_id, uid) then raise exception 'FORBIDDEN'; end if;
  update public.classes set status = 'archived', updated_at = now() where id = p_class_id;
  if not found then raise exception 'CLASS_NOT_FOUND'; end if;
  perform private.write_class_operation_audit(uid, 'archive_class', p_class_id, '{}'::jsonb);
  return p_class_id;
end;
$$;

-- Add/remove a student. Students must already belong to the same club; the
-- existing capacity trigger serializes active roster activations.
create or replace function public.manage_class_student_transaction(
  p_class_id uuid,
  p_student_id uuid,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  class_club uuid;
begin
  if uid is null or not private.can_manage_class(p_class_id, uid) then raise exception 'FORBIDDEN'; end if;
  select club_id into class_club from public.classes where id = p_class_id for update;
  if class_club is null and not found then raise exception 'CLASS_NOT_FOUND'; end if;
  if p_action not in ('add', 'remove') then raise exception 'INVALID_ACTION'; end if;
  if p_action = 'add' then
    if not exists (select 1 from public.profiles where id = p_student_id and role = 'student') then
      raise exception 'STUDENT_PROFILE_REQUIRED';
    end if;
    if class_club is not null and not exists (
      select 1 from public.club_memberships cm
      where cm.club_id = class_club and cm.user_id = p_student_id
        and cm.role = 'student' and cm.status = 'active'
    ) then
      raise exception 'STUDENT_MUST_JOIN_CLUB';
    end if;
    insert into public.class_memberships (
      class_id, user_id, member_role, status, removed_at, created_by, updated_at
    ) values (p_class_id, p_student_id, 'student', 'active', null, uid, now())
    on conflict (class_id, user_id, member_role) do update
      set status = 'active', removed_at = null, updated_at = now();
    perform private.write_class_operation_audit(uid, 'add_class_student', p_class_id,
      jsonb_build_object('user_id', p_student_id));
  else
    update public.class_memberships
    set status = 'removed', removed_at = now(), updated_at = now()
    where class_id = p_class_id and user_id = p_student_id and member_role = 'student';
    perform private.write_class_operation_audit(uid, 'remove_class_student', p_class_id,
      jsonb_build_object('user_id', p_student_id));
  end if;
  return p_class_id;
end;
$$;

-- Assign/remove a teacher and maintain the legacy class pointer atomically.
create or replace function public.manage_class_teacher_transaction(
  p_class_id uuid,
  p_teacher_id uuid,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  class_club uuid;
  target_role text;
begin
  if uid is null then raise exception 'UNAUTHORIZED'; end if;
  if not private.is_admin(uid) and not exists (
    select 1 from public.classes c join public.club_memberships cm on cm.club_id = c.club_id
    where c.id = p_class_id and cm.user_id = uid and cm.role = 'owner' and cm.status = 'active'
  ) then raise exception 'FORBIDDEN'; end if;
  select club_id into class_club from public.classes where id = p_class_id for update;
  if not found then raise exception 'CLASS_NOT_FOUND'; end if;
  if class_club is null then raise exception 'GLOBAL_CLASS_TEACHER_UNSUPPORTED'; end if;
  if p_action not in ('add', 'remove') then raise exception 'INVALID_ACTION'; end if;

  if p_action = 'add' then
    select role into target_role from public.profiles where id = p_teacher_id;
    if target_role is null or target_role not in ('teacher', 'admin') then raise exception 'TEACHER_PROFILE_REQUIRED'; end if;
    if target_role <> 'admin' and not exists (
      select 1 from public.club_memberships cm
      where cm.club_id = class_club and cm.user_id = p_teacher_id
        and cm.role in ('owner', 'coach') and cm.status = 'active'
    ) then raise exception 'TEACHER_MUST_MANAGE_CLUB'; end if;
    insert into public.class_memberships (
      class_id, user_id, member_role, status, removed_at, created_by, updated_at
    ) values (p_class_id, p_teacher_id, 'teacher', 'active', null, uid, now())
    on conflict (class_id, user_id, member_role) do update
      set status = 'active', removed_at = null, updated_at = now();
    update public.classes set teacher_user_id = p_teacher_id, updated_at = now() where id = p_class_id;
    perform private.write_class_operation_audit(uid, 'assign_class_teacher', p_class_id,
      jsonb_build_object('user_id', p_teacher_id));
  else
    update public.class_memberships
    set status = 'removed', removed_at = now(), updated_at = now()
    where class_id = p_class_id and user_id = p_teacher_id and member_role = 'teacher';
    update public.classes
    set teacher_user_id = null, updated_at = now()
    where id = p_class_id and teacher_user_id = p_teacher_id;
    perform private.write_class_operation_audit(uid, 'remove_class_teacher', p_class_id,
      jsonb_build_object('user_id', p_teacher_id));
  end if;
  return p_class_id;
end;
$$;

-- Assign/unassign course and clean schedule references as one operation.
create or replace function public.manage_class_course_transaction(
  p_class_id uuid,
  p_course_id uuid,
  p_action text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  class_program text;
  course_subject text;
begin
  if uid is null or not private.can_manage_class(p_class_id, uid) then raise exception 'FORBIDDEN'; end if;
  if p_action not in ('assign', 'unassign') then raise exception 'INVALID_ACTION'; end if;
  select program_type into class_program from public.classes where id = p_class_id for update;
  if class_program is null then raise exception 'CLASS_NOT_FOUND'; end if;
  select subject into course_subject from public.courses where id = p_course_id;
  if course_subject is null then raise exception 'COURSE_NOT_FOUND'; end if;
  if course_subject = 'ielts' and class_program <> 'ielts' then
    raise exception 'IELTS_COURSE_REQUIRES_IELTS_CLASS';
  end if;
  if p_action = 'assign' then
    insert into public.class_course_assignments (class_id, course_id, assigned_by)
    values (p_class_id, p_course_id, uid)
    on conflict (class_id, course_id) do update set assigned_by = excluded.assigned_by;
    perform private.write_class_operation_audit(uid, 'assign_course_to_class', p_class_id,
      jsonb_build_object('course_id', p_course_id));
  else
    delete from public.class_course_assignments where class_id = p_class_id and course_id = p_course_id;
    update public.class_schedules
    set course_id = null, updated_at = now()
    where class_id = p_class_id and course_id = p_course_id;
    perform private.write_class_operation_audit(uid, 'unassign_course_from_class', p_class_id,
      jsonb_build_object('course_id', p_course_id));
  end if;
  return p_class_id;
end;
$$;

create or replace function public.save_class_attendance_transaction(
  p_class_id uuid,
  p_course_id uuid,
  p_session_date date,
  p_title text,
  p_notes text,
  p_records jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  v_session_id uuid;
  record_row record;
  record_user uuid;
  record_status text;
begin
  if uid is null or not private.can_manage_class(p_class_id, uid) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.classes where id = p_class_id) then raise exception 'CLASS_NOT_FOUND'; end if;
  if not exists (select 1 from public.class_course_assignments where class_id = p_class_id and course_id = p_course_id) then
    raise exception 'COURSE_NOT_ASSIGNED';
  end if;
  if coalesce(jsonb_array_length(p_records), 0) = 0 then raise exception 'ATTENDANCE_RECORDS_REQUIRED'; end if;
  if exists (
    select 1
    from (
      select value->>'userId' as user_id
      from jsonb_array_elements(p_records)
    ) rows
    group by user_id
    having count(*) > 1
  ) then
    raise exception 'DUPLICATE_ATTENDANCE_STUDENT';
  end if;

  insert into public.class_attendance_sessions (
    class_id, course_id, session_date, title, notes, taken_by, updated_at
  ) values (p_class_id, p_course_id, p_session_date, p_title, p_notes, uid, now())
  on conflict (class_id, course_id, session_date) do update
    set title = excluded.title, notes = excluded.notes, taken_by = excluded.taken_by, updated_at = now()
  returning id into v_session_id;

  for record_row in
    select value->>'userId' as user_id, value->>'status' as status, value->>'notes' as notes
    from jsonb_array_elements(p_records)
  loop
    record_user := record_row.user_id::uuid;
    record_status := record_row.status;
    if record_status not in ('present', 'late', 'absent') then raise exception 'INVALID_ATTENDANCE_STATUS'; end if;
    if not exists (
      select 1 from public.class_memberships cm
      where cm.class_id = p_class_id and cm.user_id = record_user
        and cm.member_role = 'student'
        and cm.joined_at::date <= p_session_date
        and (
          cm.status = 'active'
          or (cm.status = 'removed' and cm.removed_at is not null and cm.removed_at::date >= p_session_date)
        )
    ) then raise exception 'ATTENDANCE_STUDENT_NOT_ACTIVE'; end if;
    insert into public.class_attendance_records (session_id, user_id, status, notes, updated_at)
    values (v_session_id, record_user, record_status, record_row.notes, now())
    on conflict (session_id, user_id) do update
      set status = excluded.status, notes = excluded.notes, updated_at = now();
    insert into public.class_attendance_correction_events (
      class_id, session_id, user_id, action, status, notes, recorded_by
    ) values (p_class_id, v_session_id, record_user, 'saved', record_status, record_row.notes, uid);
  end loop;
  perform private.write_class_operation_audit(uid, 'save_class_attendance', p_class_id,
    jsonb_build_object('course_id', p_course_id, 'session_date', p_session_date, 'records', jsonb_array_length(p_records)));
  return v_session_id;
end;
$$;

create or replace function public.delete_class_attendance_transaction(
  p_class_id uuid,
  p_session_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  session_row public.class_attendance_sessions%rowtype;
begin
  if uid is null or not private.can_manage_class(p_class_id, uid) then raise exception 'FORBIDDEN'; end if;
  select * into session_row from public.class_attendance_sessions where id = p_session_id for update;
  if not found or session_row.class_id <> p_class_id then raise exception 'SESSION_NOT_FOUND'; end if;
  insert into public.class_attendance_correction_events (
    class_id, session_id, action, recorded_by, notes
  ) values (p_class_id, p_session_id, 'deleted', uid, 'Attendance session deleted');
  delete from public.class_attendance_sessions where id = p_session_id;
  perform private.write_class_operation_audit(uid, 'delete_class_attendance', p_class_id,
    jsonb_build_object('session_id', p_session_id));
  return p_session_id;
end;
$$;

-- Persist schedules through the same authorization and audit boundary as the
-- other class operations. Course links are revalidated against the canonical
-- class assignment while the class row is locked.
create or replace function public.save_class_schedule_transaction(
  p_class_id uuid,
  p_schedule_id uuid,
  p_course_id uuid,
  p_title text,
  p_room text,
  p_location text,
  p_start_date date,
  p_end_date date,
  p_start_time time,
  p_end_time time,
  p_timezone text,
  p_recurrence_rule jsonb,
  p_recurrence_summary text,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
  schedule_id uuid;
begin
  if uid is null or not private.can_manage_class(p_class_id, uid) then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.classes where id = p_class_id for update;
  if not found then raise exception 'CLASS_NOT_FOUND'; end if;
  if nullif(btrim(p_title), '') is null then raise exception 'SCHEDULE_TITLE_REQUIRED'; end if;
  if p_end_time <= p_start_time then raise exception 'SCHEDULE_TIME_RANGE_INVALID'; end if;
  if p_end_date is not null and p_end_date < p_start_date then raise exception 'SCHEDULE_DATE_RANGE_INVALID'; end if;
  if coalesce(p_status, 'active') not in ('active', 'cancelled', 'archived') then raise exception 'SCHEDULE_STATUS_INVALID'; end if;
  if coalesce(p_recurrence_rule->>'frequency', 'none') not in ('none', 'daily', 'weekly', 'monthly') then
    raise exception 'SCHEDULE_RECURRENCE_INVALID';
  end if;
  if coalesce((p_recurrence_rule->>'interval')::integer, 1) not between 1 and 99 then
    raise exception 'SCHEDULE_RECURRENCE_INVALID';
  end if;
  if coalesce(p_recurrence_rule->>'endMode', 'never') not in ('never', 'on_date', 'after_occurrences') then
    raise exception 'SCHEDULE_RECURRENCE_INVALID';
  end if;
  if coalesce(p_recurrence_rule->>'endMode', 'never') = 'on_date'
     and nullif(p_recurrence_rule->>'until', '') is null then
    raise exception 'SCHEDULE_RECURRENCE_INVALID';
  end if;
  if coalesce(p_recurrence_rule->>'endMode', 'never') = 'after_occurrences'
     and coalesce((p_recurrence_rule->>'count')::integer, 0) not between 1 and 999 then
    raise exception 'SCHEDULE_RECURRENCE_INVALID';
  end if;
  if p_course_id is not null and not exists (
    select 1 from public.class_course_assignments
    where class_id = p_class_id and course_id = p_course_id
  ) then raise exception 'SCHEDULE_COURSE_NOT_ASSIGNED'; end if;

  if p_schedule_id is null then
    insert into public.class_schedules (
      class_id, course_id, title, room, location, start_date, end_date,
      start_time, end_time, timezone, recurrence_rule, recurrence_summary,
      status, created_by, updated_at
    ) values (
      p_class_id, p_course_id, btrim(p_title), p_room, p_location,
      p_start_date, p_end_date, p_start_time, p_end_time, p_timezone,
      coalesce(p_recurrence_rule, '{}'::jsonb), p_recurrence_summary,
      coalesce(p_status, 'active'), uid, now()
    ) returning id into schedule_id;
    perform private.write_class_operation_audit(uid, 'create_class_schedule', p_class_id,
      jsonb_build_object('schedule_id', schedule_id));
  else
    update public.class_schedules
    set course_id = p_course_id, title = btrim(p_title), room = p_room,
        location = p_location, start_date = p_start_date, end_date = p_end_date,
        start_time = p_start_time, end_time = p_end_time, timezone = p_timezone,
        recurrence_rule = coalesce(p_recurrence_rule, '{}'::jsonb),
        recurrence_summary = p_recurrence_summary, status = coalesce(p_status, 'active'),
        updated_at = now()
    where id = p_schedule_id and class_id = p_class_id;
    if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
    schedule_id := p_schedule_id;
    perform private.write_class_operation_audit(uid, 'update_class_schedule', p_class_id,
      jsonb_build_object('schedule_id', schedule_id));
  end if;
  return schedule_id;
end;
$$;

create or replace function public.archive_class_schedule_transaction(
  p_class_id uuid,
  p_schedule_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or not private.can_manage_class(p_class_id, uid) then raise exception 'FORBIDDEN'; end if;
  update public.class_schedules
  set status = 'archived', updated_at = now()
  where id = p_schedule_id and class_id = p_class_id;
  if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
  perform private.write_class_operation_audit(uid, 'delete_class_schedule', p_class_id,
    jsonb_build_object('schedule_id', p_schedule_id));
  return p_schedule_id;
end;
$$;

revoke all on function public.create_class_transaction(uuid, text, text, text, text, text, text, date, date, text, text, integer) from public;
revoke all on function public.update_class_transaction(uuid, text, text, text, text, text, date, date, text, text, integer) from public;
revoke all on function public.archive_class_transaction(uuid) from public;
revoke all on function public.manage_class_student_transaction(uuid, uuid, text) from public;
revoke all on function public.manage_class_teacher_transaction(uuid, uuid, text) from public;
revoke all on function public.manage_class_course_transaction(uuid, uuid, text) from public;
revoke all on function public.save_class_attendance_transaction(uuid, uuid, date, text, text, jsonb) from public;
revoke all on function public.delete_class_attendance_transaction(uuid, uuid) from public;
revoke all on function public.save_class_schedule_transaction(uuid, uuid, uuid, text, text, text, date, date, time, time, text, jsonb, text, text) from public;
revoke all on function public.archive_class_schedule_transaction(uuid, uuid) from public;
grant execute on function public.create_class_transaction(uuid, text, text, text, text, text, text, date, date, text, text, integer) to authenticated;
grant execute on function public.update_class_transaction(uuid, text, text, text, text, text, date, date, text, text, integer) to authenticated;
grant execute on function public.archive_class_transaction(uuid) to authenticated;
grant execute on function public.manage_class_student_transaction(uuid, uuid, text) to authenticated;
grant execute on function public.manage_class_teacher_transaction(uuid, uuid, text) to authenticated;
grant execute on function public.manage_class_course_transaction(uuid, uuid, text) to authenticated;
grant execute on function public.save_class_attendance_transaction(uuid, uuid, date, text, text, jsonb) to authenticated;
grant execute on function public.delete_class_attendance_transaction(uuid, uuid) to authenticated;
grant execute on function public.save_class_schedule_transaction(uuid, uuid, uuid, text, text, text, date, date, time, time, text, jsonb, text, text) to authenticated;
grant execute on function public.archive_class_schedule_transaction(uuid, uuid) to authenticated;

revoke all on function private.write_class_operation_audit(uuid, text, uuid, jsonb) from public;

commit;
