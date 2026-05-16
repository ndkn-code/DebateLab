-- Consolidate class/cohort RLS policies after adding Club OS access paths.

drop policy if exists "Admins can manage classes" on public.classes;
drop policy if exists "Students can view own classes" on public.classes;
drop policy if exists "Club members can view club classes" on public.classes;
drop policy if exists "Club managers can update club classes" on public.classes;

create policy "Classes readable by admins, members, and club members"
  on public.classes for select
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.class_memberships cm
      where cm.class_id = classes.id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    )
    or (club_id is not null and private.can_view_club(club_id, (select auth.uid())))
  );

create policy "Classes insertable by admins and club managers"
  on public.classes for insert
  with check (
    private.is_admin((select auth.uid()))
    or (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  );

create policy "Classes updatable by admins and club managers"
  on public.classes for update
  using (
    private.is_admin((select auth.uid()))
    or (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  )
  with check (
    private.is_admin((select auth.uid()))
    or (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  );

create policy "Classes deletable by admins and club managers"
  on public.classes for delete
  using (
    private.is_admin((select auth.uid()))
    or (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  );

drop policy if exists "Admins can manage class memberships" on public.class_memberships;
drop policy if exists "Users can view own class memberships" on public.class_memberships;
drop policy if exists "Club managers can view club class memberships" on public.class_memberships;

create policy "Class memberships readable by admins, users, and club managers"
  on public.class_memberships for select
  using (
    private.is_admin((select auth.uid()))
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.classes c
      where c.id = class_memberships.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class memberships insertable by admins and club managers"
  on public.class_memberships for insert
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_memberships.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class memberships updatable by admins and club managers"
  on public.class_memberships for update
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_memberships.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  )
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_memberships.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class memberships deletable by admins and club managers"
  on public.class_memberships for delete
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_memberships.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Admins can manage class schedules" on public.class_schedules;
drop policy if exists "Students can view own class schedules" on public.class_schedules;
drop policy if exists "Club members can view club class schedules" on public.class_schedules;
drop policy if exists "Club managers can insert club class schedules" on public.class_schedules;
drop policy if exists "Club managers can update club class schedules" on public.class_schedules;
drop policy if exists "Club managers can delete club class schedules" on public.class_schedules;

create policy "Class schedules readable by admins, members, and club members"
  on public.class_schedules for select
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.class_memberships cm
      where cm.class_id = class_schedules.class_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    )
    or exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_view_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class schedules insertable by admins and club managers"
  on public.class_schedules for insert
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class schedules updatable by admins and club managers"
  on public.class_schedules for update
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  )
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class schedules deletable by admins and club managers"
  on public.class_schedules for delete
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_schedules.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Admins can manage class course assignments" on public.class_course_assignments;
drop policy if exists "Students can view assigned class courses" on public.class_course_assignments;
drop policy if exists "Club members can view club course assignments" on public.class_course_assignments;
drop policy if exists "Club managers can insert club course assignments" on public.class_course_assignments;
drop policy if exists "Club managers can update club course assignments" on public.class_course_assignments;
drop policy if exists "Club managers can delete club course assignments" on public.class_course_assignments;

create policy "Class course assignments readable by admins, members, and club members"
  on public.class_course_assignments for select
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.class_memberships cm
      where cm.class_id = class_course_assignments.class_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    )
    or exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_view_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class course assignments insertable by admins and club managers"
  on public.class_course_assignments for insert
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class course assignments updatable by admins and club managers"
  on public.class_course_assignments for update
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  )
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class course assignments deletable by admins and club managers"
  on public.class_course_assignments for delete
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_course_assignments.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Admins can manage class attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Students can view own class attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club members can view club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club managers can insert club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club managers can update club attendance sessions" on public.class_attendance_sessions;
drop policy if exists "Club managers can delete club attendance sessions" on public.class_attendance_sessions;

create policy "Class attendance sessions readable by admins, members, and club members"
  on public.class_attendance_sessions for select
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.class_memberships cm
      where cm.class_id = class_attendance_sessions.class_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    )
    or exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_view_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class attendance sessions insertable by admins and club managers"
  on public.class_attendance_sessions for insert
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class attendance sessions updatable by admins and club managers"
  on public.class_attendance_sessions for update
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  )
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class attendance sessions deletable by admins and club managers"
  on public.class_attendance_sessions for delete
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.classes c
      where c.id = class_attendance_sessions.class_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

drop policy if exists "Admins can manage class attendance records" on public.class_attendance_records;
drop policy if exists "Students can view own class attendance records" on public.class_attendance_records;
drop policy if exists "Club members can view club attendance records" on public.class_attendance_records;
drop policy if exists "Club managers can insert club attendance records" on public.class_attendance_records;
drop policy if exists "Club managers can update club attendance records" on public.class_attendance_records;
drop policy if exists "Club managers can delete club attendance records" on public.class_attendance_records;

create policy "Class attendance records readable by admins, users, and club members"
  on public.class_attendance_records for select
  using (
    private.is_admin((select auth.uid()))
    or user_id = (select auth.uid())
    or exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_view_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class attendance records insertable by admins and club managers"
  on public.class_attendance_records for insert
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class attendance records updatable by admins and club managers"
  on public.class_attendance_records for update
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  )
  with check (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );

create policy "Class attendance records deletable by admins and club managers"
  on public.class_attendance_records for delete
  using (
    private.is_admin((select auth.uid()))
    or exists (
      select 1
      from public.class_attendance_sessions sessions
      join public.classes c on c.id = sessions.class_id
      where sessions.id = class_attendance_records.session_id
        and c.club_id is not null
        and private.can_manage_club(c.club_id, (select auth.uid()))
    )
  );
