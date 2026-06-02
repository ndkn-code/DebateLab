-- Profile social foundation: privacy-gated public profile reads, mutual
-- connections, blocks, and reports. This intentionally does not broaden raw
-- public.profiles SELECT policies; non-self profile reads must use RPCs.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter table public.profiles
  add column if not exists handle text,
  add column if not exists profile_status text;

do $$
begin
  alter table public.profiles
    add constraint profiles_handle_format_check
    check (
      handle is null
      or (
        handle = lower(handle)
        and handle ~ '^[a-z0-9_.]{3,30}$'
      )
    );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.profiles
    add constraint profiles_status_length_check
    check (profile_status is null or char_length(profile_status) <= 140);
exception
  when duplicate_object then null;
end
$$;

create unique index if not exists idx_profiles_handle_lower_unique
  on public.profiles (lower(handle))
  where handle is not null;

create table if not exists public.profile_privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profile_visibility text not null default 'trusted'
    check (profile_visibility in ('private', 'connections', 'trusted', 'public')),
  analytics_visibility text not null default 'private'
    check (analytics_visibility in ('private', 'connections', 'trusted', 'public')),
  activities_visibility text not null default 'connections'
    check (activities_visibility in ('private', 'connections', 'trusted', 'public')),
  achievements_visibility text not null default 'trusted'
    check (achievements_visibility in ('private', 'connections', 'trusted', 'public')),
  organization_visibility text not null default 'trusted'
    check (organization_visibility in ('private', 'connections', 'trusted', 'public')),
  allow_connection_requests boolean not null default true,
  searchable_by_handle boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.ensure_profile_privacy_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_privacy_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_profile_privacy_settings_insert on public.profiles;
create trigger profiles_profile_privacy_settings_insert
  after insert on public.profiles
  for each row execute function private.ensure_profile_privacy_settings();

insert into public.profile_privacy_settings (user_id)
select profiles.id
from public.profiles profiles
on conflict (user_id) do nothing;

create table if not exists public.profile_connections (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references public.profiles(id) on delete cascade,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'cancelled', 'removed')),
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  removed_at timestamptz,
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  check (requester_user_id <> recipient_user_id)
);

create unique index if not exists idx_profile_connections_one_active_pair
  on public.profile_connections (
    least(requester_user_id, recipient_user_id),
    greatest(requester_user_id, recipient_user_id)
  )
  where status in ('pending', 'accepted');

create index if not exists idx_profile_connections_requester_status
  on public.profile_connections(requester_user_id, status, updated_at desc);

create index if not exists idx_profile_connections_recipient_status
  on public.profile_connections(recipient_user_id, status, updated_at desc);

create table if not exists public.profile_blocks (
  blocker_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);

create index if not exists idx_profile_blocks_blocked_user
  on public.profile_blocks(blocked_user_id, created_at desc);

create table if not exists public.profile_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null
    check (reason in ('harassment', 'spam', 'impersonation', 'inappropriate_content', 'privacy', 'other')),
  details text,
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_user_id <> reported_user_id)
);

create index if not exists idx_profile_reports_reported_status
  on public.profile_reports(reported_user_id, status, created_at desc);

create index if not exists idx_profile_reports_reporter_created
  on public.profile_reports(reporter_user_id, created_at desc);

create or replace function private.profile_is_blocked_between(
  p_viewer_user_id uuid,
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    p_viewer_user_id is not null
    and p_target_user_id is not null
    and p_viewer_user_id <> p_target_user_id
    and exists (
      select 1
      from public.profile_blocks blocks
      where (
        blocks.blocker_user_id = p_viewer_user_id
        and blocks.blocked_user_id = p_target_user_id
      )
      or (
        blocks.blocker_user_id = p_target_user_id
        and blocks.blocked_user_id = p_viewer_user_id
      )
    ),
    false
  );
$$;

alter table public.profile_privacy_settings enable row level security;
alter table public.profile_connections enable row level security;
alter table public.profile_blocks enable row level security;
alter table public.profile_reports enable row level security;

drop policy if exists "Users can view own profile privacy" on public.profile_privacy_settings;
create policy "Users can view own profile privacy"
  on public.profile_privacy_settings for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users can insert own profile privacy" on public.profile_privacy_settings;
