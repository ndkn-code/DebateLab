-- Keep lesson-occurrence links inside the occurrence's organization and class.
-- This is additive because the original LMS core migration may already be
-- present in linked environments.

begin;

create or replace function private.is_occurrence_assignment_in_scope(
  p_occurrence_id uuid,
  p_assignment_id uuid
)
returns boolean language sql stable security definer
set search_path = public, private as $$
  select exists (
    select 1
    from public.lms_lesson_occurrences occurrence
    join public.club_assignments assignment
      on assignment.id = p_assignment_id
     and assignment.class_id = occurrence.class_id
     and assignment.club_id = occurrence.club_id
     and assignment.status = 'active'
    where occurrence.id = p_occurrence_id
  );
$$;

create or replace function private.is_occurrence_resource_in_scope(
  p_occurrence_id uuid,
  p_resource_id uuid
)
returns boolean language sql stable security definer
set search_path = public, private as $$
  select exists (
    select 1
    from public.lms_lesson_occurrences occurrence
    join public.lms_resources resource
      on resource.id = p_resource_id
     and resource.club_id = occurrence.club_id
     and resource.status = 'published'
    where occurrence.id = p_occurrence_id
      and (
        resource.scope_class_id = occurrence.class_id
        or exists (
          select 1
          from public.lms_resource_assignments assignment
          where assignment.resource_id = resource.id
            and (
              assignment.class_id = occurrence.class_id
              or assignment.course_id = occurrence.course_id
            )
        )
      )
  );
$$;

create or replace function private.has_historical_occurrence_assignment(
  p_assignment_id uuid,
  p_user_id uuid
)
returns boolean language sql stable security definer
set search_path = public, private as $$
  select exists (
    select 1
    from public.lms_occurrence_assignments link
    join public.lms_lesson_occurrences occurrence
      on occurrence.id = link.occurrence_id
    join public.club_assignments assignment
      on assignment.id = link.assignment_id
     and assignment.class_id = occurrence.class_id
     and assignment.club_id = occurrence.club_id
    join public.lms_occurrence_roster_snapshots snapshot
      on snapshot.occurrence_id = occurrence.id
     and snapshot.user_id = p_user_id
    where link.assignment_id = p_assignment_id
      and occurrence.published_at is not null
      and occurrence.status <> 'cancelled'
      and occurrence.starts_at <= now()
      and assignment.status = 'active'
  );
$$;

create or replace function private.has_historical_occurrence_resource(
  p_resource_id uuid,
  p_user_id uuid
)
returns boolean language sql stable security definer
set search_path = public, private as $$
  select exists (
    select 1
    from public.lms_occurrence_resources link
    join public.lms_lesson_occurrences occurrence
      on occurrence.id = link.occurrence_id
    join public.lms_resources resource
      on resource.id = link.resource_id
     and resource.club_id = occurrence.club_id
    join public.lms_occurrence_roster_snapshots snapshot
      on snapshot.occurrence_id = occurrence.id
     and snapshot.user_id = p_user_id
    where link.resource_id = p_resource_id
      and occurrence.published_at is not null
      and occurrence.status <> 'cancelled'
      and occurrence.starts_at <= now()
      and private.is_occurrence_resource_in_scope(occurrence.id, resource.id)
  );
$$;

drop policy if exists "LMS occurrence resource scoped reads"
  on public.lms_occurrence_resources;
create policy "LMS occurrence resource scoped reads"
on public.lms_occurrence_resources for select to authenticated
using (
  private.can_view_lms_occurrence(occurrence_id, (select auth.uid()))
  and private.is_occurrence_resource_in_scope(occurrence_id, resource_id)
);

drop policy if exists "LMS occurrence resource manager writes"
  on public.lms_occurrence_resources;
create policy "LMS occurrence resource manager writes"
on public.lms_occurrence_resources for all to authenticated
using (
  exists (
    select 1
    from public.lms_lesson_occurrences occurrence
    where occurrence.id = occurrence_id
      and private.can_manage_class(occurrence.class_id, (select auth.uid()))
  )
  and private.is_occurrence_resource_in_scope(occurrence_id, resource_id)
)
with check (
  exists (
    select 1
    from public.lms_lesson_occurrences occurrence
    where occurrence.id = occurrence_id
      and private.can_manage_class(occurrence.class_id, (select auth.uid()))
  )
  and private.is_occurrence_resource_in_scope(occurrence_id, resource_id)
);

drop policy if exists "LMS occurrence assignment scoped reads"
  on public.lms_occurrence_assignments;
create policy "LMS occurrence assignment scoped reads"
on public.lms_occurrence_assignments for select to authenticated
using (
  private.can_view_lms_occurrence(occurrence_id, (select auth.uid()))
  and private.is_occurrence_assignment_in_scope(occurrence_id, assignment_id)
);

drop policy if exists "LMS occurrence assignment manager writes"
  on public.lms_occurrence_assignments;
create policy "LMS occurrence assignment manager writes"
on public.lms_occurrence_assignments for all to authenticated
using (
  exists (
    select 1
    from public.lms_lesson_occurrences occurrence
    where occurrence.id = occurrence_id
      and private.can_manage_class(occurrence.class_id, (select auth.uid()))
  )
  and private.is_occurrence_assignment_in_scope(occurrence_id, assignment_id)
)
with check (
  exists (
    select 1
    from public.lms_lesson_occurrences occurrence
    where occurrence.id = occurrence_id
      and private.can_manage_class(occurrence.class_id, (select auth.uid()))
  )
  and private.is_occurrence_assignment_in_scope(occurrence_id, assignment_id)
);

