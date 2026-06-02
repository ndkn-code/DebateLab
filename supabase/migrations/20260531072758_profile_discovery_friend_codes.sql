-- Profile discovery, friend codes, connection center, and social guardrails.
-- Discovery stays authenticated and privacy-gated; raw profile reads remain
-- self/admin only through existing RLS.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter table public.profile_privacy_settings
  add column if not exists friend_code_discovery_enabled boolean not null default true;

create table if not exists public.profile_friend_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  active boolean not null default true,
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (code ~ '^DBT-[A-Z0-9]{4}-[A-Z0-9]{4}$')
);

create index if not exists idx_profile_friend_codes_active_code
  on public.profile_friend_codes(code)
  where active;

create table if not exists public.profile_social_audit_log (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_profile_social_audit_actor_event_created
  on public.profile_social_audit_log(actor_user_id, event_type, created_at desc);

create index if not exists idx_profile_social_audit_target_event_created
  on public.profile_social_audit_log(target_user_id, event_type, created_at desc);

alter table public.profile_friend_codes enable row level security;
alter table public.profile_social_audit_log enable row level security;

drop policy if exists "Users can view own profile friend code" on public.profile_friend_codes;
create policy "Users can view own profile friend code"
  on public.profile_friend_codes for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Admins can view profile social audit log" on public.profile_social_audit_log;
create policy "Admins can view profile social audit log"
  on public.profile_social_audit_log for select
  to authenticated
  using (private.is_admin((select auth.uid())));

revoke all on table public.profile_friend_codes from public, anon, authenticated;
revoke all on table public.profile_social_audit_log from public, anon, authenticated;
grant select on public.profile_friend_codes to authenticated;
grant select on public.profile_social_audit_log to authenticated;
grant all on public.profile_friend_codes to service_role;
grant all on public.profile_social_audit_log to service_role;

create or replace function private.profile_normalize_friend_code(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when regexp_replace(upper(trim(coalesce(p_value, ''))), '[^A-Z0-9]', '', 'g') ~ '^DBT[A-Z0-9]{8}$'
      then concat(
        'DBT-',
        substring(regexp_replace(upper(trim(coalesce(p_value, ''))), '[^A-Z0-9]', '', 'g') from 4 for 4),
        '-',
        substring(regexp_replace(upper(trim(coalesce(p_value, ''))), '[^A-Z0-9]', '', 'g') from 8 for 4)
      )
    else null
  end;
$$;

create or replace function private.generate_profile_friend_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  v_raw text;
begin
  v_raw := upper(substring(md5(gen_random_uuid()::text || clock_timestamp()::text) from 1 for 8));
  return concat('DBT-', substring(v_raw from 1 for 4), '-', substring(v_raw from 5 for 4));
end;
$$;

create or replace function private.ensure_profile_friend_code(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_attempts integer := 0;
begin
  select code
  into v_code
  from public.profile_friend_codes
  where user_id = p_user_id
    and active
  limit 1;

  if v_code is not null then
    return v_code;
  end if;

  loop
    v_attempts := v_attempts + 1;
    v_code := private.generate_profile_friend_code();

    begin
      insert into public.profile_friend_codes (user_id, code)
      values (p_user_id, v_code)
      on conflict (user_id) do update
        set code = excluded.code,
            active = true,
            rotated_at = now(),
            updated_at = now();
      return v_code;
    exception
      when unique_violation then
        if v_attempts >= 8 then
          raise exception 'Unable to generate friend code';
        end if;
    end;
  end loop;
end;
$$;

create or replace function private.ensure_profile_friend_code_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.ensure_profile_friend_code(new.id);
  return new;
end;
$$;

drop trigger if exists profiles_profile_friend_code_insert on public.profiles;
create trigger profiles_profile_friend_code_insert
  after insert on public.profiles
  for each row execute function private.ensure_profile_friend_code_trigger();

select private.ensure_profile_friend_code(profiles.id)
from public.profiles profiles
where not exists (
  select 1
  from public.profile_friend_codes codes
  where codes.user_id = profiles.id
);

create or replace function private.record_profile_social_audit(
  p_event_type text,
  p_actor_user_id uuid default null,
  p_target_user_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_social_audit_log (
    event_type,
    actor_user_id,
    target_user_id,
    metadata
  )
  values (
    left(lower(trim(coalesce(p_event_type, 'unknown'))), 120),
    p_actor_user_id,
    p_target_user_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function private.profile_social_rate_limited(
  p_actor_user_id uuid,
  p_action text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case lower(trim(coalesce(p_action, '')))
    when 'connection_request' then coalesce((
      select count(*) >= 40
      from public.profile_connections connections
      where connections.requester_user_id = p_actor_user_id
        and connections.requested_at >= now() - interval '1 day'
    ), false)
    when 'search_miss' then coalesce((
      select count(*) >= 45
      from public.profile_social_audit_log audit
      where audit.actor_user_id = p_actor_user_id
        and audit.event_type = 'profile_search_miss'
        and audit.created_at >= now() - interval '1 hour'
    ), false)
    when 'friend_code_rotation' then coalesce((
      select count(*) >= 5
      from public.profile_social_audit_log audit
      where audit.actor_user_id = p_actor_user_id
        and audit.event_type = 'profile_friend_code_rotated'
        and audit.created_at >= now() - interval '1 day'
    ), false)
    when 'report' then coalesce((
      select count(*) >= 10
      from public.profile_reports reports
      where reports.reporter_user_id = p_actor_user_id
        and reports.created_at >= now() - interval '1 hour'
    ), false)
    else false
  end;
$$;

create or replace function private.profile_discovery_shell(
  p_viewer_user_id uuid,
  p_target_user_id uuid,
  p_leaderboard_language text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
  v_language text := case lower(nullif(trim(coalesce(p_leaderboard_language, '')), ''))
    when 'vi' then 'vi'
    else 'en'
  end;
  v_connection_status text;
  v_privacy record;
  v_profile_visible boolean;
  v_organization_visible boolean;
  v_organization jsonb := null;
  v_can_request boolean := false;
  v_friend_count integer := 0;
begin
  if p_viewer_user_id is null or p_target_user_id is null then
    return null;
  end if;

  if private.profile_is_blocked_between(p_viewer_user_id, p_target_user_id) then
    return null;
  end if;

  select *
  into v_target
  from public.profiles
  where id = p_target_user_id
  limit 1;

  if not found then
    return null;
  end if;

  v_connection_status := private.profile_connection_status(
    p_viewer_user_id,
    p_target_user_id
  );

  select *
  into v_privacy
  from private.profile_effective_privacy(p_target_user_id);

  v_profile_visible := private.profile_section_visible(
    p_viewer_user_id,
    p_target_user_id,
    'profile',
    v_language
  );
  v_organization_visible := private.profile_section_visible(
    p_viewer_user_id,
    p_target_user_id,
    'organization',
    v_language
  );

  v_can_request := v_connection_status = 'none'
    and coalesce(v_privacy.allow_connection_requests, true)
    and p_viewer_user_id <> p_target_user_id;

  select count(*)::integer
  into v_friend_count
  from public.profile_connections connections
  where connections.status = 'accepted'
    and (
      connections.requester_user_id = p_target_user_id
      or connections.recipient_user_id = p_target_user_id
    );

  if v_organization_visible then
    select jsonb_build_object(
      'type', 'club',
      'id', clubs.id,
      'name', clubs.name,
      'role', memberships.role
    )
    into v_organization
    from public.club_memberships memberships
    join public.clubs clubs
      on clubs.id = memberships.club_id
    where memberships.user_id = p_target_user_id
      and memberships.status = 'active'
      and clubs.status = 'active'
    order by memberships.joined_at desc
    limit 1;

    if v_organization is null then
      select jsonb_build_object(
        'type', 'class',
        'id', classes.id,
        'name', classes.title,
        'role', memberships.member_role
      )
      into v_organization
      from public.class_memberships memberships
      join public.classes classes
        on classes.id = memberships.class_id
      where memberships.user_id = p_target_user_id
        and memberships.status = 'active'
        and classes.status = 'active'
      order by memberships.joined_at desc
      limit 1;
    end if;
  end if;

  return jsonb_build_object(
    'state', case
      when p_viewer_user_id = p_target_user_id then 'self'
      when v_profile_visible then 'visible'
      else 'private'
    end,
    'connection', jsonb_build_object(
      'status', v_connection_status,
      'viewerCanRequest', v_can_request
    ),
    'profile', jsonb_build_object(
      'userId', v_target.id,
      'handle', case when v_profile_visible then v_target.handle else null end,
      'displayName', case
        when v_profile_visible then coalesce(nullif(v_target.display_name, ''), 'Thinkfy debater')
        else 'Private profile'
      end,
      'avatarUrl', case when v_profile_visible then v_target.avatar_url else null end,
      'selectedTitle', case when v_profile_visible then v_target.selected_title else null end,
      'profileStatus', case when v_profile_visible then nullif(v_target.profile_status, '') else null end,
      'organization', v_organization,
      'friendCounts', jsonb_build_object('friends', v_friend_count),
      'isPrivate', not v_profile_visible
    )
  );
end;
$$;

create or replace function private.search_profile_discovery(
  p_query text,
  p_leaderboard_language text default 'en'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewer_user_id uuid := auth.uid();
  v_raw_query text := trim(coalesce(p_query, ''));
  v_handle text := lower(regexp_replace(v_raw_query, '^@+', ''));
  v_friend_code text := private.profile_normalize_friend_code(v_raw_query);
  v_target_user_id uuid;
  v_query_kind text := 'handle';
  v_shell jsonb;
begin
  if v_viewer_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_raw_query = '' then
    return jsonb_build_object('status', 'empty', 'queryKind', 'empty', 'result', null);
  end if;

  if private.profile_social_rate_limited(v_viewer_user_id, 'search_miss') then
    perform private.record_profile_social_audit(
      'profile_search_rate_limited',
      v_viewer_user_id,
      null,
      jsonb_build_object('queryKind', 'unknown')
    );
    return jsonb_build_object('status', 'rate_limited', 'queryKind', 'unknown', 'result', null);
  end if;

  if v_friend_code is not null then
    v_query_kind := 'friend_code';
    select codes.user_id
    into v_target_user_id
    from public.profile_friend_codes codes
    join public.profile_privacy_settings settings
      on settings.user_id = codes.user_id
    where codes.code = v_friend_code
      and codes.active
      and coalesce(settings.friend_code_discovery_enabled, true)
    limit 1;
  elsif v_handle ~ '^[a-z0-9_.]{3,30}$' then
    v_query_kind := 'handle';
    select profiles.id
    into v_target_user_id
    from public.profiles profiles
    join public.profile_privacy_settings settings
      on settings.user_id = profiles.id
    where profiles.handle = v_handle
      and coalesce(settings.searchable_by_handle, true)
    limit 1;
  else
    v_query_kind := 'invalid';
  end if;

  if v_target_user_id is null then
    perform private.record_profile_social_audit(
      'profile_search_miss',
      v_viewer_user_id,
      null,
      jsonb_build_object('queryKind', v_query_kind)
    );
    return jsonb_build_object('status', 'not_found', 'queryKind', v_query_kind, 'result', null);
  end if;

  if private.profile_is_blocked_between(v_viewer_user_id, v_target_user_id) then
    perform private.record_profile_social_audit(
      'profile_blocked_interaction_attempted',
      v_viewer_user_id,
      v_target_user_id,
      jsonb_build_object('surface', 'discovery_search', 'queryKind', v_query_kind)
    );
    return jsonb_build_object('status', 'blocked', 'queryKind', v_query_kind, 'result', null);
  end if;

  v_shell := private.profile_discovery_shell(
    v_viewer_user_id,
    v_target_user_id,
    p_leaderboard_language
  );

  perform private.record_profile_social_audit(
    'profile_search_found',
    v_viewer_user_id,
    v_target_user_id,
    jsonb_build_object('queryKind', v_query_kind)
  );

  return jsonb_build_object(
    'status', 'found',
    'queryKind', v_query_kind,
    'result', v_shell
  );
end;
$$;

create or replace function private.get_profile_connection_center()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_friend_code text;
  v_friend_code_enabled boolean := true;
  v_incoming jsonb := '[]'::jsonb;
  v_outgoing jsonb := '[]'::jsonb;
  v_friends jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  v_friend_code := private.ensure_profile_friend_code(v_user_id);

  select coalesce(settings.friend_code_discovery_enabled, true)
  into v_friend_code_enabled
  from public.profile_privacy_settings settings
  where settings.user_id = v_user_id;

  select coalesce(jsonb_agg(item.shell order by item.requested_at desc), '[]'::jsonb)
  into v_incoming
  from (
    select
      connections.requested_at,
      private.profile_discovery_shell(v_user_id, connections.requester_user_id, 'en') as shell
    from public.profile_connections connections
    where connections.recipient_user_id = v_user_id
      and connections.status = 'pending'
    order by connections.requested_at desc
    limit 30
  ) item
  where item.shell is not null;

  select coalesce(jsonb_agg(item.shell order by item.requested_at desc), '[]'::jsonb)
  into v_outgoing
  from (
    select
      connections.requested_at,
      private.profile_discovery_shell(v_user_id, connections.recipient_user_id, 'en') as shell
    from public.profile_connections connections
    where connections.requester_user_id = v_user_id
      and connections.status = 'pending'
    order by connections.requested_at desc
    limit 30
  ) item
  where item.shell is not null;

  select coalesce(jsonb_agg(item.shell order by item.updated_at desc), '[]'::jsonb)
  into v_friends
  from (
    select
      connections.updated_at,
      private.profile_discovery_shell(
        v_user_id,
        case
          when connections.requester_user_id = v_user_id then connections.recipient_user_id
          else connections.requester_user_id
        end,
        'en'
      ) as shell
    from public.profile_connections connections
    where connections.status = 'accepted'
      and (
        connections.requester_user_id = v_user_id
        or connections.recipient_user_id = v_user_id
      )
    order by connections.updated_at desc
    limit 80
  ) item
  where item.shell is not null;

  return jsonb_build_object(
    'status', 'ok',
    'friendCode', jsonb_build_object(
      'code', v_friend_code,
      'discoveryEnabled', coalesce(v_friend_code_enabled, true)
    ),
    'incoming', v_incoming,
    'outgoing', v_outgoing,
    'friends', v_friends
  );
end;
$$;

create or replace function private.get_profile_discovery_suggestions(
  p_limit integer default 10
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 20);
  v_suggestions jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  with candidate_ids as (
    select target_memberships.user_id as target_user_id, max(target_memberships.joined_at) as seen_at
    from public.club_memberships viewer_memberships
    join public.club_memberships target_memberships
      on target_memberships.club_id = viewer_memberships.club_id
     and target_memberships.status = 'active'
     and target_memberships.user_id <> v_user_id
    where viewer_memberships.user_id = v_user_id
      and viewer_memberships.status = 'active'
    group by target_memberships.user_id
    union
    select target_memberships.user_id as target_user_id, max(target_memberships.joined_at) as seen_at
    from public.class_memberships viewer_memberships
    join public.class_memberships target_memberships
      on target_memberships.class_id = viewer_memberships.class_id
     and target_memberships.status = 'active'
     and target_memberships.user_id <> v_user_id
    where viewer_memberships.user_id = v_user_id
      and viewer_memberships.status = 'active'
    group by target_memberships.user_id
  ),
  filtered as (
    select
      candidate_ids.target_user_id,
      max(candidate_ids.seen_at) as seen_at
    from candidate_ids
    join public.profile_privacy_settings settings
      on settings.user_id = candidate_ids.target_user_id
    where coalesce(settings.allow_connection_requests, true)
      and not private.profile_is_blocked_between(v_user_id, candidate_ids.target_user_id)
      and private.profile_connection_status(v_user_id, candidate_ids.target_user_id) = 'none'
      and private.profile_section_visible(v_user_id, candidate_ids.target_user_id, 'profile', 'en')
    group by candidate_ids.target_user_id
    order by max(candidate_ids.seen_at) desc nulls last
    limit v_limit
  ),
  shells as (
    select
      filtered.seen_at,
      private.profile_discovery_shell(v_user_id, filtered.target_user_id, 'en') as shell
    from filtered
  )
  select coalesce(jsonb_agg(shells.shell order by shells.seen_at desc nulls last), '[]'::jsonb)
  into v_suggestions
  from shells
  where shells.shell is not null;

  return jsonb_build_object('status', 'ok', 'suggestions', v_suggestions);
end;
$$;

create or replace function private.rotate_profile_friend_code()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text;
  v_attempts integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if private.profile_social_rate_limited(v_user_id, 'friend_code_rotation') then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  loop
    v_attempts := v_attempts + 1;
    v_code := private.generate_profile_friend_code();

    begin
      insert into public.profile_friend_codes (user_id, code, active, rotated_at)
      values (v_user_id, v_code, true, now())
      on conflict (user_id) do update
        set code = excluded.code,
            active = true,
            rotated_at = now(),
            updated_at = now();
      exit;
    exception
      when unique_violation then
        if v_attempts >= 8 then
          raise exception 'Unable to rotate friend code';
        end if;
    end;
  end loop;

  perform private.record_profile_social_audit(
    'profile_friend_code_rotated',
    v_user_id,
    v_user_id,
    '{}'::jsonb
  );

  return jsonb_build_object('status', 'rotated', 'code', v_code);
end;
$$;

create or replace function private.request_profile_connection(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_user_id uuid := auth.uid();
  v_existing record;
  v_privacy record;
  v_connection_id uuid;
begin
  if v_requester_user_id is null then
    raise exception 'Authentication required';
  end if;

  if private.profile_social_rate_limited(v_requester_user_id, 'connection_request') then
    perform private.record_profile_social_audit(
      'profile_connection_rate_limited',
      v_requester_user_id,
      p_target_user_id,
      '{}'::jsonb
    );
    return jsonb_build_object('status', 'rate_limited');
  end if;

  if p_target_user_id is null or not exists (
    select 1 from public.profiles where id = p_target_user_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_requester_user_id = p_target_user_id then
    return jsonb_build_object('status', 'self');
  end if;

  if private.profile_is_blocked_between(v_requester_user_id, p_target_user_id) then
    perform private.record_profile_social_audit(
      'profile_blocked_interaction_attempted',
      v_requester_user_id,
      p_target_user_id,
      jsonb_build_object('surface', 'connection_request')
    );
    return jsonb_build_object('status', 'blocked');
  end if;

  select *
  into v_privacy
  from private.profile_effective_privacy(p_target_user_id);

  if not coalesce(v_privacy.allow_connection_requests, true) then
    return jsonb_build_object('status', 'disabled');
  end if;

  select *
  into v_existing
  from public.profile_connections connections
  where connections.status in ('pending', 'accepted')
    and (
      (
        connections.requester_user_id = v_requester_user_id
        and connections.recipient_user_id = p_target_user_id
      )
      or (
        connections.requester_user_id = p_target_user_id
        and connections.recipient_user_id = v_requester_user_id
      )
    )
  order by connections.updated_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'status', private.profile_connection_status(v_requester_user_id, p_target_user_id),
      'connectionId', v_existing.id
    );
  end if;

  insert into public.profile_connections (requester_user_id, recipient_user_id, status)
  values (v_requester_user_id, p_target_user_id, 'pending')
  returning id into v_connection_id;

  perform private.record_profile_social_audit(
    'profile_connection_requested',
    v_requester_user_id,
    p_target_user_id,
    jsonb_build_object('connectionId', v_connection_id)
  );

  return jsonb_build_object(
    'status', 'pending_sent',
    'connectionId', v_connection_id
  );
end;
$$;

create or replace function private.respond_to_profile_connection(
  p_requester_user_id uuid,
  p_response text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient_user_id uuid := auth.uid();
  v_status text := case lower(trim(coalesce(p_response, '')))
    when 'accept' then 'accepted'
    when 'accepted' then 'accepted'
    when 'decline' then 'declined'
    when 'declined' then 'declined'
    else null
  end;
  v_connection_id uuid;
begin
  if v_recipient_user_id is null then
    raise exception 'Authentication required';
  end if;

  if v_status is null then
    raise exception 'Invalid connection response';
  end if;

  if private.profile_is_blocked_between(v_recipient_user_id, p_requester_user_id) then
    return jsonb_build_object('status', 'blocked');
  end if;

  update public.profile_connections connections
  set
    status = v_status,
    responded_at = now(),
    updated_at = now()
  where connections.requester_user_id = p_requester_user_id
    and connections.recipient_user_id = v_recipient_user_id
    and connections.status = 'pending'
  returning id into v_connection_id;

  if v_connection_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform private.record_profile_social_audit(
    case when v_status = 'accepted'
      then 'profile_connection_accepted'
      else 'profile_connection_declined'
    end,
    v_recipient_user_id,
    p_requester_user_id,
    jsonb_build_object('connectionId', v_connection_id)
  );

  return jsonb_build_object(
    'status', v_status,
    'connectionId', v_connection_id
  );
end;
$$;

create or replace function private.cancel_profile_connection(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_requester_user_id uuid := auth.uid();
  v_connection_id uuid;
begin
  if v_requester_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.profile_connections connections
  set
    status = 'cancelled',
    updated_at = now()
  where connections.requester_user_id = v_requester_user_id
    and connections.recipient_user_id = p_target_user_id
    and connections.status = 'pending'
  returning id into v_connection_id;

  if v_connection_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform private.record_profile_social_audit(
    'profile_connection_cancelled',
    v_requester_user_id,
    p_target_user_id,
    jsonb_build_object('connectionId', v_connection_id)
  );

  return jsonb_build_object(
    'status', 'cancelled',
    'connectionId', v_connection_id
  );
end;
$$;

create or replace function private.remove_profile_connection(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_user_id uuid := auth.uid();
  v_connection_id uuid;
begin
  if v_actor_user_id is null then
    raise exception 'Authentication required';
  end if;

  update public.profile_connections connections
  set
    status = 'removed',
    removed_at = now(),
    updated_at = now()
  where connections.status = 'accepted'
    and (
      (
        connections.requester_user_id = v_actor_user_id
        and connections.recipient_user_id = p_target_user_id
      )
      or (
        connections.requester_user_id = p_target_user_id
        and connections.recipient_user_id = v_actor_user_id
      )
    )
  returning id into v_connection_id;

  if v_connection_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  perform private.record_profile_social_audit(
    'profile_connection_removed',
    v_actor_user_id,
    p_target_user_id,
    jsonb_build_object('connectionId', v_connection_id)
  );

  return jsonb_build_object(
    'status', 'removed',
    'connectionId', v_connection_id
  );
end;
$$;

create or replace function private.block_profile(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocker_user_id uuid := auth.uid();
begin
  if v_blocker_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_target_user_id is null or not exists (
    select 1 from public.profiles where id = p_target_user_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_blocker_user_id = p_target_user_id then
    return jsonb_build_object('status', 'self');
  end if;

  update public.profile_connections connections
  set
    status = case when connections.status = 'pending' then 'cancelled' else 'removed' end,
    removed_at = case when connections.status = 'accepted' then now() else connections.removed_at end,
    updated_at = now()
  where connections.status in ('pending', 'accepted')
    and (
      (
        connections.requester_user_id = v_blocker_user_id
        and connections.recipient_user_id = p_target_user_id
      )
      or (
        connections.requester_user_id = p_target_user_id
        and connections.recipient_user_id = v_blocker_user_id
      )
    );

  insert into public.profile_blocks (blocker_user_id, blocked_user_id)
  values (v_blocker_user_id, p_target_user_id)
  on conflict (blocker_user_id, blocked_user_id) do nothing;

  perform private.record_profile_social_audit(
    'profile_blocked',
    v_blocker_user_id,
    p_target_user_id,
    '{}'::jsonb
  );

  return jsonb_build_object('status', 'blocked');
end;
$$;

create or replace function private.unblock_profile(p_target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_blocker_user_id uuid := auth.uid();
begin
  if v_blocker_user_id is null then
    raise exception 'Authentication required';
  end if;

  delete from public.profile_blocks blocks
  where blocks.blocker_user_id = v_blocker_user_id
    and blocks.blocked_user_id = p_target_user_id;

  perform private.record_profile_social_audit(
    'profile_unblocked',
    v_blocker_user_id,
    p_target_user_id,
    '{}'::jsonb
  );

  return jsonb_build_object('status', 'unblocked');
end;
$$;

create or replace function private.report_profile(
  p_target_user_id uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporter_user_id uuid := auth.uid();
  v_reason text := lower(trim(coalesce(p_reason, '')));
  v_report_id uuid;
begin
  if v_reporter_user_id is null then
    raise exception 'Authentication required';
  end if;

  if private.profile_social_rate_limited(v_reporter_user_id, 'report') then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  if v_reason not in ('harassment', 'spam', 'impersonation', 'inappropriate_content', 'privacy', 'other') then
    v_reason := 'other';
  end if;

  if p_target_user_id is null or not exists (
    select 1 from public.profiles where id = p_target_user_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_reporter_user_id = p_target_user_id then
    return jsonb_build_object('status', 'self');
  end if;

  insert into public.profile_reports (
    reporter_user_id,
    reported_user_id,
    reason,
    details
  )
  values (
    v_reporter_user_id,
    p_target_user_id,
    v_reason,
    nullif(trim(coalesce(p_details, '')), '')
  )
  returning id into v_report_id;

  perform private.record_profile_social_audit(
    'profile_report_submitted',
    v_reporter_user_id,
    p_target_user_id,
    jsonb_build_object('reportId', v_report_id, 'reason', v_reason)
  );

  return jsonb_build_object(
    'status', 'submitted',
    'reportId', v_report_id
  );
end;
$$;

create or replace function private.profile_enrich_leaderboard_data(
  p_data jsonb,
  p_viewer_user_id uuid,
  p_leaderboard_language text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb := coalesce(p_data #> '{personal,rows}', '[]'::jsonb);
  v_enriched_rows jsonb := '[]'::jsonb;
  v_row jsonb;
  v_target_user_id uuid;
  v_shell jsonb;
  v_profile jsonb;
  v_connection jsonb;
begin
  if p_data is null or jsonb_typeof(v_rows) <> 'array' then
    return p_data;
  end if;

  for v_row in select value from jsonb_array_elements(v_rows)
  loop
    v_target_user_id := null;
    v_shell := null;
    v_profile := null;
    v_connection := null;

    if coalesce(v_row->>'userId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      v_target_user_id := (v_row->>'userId')::uuid;
      v_shell := private.profile_discovery_shell(
        p_viewer_user_id,
        v_target_user_id,
        p_leaderboard_language
      );
      v_profile := v_shell->'profile';
      v_connection := v_shell->'connection';
    end if;

    if v_profile is not null and coalesce(v_profile->>'isPrivate', 'false') <> 'true' then
      v_row := v_row || jsonb_build_object(
        'handle', v_profile->>'handle',
        'profileHref', case
          when v_target_user_id = p_viewer_user_id then '/profile'
          when nullif(v_profile->>'handle', '') is not null then concat('/profile/', v_profile->>'handle')
          else null
        end,
        'connection', v_connection,
        'viewerCanRequest', coalesce((v_connection->>'viewerCanRequest')::boolean, false)
      );
    else
      if v_target_user_id is not null and private.profile_is_blocked_between(p_viewer_user_id, v_target_user_id) then
        v_row := v_row || jsonb_build_object(
          'handle', null,
          'profileHref', null,
          'connection', jsonb_build_object('status', 'blocked', 'viewerCanRequest', false),
          'viewerCanRequest', false
        );
      end if;
    end if;

    v_enriched_rows := v_enriched_rows || jsonb_build_array(v_row);
  end loop;

  return jsonb_set(p_data, '{personal,rows}', v_enriched_rows, true);
end;
$$;

create or replace function private.get_profile_social_guardrails(p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_admin(v_actor) then
    raise exception 'Forbidden';
  end if;

  return jsonb_build_object(
    'audit', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', audit.id,
        'eventType', audit.event_type,
        'actorUserId', audit.actor_user_id,
        'targetUserId', audit.target_user_id,
        'metadata', audit.metadata,
        'createdAt', audit.created_at
      ) order by audit.created_at desc), '[]'::jsonb)
      from public.profile_social_audit_log audit
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ),
    'guardrails', jsonb_build_array(
      jsonb_build_object(
        'key', 'search_misses_1h',
        'label', 'Search misses in the last hour',
        'value', (
          select count(*)
          from public.profile_social_audit_log audit
          where audit.event_type = 'profile_search_miss'
            and audit.created_at >= now() - interval '1 hour'
        ),
        'threshold', 100,
        'status', case when (
          select count(*)
          from public.profile_social_audit_log audit
          where audit.event_type = 'profile_search_miss'
            and audit.created_at >= now() - interval '1 hour'
        ) >= 100 then 'watch' else 'ok' end
      ),
      jsonb_build_object(
        'key', 'reports_1h',
        'label', 'Reports submitted in the last hour',
        'value', (
          select count(*)
          from public.profile_reports reports
          where reports.created_at >= now() - interval '1 hour'
        ),
        'threshold', 25,
        'status', case when (
          select count(*)
          from public.profile_reports reports
          where reports.created_at >= now() - interval '1 hour'
        ) >= 25 then 'watch' else 'ok' end
      ),
      jsonb_build_object(
        'key', 'blocked_attempts_1h',
        'label', 'Blocked interaction attempts in the last hour',
        'value', (
          select count(*)
          from public.profile_social_audit_log audit
          where audit.event_type = 'profile_blocked_interaction_attempted'
            and audit.created_at >= now() - interval '1 hour'
        ),
        'threshold', 20,
        'status', case when (
          select count(*)
          from public.profile_social_audit_log audit
          where audit.event_type = 'profile_blocked_interaction_attempted'
            and audit.created_at >= now() - interval '1 hour'
        ) >= 20 then 'watch' else 'ok' end
      )
    )
  );
end;
$$;

create or replace function public.search_profile_discovery(
  p_query text,
  p_leaderboard_language text default 'en'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.search_profile_discovery(p_query, p_leaderboard_language);
$$;

create or replace function public.get_profile_connection_center()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_profile_connection_center();
$$;

create or replace function public.get_profile_discovery_suggestions(p_limit integer default 10)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_discovery_suggestions(p_limit);
$$;

create or replace function public.rotate_profile_friend_code()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.rotate_profile_friend_code();
$$;

create or replace function public.get_profile_social_guardrails(p_limit integer default 50)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_social_guardrails(p_limit);
$$;

create or replace function public.get_leaderboard_page_data_v2(
  p_user_id uuid default auth.uid(),
  p_leaderboard_language text default 'en'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.profile_enrich_leaderboard_data(
    private.get_leaderboard_page_data_v2(p_user_id, p_leaderboard_language),
    auth.uid(),
    p_leaderboard_language
  );
$$;

revoke all on function private.profile_normalize_friend_code(text) from public, anon, authenticated;
grant execute on function private.profile_normalize_friend_code(text) to service_role;

revoke all on function private.generate_profile_friend_code() from public, anon, authenticated;
grant execute on function private.generate_profile_friend_code() to service_role;

revoke all on function private.ensure_profile_friend_code(uuid) from public, anon, authenticated;
grant execute on function private.ensure_profile_friend_code(uuid) to service_role;

revoke all on function private.ensure_profile_friend_code_trigger() from public, anon, authenticated;
grant execute on function private.ensure_profile_friend_code_trigger() to service_role;

revoke all on function private.record_profile_social_audit(text, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function private.record_profile_social_audit(text, uuid, uuid, jsonb) to service_role;

revoke all on function private.profile_social_rate_limited(uuid, text) from public, anon, authenticated;
grant execute on function private.profile_social_rate_limited(uuid, text) to service_role;

revoke all on function private.profile_discovery_shell(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.profile_discovery_shell(uuid, uuid, text) to service_role;

revoke all on function private.search_profile_discovery(text, text) from public, anon;
grant execute on function private.search_profile_discovery(text, text) to authenticated, service_role;

revoke all on function private.get_profile_connection_center() from public, anon;
grant execute on function private.get_profile_connection_center() to authenticated, service_role;

revoke all on function private.get_profile_discovery_suggestions(integer) from public, anon;
grant execute on function private.get_profile_discovery_suggestions(integer) to authenticated, service_role;

revoke all on function private.rotate_profile_friend_code() from public, anon;
grant execute on function private.rotate_profile_friend_code() to authenticated, service_role;

revoke all on function private.profile_enrich_leaderboard_data(jsonb, uuid, text) from public, anon;
grant execute on function private.profile_enrich_leaderboard_data(jsonb, uuid, text) to authenticated, service_role;

revoke all on function private.get_profile_social_guardrails(integer) from public, anon;
grant execute on function private.get_profile_social_guardrails(integer) to authenticated, service_role;

revoke all on function public.search_profile_discovery(text, text) from public, anon;
grant execute on function public.search_profile_discovery(text, text) to authenticated, service_role;

revoke all on function public.get_profile_connection_center() from public, anon;
grant execute on function public.get_profile_connection_center() to authenticated, service_role;

revoke all on function public.get_profile_discovery_suggestions(integer) from public, anon;
grant execute on function public.get_profile_discovery_suggestions(integer) to authenticated, service_role;

revoke all on function public.rotate_profile_friend_code() from public, anon;
grant execute on function public.rotate_profile_friend_code() to authenticated, service_role;

revoke all on function public.get_profile_social_guardrails(integer) from public, anon;
grant execute on function public.get_profile_social_guardrails(integer) to authenticated, service_role;

revoke all on function public.get_leaderboard_page_data_v2(uuid, text) from public, anon;
grant execute on function public.get_leaderboard_page_data_v2(uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
