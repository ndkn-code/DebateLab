-- DebateLab admin user analytics + hybrid event pipeline
-- Adds the Supabase-owned event spine used by admin drilldowns while keeping
-- PostHog and product-table analytics intact.

-- Compatibility for existing analytics/admin code.
alter table public.daily_stats
  add column if not exists minutes_studied integer not null default 0;

update public.daily_stats
set minutes_studied = coalesce(minutes_studied, practice_minutes, 0)
where minutes_studied = 0
  and practice_minutes is not null;

alter table public.user_sessions
  add column if not exists geo_lat numeric,
  add column if not exists geo_lon numeric,
  add column if not exists user_agent text,
  add column if not exists route text,
  add column if not exists device_type text;

update public.user_sessions
set
  geo_lat = coalesce(geo_lat, geo_latitude),
  geo_lon = coalesce(geo_lon, geo_longitude)
where geo_lat is null
   or geo_lon is null;

-- Existing server routes already write api_usage for AI/vendor activity.
create table if not exists public.api_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  service text not null,
  model text,
  input_tokens integer,
  output_tokens integer,
  input_unit text,
  output_unit text,
  duration_ms integer,
  estimated_cost_usd numeric(12, 6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.api_usage
  add column if not exists user_id uuid references public.profiles(id) on delete set null,
  add column if not exists service text,
  add column if not exists model text,
  add column if not exists input_tokens integer,
  add column if not exists output_tokens integer,
  add column if not exists input_unit text,
  add column if not exists output_unit text,
  add column if not exists duration_ms integer,
  add column if not exists estimated_cost_usd numeric(12, 6) not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.user_sessions(id) on delete set null,
  event_name text not null,
  feature_area text not null check (
    feature_area in (
      'courses',
      'activities',
      'practice',
      'duels',
      'ai_feedback',
      'admin',
      'profile'
    )
  ),
  route text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'web' check (source in ('web', 'server', 'admin', 'system')),
  created_at timestamptz not null default now()
);

create table if not exists public.ai_insights_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null unique,
  scope text not null,
  target_user_id uuid references public.profiles(id) on delete cascade,
  range_key text,
  model text,
  prompt_hash text,
  insights jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.analytics_module_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.analytics_module_flags (key, enabled, description)
values
  ('revenue', false, 'Dormant revenue analytics module for future monetization.'),
  ('acquisition', false, 'Dormant acquisition/source attribution analytics module.'),
  ('social', false, 'Dormant social/referral analytics module.')
on conflict (key) do nothing;

create table if not exists public.analytics_revenue_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_name text not null,
  amount_cents integer,
  currency text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_acquisition_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  source text,
  medium text,
  campaign text,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.analytics_social_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  platform text,
  event_name text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_api_usage_user_created
  on public.api_usage(user_id, created_at desc);
create index if not exists idx_api_usage_service_created
  on public.api_usage(service, created_at desc);
create index if not exists idx_analytics_events_user_time
  on public.analytics_events(user_id, occurred_at desc);
create index if not exists idx_analytics_events_feature_time
  on public.analytics_events(feature_area, occurred_at desc);
create index if not exists idx_analytics_events_name_time
  on public.analytics_events(event_name, occurred_at desc);
create index if not exists idx_ai_insights_cache_key_expires
  on public.ai_insights_cache(cache_key, expires_at);

drop function if exists public.upsert_daily_stats(uuid, integer, integer, integer);

