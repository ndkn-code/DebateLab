-- Head Teacher is an organization-scoped academic administrator.
-- It is deliberately not a profiles.role value (that column remains the
-- platform identity/compatibility role).
begin;

-- Review authors must be the class's designated teacher.  Organization role
-- is checked independently so platform admin/owner profile roles cannot grant
-- ordinary review authority, and a teacher in another organization cannot
-- cross the class boundary.
create or replace function private.is_assigned_class_teacher(
  p_class_id uuid, p_user_id uuid
) returns boolean language sql stable security definer
set search_path = public, private, extensions as $$
  select p_user_id is not null and exists (
    select 1
    from public.classes c
    join public.class_memberships cm
      on cm.class_id = c.id
     and cm.user_id = p_user_id
     and cm.member_role = 'teacher'
     and cm.status = 'active'
    join public.club_memberships om
      on om.club_id = c.club_id
     and om.user_id = p_user_id
     and om.role in ('head_teacher', 'teacher', 'coach')
     and om.status = 'active'
    where c.id = p_class_id and c.teacher_user_id = p_user_id
  );
$$;
revoke all on function private.is_assigned_class_teacher(uuid,uuid) from public, anon;
grant execute on function private.is_assigned_class_teacher(uuid,uuid) to authenticated;

-- Preserve legacy coach rows while adding the canonical organization role.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.club_memberships'::regclass
      and contype = 'c' and pg_get_constraintdef(oid) like '%role%'
  loop execute format('alter table public.club_memberships drop constraint %I', c.conname); end loop;
  alter table public.club_memberships add constraint club_memberships_role_check
    check (role in ('owner', 'admin', 'head_teacher', 'teacher', 'coach', 'student'));
  if to_regclass('public.club_invitations') is not null then
    for c in
      select conname from pg_constraint
      where conrelid = 'public.club_invitations'::regclass
        and contype = 'c' and pg_get_constraintdef(oid) like '%role%'
    loop execute format('alter table public.club_invitations drop constraint %I', c.conname); end loop;
    alter table public.club_invitations add constraint club_invitations_role_check
      check (role in ('owner', 'admin', 'head_teacher', 'teacher', 'coach', 'student'));
  end if;
end $$;

create or replace function private.organization_role(p_organization_id uuid, p_user_id uuid)
returns text language sql stable security definer
set search_path = public, private, extensions
as $$
  select cm.role from public.club_memberships cm
  where cm.club_id = p_organization_id and cm.user_id = p_user_id and cm.status = 'active'
  order by case cm.role when 'owner' then 1 when 'admin' then 2 when 'head_teacher' then 3
    when 'teacher' then 4 when 'coach' then 5 else 6 end, cm.id
  limit 1
$$;

