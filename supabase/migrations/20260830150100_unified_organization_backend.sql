-- Unified organization backend.
--
-- This is intentionally additive.  `clubs`, `club_type`, the legacy role
-- values, and compatibility views remain available while the organization
-- RPCs become the only authenticated write boundary.

begin;

alter table public.clubs
  add column if not exists organization_type text,
  add column if not exists setup_version integer not null default 1,
  add column if not exists setup_completed_at timestamptz,
  add column if not exists onboarding_completed_at timestamptz;

update public.clubs
set organization_type = case
  when lower(btrim(coalesce(club_type, ''))) in ('school', 'center') then 'school'
  else 'club'
end
where organization_type is null
   or organization_type not in ('club', 'school');

alter table public.clubs
  alter column organization_type set default 'club',
  alter column organization_type set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.clubs'::regclass
      and conname = 'clubs_organization_type_check'
  ) then
    alter table public.clubs add constraint clubs_organization_type_check
      check (organization_type in ('club', 'school'));
  end if;
end;
$$;

-- Canonical roles are accepted immediately.  `coach` remains valid for old
-- integrations and is normalized to teacher by application compatibility
-- code; only rows whose profile is already teacher/admin are backfilled.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.club_memberships'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%role%'
  loop
    execute format('alter table public.club_memberships drop constraint %I', c.conname);
  end loop;
  alter table public.club_memberships add constraint club_memberships_role_check
    check (role in ('owner', 'admin', 'teacher', 'coach', 'student'));
end;
$$;

update public.club_memberships cm
set role = 'teacher', updated_at = now()
from public.profiles p
where cm.user_id = p.id
  and cm.role = 'coach'
  and p.role in ('teacher', 'admin');

do $$
declare c record;
begin
  if to_regclass('public.club_invitations') is not null then
    for c in
      select conname
      from pg_constraint
      where conrelid = 'public.club_invitations'::regclass
        and contype = 'c'
        and pg_get_constraintdef(oid) like '%role%'
    loop
      execute format('alter table public.club_invitations drop constraint %I', c.conname);
    end loop;
    alter table public.club_invitations add constraint club_invitations_role_check
      check (role in ('owner', 'admin', 'teacher', 'coach', 'student'));
  end if;
end;
$$;

create table if not exists public.organization_operation_idempotency (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  response_payload jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (actor_id, operation, idempotency_key),
  constraint organization_idempotency_key_length
    check (char_length(idempotency_key) between 8 and 128)
);

