-- Split weekly leaderboards by debate language while preserving shared lifetime XP.
-- Neutral/unattributed XP remains in xp_events and compatibility surfaces, but
-- does not count toward visible weekly personal or organization leaderboard rank.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.normalize_leaderboard_language(p_language text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(nullif(trim(coalesce(p_language, '')), ''))
    when 'en' then 'en'
    when 'vi' then 'vi'
    else null
  end;
$$;

create or replace function private.coerce_leaderboard_language(p_language text)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(private.normalize_leaderboard_language(p_language), 'en');
$$;

alter table public.xp_events
  add column if not exists leaderboard_language text;

do $$
begin
  alter table public.xp_events
    add constraint xp_events_leaderboard_language_check
    check (leaderboard_language is null or leaderboard_language in ('en', 'vi'));
exception
  when duplicate_object then null;
end
$$;

update public.xp_events
set leaderboard_language = private.normalize_leaderboard_language(
  coalesce(
    metadata ->> 'leaderboard_language',
    metadata ->> 'practice_language'
  )
)
where leaderboard_language is null;

alter table public.xp_season_user_totals
  add column if not exists leaderboard_language text not null default 'en';
alter table public.xp_season_org_totals
  add column if not exists leaderboard_language text not null default 'en';
alter table public.leaderboard_user_leagues
  add column if not exists leaderboard_language text not null default 'en';
alter table public.leaderboard_season_user_cohorts
  add column if not exists leaderboard_language text not null default 'en';
alter table public.leaderboard_season_results
  add column if not exists leaderboard_language text not null default 'en';

do $$
begin
  alter table public.xp_season_user_totals
    add constraint xp_season_user_totals_language_check
    check (leaderboard_language in ('en', 'vi'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.xp_season_org_totals
    add constraint xp_season_org_totals_language_check
    check (leaderboard_language in ('en', 'vi'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.leaderboard_user_leagues
    add constraint leaderboard_user_leagues_language_check
    check (leaderboard_language in ('en', 'vi'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.leaderboard_season_user_cohorts
    add constraint leaderboard_season_user_cohorts_language_check
    check (leaderboard_language in ('en', 'vi'));
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter table public.leaderboard_season_results
    add constraint leaderboard_season_results_language_check
    check (leaderboard_language in ('en', 'vi'));
exception
  when duplicate_object then null;
end
$$;

alter table public.xp_season_user_totals
  drop constraint if exists xp_season_user_totals_pkey;
alter table public.xp_season_user_totals
  add constraint xp_season_user_totals_pkey
  primary key (season_id, leaderboard_language, user_id);

alter table public.xp_season_org_totals
  drop constraint if exists xp_season_org_totals_pkey;
alter table public.xp_season_org_totals
  add constraint xp_season_org_totals_pkey
  primary key (season_id, leaderboard_language, organization_type, organization_id);

alter table public.leaderboard_user_leagues
  drop constraint if exists leaderboard_user_leagues_pkey;
alter table public.leaderboard_user_leagues
  add constraint leaderboard_user_leagues_pkey
  primary key (user_id, leaderboard_language);

alter table public.leaderboard_season_user_cohorts
  drop constraint if exists leaderboard_season_user_cohorts_pkey;
alter table public.leaderboard_season_user_cohorts
  drop constraint if exists leaderboard_season_user_cohorts_season_id_league_tier_cohort_index_user_id_key;
alter table public.leaderboard_season_user_cohorts
  drop constraint if exists leaderboard_season_user_cohorts_language_unique;
alter table public.leaderboard_season_user_cohorts
  add constraint leaderboard_season_user_cohorts_pkey
  primary key (season_id, leaderboard_language, user_id);
alter table public.leaderboard_season_user_cohorts
  add constraint leaderboard_season_user_cohorts_language_unique
  unique (season_id, leaderboard_language, league_tier, cohort_index, user_id);

alter table public.leaderboard_season_results
  drop constraint if exists leaderboard_season_results_pkey;
alter table public.leaderboard_season_results
  add constraint leaderboard_season_results_pkey
  primary key (season_id, leaderboard_language, user_id);

drop index if exists public.idx_xp_events_season_user;
drop index if exists public.idx_xp_events_club_season;
drop index if exists public.idx_xp_events_class_season;
drop index if exists public.idx_xp_user_totals_rank;
drop index if exists public.idx_xp_org_totals_rank;
drop index if exists public.idx_leaderboard_cohorts_lookup;
drop index if exists public.idx_leaderboard_results_lookup;

create index if not exists idx_xp_events_season_language_user
  on public.xp_events(season_id, leaderboard_language, user_id, season_xp desc)
  where leaderboard_language is not null;
create index if not exists idx_xp_events_club_season_language
  on public.xp_events(season_id, leaderboard_language, club_id)
  where club_id is not null and leaderboard_language is not null;
create index if not exists idx_xp_events_class_season_language
  on public.xp_events(season_id, leaderboard_language, class_id)
  where class_id is not null and leaderboard_language is not null;
create index if not exists idx_xp_user_totals_rank
  on public.xp_season_user_totals(season_id, leaderboard_language, season_xp desc, last_event_at asc);
create index if not exists idx_xp_org_totals_rank
  on public.xp_season_org_totals(season_id, leaderboard_language, organization_type, normalized_xp desc, season_xp desc);
create index if not exists idx_leaderboard_cohorts_lookup
  on public.leaderboard_season_user_cohorts(season_id, leaderboard_language, league_tier, cohort_index);
create index if not exists idx_leaderboard_results_lookup
  on public.leaderboard_season_results(season_id, leaderboard_language, league_tier, cohort_index, final_rank);
create index if not exists idx_leaderboard_user_leagues_last_season_language
  on public.leaderboard_user_leagues(last_season_id, leaderboard_language)
  where last_season_id is not null;

drop function if exists public.award_xp_event(uuid, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb, integer, integer, numeric, uuid, uuid);
drop function if exists private.award_xp_event(uuid, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb, integer, integer, numeric, uuid, uuid);
drop function if exists public.get_leaderboard_page_data_v2(uuid);
drop function if exists private.get_leaderboard_page_data_v2(uuid);
drop function if exists public.get_leaderboard_page_data(uuid);
drop function if exists private.get_leaderboard_page_data(uuid);
drop function if exists public.refresh_leaderboard_org_totals(uuid);
drop function if exists private.refresh_leaderboard_org_totals(uuid);
drop function if exists public.refresh_leaderboard_season_cohorts(uuid);
drop function if exists private.refresh_leaderboard_season_cohorts(uuid);
drop function if exists public.close_leaderboard_season(uuid);
drop function if exists private.close_leaderboard_season(uuid);
drop function if exists private.refresh_leaderboard_visible_totals(uuid);

create or replace function private.upsert_xp_org_total(
  p_season_id uuid,
  p_leaderboard_language text,
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
  v_language text := private.normalize_leaderboard_language(p_leaderboard_language);
  v_active_member_count integer;
begin
  if p_organization_id is null or v_language is null then
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
    leaderboard_language,
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
    v_language,
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
  on conflict (season_id, leaderboard_language, organization_type, organization_id)
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
        and events.leaderboard_language = v_language
        and (
          (p_organization_type = 'club' and events.club_id = p_organization_id)
          or (p_organization_type = 'class' and events.class_id = p_organization_id)
        )
    ),
    active_member_count = v_active_member_count,
    normalized_xp = round(totals.season_xp::numeric / greatest(v_active_member_count, 1), 2),
    updated_at = now()
  where totals.season_id = p_season_id
    and totals.leaderboard_language = v_language
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
  p_class_id uuid default null,
  p_leaderboard_language text default null
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
  v_leaderboard_language text;
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

  v_leaderboard_language := private.normalize_leaderboard_language(
    coalesce(
      p_leaderboard_language,
      p_metadata ->> 'leaderboard_language',
      p_metadata ->> 'practice_language'
    )
  );
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
    'leaderboard_language', v_leaderboard_language,
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
    leaderboard_language,
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
    v_leaderboard_language,
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

  if v_leaderboard_language is not null then
    insert into public.xp_season_user_totals (
      season_id,
      leaderboard_language,
      user_id,
      season_xp,
      lifetime_xp,
      event_count,
      category_breakdown,
      last_event_at
    )
    values (
      v_season_id,
      v_leaderboard_language,
      p_user_id,
      v_effective_season_xp,
      v_effective_lifetime_xp,
      1,
      jsonb_build_object(p_xp_category, v_effective_season_xp),
      coalesce(p_occurred_at, now())
    )
    on conflict (season_id, leaderboard_language, user_id)
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
      v_leaderboard_language,
      'club',
      p_club_id,
      p_xp_category,
      v_effective_season_xp,
      coalesce(p_occurred_at, now())
    );

    perform private.upsert_xp_org_total(
      v_season_id,
      v_leaderboard_language,
      'class',
      p_class_id,
      p_xp_category,
      v_effective_season_xp,
      coalesce(p_occurred_at, now())
    );
  end if;

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
  p_class_id uuid default null,
  p_leaderboard_language text default null
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
    p_class_id,
    p_leaderboard_language
  );
end;
$$;

create or replace function private.refresh_leaderboard_visible_totals(
  p_season_id uuid,
  p_leaderboard_language text default null
)
returns table (user_total_count integer, org_total_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_language text := private.normalize_leaderboard_language(p_leaderboard_language);
begin
  delete from public.xp_season_user_totals totals
  where totals.season_id = p_season_id
    and (v_language is null or totals.leaderboard_language = v_language);

  insert into public.xp_season_user_totals (
    season_id,
    leaderboard_language,
    user_id,
    season_xp,
    lifetime_xp,
    event_count,
    category_breakdown,
    last_event_at
  )
  with event_base as (
    select *
    from public.xp_events events
    where events.season_id = p_season_id
      and events.leaderboard_language is not null
      and (v_language is null or events.leaderboard_language = v_language)
      and not private.leaderboard_event_is_suppressed(events.id)
  ), user_rollups as (
    select
      events.season_id,
      events.leaderboard_language,
      events.user_id,
      coalesce(sum(events.season_xp), 0)::integer as season_xp,
      coalesce(sum(events.lifetime_xp), 0)::integer as lifetime_xp,
      count(events.id)::integer as event_count,
      max(events.occurred_at) as last_event_at
    from event_base events
    group by events.season_id, events.leaderboard_language, events.user_id
  ), category_rollups as (
    select
      events.season_id,
      events.leaderboard_language,
      events.user_id,
      events.xp_category,
      sum(events.season_xp)::integer as category_xp
    from event_base events
    group by events.season_id, events.leaderboard_language, events.user_id, events.xp_category
  )
  select
    rollups.season_id,
    rollups.leaderboard_language,
    rollups.user_id,
    rollups.season_xp,
    rollups.lifetime_xp,
    rollups.event_count,
    coalesce((
      select jsonb_object_agg(categories.xp_category, categories.category_xp)
      from category_rollups categories
      where categories.season_id = rollups.season_id
        and categories.leaderboard_language = rollups.leaderboard_language
        and categories.user_id = rollups.user_id
    ), '{}'::jsonb),
    rollups.last_event_at
  from user_rollups rollups;

  get diagnostics user_total_count = row_count;

  delete from public.xp_season_org_totals totals
  where totals.season_id = p_season_id
    and totals.organization_type = 'club'
    and (v_language is null or totals.leaderboard_language = v_language);

  insert into public.xp_season_org_totals (
    season_id,
    leaderboard_language,
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
  ), event_base as (
    select
      events.*,
      coalesce(events.club_id, classes.club_id) as rollup_club_id
    from public.xp_events events
    left join public.classes classes
      on classes.id = events.class_id
    where events.season_id = p_season_id
      and events.leaderboard_language is not null
      and (v_language is null or events.leaderboard_language = v_language)
      and coalesce(events.club_id, classes.club_id) is not null
      and not private.leaderboard_event_is_suppressed(events.id)
  ), org_rollups as (
    select
      events.season_id,
      events.leaderboard_language,
      events.rollup_club_id as club_id,
      coalesce(sum(events.season_xp), 0)::integer as season_xp,
      count(events.id)::integer as event_count,
      count(distinct events.user_id)::integer as contributing_user_count,
      max(events.occurred_at) as last_event_at
    from event_base events
    group by events.season_id, events.leaderboard_language, events.rollup_club_id
  ), category_rollups as (
    select
      events.season_id,
      events.leaderboard_language,
      events.rollup_club_id as club_id,
      events.xp_category,
      sum(events.season_xp)::integer as category_xp
    from event_base events
    group by events.season_id, events.leaderboard_language, events.rollup_club_id, events.xp_category
  )
  select
    p_season_id,
    rollups.leaderboard_language,
    'club',
    clubs.id,
    coalesce(rollups.season_xp, 0),
    coalesce(rollups.event_count, 0),
    coalesce(rollups.contributing_user_count, 0),
    coalesce(member_counts.active_member_count, 0),
    round(coalesce(rollups.season_xp, 0)::numeric / greatest(coalesce(member_counts.active_member_count, 0), 1), 2),
    coalesce((
      select jsonb_object_agg(categories.xp_category, categories.category_xp)
      from category_rollups categories
      where categories.season_id = p_season_id
        and categories.leaderboard_language = rollups.leaderboard_language
        and categories.club_id = clubs.id
    ), '{}'::jsonb),
    rollups.last_event_at
  from org_rollups rollups
  join public.clubs clubs
    on clubs.id = rollups.club_id
  left join member_counts
    on member_counts.club_id = clubs.id
  where clubs.status = 'active';

  get diagnostics org_total_count = row_count;
  return next;
end;
$$;

create or replace function private.refresh_leaderboard_org_totals(
  p_season_id uuid,
  p_leaderboard_language text default null
)
returns table (refreshed_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_counts record;
begin
  select *
  into v_counts
  from private.refresh_leaderboard_visible_totals(p_season_id, p_leaderboard_language);

  refreshed_count := coalesce(v_counts.org_total_count, 0);
  return next;
end;
$$;

create or replace function private.refresh_leaderboard_season_cohorts(
  p_season_id uuid default null,
  p_leaderboard_language text default null
)
returns table (assigned_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_season_id uuid;
  v_language text := private.normalize_leaderboard_language(p_leaderboard_language);
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

  insert into public.leaderboard_user_leagues (user_id, leaderboard_language, league_tier)
  select distinct totals.user_id, totals.leaderboard_language, 'novice'
  from public.xp_season_user_totals totals
  where totals.season_id = v_season_id
    and (v_language is null or totals.leaderboard_language = v_language)
  on conflict (user_id, leaderboard_language) do nothing;

  insert into public.leaderboard_season_user_cohorts (
    season_id,
    leaderboard_language,
    user_id,
    league_tier,
    cohort_index,
    cohort_key,
    previous_rank,
    previous_zone
  )
  select
    v_season_id,
    ranked.leaderboard_language,
    ranked.user_id,
    ranked.league_tier,
    ((ranked.ordinal - 1) / 30)::integer,
    ranked.leaderboard_language || ':' || ranked.league_tier || ':' || (((ranked.ordinal - 1) / 30)::integer)::text,
    previous.final_rank,
    previous.final_zone
  from (
    select
      totals.user_id,
      totals.leaderboard_language,
      leagues.league_tier,
      row_number() over (
        partition by totals.leaderboard_language, leagues.league_tier
        order by coalesce(previous.final_rank, 999999), totals.user_id
      ) as ordinal
    from public.xp_season_user_totals totals
    join public.leaderboard_user_leagues leagues
      on leagues.user_id = totals.user_id
     and leagues.leaderboard_language = totals.leaderboard_language
    left join public.leaderboard_season_results previous
      on previous.user_id = totals.user_id
     and previous.leaderboard_language = totals.leaderboard_language
     and previous.season_id = leagues.last_season_id
    where totals.season_id = v_season_id
      and (v_language is null or totals.leaderboard_language = v_language)
  ) ranked
  left join public.leaderboard_user_leagues leagues
    on leagues.user_id = ranked.user_id
   and leagues.leaderboard_language = ranked.leaderboard_language
  left join public.leaderboard_season_results previous
    on previous.user_id = ranked.user_id
   and previous.leaderboard_language = ranked.leaderboard_language
   and previous.season_id = leagues.last_season_id
  on conflict (season_id, leaderboard_language, user_id) do nothing;

  get diagnostics assigned_count = row_count;
  return next;
end;
$$;

create or replace function private.close_leaderboard_season(
  p_season_id uuid,
  p_leaderboard_language text default null
)
returns table (resolved_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_language text := private.normalize_leaderboard_language(p_leaderboard_language);
begin
  insert into public.leaderboard_season_results (
    season_id,
    leaderboard_language,
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
      cohorts.leaderboard_language,
      cohorts.user_id,
      cohorts.league_tier,
      cohorts.cohort_index,
      coalesce(totals.season_xp, 0)::integer as season_xp,
      row_number() over (
        partition by cohorts.leaderboard_language, cohorts.league_tier, cohorts.cohort_index
        order by coalesce(totals.season_xp, 0) desc,
          coalesce(totals.last_event_at, '9999-12-31'::timestamptz) asc,
          cohorts.user_id asc
      )::integer as final_rank,
      count(*) over (
        partition by cohorts.leaderboard_language, cohorts.league_tier, cohorts.cohort_index
      )::integer as active_count
    from public.leaderboard_season_user_cohorts cohorts
    left join public.xp_season_user_totals totals
      on totals.season_id = cohorts.season_id
     and totals.leaderboard_language = cohorts.leaderboard_language
     and totals.user_id = cohorts.user_id
    where cohorts.season_id = p_season_id
      and (v_language is null or cohorts.leaderboard_language = v_language)
  ), zoned as (
    select
      ranked.*,
      private.leaderboard_personal_zone(ranked.league_tier, ranked.final_rank, ranked.active_count) as final_zone
    from ranked
  )
  select
    p_season_id,
    zoned.leaderboard_language,
    zoned.user_id,
    zoned.league_tier,
    zoned.cohort_index,
    zoned.final_rank,
    zoned.final_zone,
    zoned.season_xp,
    private.leaderboard_next_league(zoned.league_tier, zoned.final_zone),
    private.leaderboard_outcome(zoned.league_tier, zoned.final_zone)
  from zoned
  on conflict (season_id, leaderboard_language, user_id) do update set
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
    and results.user_id = leagues.user_id
    and results.leaderboard_language = leagues.leaderboard_language
    and (v_language is null or results.leaderboard_language = v_language);

  if v_language is null then
    update public.xp_seasons
    set status = 'closed',
        updated_at = now()
    where id = p_season_id;
  end if;

  return next;
end;
$$;

create or replace function private.get_leaderboard_page_data(
  p_user_id uuid default auth.uid(),
  p_leaderboard_language text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_language text := private.coerce_leaderboard_language(p_leaderboard_language);
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
      and cohorts.leaderboard_language = v_language
      and cohorts.user_id = v_user_id
    limit 1;

    if not coalesce(v_has_cohort, false) then
      select coalesce(leagues.league_tier, 'novice')
      into v_league_tier
      from public.leaderboard_user_leagues leagues
      where leagues.user_id = v_user_id
        and leagues.leaderboard_language = v_language;
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
       and leagues.leaderboard_language = totals.leaderboard_language
      left join public.leaderboard_season_user_cohorts cohorts
        on cohorts.season_id = totals.season_id
       and cohorts.leaderboard_language = totals.leaderboard_language
       and cohorts.user_id = totals.user_id
      where totals.season_id = v_season_id
        and totals.leaderboard_language = v_language
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
        and totals.leaderboard_language = v_language
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
    'leaderboardLanguage', v_language,
    'reason', v_reason,
    'season', jsonb_build_object(
      'id', coalesce(v_season_id::text, 'none'),
      'leaderboardLanguage', v_language,
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
        'leaderboardLanguage', v_language,
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
          'leaderboardLanguage', results.leaderboard_language,
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
          and results.leaderboard_language = v_language
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

create or replace function private.get_leaderboard_page_data_v2(
  p_user_id uuid default auth.uid(),
  p_leaderboard_language text default 'en'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := coalesce(p_user_id, auth.uid());
  v_language text := private.coerce_leaderboard_language(p_leaderboard_language);
  v_page jsonb;
  v_rows jsonb;
  v_current_user jsonb;
  v_season_id uuid;
  v_privacy record;
  v_kudos jsonb;
  v_explanation jsonb;
begin
  v_page := private.get_leaderboard_page_data(v_user_id, v_language);
  v_season_id := case
    when coalesce(v_page #>> '{season,id}', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then (v_page #>> '{season,id}')::uuid
    else null
  end;

  select *
  into v_privacy
  from private.leaderboard_effective_privacy(v_user_id);

  select coalesce(jsonb_agg(private.leaderboard_safe_personal_row(row_json, v_user_id)), '[]'::jsonb)
  into v_rows
  from jsonb_array_elements(coalesce(v_page #> '{personal,rows}', '[]'::jsonb)) row_json;

  v_current_user := case
    when v_page #> '{personal,currentUser}' is null
      or v_page #> '{personal,currentUser}' = 'null'::jsonb
      then 'null'::jsonb
    else private.leaderboard_safe_personal_row(
      v_page #> '{personal,currentUser}',
      v_user_id
    )
  end;

  select coalesce(jsonb_object_agg(
    row_user_id::text,
    jsonb_build_object(
      'targetUserId', row_user_id,
      'viewerCanSend',
        row_user_id <> v_user_id
        and coalesce(target_privacy.allow_kudos, true)
        and not exists (
          select 1
          from public.leaderboard_kudos kudos
          where kudos.season_id = v_season_id
            and kudos.sender_user_id = v_user_id
            and kudos.recipient_user_id = row_user_id
            and kudos.status = 'active'
        ),
      'viewerHasSent',
        exists (
          select 1
          from public.leaderboard_kudos kudos
          where kudos.season_id = v_season_id
            and kudos.sender_user_id = v_user_id
            and kudos.recipient_user_id = row_user_id
            and kudos.status = 'active'
        )
    )
  ), '{}'::jsonb)
  into v_kudos
  from (
    select (row_json ->> 'userId')::uuid as row_user_id
    from jsonb_array_elements(coalesce(v_page #> '{personal,rows}', '[]'::jsonb)) row_json
  ) row_users
  cross join lateral private.leaderboard_effective_privacy(row_users.row_user_id) target_privacy;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', explanation_events.id,
    'category', explanation_events.xp_category,
    'label', initcap(explanation_events.xp_category),
    'seasonXp', case when explanation_events.leaderboard_language = v_language then explanation_events.season_xp else 0 end,
    'lifetimeXp', explanation_events.lifetime_xp,
    'status', case
      when explanation_events.flag_status = 'suppressed_from_leaderboards' then 'suppressed'
      when explanation_events.leaderboard_language is null then 'ineligible'
      when explanation_events.leaderboard_language <> v_language then 'ineligible'
      when (explanation_events.metadata ->> 'cap_applied')::boolean then 'capped'
      else 'counted'
    end,
    'reason', case
      when explanation_events.flag_status = 'suppressed_from_leaderboards' then explanation_events.flag_reason
      when explanation_events.leaderboard_language is null then 'No leaderboard language.'
      when explanation_events.leaderboard_language <> v_language then 'Different leaderboard language.'
      when (explanation_events.metadata ->> 'cap_applied')::boolean then 'Category cap applied.'
      else null
    end,
    'occurredAt', explanation_events.occurred_at
  ) order by explanation_events.occurred_at desc), '[]'::jsonb)
  into v_explanation
  from (
    select
      events.*,
      flags.status as flag_status,
      flags.reason as flag_reason
    from public.xp_events events
    left join public.leaderboard_xp_event_flags flags
      on flags.xp_event_id = events.id
     and flags.status = 'suppressed_from_leaderboards'
    where events.user_id = v_user_id
      and events.season_id = v_season_id
      and (
        events.leaderboard_language = v_language
        or events.leaderboard_language is null
      )
    order by events.occurred_at desc
    limit 12
  ) explanation_events;

  return jsonb_set(
    jsonb_set(
      jsonb_set(v_page, '{personal,rows}', v_rows, true),
      '{personal,currentUser}',
      coalesce(v_current_user, 'null'::jsonb),
      true
    ),
    '{socialTrust}',
    jsonb_build_object(
      'privacy', jsonb_build_object(
        'userId', v_privacy.user_id,
        'displayMode', v_privacy.display_mode,
        'allowKudos', v_privacy.allow_kudos,
        'showOrganization', v_privacy.show_organization,
        'participateInLeaderboards', v_privacy.participate_in_leaderboards,
        'isDefault', v_privacy.is_default,
        'updatedAt', v_privacy.updated_at
      ),
      'kudos', jsonb_build_object(
        'receivedThisSeason', (
          select count(*)::integer
          from public.leaderboard_kudos kudos
          where kudos.season_id = v_season_id
            and kudos.recipient_user_id = v_user_id
            and kudos.status = 'active'
        ),
        'sentThisSeason', (
          select count(*)::integer
          from public.leaderboard_kudos kudos
          where kudos.season_id = v_season_id
            and kudos.sender_user_id = v_user_id
            and kudos.status = 'active'
        ),
        'availableKinds', jsonb_build_array('keep_going', 'great_round', 'strong_improvement'),
        'byUserId', v_kudos
      ),
      'scoreExplanation', v_explanation
    ),
    true
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
  activity record;
  inserted_row public.xp_events%rowtype;
  v_season_id uuid;
  v_language text;
begin
  inserted_count := 0;

  for activity in
    select *
    from public.activity_log
    where created_at >= p_since
      and xp_earned > 0
    order by created_at asc
  loop
    v_season_id := private.ensure_xp_weekly_season(activity.created_at);
    v_language := private.normalize_leaderboard_language(
      coalesce(
        activity.metadata ->> 'leaderboard_language',
        activity.metadata ->> 'practice_language'
      )
    );

    insert into public.xp_events (
      user_id,
      season_id,
      leaderboard_language,
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
    values (
      activity.user_id,
      v_season_id,
      v_language,
      coalesce(activity.reference_type, activity.activity_type, 'legacy'),
      activity.reference_id,
      activity.activity_type,
      activity.reference_type,
      'legacy',
      greatest(coalesce(activity.xp_earned, 0), 0),
      greatest(coalesce(activity.xp_earned, 0), 0),
      coalesce(activity.metadata, '{}'::jsonb) || jsonb_build_object(
        'backfilled_from_activity_log_id', activity.id,
        'leaderboard_language', v_language
      ),
      activity.created_at,
      'legacy:' || activity.id::text
    )
    on conflict (idempotency_key) do nothing
    returning * into inserted_row;

    if inserted_row.id is not null then
      inserted_count := inserted_count + 1;

      if v_language is not null then
        insert into public.xp_season_user_totals (
          season_id,
          leaderboard_language,
          user_id,
          season_xp,
          lifetime_xp,
          event_count,
          category_breakdown,
          last_event_at
        )
        values (
          v_season_id,
          v_language,
          activity.user_id,
          inserted_row.season_xp,
          inserted_row.lifetime_xp,
          1,
          jsonb_build_object('legacy', inserted_row.season_xp),
          activity.created_at
        )
        on conflict (season_id, leaderboard_language, user_id)
        do update set
          season_xp = public.xp_season_user_totals.season_xp + excluded.season_xp,
          lifetime_xp = public.xp_season_user_totals.lifetime_xp + excluded.lifetime_xp,
          event_count = public.xp_season_user_totals.event_count + 1,
          category_breakdown = private.xp_increment_breakdown(
            public.xp_season_user_totals.category_breakdown,
            'legacy',
            excluded.season_xp
          ),
          last_event_at = greatest(
            coalesce(public.xp_season_user_totals.last_event_at, excluded.last_event_at),
            excluded.last_event_at
          ),
          updated_at = now();
      end if;
    end if;
  end loop;

  return next;
end;
$$;

create or replace function public.get_leaderboard_page_data(
  p_user_id uuid default auth.uid(),
  p_leaderboard_language text default 'en'
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_leaderboard_page_data(p_user_id, p_leaderboard_language);
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
  select private.get_leaderboard_page_data_v2(p_user_id, p_leaderboard_language);
$$;

create or replace function public.refresh_leaderboard_org_totals(
  p_season_id uuid,
  p_leaderboard_language text default null
)
returns table (refreshed_count integer)
language sql
security invoker
set search_path = ''
as $$
  select * from private.refresh_leaderboard_org_totals(p_season_id, p_leaderboard_language);
$$;

create or replace function public.refresh_leaderboard_season_cohorts(
  p_season_id uuid default null,
  p_leaderboard_language text default null
)
returns table (assigned_count integer)
language sql
security invoker
set search_path = ''
as $$
  select * from private.refresh_leaderboard_season_cohorts(p_season_id, p_leaderboard_language);
$$;

create or replace function public.close_leaderboard_season(
  p_season_id uuid,
  p_leaderboard_language text default null
)
returns table (resolved_count integer)
language sql
security invoker
set search_path = ''
as $$
  select * from private.close_leaderboard_season(p_season_id, p_leaderboard_language);
$$;

revoke all on function private.normalize_leaderboard_language(text) from public, anon, authenticated;
grant execute on function private.normalize_leaderboard_language(text) to authenticated, service_role;

revoke all on function private.coerce_leaderboard_language(text) from public, anon, authenticated;
grant execute on function private.coerce_leaderboard_language(text) to authenticated, service_role;

revoke all on function private.award_xp_event(uuid, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb, integer, integer, numeric, uuid, uuid, text) from public, anon, authenticated;
grant execute on function private.award_xp_event(uuid, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb, integer, integer, numeric, uuid, uuid, text) to service_role;

revoke all on function public.award_xp_event(uuid, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb, integer, integer, numeric, uuid, uuid, text) from public, anon;
grant execute on function public.award_xp_event(uuid, text, text, text, uuid, text, text, integer, integer, timestamptz, jsonb, integer, integer, numeric, uuid, uuid, text) to authenticated, service_role;

revoke all on function private.refresh_leaderboard_visible_totals(uuid, text) from public, anon, authenticated;
grant execute on function private.refresh_leaderboard_visible_totals(uuid, text) to service_role;

revoke all on function private.refresh_leaderboard_org_totals(uuid, text) from public, anon, authenticated;
grant execute on function private.refresh_leaderboard_org_totals(uuid, text) to service_role;

revoke all on function private.refresh_leaderboard_season_cohorts(uuid, text) from public, anon, authenticated;
grant execute on function private.refresh_leaderboard_season_cohorts(uuid, text) to service_role;

revoke all on function private.close_leaderboard_season(uuid, text) from public, anon, authenticated;
grant execute on function private.close_leaderboard_season(uuid, text) to service_role;

revoke all on function private.get_leaderboard_page_data(uuid, text) from public, anon;
grant execute on function private.get_leaderboard_page_data(uuid, text) to authenticated, service_role;

revoke all on function private.get_leaderboard_page_data_v2(uuid, text) from public, anon;
grant execute on function private.get_leaderboard_page_data_v2(uuid, text) to authenticated, service_role;

revoke all on function public.backfill_legacy_xp_events(timestamptz) from public, anon;
grant execute on function public.backfill_legacy_xp_events(timestamptz) to service_role;

revoke all on function public.get_leaderboard_page_data(uuid, text) from public, anon;
grant execute on function public.get_leaderboard_page_data(uuid, text) to authenticated, service_role;

revoke all on function public.get_leaderboard_page_data_v2(uuid, text) from public, anon;
grant execute on function public.get_leaderboard_page_data_v2(uuid, text) to authenticated, service_role;

revoke all on function public.refresh_leaderboard_org_totals(uuid, text) from public, anon, authenticated;
grant execute on function public.refresh_leaderboard_org_totals(uuid, text) to service_role;

revoke all on function public.refresh_leaderboard_season_cohorts(uuid, text) from public, anon, authenticated;
grant execute on function public.refresh_leaderboard_season_cohorts(uuid, text) to service_role;

revoke all on function public.close_leaderboard_season(uuid, text) from public, anon, authenticated;
grant execute on function public.close_leaderboard_season(uuid, text) to service_role;

select private.refresh_leaderboard_visible_totals(seasons.id, null)
from public.xp_seasons seasons
where exists (
  select 1
  from public.xp_events events
  where events.season_id = seasons.id
    and events.leaderboard_language is not null
);

notify pgrst, 'reload schema';