create or replace function private.organization_can_academic_admin(p_organization_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions
as $$ select p_user_id is not null and coalesce((
  private.organization_is_admin(p_user_id)
  or private.organization_role(p_organization_id, p_user_id) in ('owner','admin','head_teacher')
), false) $$;

create or replace function private.organization_can_manage_people(p_organization_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions
as $$ select coalesce(private.organization_can_academic_admin(p_organization_id, p_user_id), false) $$;

create or replace function private.organization_can_manage_curriculum(p_organization_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions
as $$ select coalesce(private.organization_can_academic_admin(p_organization_id, p_user_id), false) $$;

create or replace function private.organization_can_override_review(p_organization_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions
as $$ select p_user_id is not null and coalesce((
  private.organization_is_admin(p_user_id)
  or private.organization_role(p_organization_id, p_user_id) = 'head_teacher'
), false) $$;

-- Class and academic data are organization-scoped for Head Teachers. The
-- existing organization_can_admin remains intentionally narrower for owner,
-- security, billing, feature flags, and ownership operations.
create or replace function private.organization_can_manage_class(p_class_id uuid, p_user_id uuid)
returns boolean language sql stable security definer
set search_path = public, private, extensions
as $$ select p_user_id is not null and exists (
  select 1 from public.classes c where c.id = p_class_id and (
    private.organization_is_admin(p_user_id)
    or private.organization_role(c.club_id, p_user_id) in ('owner','admin','head_teacher')
    or (private.organization_role(c.club_id, p_user_id) in ('teacher','coach') and exists (
      select 1 from public.class_memberships cm where cm.class_id = c.id and cm.user_id = p_user_id
        and cm.member_role = 'teacher' and cm.status = 'active'))
  )
) $$;

create or replace function private.organization_can_manage_class_in_org(
  p_class_id uuid, p_organization_id uuid, p_user_id uuid
) returns boolean language sql stable security definer
set search_path = public, private, extensions
as $$ select exists (
  select 1 from public.classes c where c.id = p_class_id and c.club_id = p_organization_id
    and private.organization_can_manage_class(c.id, p_user_id)
) $$;

revoke all on function private.organization_can_academic_admin(uuid,uuid), private.organization_can_manage_people(uuid,uuid),
  private.organization_can_manage_curriculum(uuid,uuid), private.organization_can_override_review(uuid,uuid) from public, anon;
grant execute on function private.organization_can_academic_admin(uuid,uuid), private.organization_can_manage_people(uuid,uuid),
  private.organization_can_manage_curriculum(uuid,uuid), private.organization_can_override_review(uuid,uuid) to authenticated;

-- Head Teachers may manage ordinary people records, but never privileged
-- memberships or invitations. Owners/platform admins retain last-owner rules.
create or replace function private.enforce_organization_membership_mutation()
returns trigger language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); org_id uuid := case when tg_op = 'DELETE' then old.club_id else new.club_id end;
  actor_role text; target_role text := case when tg_op = 'DELETE' then old.role else new.role end;
begin
  if uid is null or coalesce(current_setting('app.organization_invite_consume', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  actor_role := private.organization_role(org_id, uid);
  if actor_role = 'head_teacher' and target_role not in ('teacher','coach','student') then
    raise exception 'HEAD_TEACHER_PRIVILEGED_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  if target_role in ('owner','admin') and actor_role <> 'owner' and not private.organization_is_admin(uid) then
    raise exception 'ORGANIZATION_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if actor_role in ('teacher','coach') then
    raise exception 'ORGANIZATION_ADMIN_REQUIRED' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and old.role = 'owner' and old.status = 'active'
    and not exists (select 1 from public.club_memberships cm where cm.club_id = old.club_id
      and cm.role = 'owner' and cm.status = 'active' and cm.id <> old.id) then
    raise exception 'ORGANIZATION_LAST_OWNER';
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

create or replace function private.enforce_organization_invitation_mutation()
returns trigger language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); org_id uuid := case when tg_op = 'DELETE' then old.club_id else new.club_id end;
  actor_role text; target_role text := case when tg_op = 'DELETE' then old.role else new.role end;
begin
  if uid is null or coalesce(current_setting('app.organization_invite_consume', true), '') = 'on' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  actor_role := private.organization_role(org_id, uid);
  if actor_role = 'head_teacher' and target_role not in ('teacher','coach','student') then
    raise exception 'HEAD_TEACHER_PRIVILEGED_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  if target_role in ('owner','admin','head_teacher') and actor_role not in ('owner','admin')
    and not private.organization_is_admin(uid) then
    raise exception 'PRIVILEGED_ROLE_APPOINTMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if actor_role in ('teacher','coach') then raise exception 'ORGANIZATION_ADMIN_REQUIRED' using errcode = '42501'; end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;

drop policy if exists "Head teachers manage organization people" on public.club_memberships;
create policy "Head teachers manage organization people" on public.club_memberships
  for all to authenticated using (private.organization_can_manage_people(club_id, (select auth.uid())))
  with check (private.organization_can_manage_people(club_id, (select auth.uid())));
drop policy if exists "Head teachers manage organization invitations" on public.club_invitations;
create policy "Head teachers manage organization invitations" on public.club_invitations
  for all to authenticated using (private.organization_can_manage_people(club_id, (select auth.uid())))
  with check (private.organization_can_manage_people(club_id, (select auth.uid())));

-- Membership and invitation tables are not an authenticated write API. All
-- mutations go through audited RPCs (invitation consumption remains the
-- existing authenticated RPC path and runs as SECURITY DEFINER).
do $$ declare p record; begin
  for p in select policyname, tablename from pg_policies where schemaname = 'public'
    and tablename in ('club_memberships','club_invitations') and cmd in ('INSERT','UPDATE','DELETE') loop
    execute format('drop policy if exists %I on public.%I', p.policyname,
      case when p.tablename = 'club_memberships' then 'club_memberships' else 'club_invitations' end);
  end loop;
end $$;

create or replace function public.manage_organization_member_transaction(
  p_organization_id uuid, p_user_id uuid, p_role text, p_action text,
  p_expected_updated_at timestamptz, p_idempotency_key text, p_actor_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); actor_role text; row_value public.club_memberships%rowtype;
  result jsonb; existing jsonb; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or p_action not in ('add','update','remove')
    or p_role not in ('admin','head_teacher','teacher','student','coach')
    or nullif(btrim(p_idempotency_key), '') is null then raise exception 'INVALID_MEMBER_INPUT'; end if;
  actor_role := private.organization_role(p_organization_id, uid);
  if actor_role = 'head_teacher' and p_role not in ('teacher','student','coach') then
    raise exception 'HEAD_TEACHER_PRIVILEGED_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  if p_role = 'admin' and actor_role <> 'owner' and not private.organization_is_admin(uid) then
    raise exception 'OWNER_REQUIRED_FOR_ADMIN_ROLE' using errcode = '42501';
  end if;
  if p_role = 'head_teacher' and actor_role not in ('owner','admin') and not private.organization_is_admin(uid) then
    raise exception 'HEAD_TEACHER_APPOINTMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if not private.organization_can_manage_people(p_organization_id, uid) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  request_hash := encode(digest(concat_ws('|',p_organization_id,p_user_id,p_role,p_action,p_expected_updated_at), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('member:'||p_organization_id||':'||p_user_id,0));
  existing := private.organization_idempotency_lookup(uid, 'manage_organization_member', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  select * into row_value from public.club_memberships where club_id = p_organization_id and user_id = p_user_id
    order by case when role = p_role then 0 else 1 end, id limit 1 for update;
  if found and row_value.role = 'admin' and actor_role <> 'owner' and not private.organization_is_admin(uid) then
    raise exception 'OWNER_REQUIRED_FOR_ADMIN_ROLE' using errcode = '42501';
  end if;
  if found and row_value.role = 'head_teacher' and actor_role not in ('owner','admin') and not private.organization_is_admin(uid) then
    raise exception 'HEAD_TEACHER_MANAGEMENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_action = 'remove' then
    if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
    if p_expected_updated_at is not null and row_value.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_MEMBER'; end if;
    if row_value.role = 'owner' then raise exception 'OWNER_MANAGEMENT_FORBIDDEN' using errcode = '42501'; end if;
    update public.club_memberships set status = 'removed', removed_at = now(), updated_at = now() where id = row_value.id;
  elsif p_action = 'update' then
    if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
    if p_expected_updated_at is not null and row_value.updated_at is distinct from p_expected_updated_at then raise exception 'STALE_MEMBER'; end if;
    if row_value.role = 'owner' or p_role = 'owner' then raise exception 'OWNER_MANAGEMENT_FORBIDDEN' using errcode = '42501'; end if;
    update public.club_memberships set role = p_role, status = 'active', removed_at = null, updated_at = now() where id = row_value.id;
  else
    if exists (select 1 from public.club_memberships where club_id = p_organization_id and user_id = p_user_id and status = 'active') then
      raise exception 'MEMBER_ALREADY_ACTIVE';
    end if;
    insert into public.club_memberships (club_id,user_id,role,status,invited_by,joined_at,updated_at)
      values (p_organization_id,p_user_id,p_role,'active',uid,now(),now()) returning * into row_value;
  end if;
  result := jsonb_build_object('organizationId',p_organization_id,'userId',p_user_id,'role',p_role,'action',p_action,'status',case when p_action='remove' then 'removed' else 'active' end);
  insert into public.organization_operation_idempotency(actor_id,operation,idempotency_key,request_hash,response_payload,completed_at)
    values (uid,'manage_organization_member',p_idempotency_key,request_hash,result,now());
  perform private.organization_audit(p_organization_id,uid,'member_'||p_action,'membership',row_value.id,jsonb_build_object('role',p_role),p_idempotency_key);
  return result;
end $$;

create or replace function public.update_organization_academic_profile_transaction(
  p_organization_id uuid, p_name text, p_organization_type text, p_timezone text,
  p_expected_setup_version integer, p_idempotency_key text, p_actor_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); result jsonb; current_version integer; request_hash text; existing jsonb; actor_role text;
begin
  if uid is null or p_actor_id is distinct from uid or not private.organization_can_academic_admin(p_organization_id,uid)
    or nullif(btrim(p_idempotency_key),'') is null then raise exception 'FORBIDDEN'; end if;
  if p_organization_type is not null and p_organization_type not in ('club','school') then raise exception 'INVALID_ORGANIZATION_TYPE'; end if;
  actor_role := private.organization_role(p_organization_id, uid);
  if actor_role = 'head_teacher' and p_organization_type is not null then raise exception 'HEAD_TEACHER_FIELD_FORBIDDEN' using errcode='42501'; end if;
  request_hash := encode(digest(concat_ws('|',p_organization_id,p_name,p_organization_type,p_timezone,p_expected_setup_version),'sha256'),'hex');
  existing := private.organization_idempotency_lookup(uid,'update_organization_academic_profile',p_idempotency_key,request_hash);
  if existing is not null then return existing; end if;
  select setup_version into current_version from public.clubs where id=p_organization_id for update;
  if current_version is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  if p_expected_setup_version is not null and current_version <> p_expected_setup_version then raise exception 'SETUP_VERSION_CONFLICT' using errcode='40001'; end if;
  update public.clubs set name=coalesce(nullif(btrim(p_name),''),name), organization_type=coalesce(p_organization_type,organization_type),
    club_type=case when coalesce(p_organization_type,organization_type)='school' then 'school' else 'independent' end,
    timezone=coalesce(nullif(btrim(p_timezone),''),timezone), setup_version=current_version+1, updated_at=now() where id=p_organization_id;
  select jsonb_build_object('organizationId',id,'name',name,'organizationType',organization_type,'timezone',timezone,'setupVersion',setup_version)
    into result from public.clubs where id=p_organization_id;
  insert into public.organization_operation_idempotency(actor_id,operation,idempotency_key,request_hash,response_payload,completed_at)
    values(uid,'update_organization_academic_profile',p_idempotency_key,request_hash,result,now());
  perform private.organization_audit(p_organization_id,uid,'academic_profile_updated','organization',p_organization_id,'{}'::jsonb,p_idempotency_key);
  return result;
end $$;
revoke all on function public.manage_organization_member_transaction(uuid,uuid,text,text,timestamptz,text,uuid), public.update_organization_academic_profile_transaction(uuid,text,text,text,integer,text,uuid) from public,anon;
grant execute on function public.manage_organization_member_transaction(uuid,uuid,text,text,timestamptz,text,uuid), public.update_organization_academic_profile_transaction(uuid,text,text,text,integer,text,uuid) to authenticated;
revoke insert, update, delete on public.club_memberships, public.club_invitations from authenticated;

-- Keep the existing client contract while allowing the academic role to invite
-- teachers and students. Privileged invitations remain owner/admin-only.
create or replace function public.invite_organization_member_transaction(
  p_organization_id uuid, p_email text, p_role text, p_idempotency_key text, p_actor_id uuid
) returns jsonb language plpgsql security definer
set search_path = public, private, extensions
as $$
declare uid uuid := auth.uid(); actor_role text; result jsonb; existing jsonb;
  invitation public.club_invitations%rowtype; raw_token text; request_hash text;
begin
  if uid is null or p_actor_id is distinct from uid or p_role not in ('owner','admin','head_teacher','teacher','student')
    or nullif(btrim(p_email), '') is null or nullif(btrim(p_idempotency_key), '') is null then
    raise exception 'INVALID_INVITATION_INPUT';
  end if;
  actor_role := private.organization_role(p_organization_id, uid);
  if actor_role = 'head_teacher' and p_role not in ('teacher','student') then
    raise exception 'HEAD_TEACHER_PRIVILEGED_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    if not private.organization_is_owner(p_organization_id, uid) and not private.organization_is_admin(uid) then
      raise exception 'OWNER_REQUIRED';
    end if;
  elsif p_role = 'admin' then
    if actor_role <> 'owner' and not private.organization_is_admin(uid) then
      raise exception 'OWNER_REQUIRED';
    end if;
  elsif p_role = 'head_teacher' then
    if actor_role not in ('owner','admin') and not private.organization_is_admin(uid) then
      raise exception 'ADMIN_REQUIRED';
    end if;
  elsif not private.organization_can_manage_people(p_organization_id, uid) then
    raise exception 'ADMIN_REQUIRED';
  end if;
  request_hash := encode(digest(concat_ws('|', p_organization_id, lower(btrim(p_email)), p_role), 'sha256'), 'hex');
  perform pg_advisory_xact_lock(hashtextextended('invite_org:' || p_organization_id::text || ':' || lower(btrim(p_email)) || ':' || p_role, 0));
  existing := private.organization_idempotency_lookup(uid, 'invite_organization_member', p_idempotency_key, request_hash);
  if existing is not null then return existing; end if;
  raw_token := encode(gen_random_bytes(32), 'hex');
  select * into invitation from public.club_invitations
    where club_id = p_organization_id and lower(email) = lower(btrim(p_email)) and role = p_role and status = 'pending' for update;
  if found then
    update public.club_invitations set token_hash = encode(digest(raw_token, 'sha256'), 'hex'), expires_at = now() + interval '14 days', invited_by = uid, updated_at = now()
      where id = invitation.id returning * into invitation;
  else
    insert into public.club_invitations (club_id,email,role,token_hash,invited_by)
      values (p_organization_id, lower(btrim(p_email)), p_role, encode(digest(raw_token, 'sha256'), 'hex'), uid) returning * into invitation;
  end if;
  result := jsonb_build_object('invitationId', invitation.id, 'invitation_id', invitation.id,
    'organizationId', p_organization_id, 'organization_id', p_organization_id, 'email', lower(btrim(p_email)),
    'role', p_role, 'status', 'pending', 'expiresAt', invitation.expires_at, 'expires_at', invitation.expires_at, 'deliveryToken', raw_token);
  insert into public.organization_operation_idempotency(actor_id,operation,idempotency_key,request_hash,response_payload,completed_at)
    values (uid,'invite_organization_member',p_idempotency_key,request_hash,result,now());
  perform private.organization_audit(p_organization_id, uid, 'member_invited', 'invitation', invitation.id,
    jsonb_build_object('email_sha256', encode(digest(lower(btrim(p_email)), 'sha256'), 'hex'), 'role', p_role), p_idempotency_key);
  return result;
end $$;
revoke all on function public.invite_organization_member_transaction(uuid,text,text,text,uuid) from public, anon;
grant execute on function public.invite_organization_member_transaction(uuid,text,text,text,uuid) to authenticated;

commit;
