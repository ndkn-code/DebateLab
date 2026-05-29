-- Phase 3/4 leaderboard launch primitives.
-- This migration is intentionally staged in-repo only until production approval.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.leaderboard_user_leagues (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  league_tier text not null default 'novice'
    check (league_tier in ('novice', 'constructive', 'rebuttal', 'whip', 'champion')),
  last_season_id uuid references public.xp_seasons(id) on delete set null,
  last_rank integer check (last_rank is null or last_rank > 0),
  last_zone text check (last_zone is null or last_zone in ('champion', 'promote', 'hold', 'demote', 'inactive')),
  updated_at timestamptz not null default now()
);

create table if not exists public.leaderboard_season_user_cohorts (
  season_id uuid not null references public.xp_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  league_tier text not null check (league_tier in ('novice', 'constructive', 'rebuttal', 'whip', 'champion')),
  cohort_index integer not null check (cohort_index >= 0),
  cohort_key text not null,
  previous_rank integer check (previous_rank is null or previous_rank > 0),
  previous_zone text check (previous_zone is null or previous_zone in ('champion', 'promote', 'hold', 'demote', 'inactive')),
  assigned_at timestamptz not null default now(),
  primary key (season_id, user_id),
  unique (season_id, league_tier, cohort_index, user_id)
);

create table if not exists public.leaderboard_season_results (
  season_id uuid not null references public.xp_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  league_tier text not null check (league_tier in ('novice', 'constructive', 'rebuttal', 'whip', 'champion')),
  cohort_index integer not null check (cohort_index >= 0),
  final_rank integer not null check (final_rank > 0),
  final_zone text not null check (final_zone in ('champion', 'promote', 'hold', 'demote', 'inactive')),
  season_xp integer not null default 0 check (season_xp >= 0),
  next_league_tier text not null check (next_league_tier in ('novice', 'constructive', 'rebuttal', 'whip', 'champion')),
  outcome text not null check (outcome in ('champion', 'promoted', 'held', 'demoted', 'inactive')),
  resolved_at timestamptz not null default now(),
  primary key (season_id, user_id)
);

create table if not exists public.club_join_codes (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  code_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'redeemed', 'revoked', 'expired')),
  role text not null default 'student'
    check (role = 'student'),
  expires_at timestamptz not null default (now() + interval '14 days'),
  issued_by uuid references public.profiles(id) on delete set null,
  redeemed_by uuid references public.profiles(id) on delete set null,
  redeemed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_club_memberships_one_active_student
  on public.club_memberships(user_id)
  where role = 'student' and status = 'active';

create index if not exists idx_leaderboard_cohorts_lookup
  on public.leaderboard_season_user_cohorts(season_id, league_tier, cohort_index);
create index if not exists idx_leaderboard_results_lookup
  on public.leaderboard_season_results(season_id, league_tier, cohort_index, final_rank);
create index if not exists idx_club_join_codes_club_status
  on public.club_join_codes(club_id, status, created_at desc);
create index if not exists idx_club_join_codes_redeemed_by
  on public.club_join_codes(redeemed_by)
  where redeemed_by is not null;

alter table public.leaderboard_user_leagues enable row level security;
alter table public.leaderboard_season_user_cohorts enable row level security;
alter table public.leaderboard_season_results enable row level security;
alter table public.club_join_codes enable row level security;

drop policy if exists "Users can view own leaderboard league" on public.leaderboard_user_leagues;
create policy "Users can view own leaderboard league"
  on public.leaderboard_user_leagues for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users can view own leaderboard cohort" on public.leaderboard_season_user_cohorts;
create policy "Users can view own leaderboard cohort"
  on public.leaderboard_season_user_cohorts for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users can view own leaderboard results" on public.leaderboard_season_results;
create policy "Users can view own leaderboard results"
  on public.leaderboard_season_results for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Club managers can view join codes" on public.club_join_codes;
