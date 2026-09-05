-- Class join invitations. Codes are bearer credentials; table access stays
-- manager-only and all public flows go through the authenticated RPCs.
begin;

create table if not exists public.class_join_invitations (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  code text not null unique
    check (code ~ '^[0-9a-f]{32}$'),
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '7 days'),
  max_uses integer not null default 100 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0 and use_count <= max_uses),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists class_join_invitations_class_idx
  on public.class_join_invitations(class_id, created_at desc);
create unique index if not exists class_join_invitations_one_active_idx
  on public.class_join_invitations(class_id)
  where revoked_at is null;

create table if not exists public.class_join_invitation_claims (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.class_join_invitations(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  claimed_at timestamptz not null default now(),
  unique (invitation_id, user_id)
);

create index if not exists class_join_invitation_claims_user_idx
  on public.class_join_invitation_claims(user_id, claimed_at desc);

alter table public.class_join_invitations enable row level security;
alter table public.class_join_invitation_claims enable row level security;
revoke all on public.class_join_invitations, public.class_join_invitation_claims from anon, authenticated;
grant select on public.class_join_invitations to authenticated;

drop policy if exists "Class managers view join invitations" on public.class_join_invitations;
create policy "Class managers view join invitations"
  on public.class_join_invitations for select to authenticated
  using (private.can_manage_class(class_id, (select auth.uid())));

-- Claims are replay evidence, never a client-readable roster or ledger.
revoke all on public.class_join_invitation_claims from anon, authenticated;
-- Make the intentional browser-role denial explicit for policy auditing.
create policy class_join_invitation_claims_deny_browser
  on public.class_join_invitation_claims for all to anon, authenticated
  using (false) with check (false);

create or replace function public.manage_class_join_invitation(
  p_class_id uuid,
  p_action text,
  p_expected_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  uid uuid := auth.uid();
  class_row public.classes%rowtype;
  invitation_row public.class_join_invitations%rowtype;
begin
  if uid is null then return jsonb_build_object('status', 'forbidden'); end if;
  if p_action is null or p_action not in ('get', 'create', 'replace', 'revoke') then
    return jsonb_build_object('status', 'unavailable');
  end if;
  if not private.can_manage_class(p_class_id, uid) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  select * into class_row from public.classes where id = p_class_id for update;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  if not private.can_manage_class(p_class_id, uid) then
    return jsonb_build_object('status', 'forbidden');
  end if;
  if class_row.status <> 'active' or class_row.club_id is null then
    return jsonb_build_object('status', case when class_row.status = 'archived' then 'archived' else 'unavailable' end);
  end if;
  select * into invitation_row
  from public.class_join_invitations
  where class_id = p_class_id and revoked_at is null
  order by created_at desc, id desc
  limit 1
  for update;

  if p_action = 'get' then
    perform private.write_class_operation_audit(uid, 'get_class_join_invitation', p_class_id,
      jsonb_build_object('invitation_id', invitation_row.id));
    return jsonb_build_object(
      'status', 'ready',
      'invitation', case when invitation_row.id is null then null else jsonb_build_object(
        'id', invitation_row.id, 'code', invitation_row.code,
        'expiresAt', invitation_row.expires_at, 'maxUses', invitation_row.max_uses,
        'useCount', invitation_row.use_count, 'revokedAt', invitation_row.revoked_at
      ) end
    );
  end if;

  if p_action in ('replace', 'revoke') then
    if invitation_row.id is null or p_expected_id is null or invitation_row.id <> p_expected_id then
      return jsonb_build_object('status', 'stale');
    end if;
    update public.class_join_invitations
    set revoked_at = now(), updated_at = now()
    where id = invitation_row.id;
    perform private.write_class_operation_audit(uid, p_action || '_class_join_invitation', p_class_id,
      jsonb_build_object('invitation_id', invitation_row.id));
    if p_action = 'revoke' then
      return jsonb_build_object('status', 'ready', 'invitation', null);
    end if;
  elsif p_action = 'create' and invitation_row.id is not null then
    perform private.write_class_operation_audit(uid, 'create_class_join_invitation', p_class_id,
      jsonb_build_object('invitation_id', invitation_row.id, 'idempotent', true));
    return jsonb_build_object('status', 'ready', 'invitation', jsonb_build_object(
      'id', invitation_row.id, 'code', invitation_row.code,
      'expiresAt', invitation_row.expires_at, 'maxUses', invitation_row.max_uses,
      'useCount', invitation_row.use_count, 'revokedAt', invitation_row.revoked_at
    ));
  end if;

  insert into public.class_join_invitations (class_id, code, created_by)
  values (p_class_id, encode(gen_random_bytes(16), 'hex'), uid)
  returning * into invitation_row;
  perform private.write_class_operation_audit(uid, case when p_action = 'replace' then 'replace_class_join_invitation' else 'create_class_join_invitation' end, p_class_id,
    jsonb_build_object('invitation_id', invitation_row.id, 'replaced_id', case when p_action = 'replace' then p_expected_id else null end));
  return jsonb_build_object('status', 'ready', 'invitation', jsonb_build_object(
    'id', invitation_row.id, 'code', invitation_row.code,
    'expiresAt', invitation_row.expires_at, 'maxUses', invitation_row.max_uses,
    'useCount', invitation_row.use_count, 'revokedAt', invitation_row.revoked_at
  ));
end;
$$;

create or replace function public.resolve_class_join_invitation(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  uid uuid := auth.uid();
  invite public.class_join_invitations%rowtype;
  class_row public.classes%rowtype;
  result_status text;
  profile_role text;
  organization_member_id uuid;
  membership_status text;
begin
  if uid is null then return jsonb_build_object('status', 'forbidden'); end if;
  select * into invite from public.class_join_invitations where code = lower(btrim(p_code));
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  select * into class_row from public.classes where id = invite.class_id;
  if not found then return jsonb_build_object('status', 'unavailable'); end if;
  if not private.can_manage_class(class_row.id, invite.created_by) then
    return jsonb_build_object('status', 'forbidden', 'classId', class_row.id);
  end if;
  if class_row.status <> 'active' then
    return jsonb_build_object('status', case when class_row.status = 'archived' then 'archived' else 'unavailable' end, 'classId', class_row.id);
  end if;
  if class_row.club_id is null then return jsonb_build_object('status', 'organization_required', 'classId', class_row.id); end if;
  if not exists (select 1 from public.clubs where id = class_row.club_id and status = 'active') then
    return jsonb_build_object('status', 'unavailable', 'classId', class_row.id);
  end if;
  if exists (select 1 from public.class_memberships where class_id = class_row.id and user_id = uid and member_role = 'teacher') then
    return jsonb_build_object('status', 'forbidden', 'classId', class_row.id);
  end if;
  select role into profile_role from public.profiles where id = uid;
  if profile_role is distinct from 'student' then return jsonb_build_object('status', 'ineligible', 'classId', class_row.id); end if;
  select id into organization_member_id from public.club_memberships
  where club_id = class_row.club_id and user_id = uid and role = 'student' and status = 'active' limit 1;
  if organization_member_id is null then return jsonb_build_object('status', 'organization_required', 'classId', class_row.id); end if;
  select status into membership_status from public.class_memberships
  where class_id = class_row.id and user_id = uid and member_role = 'student';
  if membership_status = 'removed' then return jsonb_build_object('status', 'forbidden', 'classId', class_row.id); end if;
  if membership_status = 'active' then
    return jsonb_build_object('status', 'already_joined', 'classId', class_row.id, 'programType', class_row.program_type, 'classTitle', class_row.title);
  end if;
  result_status := case
    when class_row.status = 'archived' then 'archived'
    when class_row.status <> 'active' then 'unavailable'
    when invite.revoked_at is not null then 'revoked'
    when invite.expires_at <= clock_timestamp() then 'expired'
    when invite.use_count >= invite.max_uses then 'exhausted'
    when class_row.max_students is not null and (select count(*) from public.class_memberships where class_id = class_row.id and member_role = 'student' and status = 'active') >= class_row.max_students then 'full'
    else 'ready' end;
  return jsonb_build_object('status', result_status, 'classId', class_row.id,
    'classTitle', class_row.title, 'organizationName', (select name from public.clubs where id = class_row.club_id),
    'programType', class_row.program_type, 'expiresAt', invite.expires_at);
end;
$$;

-- Membership does not alter IELTS launch/pilot flags. Application actions and
-- learner destinations independently enforce the existing IELTS access gate.
create or replace function public.claim_class_join_invitation(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  uid uuid := auth.uid();
  invite public.class_join_invitations%rowtype;
  class_row public.classes%rowtype;
  profile_role text;
  organization_member_id uuid;
  membership public.class_memberships%rowtype;
  active_students integer;
begin
  if uid is null then return jsonb_build_object('status', 'forbidden'); end if;
  select * into class_row from public.classes where id = (select class_id from public.class_join_invitations where code = lower(btrim(p_code)) limit 1) for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  select * into invite from public.class_join_invitations where code = lower(btrim(p_code)) for update;
  if not found then return jsonb_build_object('status', 'invalid'); end if;

  if not private.can_manage_class(class_row.id, invite.created_by) then
    return jsonb_build_object('status', 'forbidden', 'classId', class_row.id);
  end if;

  select * into membership from public.class_memberships
  where class_id = class_row.id and user_id = uid and member_role = 'student';
  if exists (select 1 from public.class_memberships where class_id = class_row.id and user_id = uid and member_role = 'teacher') then
    return jsonb_build_object('status', 'forbidden', 'classId', class_row.id);
  end if;
  if class_row.status <> 'active' then return jsonb_build_object('status', case when class_row.status = 'archived' then 'archived' else 'unavailable' end, 'classId', class_row.id); end if;
  if class_row.club_id is null then return jsonb_build_object('status', 'organization_required', 'classId', class_row.id); end if;
  if not exists (select 1 from public.clubs where id = class_row.club_id and status = 'active') then
    return jsonb_build_object('status', 'unavailable', 'classId', class_row.id);
  end if;
  select role into profile_role from public.profiles where id = uid for share;
  if profile_role is distinct from 'student' then return jsonb_build_object('status', 'ineligible', 'classId', class_row.id); end if;
  select id into organization_member_id
  from public.club_memberships
  where club_id = class_row.club_id and user_id = uid and role = 'student' and status = 'active'
  limit 1 for share;
  if organization_member_id is null then
    return jsonb_build_object('status', 'organization_required', 'classId', class_row.id);
  end if;
  if membership.status = 'removed' then return jsonb_build_object('status', 'forbidden', 'classId', class_row.id); end if;
  if membership.status = 'active' then
    return jsonb_build_object('status', 'already_joined', 'classId', class_row.id, 'programType', class_row.program_type, 'classTitle', class_row.title);
  end if;
  if invite.revoked_at is not null then return jsonb_build_object('status', 'revoked', 'classId', class_row.id); end if;
  if invite.expires_at <= clock_timestamp() then return jsonb_build_object('status', 'expired', 'classId', class_row.id); end if;
  if invite.use_count >= invite.max_uses then return jsonb_build_object('status', 'exhausted', 'classId', class_row.id); end if;
  select count(*)::integer into active_students from public.class_memberships where class_id = class_row.id and member_role = 'student' and status = 'active';
  if class_row.max_students is not null and active_students >= class_row.max_students then return jsonb_build_object('status', 'full', 'classId', class_row.id); end if;

  insert into public.class_memberships (class_id, user_id, member_role, status, removed_at, created_by, updated_at)
  values (class_row.id, uid, 'student', 'active', null, uid, now())
  on conflict (class_id, user_id, member_role) do update set status = 'active', removed_at = null, updated_at = now();
  insert into public.class_join_invitation_claims (invitation_id, class_id, user_id) values (invite.id, class_row.id, uid);
  update public.class_join_invitations set use_count = use_count + 1, updated_at = now() where id = invite.id;
  perform private.write_class_operation_audit(uid, 'claim_class_join_invitation', class_row.id,
    jsonb_build_object('invitation_id', invite.id, 'user_id', uid));
  return jsonb_build_object('status', 'joined', 'classId', class_row.id);
end;
$$;

revoke all on function public.manage_class_join_invitation(uuid, text, uuid) from public, anon;
grant execute on function public.manage_class_join_invitation(uuid, text, uuid) to authenticated;
revoke all on function public.resolve_class_join_invitation(text) from public, anon;
grant execute on function public.resolve_class_join_invitation(text) to authenticated;
revoke all on function public.claim_class_join_invitation(text) from public, anon;
grant execute on function public.claim_class_join_invitation(text) to authenticated;

commit;
