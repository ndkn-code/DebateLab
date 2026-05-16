-- Break class/cohort RLS recursion by moving cross-table checks into private security-definer helpers.

create or replace function private.can_view_class(p_class_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and (
    private.is_admin(p_user_id)
    or exists (
      select 1
      from public.class_memberships cm
      where cm.class_id = p_class_id
        and cm.user_id = p_user_id
        and cm.status = 'active'
    )
    or exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.club_id is not null
        and private.can_view_club(c.club_id, p_user_id)
    )
  );
$$;

create or replace function private.can_manage_class(p_class_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and (
    private.is_admin(p_user_id)
    or exists (
      select 1
      from public.classes c
      where c.id = p_class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, p_user_id)
    )
  );
$$;

create or replace function private.can_view_attendance_session(p_session_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and exists (
    select 1
    from public.class_attendance_sessions sessions
    where sessions.id = p_session_id
      and private.can_view_class(sessions.class_id, p_user_id)
  );
$$;

create or replace function private.can_manage_attendance_session(p_session_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_user_id is not null and exists (
    select 1
    from public.class_attendance_sessions sessions
    where sessions.id = p_session_id
      and private.can_manage_class(sessions.class_id, p_user_id)
  );
$$;

revoke all on function private.can_view_class(uuid, uuid) from public;
revoke all on function private.can_manage_class(uuid, uuid) from public;
revoke all on function private.can_view_attendance_session(uuid, uuid) from public;
revoke all on function private.can_manage_attendance_session(uuid, uuid) from public;

grant execute on function private.can_view_class(uuid, uuid) to authenticated;
grant execute on function private.can_manage_class(uuid, uuid) to authenticated;
grant execute on function private.can_view_attendance_session(uuid, uuid) to authenticated;
grant execute on function private.can_manage_attendance_session(uuid, uuid) to authenticated;

drop policy if exists "Classes readable by admins, members, and club members" on public.classes;
drop policy if exists "Classes insertable by admins and club managers" on public.classes;
drop policy if exists "Classes updatable by admins and club managers" on public.classes;
drop policy if exists "Classes deletable by admins and club managers" on public.classes;
drop policy if exists "Admins can manage classes" on public.classes;
drop policy if exists "Students can view own classes" on public.classes;
drop policy if exists "Club members can view club classes" on public.classes;
drop policy if exists "Club managers can update club classes" on public.classes;

create policy "Classes readable by admins, members, and club members"
  on public.classes for select
  to authenticated
  using (private.can_view_class(id, (select auth.uid())));

create policy "Classes insertable by admins and club managers"
  on public.classes for insert
  to authenticated
  with check (
    private.is_admin((select auth.uid()))
    or (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  );

create policy "Classes updatable by admins and club managers"
  on public.classes for update
  to authenticated
  using (private.can_manage_class(id, (select auth.uid())))
  with check (
    private.is_admin((select auth.uid()))
    or (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  );

create policy "Classes deletable by admins and club managers"
  on public.classes for delete
  to authenticated
  using (private.can_manage_class(id, (select auth.uid())));

drop policy if exists "Class memberships readable by admins, users, and club managers" on public.class_memberships;
drop policy if exists "Class memberships insertable by admins and club managers" on public.class_memberships;
drop policy if exists "Class memberships updatable by admins and club managers" on public.class_memberships;
drop policy if exists "Class memberships deletable by admins and club managers" on public.class_memberships;
drop policy if exists "Admins can manage class memberships" on public.class_memberships;
drop policy if exists "Users can view own class memberships" on public.class_memberships;
drop policy if exists "Club managers can view club class memberships" on public.class_memberships;

create policy "Class memberships readable by admins, users, and club managers"
  on public.class_memberships for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_manage_class(class_id, (select auth.uid()))
  );

create policy "Class memberships insertable by admins and club managers"
  on public.class_memberships for insert
  to authenticated
  with check (private.can_manage_class(class_id, (select auth.uid())));

create policy "Class memberships updatable by admins and club managers"
  on public.class_memberships for update
  to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())))
  with check (private.can_manage_class(class_id, (select auth.uid())));

create policy "Class memberships deletable by admins and club managers"
  on public.class_memberships for delete
  to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())));

drop policy if exists "Class schedules readable by admins, members, and club members" on public.class_schedules;
drop policy if exists "Class schedules insertable by admins and club managers" on public.class_schedules;
drop policy if exists "Class schedules updatable by admins and club managers" on public.class_schedules;
drop policy if exists "Class schedules deletable by admins and club managers" on public.class_schedules;
drop policy if exists "Admins can manage class schedules" on public.class_schedules;
drop policy if exists "Students can view own class schedules" on public.class_schedules;
drop policy if exists "Club members can view club class schedules" on public.class_schedules;
drop policy if exists "Club managers can insert club class schedules" on public.class_schedules;
drop policy if exists "Club managers can update club class schedules" on public.class_schedules;
drop policy if exists "Club managers can delete club class schedules" on public.class_schedules;

