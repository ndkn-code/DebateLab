-- ============================================================
-- XP revamp foundation: ledger, seasons, and leaderboard-ready
-- snapshots. Preserves existing profile XP as a legacy baseline.
-- ============================================================

create schema if not exists private;
grant usage on schema private to authenticated;
grant usage on schema private to service_role;

create table if not exists public.xp_legacy_baselines (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  baseline_xp integer not null default 0 check (baseline_xp >= 0),
  baseline_level integer not null default 1 check (baseline_level >= 1),
  captured_at timestamptz not null default now()
);

insert into public.xp_legacy_baselines (user_id, baseline_xp, baseline_level)
select id, greatest(coalesce(xp, 0), 0), greatest(coalesce(level, 1), 1)
from public.profiles
on conflict (user_id) do nothing;

create table if not exists public.xp_seasons (
  id uuid primary key default gen_random_uuid(),
  season_key text not null unique,
  season_type text not null default 'weekly'
    check (season_type in ('weekly')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'America/New_York',
  status text not null default 'active'
    check (status in ('active', 'closed')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (season_type, starts_at)
);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.xp_seasons(id) on delete restrict,
  source_type text not null,
  source_id uuid,
  activity_type text,
  reference_type text,
  xp_category text not null
    check (xp_category in ('practice', 'lesson', 'course', 'duel', 'assignment', 'social', 'legacy')),
  lifetime_xp integer not null default 0 check (lifetime_xp >= 0),
  season_xp integer not null default 0 check (season_xp >= 0),
  club_id uuid references public.clubs(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.xp_season_user_totals (
  season_id uuid not null references public.xp_seasons(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_xp integer not null default 0 check (season_xp >= 0),
  lifetime_xp integer not null default 0 check (lifetime_xp >= 0),
  event_count integer not null default 0 check (event_count >= 0),
  category_breakdown jsonb not null default '{}'::jsonb,
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (season_id, user_id)
);

create table if not exists public.xp_season_org_totals (
  season_id uuid not null references public.xp_seasons(id) on delete cascade,
  organization_type text not null check (organization_type in ('club', 'class')),
  organization_id uuid not null,
  season_xp integer not null default 0 check (season_xp >= 0),
  event_count integer not null default 0 check (event_count >= 0),
  contributing_user_count integer not null default 0 check (contributing_user_count >= 0),
  active_member_count integer not null default 0 check (active_member_count >= 0),
  normalized_xp numeric(12, 2) not null default 0,
  category_breakdown jsonb not null default '{}'::jsonb,
  last_event_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (season_id, organization_type, organization_id)
);

create index if not exists idx_xp_events_user_occurred
  on public.xp_events(user_id, occurred_at desc);
create index if not exists idx_xp_events_season_user
  on public.xp_events(season_id, user_id, season_xp desc);
create index if not exists idx_xp_events_category_occurred
  on public.xp_events(user_id, xp_category, occurred_at desc);
create index if not exists idx_xp_events_club_season
  on public.xp_events(season_id, club_id)
  where club_id is not null;
create index if not exists idx_xp_events_class_season
  on public.xp_events(season_id, class_id)
  where class_id is not null;
create index if not exists idx_xp_user_totals_rank
  on public.xp_season_user_totals(season_id, season_xp desc, last_event_at asc);
create index if not exists idx_xp_org_totals_rank
  on public.xp_season_org_totals(season_id, organization_type, normalized_xp desc, season_xp desc);

alter table public.xp_legacy_baselines enable row level security;
alter table public.xp_seasons enable row level security;
alter table public.xp_events enable row level security;
alter table public.xp_season_user_totals enable row level security;
alter table public.xp_season_org_totals enable row level security;

drop policy if exists "Users can view own xp baseline" on public.xp_legacy_baselines;
create policy "Users can view own xp baseline"
  on public.xp_legacy_baselines for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Authenticated users can view xp seasons" on public.xp_seasons;
create policy "Authenticated users can view xp seasons"
  on public.xp_seasons for select
  to authenticated
  using (true);

drop policy if exists "Users can view own xp events" on public.xp_events;
create policy "Users can view own xp events"
  on public.xp_events for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users can view own xp season totals" on public.xp_season_user_totals;
create policy "Users can view own xp season totals"
  on public.xp_season_user_totals for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Members can view organization xp season totals" on public.xp_season_org_totals;
create policy "Members can view organization xp season totals"
  on public.xp_season_org_totals for select
  to authenticated
  using (
    private.is_admin((select auth.uid()))
    or (
      organization_type = 'club'
      and private.can_view_club(organization_id, (select auth.uid()))
    )
    or (
      organization_type = 'class'
      and private.can_view_class(organization_id, (select auth.uid()))
    )
  );

grant select on public.xp_legacy_baselines to authenticated;
grant select on public.xp_seasons to authenticated;
grant select on public.xp_events to authenticated;
grant select on public.xp_season_user_totals to authenticated;
grant select on public.xp_season_org_totals to authenticated;

create or replace function private.xp_local_date(p_timestamp timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_timestamp at time zone 'America/New_York')::date;
$$;

create or replace function private.xp_week_start_date(p_date date)
returns date
language sql
immutable
set search_path = ''
as $$
  select p_date - (((extract(dow from p_date)::integer + 6) % 7));
$$;

create or replace function private.ensure_xp_weekly_season(p_occurred_at timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_local_date date;
  v_start_date date;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_season_key text;
  v_season_id uuid;
begin
  v_local_date := private.xp_local_date(coalesce(p_occurred_at, now()));
  v_start_date := private.xp_week_start_date(v_local_date);
  v_starts_at := (v_start_date::timestamp at time zone 'America/New_York');
  v_ends_at := v_starts_at + interval '7 days';
  v_season_key := 'weekly:' || to_char(v_start_date, 'YYYY-MM-DD');

  insert into public.xp_seasons (season_key, season_type, starts_at, ends_at, timezone)
  values (v_season_key, 'weekly', v_starts_at, v_ends_at, 'America/New_York')
  on conflict (season_key)
  do update set updated_at = now()
  returning id into v_season_id;

  return v_season_id;
end;
$$;

create or replace function private.xp_category_daily_cap(p_category text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'practice' then 220
    when 'lesson' then 120
    when 'course' then 180
    when 'duel' then 160
    when 'assignment' then 180
    when 'social' then 20
    when 'legacy' then 10000
    else 200
  end;
$$;

create or replace function private.xp_category_weekly_cap(p_category text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'practice' then 900
    when 'lesson' then 450
    when 'course' then 300
    when 'duel' then 500
    when 'assignment' then 600
    when 'social' then 60
    when 'legacy' then 10000
    else 800
  end;
$$;

create or replace function private.xp_increment_breakdown(
  p_breakdown jsonb,
  p_category text,
  p_amount integer
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_set(
    coalesce(p_breakdown, '{}'::jsonb),
    array[p_category],
    to_jsonb(coalesce((p_breakdown ->> p_category)::integer, 0) + greatest(coalesce(p_amount, 0), 0)),
    true
  );
$$;

create or replace function private.upsert_xp_org_total(
  p_season_id uuid,
  p_organization_type text,
  p_organization_id uuid,
  p_category text,
  p_season_xp integer,
  p_occurred_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_member_count integer;
begin
  if p_organization_id is null then
    return;
  end if;

  if p_organization_type = 'club' then
    select count(distinct memberships.user_id)::integer
    into v_active_member_count
    from public.club_memberships memberships
    where memberships.club_id = p_organization_id
      and memberships.status = 'active';
  elsif p_organization_type = 'class' then
    select count(distinct memberships.user_id)::integer
    into v_active_member_count
    from public.class_memberships memberships
    where memberships.class_id = p_organization_id
      and memberships.status = 'active';
  else
    return;
  end if;

  v_active_member_count := greatest(coalesce(v_active_member_count, 0), 1);

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
  values (
    p_season_id,
    p_organization_type,
    p_organization_id,
    greatest(coalesce(p_season_xp, 0), 0),
    1,
    0,
    v_active_member_count,
    round(greatest(coalesce(p_season_xp, 0), 0)::numeric / v_active_member_count, 2),
    jsonb_build_object(p_category, greatest(coalesce(p_season_xp, 0), 0)),
    p_occurred_at
  )
  on conflict (season_id, organization_type, organization_id)
  do update set
    season_xp = public.xp_season_org_totals.season_xp + excluded.season_xp,
    event_count = public.xp_season_org_totals.event_count + 1,
    active_member_count = excluded.active_member_count,
    normalized_xp = round(
      (public.xp_season_org_totals.season_xp + excluded.season_xp)::numeric /
      greatest(excluded.active_member_count, 1),
      2
    ),
    category_breakdown = private.xp_increment_breakdown(
      public.xp_season_org_totals.category_breakdown,
      p_category,
      excluded.season_xp
    ),
    last_event_at = greatest(
      coalesce(public.xp_season_org_totals.last_event_at, excluded.last_event_at),
      excluded.last_event_at
    ),
    updated_at = now();

  update public.xp_season_org_totals totals
  set contributing_user_count = (
      select count(distinct events.user_id)::integer
      from public.xp_events events
      where events.season_id = p_season_id
        and (
          (p_organization_type = 'club' and events.club_id = p_organization_id)
          or (p_organization_type = 'class' and events.class_id = p_organization_id)
        )
    ),
    active_member_count = v_active_member_count,
    normalized_xp = round(totals.season_xp::numeric / greatest(v_active_member_count, 1), 2),
    updated_at = now()
  where totals.season_id = p_season_id
    and totals.organization_type = p_organization_type
    and totals.organization_id = p_organization_id;
end;
$$;

create or replace function private.award_xp_event(
  p_user_id uuid,
  p_source_type text,
  p_xp_category text,
  p_idempotency_key text,
  p_source_id uuid default null,
  p_activity_type text default null,
  p_reference_type text default null,
  p_lifetime_xp integer default 0,
  p_season_xp integer default null,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb,
  p_sessions integer default 0,
  p_minutes integer default 0,
  p_score numeric default null,
  p_club_id uuid default null,
  p_class_id uuid default null
)
returns table (
  event_id uuid,
  inserted boolean,
  lifetime_xp_awarded integer,
  season_xp_awarded integer,
  season_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_event_id uuid;
  v_requested_lifetime_xp integer;
  v_requested_season_xp integer;
  v_daily_cap integer;
  v_weekly_cap integer;
  v_daily_existing integer;
  v_weekly_existing integer;
  v_effective_season_xp integer;
  v_effective_lifetime_xp integer;
  v_local_date date;
  v_event_metadata jsonb;
  v_existing record;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;
  if coalesce(trim(p_source_type), '') = '' then
    raise exception 'p_source_type is required';
  end if;
  if coalesce(trim(p_xp_category), '') = '' then
    raise exception 'p_xp_category is required';
  end if;
  if coalesce(trim(p_idempotency_key), '') = '' then
    raise exception 'p_idempotency_key is required';
  end if;
  if p_xp_category not in ('practice', 'lesson', 'course', 'duel', 'assignment', 'social', 'legacy') then
    raise exception 'Unsupported XP category: %', p_xp_category;
  end if;

  v_requested_lifetime_xp := greatest(coalesce(p_lifetime_xp, 0), 0);
  v_requested_season_xp := greatest(coalesce(p_season_xp, p_lifetime_xp, 0), 0);
  v_season_id := private.ensure_xp_weekly_season(coalesce(p_occurred_at, now()));
  v_local_date := private.xp_local_date(coalesce(p_occurred_at, now()));
  v_daily_cap := private.xp_category_daily_cap(p_xp_category);
  v_weekly_cap := private.xp_category_weekly_cap(p_xp_category);

  select coalesce(sum(events.season_xp), 0)::integer
  into v_daily_existing
  from public.xp_events events
  where events.user_id = p_user_id
    and events.xp_category = p_xp_category
    and private.xp_local_date(events.occurred_at) = v_local_date;

  select coalesce(sum(events.season_xp), 0)::integer
  into v_weekly_existing
  from public.xp_events events
  where events.user_id = p_user_id
    and events.xp_category = p_xp_category
    and events.season_id = v_season_id;

  v_effective_season_xp := least(
    v_requested_season_xp,
    greatest(v_daily_cap - coalesce(v_daily_existing, 0), 0),
    greatest(v_weekly_cap - coalesce(v_weekly_existing, 0), 0)
  );

  v_effective_lifetime_xp := case
    when v_requested_lifetime_xp <= 0 then 0
    when v_requested_season_xp <= 0 then v_requested_lifetime_xp
    else floor(v_requested_lifetime_xp::numeric * (v_effective_season_xp::numeric / greatest(v_requested_season_xp, 1)))::integer
  end;

  v_event_metadata := coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object(
    'requested_lifetime_xp', v_requested_lifetime_xp,
    'requested_season_xp', v_requested_season_xp,
    'effective_lifetime_xp', v_effective_lifetime_xp,
    'effective_season_xp', v_effective_season_xp,
    'daily_category_cap', v_daily_cap,
    'weekly_category_cap', v_weekly_cap,
    'daily_category_xp_before', coalesce(v_daily_existing, 0),
    'weekly_category_xp_before', coalesce(v_weekly_existing, 0),
    'cap_applied', v_effective_season_xp <> v_requested_season_xp
  );

  insert into public.xp_events (
    user_id,
    season_id,
    source_type,
    source_id,
    activity_type,
    reference_type,
    xp_category,
    lifetime_xp,
    season_xp,
    club_id,
    class_id,
    metadata,
    occurred_at,
    idempotency_key
  )
  values (
    p_user_id,
    v_season_id,
    p_source_type,
    p_source_id,
    p_activity_type,
    p_reference_type,
    p_xp_category,
    v_effective_lifetime_xp,
    v_effective_season_xp,
    p_club_id,
    p_class_id,
    v_event_metadata,
    coalesce(p_occurred_at, now()),
    p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select events.id, events.lifetime_xp, events.season_xp, events.season_id
    into v_existing
    from public.xp_events events
    where events.idempotency_key = p_idempotency_key;

    event_id := v_existing.id;
    inserted := false;
    lifetime_xp_awarded := coalesce(v_existing.lifetime_xp, 0);
    season_xp_awarded := coalesce(v_existing.season_xp, 0);
    season_id := v_existing.season_id;
    return next;
    return;
  end if;

  if v_effective_lifetime_xp > 0 then
    update public.profiles
    set xp = greatest(coalesce(xp, 0) + v_effective_lifetime_xp, 0),
        level = greatest(floor((coalesce(xp, 0) + v_effective_lifetime_xp) / 500)::integer + 1, 1),
        updated_at = now()
    where id = p_user_id;
  end if;

  if p_activity_type is not null then
    insert into public.activity_log (
      user_id,
      activity_type,
      reference_id,
      reference_type,
      xp_earned,
      metadata,
      created_at
    )
    values (
      p_user_id,
      p_activity_type,
      p_source_id,
      p_reference_type,
      v_effective_lifetime_xp,
      v_event_metadata,
      coalesce(p_occurred_at, now())
    );
  end if;

  if coalesce(p_sessions, 0) <> 0
    or coalesce(p_minutes, 0) <> 0
    or v_effective_lifetime_xp <> 0
    or p_score is not null then
    insert into public.daily_stats (
      user_id,
      date,
      sessions_completed,
      practice_minutes,
      minutes_studied,
      average_score,
      xp_earned
    )
    values (
      p_user_id,
      v_local_date,
      greatest(coalesce(p_sessions, 0), 0),
      greatest(coalesce(p_minutes, 0), 0),
      greatest(coalesce(p_minutes, 0), 0),
      case when p_score is null then null else round(p_score)::integer end,
      v_effective_lifetime_xp
    )
    on conflict (user_id, date)
    do update set
      sessions_completed = public.daily_stats.sessions_completed + excluded.sessions_completed,
      practice_minutes = public.daily_stats.practice_minutes + excluded.practice_minutes,
      minutes_studied = public.daily_stats.minutes_studied + excluded.minutes_studied,
      average_score = case
        when p_score is null then public.daily_stats.average_score
        when public.daily_stats.average_score is null then round(p_score)::integer
        else round(
          (
            public.daily_stats.average_score::numeric *
            greatest(public.daily_stats.sessions_completed, 1) +
            p_score
          ) /
          greatest(public.daily_stats.sessions_completed + greatest(excluded.sessions_completed, 1), 1)
        )::integer
      end,
      xp_earned = public.daily_stats.xp_earned + excluded.xp_earned;
  end if;

  insert into public.xp_season_user_totals (
    season_id,
    user_id,
    season_xp,
    lifetime_xp,
    event_count,
    category_breakdown,
    last_event_at
  )
  values (
    v_season_id,
    p_user_id,
    v_effective_season_xp,
    v_effective_lifetime_xp,
    1,
    jsonb_build_object(p_xp_category, v_effective_season_xp),
    coalesce(p_occurred_at, now())
  )
  on conflict (season_id, user_id)
  do update set
    season_xp = public.xp_season_user_totals.season_xp + excluded.season_xp,
    lifetime_xp = public.xp_season_user_totals.lifetime_xp + excluded.lifetime_xp,
    event_count = public.xp_season_user_totals.event_count + 1,
    category_breakdown = private.xp_increment_breakdown(
      public.xp_season_user_totals.category_breakdown,
      p_xp_category,
      excluded.season_xp
    ),
    last_event_at = greatest(
      coalesce(public.xp_season_user_totals.last_event_at, excluded.last_event_at),
      excluded.last_event_at
    ),
    updated_at = now();

  perform private.upsert_xp_org_total(
    v_season_id,
    'club',
    p_club_id,
    p_xp_category,
    v_effective_season_xp,
    coalesce(p_occurred_at, now())
  );

  perform private.upsert_xp_org_total(
    v_season_id,
    'class',
    p_class_id,
    p_xp_category,
    v_effective_season_xp,
    coalesce(p_occurred_at, now())
  );

  event_id := v_event_id;
  inserted := true;
  lifetime_xp_awarded := v_effective_lifetime_xp;
  season_xp_awarded := v_effective_season_xp;
  season_id := v_season_id;
  return next;
end;
$$;

create or replace function public.award_xp_event(
  p_user_id uuid,
  p_source_type text,
  p_xp_category text,
  p_idempotency_key text,
  p_source_id uuid default null,
  p_activity_type text default null,
  p_reference_type text default null,
  p_lifetime_xp integer default 0,
  p_season_xp integer default null,
  p_occurred_at timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb,
  p_sessions integer default 0,
  p_minutes integer default 0,
  p_score numeric default null,
  p_club_id uuid default null,
  p_class_id uuid default null
)
returns table (
  event_id uuid,
  inserted boolean,
  lifetime_xp_awarded integer,
  season_xp_awarded integer,
  season_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  select *
  from private.award_xp_event(
    p_user_id,
    p_source_type,
    p_xp_category,
    p_idempotency_key,
    p_source_id,
    p_activity_type,
    p_reference_type,
    p_lifetime_xp,
    p_season_xp,
    p_occurred_at,
    p_metadata,
    p_sessions,
    p_minutes,
    p_score,
    p_club_id,
    p_class_id
  );
end;
$$;

create or replace function public.backfill_legacy_xp_events(
  p_since timestamptz default (now() - interval '90 days')
)
returns table (inserted_count integer)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  inserted_row public.xp_events%rowtype;
  v_inserted integer := 0;
begin
  for inserted_row in
    with source_logs as (
      select
        logs.id,
        logs.user_id,
        logs.activity_type,
        logs.reference_id,
        logs.reference_type,
        greatest(coalesce(logs.xp_earned, 0), 0) as xp_earned,
        logs.metadata,
        logs.created_at,
        private.ensure_xp_weekly_season(logs.created_at) as season_id,
        case
          when logs.activity_type = 'debate_completed' then 'practice'
          when logs.activity_type = 'lesson_completed' then 'lesson'
          when logs.activity_type = 'course_completed' then 'course'
          when logs.activity_type = 'duel_completed' then 'duel'
          else 'legacy'
        end as category
      from public.activity_log logs
      where logs.created_at >= p_since
        and coalesce(logs.xp_earned, 0) >= 0
    )
    insert into public.xp_events (
      user_id,
      season_id,
      source_type,
      source_id,
      activity_type,
      reference_type,
      xp_category,
      lifetime_xp,
      season_xp,
      metadata,
      occurred_at,
      idempotency_key
    )
    select
      source_logs.user_id,
      source_logs.season_id,
      coalesce(source_logs.reference_type, source_logs.activity_type, 'legacy'),
      source_logs.reference_id,
      source_logs.activity_type,
      source_logs.reference_type,
      source_logs.category,
      0,
      source_logs.xp_earned,
      coalesce(source_logs.metadata, '{}'::jsonb) || jsonb_build_object(
        'backfill_source', 'activity_log',
        'backfill_activity_log_id', source_logs.id,
        'legacy_lifetime_xp_already_in_profile', source_logs.xp_earned
      ),
      source_logs.created_at,
      'legacy:activity_log:' || source_logs.id::text
    from source_logs
    on conflict (idempotency_key) do nothing
    returning *
  loop
    v_inserted := v_inserted + 1;

    insert into public.xp_season_user_totals (
      season_id,
      user_id,
      season_xp,
      lifetime_xp,
      event_count,
      category_breakdown,
      last_event_at
    )
    values (
      inserted_row.season_id,
      inserted_row.user_id,
      inserted_row.season_xp,
      0,
      1,
      jsonb_build_object(inserted_row.xp_category, inserted_row.season_xp),
      inserted_row.occurred_at
    )
    on conflict (season_id, user_id)
    do update set
      season_xp = public.xp_season_user_totals.season_xp + excluded.season_xp,
      event_count = public.xp_season_user_totals.event_count + 1,
      category_breakdown = private.xp_increment_breakdown(
        public.xp_season_user_totals.category_breakdown,
        inserted_row.xp_category,
        excluded.season_xp
      ),
      last_event_at = greatest(
        coalesce(public.xp_season_user_totals.last_event_at, excluded.last_event_at),
        excluded.last_event_at
      ),
      updated_at = now();
  end loop;

  inserted_count := v_inserted;
  return next;
end;
$$;

revoke all on function public.award_xp_event(
  uuid, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb, integer, integer, numeric, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.award_xp_event(
  uuid, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb, integer, integer, numeric, uuid, uuid
) to service_role;

revoke all on function public.backfill_legacy_xp_events(timestamptz)
  from public, anon, authenticated;
grant execute on function public.backfill_legacy_xp_events(timestamptz)
  to service_role;

grant execute on function private.award_xp_event(
  uuid, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb, integer, integer, numeric, uuid, uuid
) to service_role;
grant execute on function private.ensure_xp_weekly_season(timestamptz) to service_role;

-- Legacy RPCs are retained during the production cutover so the currently
-- deployed app release keeps working until the ledger-aware release is live.
-- A follow-up hardening migration should revoke authenticated access after
-- production traffic has fully moved to public.award_xp_event.
revoke all on function public.increment_xp(uuid, integer) from public, anon;
grant execute on function public.increment_xp(uuid, integer) to authenticated, service_role;

revoke all on function public.upsert_daily_stats(uuid, integer, integer, integer, numeric)
  from public, anon;
grant execute on function public.upsert_daily_stats(uuid, integer, integer, integer, numeric)
  to authenticated, service_role;
