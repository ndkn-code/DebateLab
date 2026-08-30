-- Class/cohort manager authorization and IELTS assignment integrity.
-- Owners manage all classes in their club; coaches must be active teacher
-- members of the specific class. Platform admins retain global access.

begin;

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
      join public.club_memberships cm on cm.club_id = c.club_id
      where c.id = p_class_id
        and c.club_id is not null
        and cm.user_id = p_user_id
        and cm.status = 'active'
        and (
          cm.role = 'owner'
          or (
            cm.role = 'coach'
            and exists (
              select 1
              from public.profiles coach_profile
              where coach_profile.id = p_user_id
                and coach_profile.role = 'teacher'
            )
            and exists (
              select 1
              from public.class_memberships teacher_membership
              where teacher_membership.class_id = c.id
                and teacher_membership.user_id = p_user_id
                and teacher_membership.member_role = 'teacher'
                and teacher_membership.status = 'active'
            )
          )
        )
    )
  );
$$;

create or replace function private.can_manage_new_class(p_club_id uuid, p_user_id uuid)
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
      from public.club_memberships cm
      where cm.club_id = p_club_id
        and cm.user_id = p_user_id
        and cm.role = 'owner'
        and cm.status = 'active'
    )
  );
$$;

revoke all on function private.can_manage_class(uuid, uuid) from public;
revoke all on function private.can_manage_new_class(uuid, uuid) from public;
grant execute on function private.can_manage_class(uuid, uuid) to authenticated;
grant execute on function private.can_manage_new_class(uuid, uuid) to authenticated;

-- A coach cannot move a class between organizations. Service-role jobs are
-- trusted and have no auth.uid(); normal requests are checked here as well as
-- by RLS.
create or replace function private.prevent_class_cross_club_move()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if tg_op = 'UPDATE'
     and new.club_id is distinct from old.club_id
     and auth.uid() is not null
     and not private.is_admin(auth.uid()) then
    raise exception 'Class organization cannot be changed by a non-admin';
  end if;
  return new;
end;
$$;

drop trigger if exists classes_prevent_cross_club_move on public.classes;
create trigger classes_prevent_cross_club_move
before update on public.classes
for each row execute function private.prevent_class_cross_club_move();

-- Keep the legacy teacher_user_id projection consistent with the canonical
-- class_memberships teacher row. This protects direct class updates as well as
-- the owner-only teacher assignment action.
create or replace function private.enforce_class_teacher_membership()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
  if new.teacher_user_id is not null
     and not exists (
       select 1
       from public.class_memberships cm
       where cm.class_id = new.id
         and cm.user_id = new.teacher_user_id
         and cm.member_role = 'teacher'
         and cm.status = 'active'
     ) then
    raise exception 'Class teacher must have an active teacher membership';
  end if;
  return new;
end;
$$;

drop trigger if exists classes_enforce_teacher_membership on public.classes;
create trigger classes_enforce_teacher_membership
before insert or update of teacher_user_id on public.classes
for each row execute function private.enforce_class_teacher_membership();

-- Enforce class capacity under concurrent activations. The advisory lock is
-- transaction-scoped and serializes activations for one class only.
create or replace function private.enforce_class_capacity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  capacity integer;
  active_students integer;
begin
  if new.member_role = 'student' and new.status = 'active' then
    perform pg_advisory_xact_lock(hashtextextended(new.class_id::text, 0));
    select max_students into capacity from public.classes where id = new.class_id;
    if capacity is not null then
      select count(*)::integer into active_students
      from public.class_memberships
      where class_id = new.class_id
        and member_role = 'student'
        and status = 'active'
        and id <> new.id;
      if active_students >= capacity then
        raise exception 'Class is at capacity';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists class_memberships_enforce_capacity on public.class_memberships;
create trigger class_memberships_enforce_capacity
before insert or update of class_id, member_role, status on public.class_memberships
for each row execute function private.enforce_class_capacity();

-- A teacher membership is a real authorization grant, so it must point to a
-- teacher/admin profile who is an active manager of the class's club. Student
-- roster rows likewise cannot be forged for another profile role.
create or replace function private.enforce_class_membership_role_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  profile_role text;
  class_club uuid;