create or replace function public.upsert_daily_stats(
  p_user_id uuid,
  p_sessions integer default 0,
  p_minutes integer default 0,
  p_xp integer default 0,
  p_score numeric default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
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
    current_date,
    coalesce(p_sessions, 0),
    coalesce(p_minutes, 0),
    coalesce(p_minutes, 0),
    case when p_score is null then null else round(p_score)::integer end,
    coalesce(p_xp, 0)
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
end;
$$;

grant execute on function public.upsert_daily_stats(uuid, integer, integer, integer, numeric)
  to authenticated;

alter table public.api_usage enable row level security;
alter table public.analytics_events enable row level security;
alter table public.ai_insights_cache enable row level security;
alter table public.analytics_module_flags enable row level security;
alter table public.analytics_revenue_events enable row level security;
alter table public.analytics_acquisition_events enable row level security;
alter table public.analytics_social_events enable row level security;

drop policy if exists "Users can view own api usage" on public.api_usage;
create policy "Users can view own api usage"
  on public.api_usage for select
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Users can insert own api usage" on public.api_usage;
create policy "Users can insert own api usage"
  on public.api_usage for insert
  with check (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Admins can manage api usage" on public.api_usage;
create policy "Admins can manage api usage"
  on public.api_usage for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can view own analytics events" on public.analytics_events;
create policy "Users can view own analytics events"
  on public.analytics_events for select
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Users can insert own analytics events" on public.analytics_events;
create policy "Users can insert own analytics events"
  on public.analytics_events for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins can manage analytics events" on public.analytics_events;
create policy "Admins can manage analytics events"
  on public.analytics_events for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view ai insights cache" on public.ai_insights_cache;
create policy "Admins can view ai insights cache"
  on public.ai_insights_cache for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage ai insights cache" on public.ai_insights_cache;
create policy "Admins can manage ai insights cache"
  on public.ai_insights_cache for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view analytics module flags" on public.analytics_module_flags;
create policy "Admins can view analytics module flags"
  on public.analytics_module_flags for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage analytics module flags" on public.analytics_module_flags;
create policy "Admins can manage analytics module flags"
  on public.analytics_module_flags for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view revenue analytics stubs" on public.analytics_revenue_events;
create policy "Admins can view revenue analytics stubs"
  on public.analytics_revenue_events for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage revenue analytics stubs" on public.analytics_revenue_events;
create policy "Admins can manage revenue analytics stubs"
  on public.analytics_revenue_events for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view acquisition analytics stubs" on public.analytics_acquisition_events;
create policy "Admins can view acquisition analytics stubs"
  on public.analytics_acquisition_events for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage acquisition analytics stubs" on public.analytics_acquisition_events;
create policy "Admins can manage acquisition analytics stubs"
  on public.analytics_acquisition_events for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view social analytics stubs" on public.analytics_social_events;
create policy "Admins can view social analytics stubs"
  on public.analytics_social_events for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage social analytics stubs" on public.analytics_social_events;
create policy "Admins can manage social analytics stubs"
  on public.analytics_social_events for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

-- Admin read access for product tables that power user drilldowns.
drop policy if exists "Admins can view all daily stats" on public.daily_stats;
create policy "Admins can view all daily stats"
  on public.daily_stats for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can view all debate sessions" on public.debate_sessions;
create policy "Admins can view all debate sessions"
  on public.debate_sessions for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can view all activity logs" on public.activity_log;
create policy "Admins can view all activity logs"
  on public.activity_log for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can view debate duels" on public.debate_duels;
create policy "Admins can view debate duels"
  on public.debate_duels for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can view duel participants" on public.debate_duel_participants;
create policy "Admins can view duel participants"
  on public.debate_duel_participants for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can view duel speeches" on public.debate_duel_speeches;
create policy "Admins can view duel speeches"
  on public.debate_duel_speeches for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can view duel judgments" on public.debate_duel_judgments;
create policy "Admins can view duel judgments"
  on public.debate_duel_judgments for select
  using (private.is_admin(auth.uid()));

-- Invoker-safe views: users see their own rows through RLS; admins see all.
create or replace view public.analytics_dau
with (security_invoker = true)
as
select
  date_trunc('day', occurred_at)::date as activity_date,
  count(distinct user_id)::integer as active_users,
  count(*)::integer as event_count
from public.analytics_events
group by 1;

create or replace view public.analytics_mau
with (security_invoker = true)
as
select
  date_trunc('month', occurred_at)::date as activity_month,
  count(distinct user_id)::integer as active_users,
  count(*)::integer as event_count
from public.analytics_events
group by 1;

create or replace view public.analytics_feature_adoption
with (security_invoker = true)
as
select
  date_trunc('day', occurred_at)::date as activity_date,
  feature_area,
  count(distinct user_id)::integer as active_users,
  count(*)::integer as total_events,
  max(occurred_at) as last_seen_at
from public.analytics_events
group by 1, 2;

create or replace view public.analytics_retention
with (security_invoker = true)
as
with first_seen as (
  select
    user_id,
    min(date_trunc('day', occurred_at)::date) as cohort_date
  from public.analytics_events
  group by user_id
)
select
  first_seen.cohort_date,
  date_trunc('day', analytics_events.occurred_at)::date as activity_date,
  (
    date_trunc('day', analytics_events.occurred_at)::date - first_seen.cohort_date
  )::integer as days_since_cohort,
  count(distinct analytics_events.user_id)::integer as retained_users
from public.analytics_events
join first_seen on first_seen.user_id = analytics_events.user_id
group by 1, 2, 3;

create or replace view public.analytics_user_activity_rollup
with (security_invoker = true)
as
select
  user_id,
  date_trunc('day', occurred_at)::date as activity_date,
  count(*)::integer as event_count,
  count(distinct session_id)::integer as session_count,
  coalesce(round(sum(duration_ms)::numeric / 60000), 0)::integer as active_minutes,
  max(occurred_at) as last_seen_at
from public.analytics_events
group by 1, 2;

create or replace view public.analytics_user_event_history
with (security_invoker = true)
as
select
  id,
  user_id,
  session_id,
  event_name,
  feature_area,
  route,
  duration_ms,
  occurred_at,
  metadata,
  source,
  created_at
from public.analytics_events;

create or replace view public.analytics_user_course_progress
with (security_invoker = true)
as
select
  enrollments.user_id,
  enrollments.course_id,
  courses.title as course_title,
  courses.visibility,
  enrollments.status,
  enrollments.progress_percent,
  enrollments.enrolled_at,
  enrollments.completed_at,
  greatest(enrollments.enrolled_at, coalesce(enrollments.completed_at, enrollments.enrolled_at)) as last_activity_at
from public.enrollments
join public.courses on courses.id = enrollments.course_id;

create or replace view public.analytics_user_module_progress
with (security_invoker = true)
as
select
  enrollments.user_id,
  course_modules.course_id,
  course_modules.id as module_id,
  course_modules.title as module_title,
  course_modules.access_level,
  coalesce(course_modules.sort_order, course_modules.order_index, 0) as sort_order,
  count(distinct activities.id)::integer as total_activities,
  count(distinct activity_attempts.activity_id)::integer as completed_activities,
  max(activity_attempts.completed_at) as last_completed_at
from public.enrollments
join public.course_modules
  on course_modules.course_id = enrollments.course_id
left join public.activities
  on activities.module_id = course_modules.id
  and activities.is_archived = false
left join public.activity_attempts
  on activity_attempts.user_id = enrollments.user_id
  and activity_attempts.activity_id = activities.id
  and activity_attempts.completed_at is not null
where course_modules.is_archived = false
group by
  enrollments.user_id,
  course_modules.course_id,
  course_modules.id,
  course_modules.title,
  course_modules.access_level,
  course_modules.sort_order,
  course_modules.order_index;

create or replace view public.analytics_user_activity_progress
with (security_invoker = true)
as
select
  activity_attempts.user_id,
  course_modules.course_id,
  activities.module_id,
  activity_attempts.activity_id,
  activities.title as activity_title,
  activities.activity_type,
  activity_attempts.started_at,
  activity_attempts.completed_at,
  activity_attempts.score,
  activity_attempts.max_score,
  activity_attempts.is_passed,
  activity_attempts.time_spent_seconds
from public.activity_attempts
join public.activities on activities.id = activity_attempts.activity_id
join public.course_modules on course_modules.id = activities.module_id;

grant select, insert on public.analytics_events to authenticated;
grant select on public.analytics_dau to authenticated;
grant select on public.analytics_mau to authenticated;
grant select on public.analytics_feature_adoption to authenticated;
grant select on public.analytics_retention to authenticated;
grant select on public.analytics_user_activity_rollup to authenticated;
grant select on public.analytics_user_event_history to authenticated;
grant select on public.analytics_user_course_progress to authenticated;
grant select on public.analytics_user_module_progress to authenticated;
grant select on public.analytics_user_activity_progress to authenticated;