create policy "Club managers can view join codes"
  on public.club_join_codes for select
  to authenticated
  using (
    private.can_manage_club(club_id, (select auth.uid()))
    or redeemed_by = (select auth.uid())
  );

drop policy if exists "Club managers can insert join codes" on public.club_join_codes;
create policy "Club managers can insert join codes"
  on public.club_join_codes for insert
  to authenticated
  with check (private.can_manage_club(club_id, (select auth.uid())));

drop policy if exists "Club managers can update join codes" on public.club_join_codes;
create policy "Club managers can update join codes"
  on public.club_join_codes for update
  to authenticated
  using (private.can_manage_club(club_id, (select auth.uid())))
  with check (private.can_manage_club(club_id, (select auth.uid())));

grant select on public.leaderboard_user_leagues to authenticated;
grant select on public.leaderboard_season_user_cohorts to authenticated;
grant select on public.leaderboard_season_results to authenticated;
grant select, insert, update on public.club_join_codes to authenticated;
grant all on public.leaderboard_user_leagues to service_role;
grant all on public.leaderboard_season_user_cohorts to service_role;
grant all on public.leaderboard_season_results to service_role;
grant all on public.club_join_codes to service_role;

create or replace function private.leaderboard_league_order(p_tier text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_tier
    when 'novice' then 0
    when 'constructive' then 1
    when 'rebuttal' then 2
    when 'whip' then 3
    when 'champion' then 4
    else 0
  end;
$$;

create or replace function private.leaderboard_league_from_order(p_order integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_order <= 0 then 'novice'
    when p_order = 1 then 'constructive'
    when p_order = 2 then 'rebuttal'
    when p_order = 3 then 'whip'
    else 'champion'
  end;
$$;

create or replace function private.leaderboard_personal_zone(
  p_league_tier text,
  p_rank integer,
  p_active_count integer
)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_active_count, 0) <= 0 or coalesce(p_rank, 0) <= 0 then 'inactive'
    when p_league_tier = 'champion' and p_rank <= 3 then 'champion'
    when p_league_tier <> 'champion' and p_rank <= 8 then 'promote'
    when p_league_tier <> 'novice'
      and p_active_count >= 12
      and p_rank > p_active_count - 5 then 'demote'
    else 'hold'
  end;
$$;

create or replace function private.leaderboard_next_league(p_league_tier text, p_zone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_zone = 'promote' then private.leaderboard_league_from_order(private.leaderboard_league_order(p_league_tier) + 1)
    when p_zone = 'demote' then private.leaderboard_league_from_order(private.leaderboard_league_order(p_league_tier) - 1)
    else p_league_tier
  end;
$$;

create or replace function private.leaderboard_outcome(p_league_tier text, p_zone text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_zone = 'champion' then 'champion'
    when p_zone = 'promote' then 'promoted'
    when p_zone = 'demote' then 'demoted'
    when p_zone = 'inactive' then 'inactive'
    else 'held'
  end;
$$;

create or replace function private.leaderboard_org_band(p_active_members integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when coalesce(p_active_members, 0) <= 10 then 'small'
    when p_active_members <= 30 then 'medium'
    else 'large'
  end;
$$;

create or replace function private.normalize_club_join_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

create or replace function private.hash_club_join_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(private.normalize_club_join_code(p_code), 'sha256'), 'hex');
$$;

create or replace function private.claim_club_join_code(p_code text)
returns table (
  status text,
  club_id uuid,
  membership_id uuid,
  message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := private.normalize_club_join_code(p_code);
  v_code_hash text;
  v_code_row public.club_join_codes%rowtype;
  v_existing public.club_memberships%rowtype;
  v_membership_id uuid;
begin
  if v_user_id is null then
    return query select 'auth_required'::text, null::uuid, null::uuid, 'Sign in to join an organization.'::text;
    return;
  end if;

  if length(v_code) < 6 then
    return query select 'malformed'::text, null::uuid, null::uuid, 'Enter a valid organization code.'::text;
    return;
  end if;

  v_code_hash := private.hash_club_join_code(v_code);

  select *
  into v_code_row
  from public.club_join_codes
  where code_hash = v_code_hash
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, 'That organization code was not found.'::text;
    return;
  end if;

  if v_code_row.status = 'redeemed' then
    return query select 'already_redeemed'::text, v_code_row.club_id, null::uuid, 'That organization code has already been used.'::text;
    return;
  end if;

  if v_code_row.status = 'revoked' then
    return query select 'revoked'::text, v_code_row.club_id, null::uuid, 'That organization code was revoked.'::text;
    return;
  end if;

  if v_code_row.status = 'expired' or v_code_row.expires_at <= now() then
    update public.club_join_codes
    set status = 'expired', updated_at = now()
    where id = v_code_row.id and status = 'pending';

    return query select 'expired'::text, v_code_row.club_id, null::uuid, 'That organization code has expired.'::text;
    return;
  end if;

  select *
  into v_existing
  from public.club_memberships
  where user_id = v_user_id
    and role = 'student'
    and status = 'active'
  limit 1;

  if found and v_existing.club_id <> v_code_row.club_id then
    return query select 'already_in_org'::text, v_existing.club_id, v_existing.id, 'You are already in an organization.'::text;
    return;
  end if;

  if found and v_existing.club_id = v_code_row.club_id then
    v_membership_id := v_existing.id;
  else
    insert into public.club_memberships (
      club_id,
      user_id,
      role,
      status,
      invited_by,
      metadata
    )
    values (
      v_code_row.club_id,
      v_user_id,
      'student',
      'active',
      v_code_row.issued_by,
      jsonb_build_object(
        'verification_method', 'join_code',
        'club_join_code_id', v_code_row.id
      )
    )
    on conflict (club_id, user_id, role)
    do update set
      status = 'active',
      removed_at = null,
      invited_by = excluded.invited_by,
      metadata = coalesce(public.club_memberships.metadata, '{}'::jsonb) || excluded.metadata,
      updated_at = now()
    returning id into v_membership_id;
  end if;

  update public.club_join_codes
  set status = 'redeemed',
      redeemed_by = v_user_id,
      redeemed_at = now(),
      updated_at = now()
  where id = v_code_row.id
    and status = 'pending';

  return query select 'accepted'::text, v_code_row.club_id, v_membership_id, 'Organization joined.'::text;
end;
$$;

create or replace function private.refresh_leaderboard_org_totals(p_season_id uuid)
returns table (refreshed_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.xp_season_org_totals
  where season_id = p_season_id
    and organization_type = 'club';

  insert into public.xp_season_org_totals (
    season_id,
    organization_type,
    organization_id,
    season_xp,
    event_count,
    contributing_user_count,
    active_member_count,
    normalized_xp,
    category_breakdown,
    last_event_at
  )
  with member_counts as (
    select
      memberships.club_id,
      count(distinct memberships.user_id)::integer as active_member_count
    from public.club_memberships memberships
    where memberships.role = 'student'
      and memberships.status = 'active'
    group by memberships.club_id
  ), event_counts as (
    select
      coalesce(events.club_id, classes.club_id) as club_id,
      coalesce(sum(events.season_xp), 0)::integer as season_xp,
      count(events.id)::integer as event_count,
      count(distinct events.user_id)::integer as contributing_user_count,
      max(events.occurred_at) as last_event_at
    from public.xp_events events
    left join public.classes classes
      on classes.id = events.class_id
    where events.season_id = p_season_id
      and coalesce(events.club_id, classes.club_id) is not null
    group by coalesce(events.club_id, classes.club_id)
  )
  select
    p_season_id,
    'club',
    clubs.id,
    coalesce(event_counts.season_xp, 0),
    coalesce(event_counts.event_count, 0),
    coalesce(event_counts.contributing_user_count, 0),
    coalesce(member_counts.active_member_count, 0),
    round(coalesce(event_counts.season_xp, 0)::numeric / greatest(coalesce(member_counts.active_member_count, 0), 1), 2),
    '{}'::jsonb,
    event_counts.last_event_at
  from public.clubs clubs
  left join member_counts on member_counts.club_id = clubs.id
  left join event_counts on event_counts.club_id = clubs.id
  where clubs.status = 'active';

  get diagnostics refreshed_count = row_count;
  return next;
end;
$$;

create or replace function private.refresh_leaderboard_season_cohorts(p_season_id uuid default null)
returns table (assigned_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
begin
  select coalesce(p_season_id, seasons.id)
  into v_season_id
  from public.xp_seasons seasons
  where p_season_id is not null
     or (seasons.starts_at <= now() and seasons.ends_at > now())
  order by seasons.starts_at desc
  limit 1;

  if v_season_id is null then
    assigned_count := 0;
    return next;
    return;
  end if;

  insert into public.leaderboard_user_leagues (user_id, league_tier)
  select totals.user_id, 'novice'
  from public.xp_season_user_totals totals
  where totals.season_id = v_season_id
  on conflict (user_id) do nothing;

  insert into public.leaderboard_season_user_cohorts (
    season_id,
    user_id,
    league_tier,
    cohort_index,
    cohort_key,
    previous_rank,
    previous_zone
  )
  select
    v_season_id,
    ranked.user_id,
    ranked.league_tier,
    ((ranked.ordinal - 1) / 30)::integer,
    ranked.league_tier || ':' || (((ranked.ordinal - 1) / 30)::integer)::text,
    previous.final_rank,
    previous.final_zone
  from (
    select
      totals.user_id,
      leagues.league_tier,
      row_number() over (
        partition by leagues.league_tier
        order by coalesce(previous.final_rank, 999999), totals.user_id
      ) as ordinal
    from public.xp_season_user_totals totals
    join public.leaderboard_user_leagues leagues
      on leagues.user_id = totals.user_id
    left join public.leaderboard_season_results previous
      on previous.user_id = totals.user_id
     and previous.season_id = leagues.last_season_id
    where totals.season_id = v_season_id
  ) ranked
  left join public.leaderboard_user_leagues leagues
    on leagues.user_id = ranked.user_id
  left join public.leaderboard_season_results previous
    on previous.user_id = ranked.user_id
   and previous.season_id = leagues.last_season_id
  on conflict (season_id, user_id) do nothing;

  get diagnostics assigned_count = row_count;
  return next;
end;
$$;

create or replace function private.close_leaderboard_season(p_season_id uuid)
returns table (resolved_count integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.leaderboard_season_results (
    season_id,
    user_id,
    league_tier,
    cohort_index,
    final_rank,
    final_zone,
    season_xp,
    next_league_tier,
    outcome
  )
  with ranked as (
    select
      cohorts.season_id,
      cohorts.user_id,
      cohorts.league_tier,
      cohorts.cohort_index,
      coalesce(totals.season_xp, 0)::integer as season_xp,
      row_number() over (
        partition by cohorts.league_tier, cohorts.cohort_index
        order by coalesce(totals.season_xp, 0) desc,
          coalesce(totals.last_event_at, '9999-12-31'::timestamptz) asc,
          cohorts.user_id asc
      )::integer as final_rank,
      count(*) over (partition by cohorts.league_tier, cohorts.cohort_index)::integer as active_count
    from public.leaderboard_season_user_cohorts cohorts
    left join public.xp_season_user_totals totals
      on totals.season_id = cohorts.season_id
     and totals.user_id = cohorts.user_id
    where cohorts.season_id = p_season_id
  ), zoned as (
    select
      ranked.*,
      private.leaderboard_personal_zone(ranked.league_tier, ranked.final_rank, ranked.active_count) as final_zone
    from ranked
  )
  select
    p_season_id,
    zoned.user_id,
    zoned.league_tier,
    zoned.cohort_index,
    zoned.final_rank,
    zoned.final_zone,
    zoned.season_xp,
    private.leaderboard_next_league(zoned.league_tier, zoned.final_zone),
    private.leaderboard_outcome(zoned.league_tier, zoned.final_zone)
  from zoned
  on conflict (season_id, user_id) do update set
    final_rank = excluded.final_rank,
    final_zone = excluded.final_zone,
    season_xp = excluded.season_xp,
    next_league_tier = excluded.next_league_tier,
    outcome = excluded.outcome,
    resolved_at = now();

  get diagnostics resolved_count = row_count;

  update public.leaderboard_user_leagues leagues
  set league_tier = results.next_league_tier,
      last_season_id = results.season_id,
      last_rank = results.final_rank,
      last_zone = results.final_zone,
      updated_at = now()
  from public.leaderboard_season_results results
  where results.season_id = p_season_id
    and results.user_id = leagues.user_id;

  update public.xp_seasons
  set status = 'closed',
      updated_at = now()
  where id = p_season_id;

  return next;
end;
$$;

create or replace function private.get_leaderboard_page_data(p_user_id uuid default auth.uid())
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_season_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_timezone text;
  v_season_label text;
  v_days_remaining integer;
  v_league_tier text := 'novice';
  v_cohort_index integer := 0;
  v_has_cohort boolean := false;
  v_personal_rows jsonb := '[]'::jsonb;
  v_current_user jsonb := null;
  v_org_rows jsonb := '[]'::jsonb;
  v_current_org jsonb := null;
  v_affiliation jsonb := null;
  v_active_count integer := 0;
  v_demotion_enabled boolean := false;
  v_status text := 'empty';
  v_reason text := null;
begin
  if auth.uid() is not null
    and v_user_id <> auth.uid()
    and not private.is_admin(auth.uid()) then
    v_user_id := auth.uid();
  end if;

  select seasons.id, seasons.starts_at, seasons.ends_at, seasons.timezone
  into v_season_id, v_starts_at, v_ends_at, v_timezone
  from public.xp_seasons seasons
  where seasons.starts_at <= now()
    and seasons.ends_at > now()
  order by seasons.starts_at desc
  limit 1;

  if v_season_id is null then
    select seasons.id, seasons.starts_at, seasons.ends_at, seasons.timezone
    into v_season_id, v_starts_at, v_ends_at, v_timezone
    from public.xp_seasons seasons
    order by seasons.starts_at desc
    limit 1;
  end if;

  if v_season_id is null then
    v_starts_at := date_trunc('week', now());
    v_ends_at := v_starts_at + interval '7 days';
    v_timezone := 'America/New_York';
    v_reason := 'No XP season has been created yet.';
  end if;

  v_season_label := to_char(v_starts_at at time zone v_timezone, 'Mon FMDD')
    || ' - '
    || to_char(v_ends_at at time zone v_timezone, 'Mon FMDD');
  v_days_remaining := greatest(0, ceil(extract(epoch from (v_ends_at - now())) / 86400.0)::integer);

  if v_season_id is not null then
    select cohorts.league_tier, cohorts.cohort_index, true
    into v_league_tier, v_cohort_index, v_has_cohort
    from public.leaderboard_season_user_cohorts cohorts
    where cohorts.season_id = v_season_id
      and cohorts.user_id = v_user_id
    limit 1;

    if not coalesce(v_has_cohort, false) then
      select coalesce(leagues.league_tier, 'novice')
      into v_league_tier
      from public.leaderboard_user_leagues leagues
      where leagues.user_id = v_user_id;
      v_league_tier := coalesce(v_league_tier, 'novice');
    end if;

    with base as (
      select
        totals.user_id,
        coalesce(nullif(profiles.display_name, ''), 'Thinkfy debater') as display_name,
        profiles.avatar_url,
        coalesce(nullif(left(regexp_replace(coalesce(profiles.display_name, profiles.email, 'T'), '[^[:alnum:] ]', '', 'g'), 2), ''), 'T') as initials,
        profiles.selected_title,
        totals.season_xp,
        null::numeric as average_score,
        cohorts.previous_rank,
        totals.last_event_at
      from public.xp_season_user_totals totals
      join public.profiles profiles
        on profiles.id = totals.user_id
      left join public.leaderboard_user_leagues leagues
        on leagues.user_id = totals.user_id
      left join public.leaderboard_season_user_cohorts cohorts
        on cohorts.season_id = totals.season_id
       and cohorts.user_id = totals.user_id
      where totals.season_id = v_season_id
        and coalesce(cohorts.league_tier, leagues.league_tier, 'novice') = v_league_tier
        and (
          not coalesce(v_has_cohort, false)
          or cohorts.cohort_index = v_cohort_index
        )
    ), ranked as (
      select
        base.*,
        row_number() over (
          order by base.season_xp desc,
            coalesce(base.average_score, -1) desc,
            coalesce(base.last_event_at, '9999-12-31'::timestamptz) asc,
            base.user_id asc
        )::integer as rank_position,
        count(*) over ()::integer as active_count
      from base
    ), rows as (
      select jsonb_build_object(
        'userId', ranked.user_id,
        'rank', ranked.rank_position,
        'displayName', ranked.display_name,
        'avatarUrl', ranked.avatar_url,
        'initials', upper(ranked.initials),
        'title', ranked.selected_title,
        'seasonXp', ranked.season_xp,
        'averageScore', ranked.average_score,
        'previousRank', ranked.previous_rank,
        'rankDelta', case when ranked.previous_rank is null then 0 else ranked.previous_rank - ranked.rank_position end,
        'lastEventAt', ranked.last_event_at,
        'zone', private.leaderboard_personal_zone(v_league_tier, ranked.rank_position, ranked.active_count),
        'isCurrentUser', ranked.user_id = v_user_id
      ) as row_json,
      ranked.user_id,
      ranked.active_count
      from ranked
    )
    select
      coalesce(jsonb_agg(row_json order by (row_json ->> 'rank')::integer), '[]'::jsonb),
      coalesce(max(active_count), 0),
      ((jsonb_agg(row_json) filter (where user_id = v_user_id)) -> 0)
    into v_personal_rows, v_active_count, v_current_user
    from rows;

    with affiliation as (
      select
        clubs.id,
        clubs.name,
        clubs.club_type,
        clubs.city,
        clubs.logo_url,
        memberships.role,
        memberships.joined_at,
        memberships.metadata
      from public.club_memberships memberships
      join public.clubs clubs
        on clubs.id = memberships.club_id
      where memberships.user_id = v_user_id
        and memberships.role = 'student'
        and memberships.status = 'active'
      order by memberships.joined_at asc
      limit 1
    )
    select jsonb_build_object(
      'organizationId', affiliation.id,
      'organizationType', 'club',
      'name', affiliation.name,
      'subtitle', initcap(affiliation.club_type),
      'logoUrl', affiliation.logo_url,
      'role', affiliation.role,
      'joinedAt', affiliation.joined_at,
      'verificationMethod', coalesce(affiliation.metadata ->> 'verification_method', 'admin')
    )
    into v_affiliation
    from affiliation;

    with org_base as (
      select
        clubs.id,
        clubs.name,
        clubs.club_type,
        clubs.city,
        clubs.logo_url,
        totals.season_xp,
        totals.contributing_user_count,
        totals.active_member_count,
        totals.normalized_xp,
        totals.last_event_at,
        private.leaderboard_org_band(totals.active_member_count) as band
      from public.xp_season_org_totals totals
      join public.clubs clubs
        on clubs.id = totals.organization_id
      where totals.season_id = v_season_id
        and totals.organization_type = 'club'
        and totals.active_member_count > 0
        and clubs.status = 'active'
    ), ranked as (
      select
        org_base.*,
        row_number() over (
          partition by org_base.band
          order by org_base.season_xp desc,
            org_base.contributing_user_count desc,
            org_base.normalized_xp desc,
            coalesce(org_base.last_event_at, '9999-12-31'::timestamptz) asc,
            org_base.id asc
        )::integer as rank_position
      from org_base
    ), rows as (
      select
        jsonb_build_object(
          'organizationId', ranked.id,
          'organizationType', 'club',
          'rank', ranked.rank_position,
          'name', ranked.name,
          'subtitle', initcap(ranked.club_type) || coalesce(' - ' || ranked.city, ''),
          'logoUrl', ranked.logo_url,
          'seasonXp', ranked.season_xp,
          'activeMembers', ranked.active_member_count,
          'contributingMembers', ranked.contributing_user_count,
          'previousRank', null,
          'rankDelta', 0,
          'lastEventAt', ranked.last_event_at,
          'band', ranked.band,
          'isCurrentOrganization', v_affiliation is not null and ranked.id = (v_affiliation ->> 'organizationId')::uuid
        ) as row_json,
        ranked.id
      from ranked
    )
    select
      coalesce(jsonb_agg(row_json order by (row_json ->> 'band'), (row_json ->> 'rank')::integer), '[]'::jsonb),
      ((jsonb_agg(row_json) filter (
        where v_affiliation is not null
          and id = (v_affiliation ->> 'organizationId')::uuid
      )) -> 0)
    into v_org_rows, v_current_org
    from rows;
  end if;

  v_demotion_enabled := v_league_tier <> 'novice' and v_active_count >= 12;
  v_status := case
    when jsonb_array_length(v_personal_rows) > 0 or jsonb_array_length(v_org_rows) > 0 then 'ready'
    else 'empty'
  end;

  return jsonb_build_object(
    'source', 'ledger',
    'status', v_status,
    'reason', v_reason,
    'season', jsonb_build_object(
      'id', coalesce(v_season_id::text, 'none'),
      'label', v_season_label,
      'startsAt', v_starts_at,
      'endsAt', v_ends_at,
      'timezone', v_timezone,
      'daysRemaining', v_days_remaining
    ),
    'personal', jsonb_build_object(
      'league', jsonb_build_object(
        'id', v_league_tier,
        'name', case v_league_tier
          when 'constructive' then 'Constructive League'
          when 'rebuttal' then 'Rebuttal League'
          when 'whip' then 'Whip League'
          when 'champion' then 'Champion League'
          else 'Novice League'
        end,
        'shortName', initcap(v_league_tier),
        'order', private.leaderboard_league_order(v_league_tier),
        'status', 'current'
      ),
      'tiers', (
        select jsonb_agg(jsonb_build_object(
          'id', tier.id,
          'name', tier.name,
          'shortName', tier.short_name,
          'order', tier.ordinal,
          'status', case
            when tier.ordinal < private.leaderboard_league_order(v_league_tier) then 'completed'
            when tier.ordinal = private.leaderboard_league_order(v_league_tier) then 'current'
            else 'locked'
          end
        ) order by tier.ordinal)
        from (
          values
            ('novice', 'Novice League', 'Novice', 0),
            ('constructive', 'Constructive League', 'Constructive', 1),
            ('rebuttal', 'Rebuttal League', 'Rebuttal', 2),
            ('whip', 'Whip League', 'Whip', 3),
            ('champion', 'Champion League', 'Champion', 4)
        ) as tier(id, name, short_name, ordinal)
      ),
      'cohort', jsonb_build_object(
        'seasonId', coalesce(v_season_id::text, 'none'),
        'leagueTier', v_league_tier,
        'cohortIndex', v_cohort_index,
        'cohortSize', 30
      ),
      'cohortSize', 30,
      'activeCount', v_active_count,
      'promotionCount', 8,
      'demotionCount', 5,
      'demotionEnabled', v_demotion_enabled,
      'championCount', 3,
      'outcome', (
        select jsonb_build_object(
          'seasonId', results.season_id,
          'finalRank', results.final_rank,
          'finalZone', results.final_zone,
          'seasonXp', results.season_xp,
          'fromLeagueTier', results.league_tier,
          'nextLeagueTier', results.next_league_tier,
          'outcome', results.outcome,
          'resolvedAt', results.resolved_at
        )
        from public.leaderboard_season_results results
        where results.user_id = v_user_id
        order by results.resolved_at desc
        limit 1
      ),
      'rows', v_personal_rows,
      'currentUser', v_current_user
    ),
    'organizations', jsonb_build_object(
      'bands', jsonb_build_array('small', 'medium', 'large'),
      'affiliation', v_affiliation,
      'rows', v_org_rows,
      'currentOrganization', v_current_org
    )
  );
end;
$$;

create or replace function public.claim_club_join_code(p_code text)
returns table (
  status text,
  club_id uuid,
  membership_id uuid,
  message text
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.claim_club_join_code(p_code);
$$;

create or replace function public.get_leaderboard_page_data(p_user_id uuid default auth.uid())
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_leaderboard_page_data(p_user_id);
$$;

create or replace function public.refresh_leaderboard_org_totals(p_season_id uuid)
returns table (refreshed_count integer)
language sql
security invoker
set search_path = ''
as $$
  select * from private.refresh_leaderboard_org_totals(p_season_id);
$$;

create or replace function public.refresh_leaderboard_season_cohorts(p_season_id uuid default null)
returns table (assigned_count integer)
language sql
security invoker
set search_path = ''
as $$
  select * from private.refresh_leaderboard_season_cohorts(p_season_id);
$$;

create or replace function public.close_leaderboard_season(p_season_id uuid)
returns table (resolved_count integer)
language sql
security invoker
set search_path = ''
as $$
  select * from private.close_leaderboard_season(p_season_id);
$$;

revoke all on function private.claim_club_join_code(text) from public, anon;
grant execute on function private.claim_club_join_code(text) to authenticated;

revoke all on function private.get_leaderboard_page_data(uuid) from public, anon;
grant execute on function private.get_leaderboard_page_data(uuid) to authenticated, service_role;

revoke all on function private.refresh_leaderboard_org_totals(uuid) from public, anon, authenticated;
grant execute on function private.refresh_leaderboard_org_totals(uuid) to service_role;

revoke all on function private.refresh_leaderboard_season_cohorts(uuid) from public, anon, authenticated;
grant execute on function private.refresh_leaderboard_season_cohorts(uuid) to service_role;

revoke all on function private.close_leaderboard_season(uuid) from public, anon, authenticated;
grant execute on function private.close_leaderboard_season(uuid) to service_role;

revoke all on function public.claim_club_join_code(text) from public, anon;
grant execute on function public.claim_club_join_code(text) to authenticated;

revoke all on function public.get_leaderboard_page_data(uuid) from public, anon;
grant execute on function public.get_leaderboard_page_data(uuid) to authenticated, service_role;

revoke all on function public.refresh_leaderboard_org_totals(uuid) from public, anon, authenticated;
grant execute on function public.refresh_leaderboard_org_totals(uuid) to service_role;

revoke all on function public.refresh_leaderboard_season_cohorts(uuid) from public, anon, authenticated;
grant execute on function public.refresh_leaderboard_season_cohorts(uuid) to service_role;

revoke all on function public.close_leaderboard_season(uuid) from public, anon, authenticated;
grant execute on function public.close_leaderboard_season(uuid) to service_role;