begin
  select role into profile_role from public.profiles where id = new.user_id;
  if profile_role is null then raise exception 'Class member profile not found'; end if;

  if new.member_role = 'student' and profile_role <> 'student' then
    raise exception 'Student class membership requires a student profile';
  end if;

  if new.member_role = 'teacher' and new.status = 'active' then
    if profile_role not in ('teacher', 'admin') then
      raise exception 'Active teacher membership requires a teacher profile';
    end if;
    select club_id into class_club from public.classes where id = new.class_id;
    if class_club is null then
      raise exception 'Global classes cannot assign club teachers';
    end if;
    if profile_role <> 'admin' and not exists (
      select 1
      from public.club_memberships cm
      where cm.club_id = class_club
        and cm.user_id = new.user_id
        and cm.status = 'active'
        and cm.role in ('owner', 'coach')
    ) then
      raise exception 'Teacher must be an active manager of the class club';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists class_memberships_enforce_role_integrity on public.class_memberships;
create trigger class_memberships_enforce_role_integrity
before insert or update of class_id, user_id, member_role, status
on public.class_memberships
for each row execute function private.enforce_class_membership_role_integrity();

-- A class course assignment cannot attach IELTS content to a non-IELTS class.
create or replace function private.enforce_class_course_subject()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  class_program text;
  course_subject text;
begin
  select program_type into class_program from public.classes where id = new.class_id;
  select subject into course_subject from public.courses where id = new.course_id;
  if class_program is null then raise exception 'Class not found'; end if;
  if course_subject is null then raise exception 'Course not found'; end if;
  if course_subject = 'ielts' and class_program <> 'ielts' then
    raise exception 'IELTS courses can only be assigned to IELTS classes';
  end if;
  return new;
end;
$$;

drop trigger if exists class_course_assignments_enforce_subject on public.class_course_assignments;
create trigger class_course_assignments_enforce_subject
before insert or update of class_id, course_id on public.class_course_assignments
for each row execute function private.enforce_class_course_subject();

-- IELTS mock assignments must be attached to an IELTS class in the same club.
-- The application validates this too, but the trigger protects direct writes
-- and keeps assignment creation atomic with its class taxonomy.
create or replace function private.enforce_ielts_assignment_integrity()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  class_club uuid;
  class_program text;
begin
  if new.assignment_type = 'ielts_mock' then
    if new.class_id is null or new.ielts_test_id is null then
      raise exception 'IELTS mock assignments require a class and test';
    end if;
    select club_id, program_type
      into class_club, class_program
    from public.classes
    where id = new.class_id;
    if class_club is null or class_club <> new.club_id or class_program <> 'ielts' then
      raise exception 'IELTS mock assignments require an IELTS class in the same club';
    end if;
  elsif new.ielts_test_id is not null then
    raise exception 'Only IELTS mock assignments may reference an IELTS test';
  end if;
  return new;
end;
$$;

drop trigger if exists club_assignments_enforce_ielts_integrity on public.club_assignments;
create trigger club_assignments_enforce_ielts_integrity
before insert or update of assignment_type, class_id, club_id, ielts_test_id
on public.club_assignments
for each row execute function private.enforce_ielts_assignment_integrity();

-- Keep attendance rows tied to a student who belonged to the class for the
-- session date, including historical rows after a student is removed.
create or replace function private.enforce_attendance_roster_membership()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  session_class uuid;
  session_date date;
begin
  select class_id, class_attendance_sessions.session_date
    into session_class, session_date
  from public.class_attendance_sessions
  where id = new.session_id;
  if session_class is null then raise exception 'Attendance session not found'; end if;
  if not exists (
    select 1
    from public.class_memberships cm
    where cm.class_id = session_class
      and cm.user_id = new.user_id
      and cm.member_role = 'student'
      and cm.joined_at::date <= session_date
      and (
        cm.status = 'active'
        or (cm.status = 'removed' and cm.removed_at is not null and cm.removed_at::date >= session_date)
      )
  ) then
    raise exception 'Attendance user was not enrolled in this class on the session date';
  end if;
  return new;
end;
$$;

drop trigger if exists class_attendance_records_enforce_roster on public.class_attendance_records;
create trigger class_attendance_records_enforce_roster
before insert or update of session_id, user_id on public.class_attendance_records
for each row execute function private.enforce_attendance_roster_membership();

-- The generic Club OS policies are intentionally narrowed for class-bound rows.
drop policy if exists "Classes insertable by admins and club managers" on public.classes;
drop policy if exists "Classes insertable by admins and club owners" on public.classes;
create policy "Classes insertable by admins and club owners"
  on public.classes for insert
  to authenticated
  with check (private.can_manage_new_class(club_id, (select auth.uid())));

drop policy if exists "Classes updatable by admins and club managers" on public.classes;
drop policy if exists "Classes updatable by admins, owners, and assigned coaches" on public.classes;
create policy "Classes updatable by admins, owners, and assigned coaches"
  on public.classes for update
  to authenticated
  using (private.can_manage_class(id, (select auth.uid())))
  with check (private.can_manage_class(id, (select auth.uid())));

