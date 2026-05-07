-- DebateLab beta entitlements and admin schema reconciliation
-- Adds the course/admin tables already referenced by the app, then layers in
-- subscription and usage records for future monetization gates.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_admin(p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = p_user_id
      and role = 'admin'
  );
$$;

grant execute on function private.is_admin(uuid) to authenticated;

-- Profile fields referenced by the app shell and profile UI.
alter table public.profiles
  add column if not exists selected_title text,
  add column if not exists unlocked_titles text[] not null default '{}'::text[],
  add column if not exists banner_color text not null default '#4d86f7';

-- Course publishing/access fields referenced by the admin course builder.
alter table public.courses
  add column if not exists short_description text,
  add column if not exists visibility text not null default 'public',
  add column if not exists is_free boolean not null default true,
  add column if not exists is_archived boolean not null default false,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'courses_visibility_check'
      and conrelid = 'public.courses'::regclass
  ) then
    alter table public.courses
      add constraint courses_visibility_check
      check (visibility in ('public', 'premium', 'class_restricted'));
  end if;
end;
$$;

-- Preserve the original order_index column while adding the newer sort_order API.
alter table public.course_modules
  add column if not exists sort_order integer,
  add column if not exists access_level text not null default 'locked',
  add column if not exists is_archived boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'course_modules'
      and column_name = 'order_index'
  ) then
    update public.course_modules
    set sort_order = coalesce(sort_order, order_index, 0)
    where sort_order is null;
  else
    update public.course_modules
    set sort_order = coalesce(sort_order, 0)
    where sort_order is null;
  end if;
end;
$$;

alter table public.course_modules
  alter column sort_order set default 0,
  alter column sort_order set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'course_modules_access_level_check'
      and conrelid = 'public.course_modules'::regclass
  ) then
    alter table public.course_modules
      add constraint course_modules_access_level_check
      check (access_level in ('free', 'locked', 'premium'));
  end if;
end;
$$;

alter table public.lesson_progress
  add column if not exists course_id uuid references public.courses(id) on delete cascade;

alter table public.enrollments
  add column if not exists progress_percent integer not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'enrollments'
      and column_name = 'progress_pct'
  ) then
    update public.enrollments
    set progress_percent = coalesce(progress_percent, progress_pct, 0)
    where progress_percent = 0
      and progress_pct is not null;
  end if;
end;
$$;

alter table public.daily_stats
  add column if not exists practice_minutes integer not null default 0;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'daily_stats'
      and column_name = 'minutes_studied'
  ) then
    update public.daily_stats
    set practice_minutes = coalesce(practice_minutes, minutes_studied, 0)
    where practice_minutes = 0
      and minutes_studied is not null;
  end if;
end;
$$;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  activity_type text not null check (
    activity_type in ('lesson', 'quiz', 'matching', 'fill_blank', 'drag_order', 'flashcard')
  ),
  title text not null,
  description text,
  phase text not null default 'learn' check (phase in ('learn', 'practice', 'apply')),
  order_index integer not null default 0,
  duration_minutes integer not null default 5,
  is_archived boolean not null default false,
  content jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete cascade,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score integer,
  max_score integer,
  is_passed boolean,
  attempt_number integer not null default 1,
  time_spent_seconds integer not null default 0,
  responses jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.course_access_rules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  rule_type text not null check (rule_type in ('individual_user', 'user_group')),
  target_id uuid not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (course_id, rule_type, target_id)
);

create table if not exists public.admin_activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_start timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  session_end timestamptz,
  geo_country text,
  geo_city text,
  geo_latitude numeric,
  geo_longitude numeric,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_type text not null default 'premium' check (plan_type in ('free', 'premium', 'enterprise')),
  status text not null default 'active' check (
    status in ('active', 'trial', 'cancelled', 'expired', 'past_due', 'pending')
  ),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_start_date timestamptz,
  trial_end_date timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at timestamptz,
  ended_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_feature_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature_name text not null,
  period_start timestamptz not null,
  period_end timestamptz not null,
  used_count integer not null default 0,
  limit_count integer,
  last_used_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, feature_name, period_start)
);

create index if not exists idx_courses_visibility on public.courses(visibility);
create index if not exists idx_courses_archived on public.courses(is_archived);
create index if not exists idx_course_modules_course_sort on public.course_modules(course_id, sort_order);
create index if not exists idx_activities_module_order on public.activities(module_id, order_index);
create index if not exists idx_activity_attempts_user_activity on public.activity_attempts(user_id, activity_id);
create index if not exists idx_course_access_rules_target on public.course_access_rules(target_id);
create index if not exists idx_admin_activity_log_admin on public.admin_activity_log(admin_user_id, created_at desc);
create index if not exists idx_user_sessions_user_active on public.user_sessions(user_id, is_active);
create index if not exists idx_subscriptions_user_status on public.subscriptions(user_id, status);
create index if not exists idx_user_feature_usage_user_feature on public.user_feature_usage(user_id, feature_name);