create table if not exists public.organization_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.clubs(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create index if not exists organization_audit_events_org_created_idx
  on public.organization_audit_events(organization_id, created_at desc, id desc);
create index if not exists organization_operation_idempotency_actor_idx
  on public.organization_operation_idempotency(actor_id, created_at desc);

create or replace function private.organization_idempotency_lookup(
  p_actor_id uuid, p_operation text, p_idempotency_key text, p_request_hash text
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare row_value public.organization_operation_idempotency%rowtype;
begin
  select * into row_value from public.organization_operation_idempotency
  where actor_id = p_actor_id and operation = p_operation and idempotency_key = p_idempotency_key
  for update;
  if not found then return null; end if;
  if row_value.request_hash is distinct from p_request_hash then
    raise exception 'IDEMPOTENCY_KEY_REUSE';
  end if;
  return row_value.response_payload;
end;
$$;
revoke all on function private.organization_idempotency_lookup(uuid, text, text, text) from public, anon, authenticated;

alter table public.organization_operation_idempotency enable row level security;
alter table public.organization_audit_events enable row level security;
revoke all on public.organization_operation_idempotency from anon, authenticated;
revoke all on public.organization_audit_events from anon, authenticated;
grant select on public.organization_audit_events to authenticated;

create or replace function private.organization_is_admin(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, private, extensions
as $$
  select p_user_id is not null and exists (
    select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin'
  );
$$;

create or replace function private.organization_role(p_organization_id uuid, p_user_id uuid)
returns text
language sql stable security definer
set search_path = public, private, extensions
as $$
  select cm.role
  from public.club_memberships cm
  where cm.club_id = p_organization_id
    and cm.user_id = p_user_id
    and cm.status = 'active'
  order by case cm.role when 'owner' then 1 when 'admin' then 2 when 'teacher' then 3 when 'coach' then 4 else 5 end
  limit 1;
$$;

create or replace function private.organization_can_admin(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, private, extensions
as $$
  select private.organization_is_admin(p_user_id)
    or private.organization_role(p_organization_id, p_user_id) in ('owner', 'admin');
$$;

create or replace function private.organization_is_owner(p_organization_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, private, extensions
as $$
  select private.organization_is_admin(p_user_id)
    or private.organization_role(p_organization_id, p_user_id) = 'owner';
$$;

create or replace function private.organization_can_manage_class(p_class_id uuid, p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = public, private, extensions
as $$
  select p_user_id is not null and exists (
    select 1
    from public.classes c
    where c.id = p_class_id
      and (
        private.organization_is_admin(p_user_id)
        or private.organization_role(c.club_id, p_user_id) in ('owner', 'admin')
        or (
          private.organization_role(c.club_id, p_user_id) in ('teacher', 'coach')
          and exists (
            select 1 from public.profiles p
            where p.id = p_user_id and p.role = 'teacher'
          )
          and exists (
            select 1 from public.class_memberships cm
            where cm.class_id = c.id and cm.user_id = p_user_id
              and cm.member_role = 'teacher' and cm.status = 'active'
          )
        )
      )
  );
$$;

create or replace function private.organization_can_manage_class_in_org(
  p_class_id uuid, p_organization_id uuid, p_user_id uuid
)
returns boolean
language sql stable security definer
set search_path = public, private, extensions
as $$
  select p_user_id is not null and (
    private.organization_is_admin(p_user_id)
    or private.organization_role(p_organization_id, p_user_id) in ('owner', 'admin')
    or (
      private.organization_role(p_organization_id, p_user_id) in ('teacher', 'coach')
      and exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'teacher')
      and exists (
        select 1 from public.class_memberships cm
        where cm.class_id = p_class_id and cm.user_id = p_user_id
          and cm.member_role = 'teacher' and cm.status = 'active'
      )
    )
  );
$$;

create or replace function private.organization_is_active_class_member(
  p_class_id uuid, p_user_id uuid
)
returns boolean
language sql stable security definer
set search_path = public, private, extensions
as $$
  select p_user_id is not null and exists (
    select 1 from public.class_memberships cm
    where cm.class_id = p_class_id and cm.user_id = p_user_id and cm.status = 'active'
  );
$$;

revoke all on function private.organization_is_admin(uuid) from public, anon;
revoke all on function private.organization_role(uuid, uuid) from public, anon;
revoke all on function private.organization_can_admin(uuid, uuid) from public, anon;
revoke all on function private.organization_is_owner(uuid, uuid) from public, anon;
revoke all on function private.organization_can_manage_class(uuid, uuid) from public, anon;
revoke all on function private.organization_can_manage_class_in_org(uuid, uuid, uuid) from public, anon;
revoke all on function private.organization_is_active_class_member(uuid, uuid) from public, anon;
grant execute on function private.organization_is_admin(uuid) to authenticated;
grant execute on function private.organization_role(uuid, uuid) to authenticated;
grant execute on function private.organization_can_admin(uuid, uuid) to authenticated;
grant execute on function private.organization_is_owner(uuid, uuid) to authenticated;
grant execute on function private.organization_can_manage_class(uuid, uuid) to authenticated;
grant execute on function private.organization_can_manage_class_in_org(uuid, uuid, uuid) to authenticated;
grant execute on function private.organization_is_active_class_member(uuid, uuid) to authenticated;

drop policy if exists "Organization managers read audit events" on public.organization_audit_events;
create policy "Organization managers read audit events"
on public.organization_audit_events for select to authenticated
using (private.organization_can_admin(organization_id, (select auth.uid())));

create or replace function private.prevent_organization_audit_mutation()
returns trigger language plpgsql security definer
set search_path = public, private, extensions
as $$
begin
  raise exception 'ORGANIZATION_AUDIT_IMMUTABLE' using errcode = '42501';
end;
$$;
drop trigger if exists organization_audit_events_immutable on public.organization_audit_events;
create trigger organization_audit_events_immutable
before update or delete on public.organization_audit_events
for each row execute function private.prevent_organization_audit_mutation();
revoke all on function private.prevent_organization_audit_mutation() from public, anon, authenticated;

-- Replace the legacy Club OS helpers at their shared boundary.  A teacher's
-- authorization is exact-class and an organization teacher cannot manage
-- organization-wide writes (the old `coach` value remains accepted).
create or replace function private.can_manage_club(p_club_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private, extensions as $$
  select p_user_id is not null and (
    private.organization_is_admin(p_user_id)
    or private.organization_role(p_club_id, p_user_id) in ('owner', 'admin')
  );
$$;
create or replace function private.can_manage_new_class(p_club_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private, extensions as $$
  select private.can_manage_club(p_club_id, p_user_id);
$$;
create or replace function private.can_manage_class(p_class_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private, extensions as $$
  select private.organization_can_manage_class(p_class_id, p_user_id);
$$;
create or replace function private.is_assigned_class_teacher(p_class_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public, private, extensions as $$
  select p_user_id is not null and exists (
    select 1 from public.classes c
    join public.class_memberships cm on cm.class_id = c.id and cm.user_id = p_user_id
      and cm.member_role = 'teacher' and cm.status = 'active'
    where c.id = p_class_id
      and private.organization_role(c.club_id, p_user_id) in ('owner', 'admin', 'teacher', 'coach')
      and exists (select 1 from public.profiles p where p.id = p_user_id and p.role in ('teacher', 'admin'))
  );
$$;
revoke all on function private.can_manage_club(uuid, uuid), private.can_manage_new_class(uuid, uuid), private.can_manage_class(uuid, uuid), private.is_assigned_class_teacher(uuid, uuid) from public, anon;
grant execute on function private.can_manage_club(uuid, uuid), private.can_manage_new_class(uuid, uuid), private.can_manage_class(uuid, uuid), private.is_assigned_class_teacher(uuid, uuid) to authenticated;

-- Profiles are self-readable/updatable in the legacy schema.  Preserve that
-- UX while making role escalation impossible for a non-admin session.
create or replace function private.prevent_profile_role_escalation()
returns trigger
language plpgsql security definer
set search_path = public, private, extensions
as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not private.organization_is_admin(auth.uid())
     and coalesce(current_setting('app.organization_invite_consume', true), '') <> 'on' then
    raise exception 'PROFILE_ROLE_CHANGE_FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
before update of role on public.profiles
for each row execute function private.prevent_profile_role_escalation();
revoke all on function private.prevent_profile_role_escalation() from public, anon, authenticated;

-- Compatibility with the authority-field guard introduced by the shared
-- security hardening stream. Invitation consumption is the only non-admin
-- path allowed to promote an explicitly invited account to teacher.
create or replace function private.prevent_profile_authority_escalation()
returns trigger
language plpgsql security definer
set search_path = public, private, extensions
as $$
begin
  if (new.role is distinct from old.role or lower(new.email) is distinct from lower(old.email))
     and auth.uid() is not null
     and not private.organization_is_admin(auth.uid())
     and coalesce(current_setting('app.organization_invite_consume', true), '') <> 'on' then
    raise exception 'Profile authority fields are server controlled' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.prevent_profile_authority_escalation() from public, anon, authenticated;
drop trigger if exists profiles_prevent_authority_escalation on public.profiles;
create trigger profiles_prevent_authority_escalation
before update of role, email on public.profiles
for each row execute function private.prevent_profile_authority_escalation();

-- Keep the legacy class-membership integrity trigger, but teach it the
-- canonical organization roles. Organization authority and class teaching
-- remain separate: an active organization membership is required before an
-- explicit teacher class assignment can be activated.
create or replace function private.enforce_class_membership_role_integrity()
returns trigger
language plpgsql security definer
set search_path = public, private, extensions
as $$
declare profile_role text; class_club uuid;
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
    if class_club is null then raise exception 'Global classes cannot assign organization teachers'; end if;
    if not exists (
      select 1 from public.club_memberships cm
      where cm.club_id = class_club and cm.user_id = new.user_id
        and cm.status = 'active' and cm.role in ('owner', 'admin', 'teacher', 'coach')
    ) then
      raise exception 'Teacher must be an active member of the class organization';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_class_membership_role_integrity() from public, anon, authenticated;

-- Membership changes cannot grant an owner/admin role to an arbitrary caller,
-- remove the last owner, or silently transfer organization ownership.
create or replace function private.enforce_organization_membership_boundary()
returns trigger
language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); old_owner boolean; actor_owner boolean;
begin
  if uid is null then return new; end if; -- trusted service-role jobs
  if coalesce(current_setting('app.organization_invite_consume', true), '') = 'on' then
    return new;
  end if;
  actor_owner := private.organization_is_owner(new.club_id, uid);
  old_owner := tg_op = 'UPDATE' and old.role = 'owner' and old.status = 'active';
  if old_owner or new.role = 'owner' then
    perform pg_advisory_xact_lock(hashtextextended('organization_owner:' || new.club_id::text, 0));
  end if;
  if new.role in ('owner', 'admin') and not actor_owner and not private.organization_is_admin(uid) then
    raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if old_owner and (new.role <> 'owner' or new.status <> 'active')
     and not actor_owner and not private.organization_is_admin(uid) then
    raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if old_owner and (new.role <> 'owner' or new.status <> 'active')
     and not exists (
       select 1 from public.club_memberships cm
       where cm.club_id = old.club_id and cm.role = 'owner' and cm.status = 'active'
         and cm.id <> old.id
     ) then
    raise exception 'ORGANIZATION_LAST_OWNER';
  end if;
  return new;
end;
$$;
drop trigger if exists club_memberships_organization_boundary on public.club_memberships;
create trigger club_memberships_organization_boundary
before insert or update on public.club_memberships
for each row execute function private.enforce_organization_membership_boundary();
revoke all on function private.enforce_organization_membership_boundary() from public, anon, authenticated;

create or replace function private.enforce_organization_membership_mutation()
returns trigger language plpgsql security definer set search_path = public, private, extensions as $$
declare uid uuid := auth.uid(); org_id uuid := case when tg_op = 'DELETE' then old.club_id else new.club_id end; actor_role text;
begin
  if uid is null then if tg_op = 'DELETE' then return old; else return new; end if; end if;
  if coalesce(current_setting('app.organization_invite_consume', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  actor_role := private.organization_role(org_id, uid);
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and (old.role = 'owner' or new.role = 'owner'))
     or (tg_op = 'INSERT' and new.role = 'owner') then
    perform pg_advisory_xact_lock(hashtextextended('organization_owner:' || org_id::text, 0));
  end if;
  if actor_role in ('teacher', 'coach') then
    raise exception 'ORGANIZATION_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and old.role = 'owner' and old.status = 'active'
     and not exists (select 1 from public.club_memberships cm where cm.club_id = old.club_id and cm.role = 'owner' and cm.status = 'active' and cm.id <> old.id) then
    raise exception 'ORGANIZATION_LAST_OWNER';
  end if;
  if tg_op <> 'DELETE' and new.role in ('owner', 'admin') and actor_role <> 'owner' and not private.organization_is_admin(uid) then
    raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists club_memberships_organization_mutation on public.club_memberships;
create trigger club_memberships_organization_mutation
before insert or update or delete on public.club_memberships
for each row execute function private.enforce_organization_membership_mutation();
revoke all on function private.enforce_organization_membership_mutation() from public, anon, authenticated;

create or replace function private.enforce_organization_invitation_mutation()
returns trigger language plpgsql security definer set search_path = public, private, extensions as $$
declare uid uuid := auth.uid(); org_id uuid := case when tg_op = 'DELETE' then old.club_id else new.club_id end; actor_role text;
begin
  if uid is null then if tg_op = 'DELETE' then return old; else return new; end if; end if;
  actor_role := private.organization_role(org_id, uid);
  if actor_role in ('teacher', 'coach') and coalesce(current_setting('app.organization_invite_consume', true), '') <> 'on' then raise exception 'ORGANIZATION_ADMIN_REQUIRED' using errcode = '42501'; end if;
  if tg_op <> 'DELETE' and new.role in ('owner', 'admin') and actor_role <> 'owner' and not private.organization_is_admin(uid) then
    raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
drop trigger if exists club_invitations_organization_mutation on public.club_invitations;
create trigger club_invitations_organization_mutation
before insert or update or delete on public.club_invitations
for each row execute function private.enforce_organization_invitation_mutation();
revoke all on function private.enforce_organization_invitation_mutation() from public, anon, authenticated;

-- The class pointer and legacy views remain, but their organization scope is
-- enforced in the database for normal authenticated sessions.
create or replace function private.enforce_class_organization_scope()
returns trigger
language plpgsql security definer
set search_path = public, private, extensions
as $$
declare class_club uuid;
begin
  if auth.uid() is null then return new; end if;
  if new.class_id is null then return new; end if;
  select club_id into class_club from public.classes where id = new.class_id;
  if class_club is null then raise exception 'CLASS_NOT_FOUND'; end if;
  if tg_table_name = 'class_memberships' then
    if new.member_role = 'student' and not exists (
      select 1 from public.club_memberships cm
      where cm.club_id = class_club and cm.user_id = new.user_id
        and cm.status = 'active' and cm.role = 'student'
    ) then raise exception 'STUDENT_MUST_JOIN_ORGANIZATION'; end if;
    if new.member_role = 'teacher' and not exists (
      select 1 from public.club_memberships cm
      where cm.club_id = class_club and cm.user_id = new.user_id
        and cm.status = 'active' and cm.role in ('owner', 'admin', 'teacher', 'coach')
    ) then raise exception 'TEACHER_MUST_JOIN_ORGANIZATION'; end if;
  elsif tg_table_name = 'class_schedules' and new.course_id is not null and not exists (
    select 1 from public.class_course_assignments cca
    where cca.class_id = new.class_id and cca.course_id = new.course_id
  ) then raise exception 'COURSE_NOT_ASSIGNED_TO_CLASS';
  elsif tg_table_name = 'class_attendance_sessions' and not exists (
    select 1 from public.class_course_assignments cca
    where cca.class_id = new.class_id and cca.course_id = new.course_id
  ) then raise exception 'COURSE_NOT_ASSIGNED_TO_CLASS';
  end if;
  return new;
end;
$$;
drop trigger if exists class_memberships_organization_scope on public.class_memberships;
create trigger class_memberships_organization_scope
before insert or update of class_id, user_id, member_role, status on public.class_memberships
for each row execute function private.enforce_class_organization_scope();
drop trigger if exists class_schedules_organization_scope on public.class_schedules;
create trigger class_schedules_organization_scope
before insert or update of class_id, course_id on public.class_schedules
for each row execute function private.enforce_class_organization_scope();
drop trigger if exists class_attendance_sessions_organization_scope on public.class_attendance_sessions;
create trigger class_attendance_sessions_organization_scope
before insert or update of class_id, course_id on public.class_attendance_sessions
for each row execute function private.enforce_class_organization_scope();
revoke all on function private.enforce_class_organization_scope() from public, anon, authenticated;

create or replace function private.enforce_class_teacher_update_boundary()
returns trigger language plpgsql security definer set search_path = public, private, extensions as $$
declare uid uuid := auth.uid(); actor_role text;
begin
  if uid is null then return new; end if;
  actor_role := private.organization_role(old.club_id, uid);
  if actor_role in ('teacher', 'coach') and (
    new.club_id is distinct from old.club_id or new.teacher_user_id is distinct from old.teacher_user_id
    or new.program_type is distinct from old.program_type or new.status is distinct from old.status
    or new.max_students is distinct from old.max_students
  ) then raise exception 'TEACHER_SENSITIVE_CLASS_UPDATE_FORBIDDEN' using errcode = '42501'; end if;
  return new;
end;
$$;
drop trigger if exists classes_teacher_update_boundary on public.classes;
create trigger classes_teacher_update_boundary
before update on public.classes for each row execute function private.enforce_class_teacher_update_boundary();
revoke all on function private.enforce_class_teacher_update_boundary() from public, anon, authenticated;

create or replace function private.enforce_club_assignment_organization_scope()
returns trigger
language plpgsql security definer
set search_path = public, private, extensions
as $$
declare class_club uuid;
begin
  if new.class_id is not null then
    select club_id into class_club from public.classes where id = new.class_id;
    if class_club is null or class_club is distinct from new.club_id then
      raise exception 'ASSIGNMENT_ORGANIZATION_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists club_assignments_organization_scope on public.club_assignments;
create trigger club_assignments_organization_scope
before insert or update of club_id, class_id on public.club_assignments
for each row execute function private.enforce_club_assignment_organization_scope();
revoke all on function private.enforce_club_assignment_organization_scope() from public, anon, authenticated;

create or replace function private.enforce_club_event_organization_scope()
returns trigger language plpgsql security definer
set search_path = public, private, extensions
as $$
declare class_club uuid;
begin
  if new.class_id is not null then
    select club_id into class_club from public.classes where id = new.class_id;
    if class_club is null or class_club is distinct from new.club_id then
      raise exception 'EVENT_ORGANIZATION_MISMATCH';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists club_events_organization_scope on public.club_events;
create trigger club_events_organization_scope
before insert or update of club_id, class_id on public.club_events
for each row execute function private.enforce_club_event_organization_scope();
revoke all on function private.enforce_club_event_organization_scope() from public, anon, authenticated;

-- Existing table grants and policy guards remain in place for legacy flows;
-- organization writes below still use SECURITY DEFINER RPCs.  In particular,
-- teacher-scoped policies cannot grant organization-wide membership writes.
grant select on public.clubs, public.club_memberships, public.classes, public.class_memberships,
  public.class_course_assignments to authenticated;

-- Exact-class reads for learners.  Organization owners/admins retain manager
-- reads; a teacher is limited to assigned class rows.
do $$
declare p record; t text;
begin
  foreach t in array array['classes','class_memberships','class_course_assignments','class_schedules','club_assignments','class_attendance_sessions','class_attendance_records'] loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t and cmd = 'SELECT' loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end;
$$;

create policy "Organization exact class reads" on public.classes for select to authenticated
using (
  private.organization_can_manage_class_in_org(id, club_id, (select auth.uid()))
  or (private.organization_role(club_id, (select auth.uid())) is not null
    and private.organization_is_active_class_member(id, (select auth.uid())))
);
create policy "Organization exact membership reads" on public.class_memberships for select to authenticated
using (
  (user_id = (select auth.uid()) and exists (
    select 1 from public.classes c
    where c.id = class_memberships.class_id
      and private.organization_role(c.club_id, (select auth.uid())) is not null
  ))
  or private.organization_can_manage_class(class_id, (select auth.uid()))
);
create policy "Organization exact course reads" on public.class_course_assignments for select to authenticated
using (
  private.organization_can_manage_class(class_id, (select auth.uid()))
  or exists (select 1 from public.class_memberships cm join public.classes c on c.id = cm.class_id where cm.class_id = class_course_assignments.class_id and cm.user_id = (select auth.uid()) and cm.member_role = 'student' and cm.status = 'active' and private.organization_role(c.club_id, (select auth.uid())) is not null)
);
create policy "Organization exact schedule reads" on public.class_schedules for select to authenticated
using (
  private.organization_can_manage_class(class_id, (select auth.uid()))
  or exists (select 1 from public.class_memberships cm join public.classes c on c.id = cm.class_id where cm.class_id = class_schedules.class_id and cm.user_id = (select auth.uid()) and cm.status = 'active' and private.organization_role(c.club_id, (select auth.uid())) is not null)
);
create policy "Organization exact assignment reads" on public.club_assignments for select to authenticated
using (
  (class_id is null and private.organization_can_admin(club_id, (select auth.uid())))
  or (class_id is not null and (private.organization_can_manage_class(class_id, (select auth.uid()))
    or exists (select 1 from public.class_memberships cm join public.classes c on c.id = cm.class_id where cm.class_id = club_assignments.class_id and cm.user_id = (select auth.uid()) and cm.member_role = 'student' and cm.status = 'active' and club_assignments.status = 'active' and private.organization_role(c.club_id, (select auth.uid())) is not null)))
);
create policy "Organization exact attendance session reads" on public.class_attendance_sessions for select to authenticated
using (
  private.organization_can_manage_class(class_id, (select auth.uid()))
  or exists (select 1 from public.class_memberships cm join public.classes c on c.id = cm.class_id where cm.class_id = class_attendance_sessions.class_id and cm.user_id = (select auth.uid()) and cm.status = 'active' and private.organization_role(c.club_id, (select auth.uid())) is not null)
);
create policy "Organization exact attendance record reads" on public.class_attendance_records for select to authenticated
using (exists (
  select 1 from public.class_attendance_sessions s
  where s.id = class_attendance_records.session_id
    and (private.organization_can_manage_class(s.class_id, (select auth.uid()))
      or (class_attendance_records.user_id = (select auth.uid()) and exists (select 1 from public.class_memberships cm join public.classes c on c.id = cm.class_id where cm.class_id = s.class_id and cm.user_id = (select auth.uid()) and cm.status = 'active' and private.organization_role(c.club_id, (select auth.uid())) is not null)))
));

drop policy if exists "Club members can view events" on public.club_events;
create policy "Organization scoped event reads" on public.club_events for select to authenticated
using (
  (class_id is null and private.organization_role(club_id, (select auth.uid())) is not null)
  or (class_id is not null and (
    private.organization_can_manage_class(class_id, (select auth.uid()))
    or exists (
      select 1 from public.class_memberships cm
      where cm.class_id = club_events.class_id and cm.user_id = (select auth.uid())
        and cm.status = 'active'
        and private.organization_role(club_events.club_id, (select auth.uid())) is not null
    )
  ))
);

create or replace function private.organization_audit(
  p_organization_id uuid, p_actor_id uuid, p_action text,
  p_entity_type text, p_entity_id uuid, p_changes jsonb, p_idempotency_key text
)
returns void language plpgsql security definer
set search_path = public, private, extensions
as $$
begin
  insert into public.organization_audit_events
    (organization_id, actor_id, action, entity_type, entity_id, payload, idempotency_key)
  values (p_organization_id, p_actor_id, p_action, p_entity_type, p_entity_id,
    coalesce(p_changes, '{}'::jsonb), p_idempotency_key);
  insert into public.admin_activity_log
    (admin_user_id, action, entity_type, entity_id, changes)
  values (p_actor_id, 'organization_' || p_action, p_entity_type, p_entity_id,
    jsonb_build_object('organization_id', p_organization_id) || coalesce(p_changes, '{}'::jsonb));
end;
$$;
revoke all on function private.organization_audit(uuid, uuid, text, text, uuid, jsonb, text) from public, anon, authenticated;

create or replace function public.create_organization_draft_transaction(
  p_name text, p_organization_type text, p_country text, p_city text,
  p_timezone text, p_code text, p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); org_id uuid; result jsonb; existing jsonb; code_value text; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or not private.organization_is_admin(uid) then raise exception 'FORBIDDEN'; end if;
  if p_organization_type not in ('club', 'school') or nullif(btrim(p_name), '') is null then raise exception 'INVALID_ORGANIZATION_INPUT'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(concat_ws('|', p_name, p_organization_type, p_country, p_city, p_timezone, p_code), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('create_org:' || uid::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'create_organization_draft', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  code_value := coalesce(nullif(btrim(p_code), ''), 'org-' || substr(gen_random_uuid()::text, 1, 8));
  insert into public.clubs (code, name, organization_type, club_type, country, city, timezone, status, owner_user_id)
  values (code_value, btrim(p_name), p_organization_type, case when p_organization_type = 'school' then 'school' else 'independent' end, coalesce(nullif(btrim(p_country), ''), 'VN'), nullif(btrim(p_city), ''), coalesce(nullif(btrim(p_timezone), ''), 'Asia/Ho_Chi_Minh'), 'draft', uid)
  returning id into org_id;
  insert into public.club_memberships (club_id, user_id, role, status, invited_by)
  values (org_id, uid, 'owner', 'active', uid);
  result := jsonb_build_object('organizationId', org_id, 'organization_id', org_id, 'status', 'draft', 'setupVersion', 1, 'setup_version', 1, 'setupCompletedAt', null, 'onboardingCompletedAt', null);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at)
  values (uid, 'create_organization_draft', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(org_id, uid, 'created', 'organization', org_id, jsonb_build_object('organization_type', p_organization_type), p_idempotency_key);
  return result;
end;
$$;

create or replace function public.update_organization_transaction(
  p_organization_id uuid, p_name text, p_organization_type text, p_country text,
  p_city text, p_timezone text, p_logo_url text, p_facebook_url text,
  p_instagram_url text, p_threads_url text, p_setup_version integer,
  p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; request_hash text; current_setup integer;
begin
  if uid is null or p_actor_id is distinct from uid or not private.organization_can_admin(p_organization_id, uid) then raise exception 'FORBIDDEN'; end if;
  if p_organization_type is not null and p_organization_type not in ('club', 'school') then raise exception 'INVALID_ORGANIZATION_TYPE'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(jsonb_build_object(
    'organization_id', p_organization_id, 'name', p_name,
    'organization_type', p_organization_type, 'country', p_country,
    'city', p_city, 'timezone', p_timezone, 'logo_url', p_logo_url,
    'facebook_url', p_facebook_url, 'instagram_url', p_instagram_url,
    'threads_url', p_threads_url, 'setup_version', p_setup_version
  )::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('update_org:' || p_organization_id::text || ':' || uid::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'update_organization', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  select setup_version into current_setup from public.clubs where id = p_organization_id for update;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  if p_setup_version is not null and p_setup_version > current_setup + 1 then
    raise exception 'SETUP_VERSION_CONFLICT' using errcode = '40001';
  end if;
  update public.clubs set
    name = coalesce(nullif(btrim(p_name), ''), name),
    organization_type = coalesce(p_organization_type, organization_type),
    club_type = case when coalesce(p_organization_type, organization_type) = 'school' then 'school' else 'independent' end,
    country = coalesce(nullif(btrim(p_country), ''), country), city = coalesce(nullif(btrim(p_city), ''), city),
    timezone = coalesce(nullif(btrim(p_timezone), ''), timezone),
    logo_url = case when p_logo_url is null then logo_url else p_logo_url end,
    facebook_url = case when p_facebook_url is null then facebook_url else p_facebook_url end,
    instagram_url = case when p_instagram_url is null then instagram_url else p_instagram_url end,
    threads_url = case when p_threads_url is null then threads_url else p_threads_url end,
    setup_version = greatest(setup_version, coalesce(p_setup_version, setup_version)), updated_at = now()
  where id = p_organization_id;
  select jsonb_build_object('organizationId', id, 'organization_id', id, 'status', status, 'setupVersion', setup_version, 'setup_version', setup_version, 'setupCompletedAt', setup_completed_at, 'onboardingCompletedAt', onboarding_completed_at) into result from public.clubs where id = p_organization_id;
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'update_organization', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(p_organization_id, uid, 'updated', 'organization', p_organization_id, jsonb_build_object('setup_version', p_setup_version), p_idempotency_key);
  return result;
end;
$$;

create or replace function public.invite_organization_member_transaction(
  p_organization_id uuid, p_email text, p_role text, p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; invitation public.club_invitations%rowtype; inv_id uuid; request_hash text; raw_token text;
begin
  if uid is null or p_actor_id is distinct from uid or p_role not in ('owner', 'admin', 'teacher', 'student') then raise exception 'INVALID_INVITATION_INPUT'; end if;
  if p_role in ('owner', 'admin') then
    if not private.organization_is_owner(p_organization_id, uid) then raise exception 'OWNER_REQUIRED'; end if;
  elsif not private.organization_can_admin(p_organization_id, uid) then raise exception 'ADMIN_REQUIRED'; end if;
  if nullif(btrim(p_idempotency_key), '') is null or nullif(btrim(p_email), '') is null then raise exception 'INVALID_INVITATION_INPUT'; end if;
  request_hash := encode(digest(concat_ws('|', p_organization_id, lower(btrim(p_email)), p_role), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('invite_org:' || p_organization_id::text || ':' || lower(btrim(p_email)) || ':' || p_role, 0));
  existing := private.organization_idempotency_lookup(uid, 'invite_organization_member', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  raw_token := encode(gen_random_bytes(32), 'hex');
  select * into invitation from public.club_invitations where club_id = p_organization_id and lower(email) = lower(btrim(p_email)) and role = p_role and status = 'pending' for update;
  if found then
    inv_id := invitation.id;
    update public.club_invitations
    set token_hash = encode(digest(raw_token, 'sha256'), 'hex'),
        expires_at = now() + interval '14 days', invited_by = uid, updated_at = now()
    where id = inv_id
    returning * into invitation;
  else
    insert into public.club_invitations (club_id, email, role, token_hash, invited_by)
    values (p_organization_id, lower(btrim(p_email)), p_role, encode(digest(raw_token, 'sha256'), 'hex'), uid)
    returning * into invitation;
    inv_id := invitation.id;
  end if;
  result := jsonb_build_object('invitationId', inv_id, 'invitation_id', inv_id, 'organizationId', p_organization_id, 'organization_id', p_organization_id, 'email', lower(btrim(p_email)), 'role', p_role, 'status', 'pending', 'expiresAt', invitation.expires_at, 'expires_at', invitation.expires_at, 'deliveryToken', raw_token);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'invite_organization_member', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(p_organization_id, uid, 'member_invited', 'invitation', inv_id, jsonb_build_object('email_sha256', encode(digest(lower(btrim(p_email)), 'sha256'), 'hex'), 'role', p_role), p_idempotency_key);
  return result;
end;
$$;

create or replace function public.activate_organization_transaction(
  p_organization_id uuid, p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or not private.organization_can_admin(p_organization_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(p_organization_id::text, 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('activate_org:' || p_organization_id::text || ':' || uid::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'activate_organization', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  update public.clubs set status = 'active', setup_version = greatest(setup_version, 5), setup_completed_at = coalesce(setup_completed_at, now()), onboarding_completed_at = coalesce(onboarding_completed_at, now()), updated_at = now() where id = p_organization_id;
  if not found then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  select jsonb_build_object('organizationId', id, 'organization_id', id, 'status', status, 'setupVersion', setup_version, 'setup_version', setup_version, 'setupCompletedAt', setup_completed_at, 'onboardingCompletedAt', onboarding_completed_at) into result from public.clubs where id = p_organization_id;
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'activate_organization', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(p_organization_id, uid, 'activated', 'organization', p_organization_id, '{}'::jsonb, p_idempotency_key);
  return result;
end;
$$;

create or replace function public.create_organization_class_transaction(
  p_organization_id uuid, p_club_id uuid, p_code text, p_title text, p_description text,
  p_program_type text, p_grade_level text, p_status text, p_start_date date, p_end_date date,
  p_meeting_schedule text, p_room text, p_max_students integer, p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; class_id uuid; code_value text; request_hash text; org_id uuid := coalesce(p_organization_id, p_club_id);
begin
  if uid is null or p_actor_id is distinct from uid or org_id is null or p_club_id is distinct from org_id or not private.organization_can_admin(org_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_title), '') is null or coalesce(p_program_type, 'debate') not in ('debate', 'ielts', 'public_speaking') or coalesce(p_status, 'draft') not in ('draft', 'active', 'archived') then raise exception 'INVALID_CLASS_INPUT'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(concat_ws('|', org_id, p_code, p_title, p_description, p_program_type, p_grade_level, p_status, p_start_date, p_end_date, p_meeting_schedule, p_room, p_max_students), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('create_class:' || org_id::text || ':' || uid::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'create_organization_class', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  if not exists (select 1 from public.clubs where id = org_id) then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  code_value := coalesce(nullif(btrim(p_code), ''), 'class-' || substr(gen_random_uuid()::text, 1, 8));
  insert into public.classes (club_id, code, title, description, program_type, grade_level, status, start_date, end_date, meeting_schedule, room, max_students, created_by)
  values (org_id, code_value, btrim(p_title), p_description, coalesce(p_program_type, 'debate'), p_grade_level, coalesce(p_status, 'draft'), p_start_date, p_end_date, p_meeting_schedule, p_room, p_max_students, uid)
  returning id into class_id;
  result := jsonb_build_object('classId', class_id, 'class_id', class_id, 'organizationId', org_id, 'organization_id', org_id);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'create_organization_class', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(org_id, uid, 'class_created', 'class', class_id, jsonb_build_object('title', btrim(p_title)), p_idempotency_key);
  return result;
end;
$$;

create or replace function public.assign_organization_teacher_transaction(
  p_organization_id uuid, p_class_id uuid, p_teacher_id uuid, p_action text,
  p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; org_id uuid; role_value text; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or p_action <> 'add' or not private.organization_can_admin(p_organization_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(concat_ws('|', p_organization_id, p_class_id, p_teacher_id, p_action), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('assign_teacher:' || p_class_id::text || ':' || p_teacher_id::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'assign_organization_teacher', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  select club_id into org_id from public.classes where id = p_class_id for update;
  if org_id is null or org_id is distinct from p_organization_id then raise exception 'CLASS_ORGANIZATION_MISMATCH'; end if;
  select role into role_value from public.profiles where id = p_teacher_id;
  if role_value not in ('teacher', 'admin') or (role_value <> 'admin' and not exists (select 1 from public.club_memberships cm where cm.club_id = org_id and cm.user_id = p_teacher_id and cm.status = 'active' and cm.role in ('owner', 'admin', 'teacher', 'coach'))) then raise exception 'TEACHER_MUST_JOIN_ORGANIZATION'; end if;
  insert into public.class_memberships (class_id, user_id, member_role, status, created_by, updated_at) values (p_class_id, p_teacher_id, 'teacher', 'active', uid, now()) on conflict (class_id, user_id, member_role) do update set status = 'active', removed_at = null, updated_at = now();
  update public.classes set teacher_user_id = p_teacher_id, updated_at = now() where id = p_class_id;
  result := jsonb_build_object('classId', p_class_id, 'class_id', p_class_id, 'resourceId', p_teacher_id, 'resource_id', p_teacher_id, 'organizationId', org_id, 'organization_id', org_id);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'assign_organization_teacher', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(org_id, uid, 'teacher_assigned', 'class', p_class_id, jsonb_build_object('teacher_id', p_teacher_id), p_idempotency_key);
  return result;
end;
$$;

create or replace function public.assign_organization_course_transaction(
  p_organization_id uuid, p_class_id uuid, p_course_id uuid, p_action text,
  p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or p_action <> 'assign' or not private.organization_can_admin(p_organization_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(concat_ws('|', p_organization_id, p_class_id, p_course_id, p_action), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('assign_course:' || p_class_id::text || ':' || p_course_id::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'assign_organization_course', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  if not exists (select 1 from public.classes where id = p_class_id and club_id = p_organization_id) then raise exception 'CLASS_ORGANIZATION_MISMATCH'; end if;
  if not exists (select 1 from public.courses where id = p_course_id) then raise exception 'COURSE_NOT_FOUND'; end if;
  insert into public.class_course_assignments (class_id, course_id, assigned_by) values (p_class_id, p_course_id, uid) on conflict (class_id, course_id) do update set assigned_by = excluded.assigned_by;
  result := jsonb_build_object('classId', p_class_id, 'class_id', p_class_id, 'resourceId', p_course_id, 'resource_id', p_course_id, 'organizationId', p_organization_id, 'organization_id', p_organization_id);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'assign_organization_course', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(p_organization_id, uid, 'course_assigned', 'class', p_class_id, jsonb_build_object('course_id', p_course_id), p_idempotency_key);
  return result;
end;
$$;

create or replace function public.assign_organization_material_transaction(
  p_organization_id uuid, p_class_id uuid, p_material_id uuid, p_idempotency_key text, p_actor_id uuid
)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; existing jsonb; version_id uuid; placement_id uuid; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or not private.organization_can_admin(p_organization_id, uid) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
  request_hash := encode(digest(concat_ws('|', p_organization_id, p_class_id, p_material_id), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('assign_material:' || p_class_id::text || ':' || p_material_id::text || ':' || p_idempotency_key, 0));
  existing := private.organization_idempotency_lookup(uid, 'assign_organization_material', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  if not exists (select 1 from public.classes where id = p_class_id and club_id = p_organization_id) then raise exception 'CLASS_ORGANIZATION_MISMATCH'; end if;
  if not exists (select 1 from public.lms_materials where id = p_material_id and club_id = p_organization_id) then raise exception 'MATERIAL_NOT_FOUND'; end if;
  select id into version_id
  from public.lms_material_versions
  where material_id = p_material_id and processing_status = 'ready'
  order by version_number desc
  limit 1;
  if version_id is null then raise exception 'MATERIAL_VERSION_NOT_READY'; end if;
  select id into placement_id from public.lms_material_placements where material_id = p_material_id and target_type = 'class' and class_id = p_class_id limit 1;
  if placement_id is null then
    insert into public.lms_material_placements (material_id, version_id, club_id, target_type, class_id, status, created_by) values (p_material_id, version_id, p_organization_id, 'class', p_class_id, 'draft', uid) returning id into placement_id;
  end if;
  result := jsonb_build_object('classId', p_class_id, 'class_id', p_class_id, 'resourceId', p_material_id, 'resource_id', p_material_id, 'organizationId', p_organization_id, 'organization_id', p_organization_id);
  insert into public.organization_operation_idempotency(actor_id, operation, idempotency_key, request_hash, response_payload, completed_at) values (uid, 'assign_organization_material', p_idempotency_key, request_hash, result, now());
  perform private.organization_audit(p_organization_id, uid, 'material_assigned', 'class', p_class_id, jsonb_build_object('material_id', p_material_id, 'placement_id', placement_id), p_idempotency_key);
  return result;
end;
$$;

-- Invitation consumption is deliberately email-matched and returns no target
-- email on failure.  The row lock makes two concurrent accepts deterministic.
create or replace function public.consume_organization_invitation(p_token_hash text)
returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare
  uid uuid := auth.uid();
  invitation public.club_invitations%rowtype;
  profile_email text;
  member_role text;
  active_student_club uuid;
begin
  if uid is null or nullif(btrim(p_token_hash), '') is null then
    return jsonb_build_object('status', 'invalid');
  end if;
  select lower(email) into profile_email from auth.users where id = uid;
  select * into invitation from public.club_invitations where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;

  member_role := case when invitation.role = 'coach' then 'teacher' else invitation.role end;
  if invitation.status = 'accepted' and invitation.accepted_by = uid then
    if exists (
      select 1 from public.club_memberships cm
      where cm.club_id = invitation.club_id and cm.user_id = uid
        and cm.role = member_role and cm.status = 'active'
    ) then
      return jsonb_build_object('status', 'accepted', 'clubId', invitation.club_id, 'organizationId', invitation.club_id);
    end if;
    return jsonb_build_object('status', 'revoked');
  end if;
  if invitation.status = 'revoked' then return jsonb_build_object('status', 'revoked'); end if;
  if invitation.status = 'expired' then return jsonb_build_object('status', 'expired'); end if;
  if invitation.status <> 'pending' then return jsonb_build_object('status', 'invalid'); end if;
  if invitation.expires_at <= now() then
    update public.club_invitations set status = 'expired', updated_at = now() where id = invitation.id;
    return jsonb_build_object('status', 'expired');
  end if;
  if not exists (select 1 from public.clubs c where c.id = invitation.club_id and c.status = 'active') then
    return jsonb_build_object('status', 'revoked');
  end if;
  if profile_email is null or profile_email <> lower(invitation.email) then
    return jsonb_build_object('status', 'email_mismatch');
  end if;

  if member_role = 'student' then
    select cm.club_id into active_student_club
    from public.club_memberships cm
    where cm.user_id = uid and cm.role = 'student' and cm.status = 'active'
    order by cm.created_at, cm.id
    limit 1;
    if active_student_club is not null and active_student_club <> invitation.club_id then
      return jsonb_build_object('status', 'already_in_org', 'clubId', active_student_club, 'organizationId', active_student_club);
    end if;
  end if;

  perform set_config('app.organization_invite_consume', 'on', true);
  if member_role = 'teacher' then
    update public.profiles set role = 'teacher', updated_at = now() where id = uid and role = 'student';
  end if;
  insert into public.club_memberships (club_id, user_id, role, status, invited_by)
  values (invitation.club_id, uid, member_role, 'active', invitation.invited_by)
  on conflict (club_id, user_id, role) do update
    set status = 'active', removed_at = null, updated_at = now();
  update public.club_invitations
  set status = 'accepted', accepted_by = uid, accepted_at = now(), updated_at = now()
  where id = invitation.id and status = 'pending';
  perform private.organization_audit(invitation.club_id, uid, 'member_accepted', 'invitation', invitation.id, jsonb_build_object('role', member_role), null);
  return jsonb_build_object('status', 'accepted', 'clubId', invitation.club_id, 'organizationId', invitation.club_id);
end;
$$;

revoke all on function public.create_organization_draft_transaction(text, text, text, text, text, text, text, uuid) from public, anon;
revoke all on function public.update_organization_transaction(uuid, text, text, text, text, text, text, text, text, text, integer, text, uuid) from public, anon;
revoke all on function public.invite_organization_member_transaction(uuid, text, text, text, uuid) from public, anon;
revoke all on function public.activate_organization_transaction(uuid, text, uuid) from public, anon;
revoke all on function public.create_organization_class_transaction(uuid, uuid, text, text, text, text, text, text, date, date, text, text, integer, text, uuid) from public, anon;
revoke all on function public.assign_organization_teacher_transaction(uuid, uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.assign_organization_course_transaction(uuid, uuid, uuid, text, text, uuid) from public, anon;
revoke all on function public.assign_organization_material_transaction(uuid, uuid, uuid, text, uuid) from public, anon;
revoke all on function public.consume_organization_invitation(text) from public, anon;
grant execute on function public.create_organization_draft_transaction(text, text, text, text, text, text, text, uuid) to authenticated;
grant execute on function public.update_organization_transaction(uuid, text, text, text, text, text, text, text, text, text, integer, text, uuid) to authenticated;
grant execute on function public.invite_organization_member_transaction(uuid, text, text, text, uuid) to authenticated;
grant execute on function public.activate_organization_transaction(uuid, text, uuid) to authenticated;
grant execute on function public.create_organization_class_transaction(uuid, uuid, text, text, text, text, text, text, date, date, text, text, integer, text, uuid) to authenticated;
grant execute on function public.assign_organization_teacher_transaction(uuid, uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.assign_organization_course_transaction(uuid, uuid, uuid, text, text, uuid) to authenticated;
grant execute on function public.assign_organization_material_transaction(uuid, uuid, uuid, text, uuid) to authenticated;
grant execute on function public.consume_organization_invitation(text) to authenticated;

commit;