-- The organization migration intentionally replaced legacy SELECT policies,
-- but class enrollment is itself the learner authorization boundary. Requiring
-- a second organization membership locked normal LMS students out and removed
-- the historical occurrence/attendance path. Restore exact-class access while
-- keeping owners, admins, and assigned teachers class-scoped.
create or replace function private.is_assigned_class_teacher(
  p_class_id uuid,
  p_user_id uuid
)
returns boolean language sql stable security definer
set search_path = public, private, extensions as $$
  select p_user_id is not null
    and not private.is_admin(p_user_id)
    and exists (
      select 1
      from public.class_memberships membership
      join public.classes class_row
        on class_row.id = membership.class_id
      join public.profiles profile
        on profile.id = membership.user_id
       and profile.role = 'teacher'
      where membership.class_id = p_class_id
        and membership.user_id = p_user_id
        and membership.member_role = 'teacher'
        and membership.status = 'active'
        and class_row.teacher_user_id = p_user_id
        and private.organization_role(class_row.club_id, p_user_id)
          in ('owner', 'teacher', 'coach')
        and private.organization_can_manage_class(class_row.id, p_user_id)
    );
$$;

drop policy if exists "Organization exact class reads" on public.classes;
create policy "Organization exact class reads"
on public.classes for select to authenticated
using (
  private.organization_can_manage_class_in_org(
    id,
    club_id,
    (select auth.uid())
  )
  or private.organization_is_active_class_member(id, (select auth.uid()))
);

drop policy if exists "Organization exact membership reads"
  on public.class_memberships;
create policy "Organization exact membership reads"
on public.class_memberships for select to authenticated
using (
  user_id = (select auth.uid())
  or private.organization_can_manage_class(class_id, (select auth.uid()))
);

drop policy if exists "Organization exact course reads"
  on public.class_course_assignments;
create policy "Organization exact course reads"
on public.class_course_assignments for select to authenticated
using (
  private.organization_can_manage_class(class_id, (select auth.uid()))
  or private.organization_is_active_class_member(
    class_id,
    (select auth.uid())
  )
);

drop policy if exists "Organization exact schedule reads"
  on public.class_schedules;
drop policy if exists "Exact class members and managers view schedules"
  on public.class_schedules;
create policy "Exact class members and managers view schedules"
on public.class_schedules for select to authenticated
using (
  private.organization_can_manage_class(class_id, (select auth.uid()))
  or (
    status = 'active'
    and exists (
      select 1
      from public.class_memberships membership
      where membership.class_id = class_schedules.class_id
        and membership.user_id = (select auth.uid())
        and membership.status = 'active'
    )
  )
);

drop policy if exists "Organization exact assignment reads"
  on public.club_assignments;
create policy "Organization exact assignment reads"
on public.club_assignments for select to authenticated
using (
  (
    class_id is null
    and private.organization_can_admin(club_id, (select auth.uid()))
  )
  or (
    class_id is not null
    and (
      private.organization_can_manage_class(class_id, (select auth.uid()))
      or (
        status = 'active'
        and private.organization_is_active_class_member(
          class_id,
          (select auth.uid())
        )
      )
      or private.has_historical_occurrence_assignment(
        id,
        (select auth.uid())
      )
    )
  )
);

drop policy if exists "Organization exact attendance session reads"
  on public.class_attendance_sessions;
create policy "Organization exact attendance session reads"
on public.class_attendance_sessions for select to authenticated
using (
  private.organization_can_manage_class(class_id, (select auth.uid()))
  or private.can_view_attendance_session(id, (select auth.uid()))
);

drop policy if exists "Organization exact attendance record reads"
  on public.class_attendance_records;
create policy "Organization exact attendance record reads"
on public.class_attendance_records for select to authenticated
using (
  exists (
    select 1
    from public.class_attendance_sessions session_row
    where session_row.id = class_attendance_records.session_id
      and (
        private.organization_can_manage_class(
          session_row.class_id,
          (select auth.uid())
        )
        or (
          class_attendance_records.user_id = (select auth.uid())
          and private.can_view_attendance_session(
            class_attendance_records.session_id,
            (select auth.uid())
          )
        )
      )
  )
);

drop policy if exists "Organization scoped event reads" on public.club_events;
create policy "Organization scoped event reads"
on public.club_events for select to authenticated
using (
  (
    class_id is null
    and private.organization_role(club_id, (select auth.uid())) is not null
  )
  or (
    class_id is not null
    and (
      private.organization_can_manage_class(class_id, (select auth.uid()))
      or private.organization_is_active_class_member(
        class_id,
        (select auth.uid())
      )
    )
  )
);

revoke all on function private.is_occurrence_assignment_in_scope(uuid, uuid),
  private.is_occurrence_resource_in_scope(uuid, uuid),
  private.is_assigned_class_teacher(uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.is_occurrence_assignment_in_scope(uuid, uuid),
  private.is_occurrence_resource_in_scope(uuid, uuid),
  private.is_assigned_class_teacher(uuid, uuid)
  to authenticated, service_role;

commit;