create policy "Class schedules readable by admins, members, and club members"
  on public.class_schedules for select
  to authenticated
  using (private.can_view_class(class_id, (select auth.uid())));

create policy "Class schedules insertable by admins and club managers"
  on public.class_schedules for insert
  to authenticated
  with check (private.can_manage_class(class_id, (select auth.uid())));

create policy "Class schedules updatable by admins and club managers"
  on public.class_schedules for update
  to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())))
  with check (private.can_manage_class(class_id, (select auth.uid())));

create policy "Class schedules deletable by admins and club managers"
  on public.class_schedules for delete
  to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())));

drop policy if exists "Class course assignments readable by admins, members, and club members" on public.class_course_assignments;
drop policy if exists "Class course assignments insertable by admins and club managers" on public.class_course_assignments;
drop policy if exists "Class course assignments updatable by admins and club managers" on public.class_course_assignments;
drop policy if exists "Class course assignments deletable by admins and club managers" on public.class_course_assignments;
drop policy if exists "Admins can manage class course assignments" on public.class_course_assignments;
drop policy if exists "Students can view assigned class courses" on public.class_course_assignments;
drop policy if exists "Club members can view club course assignments" on public.class_course_assignments;
drop policy if exists "Club managers can insert club course assignments" on public.class_course_assignments;
drop policy if exists "Club managers can update club course assignments" on public.class_course_assignments;
drop policy if exists "Club managers can delete club course assignments" on public.class_course_assignments;

create policy "Class course assignments readable by admins, members, and club members"
  on public.class_course_assignments for select
  to authenticated
  using (private.can_view_class(class_id, (select auth.uid())));

create policy "Class course assignments insertable by admins and club managers"
  on public.class_course_assignments for insert
  to authenticated
  with check (private.can_manage_class(class_id, (select auth.uid())));

create policy "Class course assignments updatable by admins and club managers"
  on public.class_course_assignments for update
  to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())))
  with check (private.can_manage_class(class_id, (select auth.uid())));

create policy "Class course assignments deletable by admins and club managers"
  on public.class_course_assignments for delete
  to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())));

drop policy if exists "Class attendance sessions readable by admins, members, and club members" on public.class_attendance_sessions;
drop policy if exists "Class attendance sessions insertable by admins and club managers" on public.class_attendance_sessions;
drop policy if exists "Class attendance sessions updatable by admins and club managers" on public.class_attendance_sessions;
drop policy if exists "Class attendance sessions deletable by admins and club managers" on public.class_attendance_sessions;
drop policy if exists "Admins can manage class attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Students can view own class attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club members can view club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club managers can insert club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club managers can update club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club managers can delete club attendance sessions" on public.class_attendance_sessions;

create policy "Class attendance sessions readable by admins, members, and club members"
  on public.class_attendance_sessions for select
  to authenticated
  using (private.can_view_class(class_id, (select auth.uid())));

create policy "Class attendance sessions insertable by admins and club managers"
  on public.class_attendance_sessions for insert
  to authenticated
  with check (private.can_manage_class(class_id, (select auth.uid())));

create policy "Class attendance sessions updatable by admins and club managers"
  on public.class_attendance_sessions for update
  to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())))
  with check (private.can_manage_class(class_id, (select auth.uid())));

create policy "Class attendance sessions deletable by admins and club managers"
  on public.class_attendance_sessions for delete
  to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())));

drop policy if exists "Class attendance records readable by admins, users, and club members" on public.class_attendance_records;
drop policy if exists "Class attendance records insertable by admins and club managers" on public.class_attendance_records;
drop policy if exists "Class attendance records updatable by admins and club managers" on public.class_attendance_records;
drop policy if exists "Class attendance records deletable by admins and club managers" on public.class_attendance_records;
drop policy if exists "Admins can manage class attendance records" on public.class_attendance_records;
drop policy if exists "Students can view own class attendance records" on public.class_attendance_records;
drop policy if exists "Club members can view club attendance records" on public.class_attendance_records;
drop policy if exists "Club managers can insert club attendance records" on public.class_attendance_records;
drop policy if exists "Club managers can update club attendance records" on public.class_attendance_records;
drop policy if exists "Club managers can delete club attendance records" on public.class_attendance_records;

create policy "Class attendance records readable by admins, users, and club members"
  on public.class_attendance_records for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or private.can_view_attendance_session(session_id, (select auth.uid()))
  );

create policy "Class attendance records insertable by admins and club managers"
  on public.class_attendance_records for insert
  to authenticated
  with check (private.can_manage_attendance_session(session_id, (select auth.uid())));

create policy "Class attendance records updatable by admins and club managers"
  on public.class_attendance_records for update
  to authenticated
  using (private.can_manage_attendance_session(session_id, (select auth.uid())))
  with check (private.can_manage_attendance_session(session_id, (select auth.uid())));

create policy "Class attendance records deletable by admins and club managers"
  on public.class_attendance_records for delete
  to authenticated
  using (private.can_manage_attendance_session(session_id, (select auth.uid())));