drop policy if exists "Classes deletable by admins and club managers" on public.classes;
drop policy if exists "Classes deletable by admins, owners, and assigned coaches" on public.classes;
create policy "Classes deletable by admins, owners, and assigned coaches"
  on public.classes for delete
  to authenticated
  using (private.can_manage_class(id, (select auth.uid())));

create or replace function private.can_manage_class_assignment(
  p_class_id uuid,
  p_club_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, private
as $$
  select p_class_id is null
    and (
      private.is_admin(p_user_id)
      or exists (
        select 1 from public.club_memberships cm
        where cm.club_id = p_club_id and cm.user_id = p_user_id
          and cm.role = 'owner' and cm.status = 'active'
      )
    )
    or p_class_id is not null
    and exists (
      select 1 from public.classes c
      where c.id = p_class_id
        and c.club_id = p_club_id
        and private.can_manage_class(c.id, p_user_id)
    );
$$;

revoke all on function private.can_manage_class_assignment(uuid, uuid, uuid) from public;
grant execute on function private.can_manage_class_assignment(uuid, uuid, uuid) to authenticated;

-- Trigger helpers are internal enforcement boundaries, not callable APIs.
revoke all on function private.prevent_class_cross_club_move() from public;
revoke all on function private.enforce_class_teacher_membership() from public;
revoke all on function private.enforce_class_capacity() from public;
revoke all on function private.enforce_class_membership_role_integrity() from public;
revoke all on function private.enforce_class_course_subject() from public;
revoke all on function private.enforce_ielts_assignment_integrity() from public;
revoke all on function private.enforce_attendance_roster_membership() from public;

drop policy if exists "Club members can view assignments" on public.club_assignments;
create policy "Club members can view assignments"
  on public.club_assignments for select
  using (
    (
      class_id is null
      and private.can_view_club(club_id, (select auth.uid()))
    )
    or (
      class_id is not null
      and exists (
        select 1
        from public.classes c
        where c.id = club_assignments.class_id
          and c.club_id = club_assignments.club_id
      )
      and private.can_view_class(class_id, (select auth.uid()))
    )
  );

drop policy if exists "Club managers can insert assignments" on public.club_assignments;
create policy "Club managers can insert assignments"
  on public.club_assignments for insert
  with check (private.can_manage_class_assignment(class_id, club_id, (select auth.uid())));

drop policy if exists "Club managers can update assignments" on public.club_assignments;
create policy "Club managers can update assignments"
  on public.club_assignments for update
  using (private.can_manage_class_assignment(class_id, club_id, (select auth.uid())))
  with check (private.can_manage_class_assignment(class_id, club_id, (select auth.uid())));

drop policy if exists "Club managers can delete assignments" on public.club_assignments;
create policy "Club managers can delete assignments"
  on public.club_assignments for delete
  using (private.can_manage_class_assignment(class_id, club_id, (select auth.uid())));

-- Permit class managers to write the existing admin audit stream. The log is
-- still readable only by platform admins; class actions use entity_type=class.
drop policy if exists "Admins can insert admin activity log" on public.admin_activity_log;
drop policy if exists "Admins and class managers can insert admin activity log" on public.admin_activity_log;
create policy "Admins and class managers can insert admin activity log"
  on public.admin_activity_log for insert
  with check (
    private.is_admin((select auth.uid()))
    or (entity_type = 'class' and private.can_manage_class(entity_id, (select auth.uid())))
  );

-- A coach's class scope must also apply to IELTS teacher reporting rows.
drop policy if exists "Class managers view IELTS assignment attempts" on public.ielts_attempts;
create policy "Class managers view IELTS assignment attempts"
  on public.ielts_attempts
  for select
  using (
    (class_id is not null and private.can_manage_class(class_id, (select auth.uid())))
    or (class_id is null and club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
  );

drop policy if exists "Class managers view IELTS assignment band scores" on public.attempt_band_scores;
create policy "Class managers view IELTS assignment band scores"
  on public.attempt_band_scores
  for select
  using (
    exists (
      select 1
      from public.ielts_attempts a
      where a.id = attempt_band_scores.attempt_id
        and (
          (a.class_id is not null and private.can_manage_class(a.class_id, (select auth.uid())))
          or (a.class_id is null and a.club_id is not null and private.can_manage_club(a.club_id, (select auth.uid())))
        )
    )
  );

commit;
