-- Remove attendance policy recursion and keep learner reads behind the
-- published/historical lesson-occurrence boundary.
begin;

create or replace function private.can_manage_attendance_session(
  p_session_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and exists (
    select 1
    from public.class_attendance_sessions session_row
    where session_row.id = p_session_id
      and private.can_manage_class(session_row.class_id, p_user_id)
  );
$$;

create or replace function private.can_view_attendance_session(
  p_session_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and exists (
    select 1
    from public.class_attendance_sessions session_row
    where session_row.id = p_session_id
      and (
        (
          session_row.occurrence_id is not null
          and private.can_view_lms_occurrence(
            session_row.occurrence_id,
            p_user_id
          )
        )
        or (
          session_row.occurrence_id is null
          and private.has_own_attendance_record(session_row.id, p_user_id)
          and private.was_class_student_on_date(
            session_row.class_id,
            p_user_id,
            session_row.session_date
          )
        )
      )
  );
$$;

revoke all on function private.can_manage_attendance_session(uuid, uuid)
  from public;
revoke all on function private.can_view_attendance_session(uuid, uuid)
  from public;
grant execute on function private.can_manage_attendance_session(uuid, uuid)
  to authenticated;
grant execute on function private.can_view_attendance_session(uuid, uuid)
  to authenticated;
grant select on public.class_attendance_sessions,
  public.class_attendance_records to authenticated;

drop policy if exists
  "Attendance sessions readable by admins assigned teachers and enrolled learners"
  on public.class_attendance_sessions;
drop policy if exists "Historical learners read own attendance sessions"
  on public.class_attendance_sessions;
create policy "Attendance sessions use nonrecursive class and occurrence scope"
on public.class_attendance_sessions for select to authenticated
using (
  private.is_admin((select auth.uid()))
  or private.can_manage_class(class_id, (select auth.uid()))
  or private.can_view_attendance_session(id, (select auth.uid()))
);

drop policy if exists
  "Attendance records readable by admins assigned teachers and owners"
  on public.class_attendance_records;
create policy "Attendance records use nonrecursive session scope"
on public.class_attendance_records for select to authenticated
using (
  private.is_admin((select auth.uid()))
  or private.can_manage_attendance_session(
    class_attendance_records.session_id,
    (select auth.uid())
  )
  or (
    user_id = (select auth.uid())
    and private.can_view_attendance_session(
      class_attendance_records.session_id,
      (select auth.uid())
    )
  )
);

drop policy if exists "Attendance records insertable by admins and assigned teachers"
  on public.class_attendance_records;
create policy "Attendance records insert through managed sessions"
on public.class_attendance_records for insert to authenticated
with check (
  private.is_admin((select auth.uid()))
  or private.can_manage_attendance_session(session_id, (select auth.uid()))
);

drop policy if exists "Attendance records updatable by admins and assigned teachers"
  on public.class_attendance_records;
create policy "Attendance records update through managed sessions"
on public.class_attendance_records for update to authenticated
using (
  private.is_admin((select auth.uid()))
  or private.can_manage_attendance_session(session_id, (select auth.uid()))
)
with check (
  private.is_admin((select auth.uid()))
  or private.can_manage_attendance_session(session_id, (select auth.uid()))
);

drop policy if exists "Attendance records deletable by admins and assigned teachers"
  on public.class_attendance_records;
create policy "Attendance records delete through managed sessions"
on public.class_attendance_records for delete to authenticated
using (
  private.is_admin((select auth.uid()))
  or private.can_manage_attendance_session(session_id, (select auth.uid()))
);

commit;