create or replace function public.increment_xp(user_id uuid, amount integer)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.profiles
  set
    xp = greatest(coalesce(xp, 0) + coalesce(amount, 0), 0),
    level = greatest(floor((coalesce(xp, 0) + coalesce(amount, 0)) / 500)::integer + 1, 1),
    updated_at = now()
  where id = increment_xp.user_id;
end;
$$;

create or replace function public.upsert_daily_stats(
  p_user_id uuid,
  p_sessions integer default 0,
  p_minutes integer default 0,
  p_xp integer default 0
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
    xp_earned
  )
  values (
    p_user_id,
    current_date,
    coalesce(p_sessions, 0),
    coalesce(p_minutes, 0),
    coalesce(p_xp, 0)
  )
  on conflict (user_id, date)
  do update set
    sessions_completed = public.daily_stats.sessions_completed + excluded.sessions_completed,
    practice_minutes = public.daily_stats.practice_minutes + excluded.practice_minutes,
    xp_earned = public.daily_stats.xp_earned + excluded.xp_earned;
end;
$$;

alter table public.activities enable row level security;
alter table public.activity_attempts enable row level security;
alter table public.course_access_rules enable row level security;
alter table public.admin_activity_log enable row level security;
alter table public.user_sessions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.user_feature_usage enable row level security;

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles"
  on public.profiles for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles"
  on public.profiles for update
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage courses" on public.courses;
create policy "Admins can manage courses"
  on public.courses for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage course modules" on public.course_modules;
create policy "Admins can manage course modules"
  on public.course_modules for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage lessons" on public.lessons;
create policy "Admins can manage lessons"
  on public.lessons for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage quiz questions" on public.quiz_questions;
create policy "Admins can manage quiz questions"
  on public.quiz_questions for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage enrollments" on public.enrollments;
create policy "Admins can manage enrollments"
  on public.enrollments for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can manage lesson progress" on public.lesson_progress;
create policy "Admins can manage lesson progress"
  on public.lesson_progress for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Authenticated users can view active activities" on public.activities;
create policy "Authenticated users can view active activities"
  on public.activities for select
  using (auth.uid() is not null and is_archived = false);

drop policy if exists "Admins can manage activities" on public.activities;
create policy "Admins can manage activities"
  on public.activities for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can view own activity attempts" on public.activity_attempts;
create policy "Users can view own activity attempts"
  on public.activity_attempts for select
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Users can insert own activity attempts" on public.activity_attempts;
create policy "Users can insert own activity attempts"
  on public.activity_attempts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own activity attempts" on public.activity_attempts;
create policy "Users can update own activity attempts"
  on public.activity_attempts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Admins can manage activity attempts" on public.activity_attempts;
create policy "Admins can manage activity attempts"
  on public.activity_attempts for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can view own course access rules" on public.course_access_rules;
create policy "Users can view own course access rules"
  on public.course_access_rules for select
  using (target_id = auth.uid() or private.is_admin(auth.uid()));

drop policy if exists "Admins can manage course access rules" on public.course_access_rules;
create policy "Admins can manage course access rules"
  on public.course_access_rules for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Admins can view admin activity log" on public.admin_activity_log;
create policy "Admins can view admin activity log"
  on public.admin_activity_log for select
  using (private.is_admin(auth.uid()));

drop policy if exists "Admins can insert admin activity log" on public.admin_activity_log;
create policy "Admins can insert admin activity log"
  on public.admin_activity_log for insert
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can manage own sessions" on public.user_sessions;
create policy "Users can manage own sessions"
  on public.user_sessions for all
  using (auth.uid() = user_id or private.is_admin(auth.uid()))
  with check (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Users can view own subscriptions" on public.subscriptions;
create policy "Users can view own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Admins can manage subscriptions" on public.subscriptions;
create policy "Admins can manage subscriptions"
  on public.subscriptions for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));

drop policy if exists "Users can view own feature usage" on public.user_feature_usage;
create policy "Users can view own feature usage"
  on public.user_feature_usage for select
  using (auth.uid() = user_id or private.is_admin(auth.uid()));

drop policy if exists "Users can update own feature usage" on public.user_feature_usage;
create policy "Users can update own feature usage"
  on public.user_feature_usage for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can insert own feature usage" on public.user_feature_usage;
create policy "Users can insert own feature usage"
  on public.user_feature_usage for insert
  with check (auth.uid() = user_id);

drop policy if exists "Admins can manage feature usage" on public.user_feature_usage;
create policy "Admins can manage feature usage"
  on public.user_feature_usage for all
  using (private.is_admin(auth.uid()))
  with check (private.is_admin(auth.uid()));