create policy "Users can insert own profile privacy"
  on public.profile_privacy_settings for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own profile privacy" on public.profile_privacy_settings;
create policy "Users can update own profile privacy"
  on public.profile_privacy_settings for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Connection participants can view profile connections" on public.profile_connections;
create policy "Connection participants can view profile connections"
  on public.profile_connections for select
  to authenticated
  using (
    requester_user_id = (select auth.uid())
    or recipient_user_id = (select auth.uid())
    or private.is_admin((select auth.uid()))
  );

drop policy if exists "Users can create safe pending profile connections" on public.profile_connections;
create policy "Users can create safe pending profile connections"
  on public.profile_connections for insert
  to authenticated
  with check (
    requester_user_id = (select auth.uid())
    and requester_user_id <> recipient_user_id
    and status = 'pending'
    and not private.profile_is_blocked_between(requester_user_id, recipient_user_id)
    and coalesce(
      (
        select settings.allow_connection_requests
        from public.profile_privacy_settings settings
        where settings.user_id = recipient_user_id
      ),
      true
    )
  );

drop policy if exists "Admins can update profile connections" on public.profile_connections;
create policy "Admins can update profile connections"
  on public.profile_connections for update
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

drop policy if exists "Users can view own profile blocks" on public.profile_blocks;
create policy "Users can view own profile blocks"
  on public.profile_blocks for select
  to authenticated
  using (blocker_user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users can create own profile blocks" on public.profile_blocks;
create policy "Users can create own profile blocks"
  on public.profile_blocks for insert
  to authenticated
  with check (blocker_user_id = (select auth.uid()) and blocker_user_id <> blocked_user_id);

drop policy if exists "Users can delete own profile blocks" on public.profile_blocks;
create policy "Users can delete own profile blocks"
  on public.profile_blocks for delete
  to authenticated
  using (blocker_user_id = (select auth.uid()));

drop policy if exists "Reporters and admins can view profile reports" on public.profile_reports;
create policy "Reporters and admins can view profile reports"
  on public.profile_reports for select
  to authenticated
  using (reporter_user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users can submit profile reports" on public.profile_reports;
create policy "Users can submit profile reports"
  on public.profile_reports for insert
  to authenticated
  with check (reporter_user_id = (select auth.uid()) and reporter_user_id <> reported_user_id);

drop policy if exists "Admins can update profile reports" on public.profile_reports;
create policy "Admins can update profile reports"
  on public.profile_reports for update
  to authenticated
  using (private.is_admin((select auth.uid())))
  with check (private.is_admin((select auth.uid())));

revoke all on table
  public.profile_privacy_settings,
  public.profile_connections,
  public.profile_blocks,
  public.profile_reports
from public, anon, authenticated;

grant select, insert, update on public.profile_privacy_settings to authenticated;
grant select on public.profile_connections to authenticated;
grant select, insert, delete on public.profile_blocks to authenticated;
grant select, insert, update on public.profile_reports to authenticated;

grant all on public.profile_privacy_settings to service_role;
grant all on public.profile_connections to service_role;
grant all on public.profile_blocks to service_role;
grant all on public.profile_reports to service_role;

create or replace function private.profile_effective_privacy(p_user_id uuid)
returns table (
  user_id uuid,
  profile_visibility text,
  analytics_visibility text,
  activities_visibility text,
  achievements_visibility text,
  organization_visibility text,
  allow_connection_requests boolean,
  searchable_by_handle boolean,
  is_default boolean,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    p_user_id,
    coalesce(settings.profile_visibility, 'trusted'),
    coalesce(settings.analytics_visibility, 'private'),
    coalesce(settings.activities_visibility, 'connections'),
    coalesce(settings.achievements_visibility, 'trusted'),
    coalesce(settings.organization_visibility, 'trusted'),
    coalesce(settings.allow_connection_requests, true),
    coalesce(settings.searchable_by_handle, true),
    settings.user_id is null,
    coalesce(settings.updated_at, now())
  from (select p_user_id as user_id) seed
  left join public.profile_privacy_settings settings
    on settings.user_id = seed.user_id;
$$;

create or replace function private.profile_connection_status(
  p_viewer_user_id uuid,
  p_target_user_id uuid
)
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_row record;
begin
  if p_viewer_user_id is null or p_target_user_id is null then
    return 'none';
  end if;

  if p_viewer_user_id = p_target_user_id then
    return 'self';
  end if;

  if private.profile_is_blocked_between(p_viewer_user_id, p_target_user_id) then
    return 'blocked';
  end if;

  select connections.requester_user_id, connections.recipient_user_id, connections.status
  into v_row
  from public.profile_connections connections
  where connections.status in ('pending', 'accepted')
    and (
      (
        connections.requester_user_id = p_viewer_user_id
        and connections.recipient_user_id = p_target_user_id
      )
      or (
        connections.requester_user_id = p_target_user_id
        and connections.recipient_user_id = p_viewer_user_id
      )
    )
  order by connections.updated_at desc
  limit 1;

  if not found then
    return 'none';
  end if;

  if v_row.status = 'accepted' then
    return 'accepted';
  end if;

  if v_row.requester_user_id = p_viewer_user_id then
    return 'pending_sent';
  end if;

  return 'pending_received';
end;
$$;

create or replace function private.profile_shared_trusted_context(
  p_viewer_user_id uuid,
  p_target_user_id uuid,
  p_leaderboard_language text default 'en'
)
returns boolean
language sql
stable
set search_path = ''
as $$
  with normalized as (
    select
      p_viewer_user_id as viewer_user_id,
      p_target_user_id as target_user_id,
      case lower(nullif(trim(coalesce(p_leaderboard_language, '')), ''))
        when 'vi' then 'vi'
        else 'en'
      end as leaderboard_language
  )
  select coalesce(
    exists (
      select 1
      from normalized
      where viewer_user_id is not null
        and target_user_id is not null
        and viewer_user_id = target_user_id
    )
    or (
      not private.profile_is_blocked_between(p_viewer_user_id, p_target_user_id)
      and (
        private.profile_connection_status(p_viewer_user_id, p_target_user_id) = 'accepted'
        or exists (
          select 1
          from normalized
          join public.club_memberships viewer_memberships
            on viewer_memberships.user_id = normalized.viewer_user_id
           and viewer_memberships.status = 'active'
          join public.club_memberships target_memberships
            on target_memberships.club_id = viewer_memberships.club_id
           and target_memberships.user_id = normalized.target_user_id
           and target_memberships.status = 'active'
        )
        or exists (
          select 1
          from normalized
          join public.class_memberships viewer_memberships
            on viewer_memberships.user_id = normalized.viewer_user_id
           and viewer_memberships.status = 'active'
          join public.class_memberships target_memberships
            on target_memberships.class_id = viewer_memberships.class_id
           and target_memberships.user_id = normalized.target_user_id
           and target_memberships.status = 'active'
        )
        or exists (
          select 1
          from normalized
          join public.xp_seasons seasons
            on seasons.status = 'active'
          join public.leaderboard_season_user_cohorts viewer_cohort
            on viewer_cohort.season_id = seasons.id
           and viewer_cohort.leaderboard_language = normalized.leaderboard_language
           and viewer_cohort.user_id = normalized.viewer_user_id
          join public.leaderboard_season_user_cohorts target_cohort
            on target_cohort.season_id = viewer_cohort.season_id
           and target_cohort.leaderboard_language = viewer_cohort.leaderboard_language
           and target_cohort.league_tier = viewer_cohort.league_tier
           and target_cohort.cohort_index = viewer_cohort.cohort_index
           and target_cohort.user_id = normalized.target_user_id
          left join public.leaderboard_privacy_settings leaderboard_settings
            on leaderboard_settings.user_id = normalized.target_user_id
          where coalesce(leaderboard_settings.participate_in_leaderboards, true)
            and coalesce(leaderboard_settings.display_mode, 'public_name') <> 'hidden'
        )
      )
    ),
    false
  );
$$;

create or replace function private.profile_section_visible(
  p_viewer_user_id uuid,
  p_target_user_id uuid,
  p_section text,
  p_leaderboard_language text default 'en'
)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_privacy record;
  v_visibility text;
begin
  if p_viewer_user_id is null or p_target_user_id is null then
    return false;
  end if;

  if p_viewer_user_id = p_target_user_id or private.is_admin(p_viewer_user_id) then
    return true;
  end if;

  if private.profile_is_blocked_between(p_viewer_user_id, p_target_user_id) then
    return false;
  end if;

  select *
  into v_privacy
  from private.profile_effective_privacy(p_target_user_id);

  v_visibility := case lower(coalesce(p_section, 'profile'))
    when 'analytics' then v_privacy.analytics_visibility
    when 'activities' then v_privacy.activities_visibility
    when 'achievements' then v_privacy.achievements_visibility
    when 'organization' then v_privacy.organization_visibility
    else v_privacy.profile_visibility
  end;

  if v_visibility = 'public' then
    return true;
  end if;

  if v_visibility = 'connections' then
    return private.profile_connection_status(p_viewer_user_id, p_target_user_id) = 'accepted';
  end if;

  if v_visibility = 'trusted' then
    return private.profile_shared_trusted_context(
      p_viewer_user_id,
      p_target_user_id,
      p_leaderboard_language
    );
  end if;

  return false;
end;
$$;

create or replace function private.get_profile_public_data(
  p_target_user_id uuid default null,
  p_handle text default null,
  p_leaderboard_language text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_user_id uuid := auth.uid();
  v_target public.profiles%rowtype;
  v_handle text := lower(regexp_replace(trim(coalesce(p_handle, '')), '^@+', ''));
  v_language text := case lower(nullif(trim(coalesce(p_leaderboard_language, '')), ''))
    when 'vi' then 'vi'
    else 'en'
  end;
  v_connection_status text;
  v_privacy record;
  v_profile_visible boolean;
  v_analytics_visible boolean;
  v_activities_visible boolean;
  v_achievements_visible boolean;
  v_organization_visible boolean;
  v_state text;
  v_friend_count integer := 0;
  v_season jsonb := null;
  v_organization jsonb := null;
  v_can_request boolean := false;
begin
  if v_viewer_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_target_user_id is null and v_handle = '' then
    p_target_user_id := v_viewer_user_id;
  end if;

  if p_target_user_id is not null then
    select *
    into v_target
    from public.profiles
    where id = p_target_user_id
    limit 1;
  else
    select profiles.*
    into v_target
    from public.profiles profiles
    left join public.profile_privacy_settings settings
      on settings.user_id = profiles.id
    where profiles.handle = v_handle
      and coalesce(settings.searchable_by_handle, true)
    limit 1;
  end if;

  if not found then
    return jsonb_build_object(
      'state', 'not_found',
      'profile', null,
      'connection', null
    );
  end if;

  v_connection_status := private.profile_connection_status(v_viewer_user_id, v_target.id);

  select *
  into v_privacy
  from private.profile_effective_privacy(v_target.id);

  v_can_request := v_connection_status = 'none'
    and coalesce(v_privacy.allow_connection_requests, true)
    and v_viewer_user_id <> v_target.id;

  if v_connection_status = 'blocked' then
    return jsonb_build_object(
      'state', 'blocked',
      'profile', null,
      'connection', jsonb_build_object(
        'status', 'blocked',
        'viewerCanRequest', false
      )
    );
  end if;

  v_profile_visible := private.profile_section_visible(
    v_viewer_user_id,
    v_target.id,
    'profile',
    v_language
  );

  if not v_profile_visible then
    return jsonb_build_object(
      'state', 'private',
      'profile', null,
      'connection', jsonb_build_object(
        'status', v_connection_status,
        'viewerCanRequest', v_can_request
      )
    );
  end if;

  v_analytics_visible := private.profile_section_visible(
    v_viewer_user_id,
    v_target.id,
    'analytics',
    v_language
  );
  v_activities_visible := private.profile_section_visible(
    v_viewer_user_id,
    v_target.id,
    'activities',
    v_language
  );
  v_achievements_visible := private.profile_section_visible(
    v_viewer_user_id,
    v_target.id,
    'achievements',
    v_language
  );
  v_organization_visible := private.profile_section_visible(
    v_viewer_user_id,
    v_target.id,
    'organization',
    v_language
  );

  select count(*)::integer
  into v_friend_count
  from public.profile_connections connections
  where connections.status = 'accepted'
    and (
      connections.requester_user_id = v_target.id
      or connections.recipient_user_id = v_target.id
    );

  if v_analytics_visible then
    with ranked as (
      select
        totals.user_id,
        totals.season_xp,
        cohorts.league_tier,
        cohorts.cohort_index,
        (rank() over (
          partition by totals.season_id, totals.leaderboard_language, cohorts.league_tier, cohorts.cohort_index
          order by totals.season_xp desc, totals.last_event_at asc nulls last, totals.user_id
        ))::integer as current_rank
      from public.xp_seasons seasons
      join public.xp_season_user_totals totals
        on totals.season_id = seasons.id
       and totals.leaderboard_language = v_language
      left join public.leaderboard_season_user_cohorts cohorts
        on cohorts.season_id = totals.season_id
       and cohorts.leaderboard_language = totals.leaderboard_language
       and cohorts.user_id = totals.user_id
      left join public.leaderboard_privacy_settings leaderboard_settings
        on leaderboard_settings.user_id = totals.user_id
      where seasons.status = 'active'
        and coalesce(leaderboard_settings.participate_in_leaderboards, true)
        and coalesce(leaderboard_settings.display_mode, 'public_name') <> 'hidden'
    )
    select jsonb_build_object(
      'language', v_language,
      'seasonXp', ranked.season_xp,
      'rank', ranked.current_rank,
      'leagueTier', ranked.league_tier,
      'cohortIndex', ranked.cohort_index
    )
    into v_season
    from ranked
    where ranked.user_id = v_target.id
    limit 1;
  end if;

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
    where memberships.user_id = v_target.id
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
      where memberships.user_id = v_target.id
        and memberships.status = 'active'
        and classes.status = 'active'
      order by memberships.joined_at desc
      limit 1;
    end if;
  end if;

  v_state := case
    when v_viewer_user_id = v_target.id then 'self'
    when v_profile_visible
      and v_analytics_visible
      and v_activities_visible
      and v_achievements_visible
      and v_organization_visible then 'visible'
    else 'limited'
  end;

  return jsonb_build_object(
    'state', v_state,
    'visibleSections', jsonb_build_object(
      'analytics', v_analytics_visible,
      'activities', v_activities_visible,
      'achievements', v_achievements_visible,
      'organization', v_organization_visible
    ),
    'connection', jsonb_build_object(
      'status', v_connection_status,
      'viewerCanRequest', v_can_request
    ),
    'profile', jsonb_build_object(
      'userId', v_target.id,
      'handle', v_target.handle,
      'displayName', coalesce(nullif(v_target.display_name, ''), 'Thinkfy debater'),
      'avatarUrl', v_target.avatar_url,
      'selectedTitle', case when v_achievements_visible then v_target.selected_title else null end,
      'profileStatus', nullif(v_target.profile_status, ''),
      'level', case when v_analytics_visible then v_target.level else null end,
      'lifetimeXp', case when v_analytics_visible then greatest(coalesce(v_target.xp, 0), 0) else null end,
      'season', v_season,
      'organization', v_organization,
      'friendCounts', jsonb_build_object('friends', v_friend_count),
      'featuredAchievements', case when v_achievements_visible then '[]'::jsonb else null end
    )
  );
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

  if p_target_user_id is null or not exists (
    select 1 from public.profiles where id = p_target_user_id
  ) then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_requester_user_id = p_target_user_id then
    return jsonb_build_object('status', 'self');
  end if;

  if private.profile_is_blocked_between(v_requester_user_id, p_target_user_id) then
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

  return jsonb_build_object(
    'status', 'submitted',
    'reportId', v_report_id
  );
end;
$$;

create or replace function public.get_profile_public_data(
  p_target_user_id uuid default null,
  p_handle text default null,
  p_leaderboard_language text default 'en'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_profile_public_data(p_target_user_id, p_handle, p_leaderboard_language);
$$;

create or replace function public.request_profile_connection(p_target_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.request_profile_connection(p_target_user_id);
$$;

create or replace function public.respond_to_profile_connection(
  p_requester_user_id uuid,
  p_response text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.respond_to_profile_connection(p_requester_user_id, p_response);
$$;

create or replace function public.cancel_profile_connection(p_target_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_profile_connection(p_target_user_id);
$$;

create or replace function public.remove_profile_connection(p_target_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.remove_profile_connection(p_target_user_id);
$$;

create or replace function public.block_profile(p_target_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.block_profile(p_target_user_id);
$$;

create or replace function public.unblock_profile(p_target_user_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.unblock_profile(p_target_user_id);
$$;

create or replace function public.report_profile(
  p_target_user_id uuid,
  p_reason text,
  p_details text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.report_profile(p_target_user_id, p_reason, p_details);
$$;

revoke all on function private.profile_is_blocked_between(uuid, uuid) from public, anon, authenticated;
grant execute on function private.profile_is_blocked_between(uuid, uuid) to service_role;

revoke all on function private.ensure_profile_privacy_settings() from public, anon, authenticated;
grant execute on function private.ensure_profile_privacy_settings() to service_role;

revoke all on function private.profile_effective_privacy(uuid) from public, anon, authenticated;
grant execute on function private.profile_effective_privacy(uuid) to service_role;

revoke all on function private.profile_connection_status(uuid, uuid) from public, anon, authenticated;
grant execute on function private.profile_connection_status(uuid, uuid) to service_role;

revoke all on function private.profile_shared_trusted_context(uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.profile_shared_trusted_context(uuid, uuid, text) to service_role;

revoke all on function private.profile_section_visible(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function private.profile_section_visible(uuid, uuid, text, text) to service_role;

revoke all on function private.get_profile_public_data(uuid, text, text) from public, anon;
grant execute on function private.get_profile_public_data(uuid, text, text) to authenticated, service_role;

revoke all on function private.request_profile_connection(uuid) from public, anon;
grant execute on function private.request_profile_connection(uuid) to authenticated, service_role;

revoke all on function private.respond_to_profile_connection(uuid, text) from public, anon;
grant execute on function private.respond_to_profile_connection(uuid, text) to authenticated, service_role;

revoke all on function private.cancel_profile_connection(uuid) from public, anon;
grant execute on function private.cancel_profile_connection(uuid) to authenticated, service_role;

revoke all on function private.remove_profile_connection(uuid) from public, anon;
grant execute on function private.remove_profile_connection(uuid) to authenticated, service_role;

revoke all on function private.block_profile(uuid) from public, anon;
grant execute on function private.block_profile(uuid) to authenticated, service_role;

revoke all on function private.unblock_profile(uuid) from public, anon;
grant execute on function private.unblock_profile(uuid) to authenticated, service_role;

revoke all on function private.report_profile(uuid, text, text) from public, anon;
grant execute on function private.report_profile(uuid, text, text) to authenticated, service_role;

revoke all on function public.get_profile_public_data(uuid, text, text) from public, anon;
grant execute on function public.get_profile_public_data(uuid, text, text) to authenticated, service_role;

revoke all on function public.request_profile_connection(uuid) from public, anon;
grant execute on function public.request_profile_connection(uuid) to authenticated, service_role;

revoke all on function public.respond_to_profile_connection(uuid, text) from public, anon;
grant execute on function public.respond_to_profile_connection(uuid, text) to authenticated, service_role;

revoke all on function public.cancel_profile_connection(uuid) from public, anon;
grant execute on function public.cancel_profile_connection(uuid) to authenticated, service_role;

revoke all on function public.remove_profile_connection(uuid) from public, anon;
grant execute on function public.remove_profile_connection(uuid) to authenticated, service_role;

revoke all on function public.block_profile(uuid) from public, anon;
grant execute on function public.block_profile(uuid) to authenticated, service_role;

revoke all on function public.unblock_profile(uuid) from public, anon;
grant execute on function public.unblock_profile(uuid) to authenticated, service_role;

revoke all on function public.report_profile(uuid, text, text) from public, anon;
grant execute on function public.report_profile(uuid, text, text) to authenticated, service_role;

notify pgrst, 'reload schema';
