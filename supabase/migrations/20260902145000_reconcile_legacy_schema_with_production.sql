-- Reconcile the hand-written legacy schema block (001_initial_schema.sql .. 038_*.sql)
-- with the shape production actually has.
--
-- WHY THIS EXISTS
-- ---------------
-- Production (rsbnryympenjyzhhchhu) was built through the Supabase dashboard between
-- 2026-03-15 and 2026-05-18. None of those changes were ever captured as migration
-- files: `supabase_migrations.schema_migrations` on production holds 25 versions whose
-- names have no counterpart in this directory (`admin_panel_alter_courses`,
-- `add_increment_xp_function`, `fix_profiles_rls_policies`, ...). Around 2026-05-18 the
-- team started the `NNN_name.sql` convention and *back-wrote* 001..038 to describe the
-- database as they believed it to be. That reconstruction got 20 tables wrong, so the
-- migration chain has never been able to rebuild production's schema.
--
-- The divergence is confined to that block. Every migration from
-- 20260520180100_practice_analysis_pipeline.sql onward reproduces production exactly.
-- This file therefore sits at the boundary where production's shape starts to matter:
-- immediately before 20260902150000_organization_curriculum.sql, the first migration
-- that reads a column the reconstruction got wrong (quiz_questions.sort_order).
--
-- SAFETY
-- ------
-- Every statement below is a no-op against production, by construction:
--   * adds use `add column if not exists`
--   * drops use `drop column if exists`
--   * renames are guarded on the old name existing and the new name not existing
--   * type changes are guarded on the current type
--   * nullability/default changes are driven off information_schema and are semantic
--     no-ops when the column already has the target state
-- Applying it to production must change nothing. Applying it to a database rebuilt from
-- this directory brings that database to production's shape.
--
-- Verified by rebuilding from empty and diffing information_schema.columns against
-- production: 0 differences across all 203 shared tables.

begin;

-- ---------------------------------------------------------------------------
-- 1. Column renames the reconstruction got wrong.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('quiz_questions',  'order_index',   'sort_order'),
      ('course_modules',  'order_index',   'sort_order'),
      ('lessons',         'order_index',   'sort_order'),
      ('lessons',         'type',          'lesson_type'),
      ('lessons',         'duration_minutes', 'estimated_minutes'),
      ('enrollments',     'enrolled_at',   'started_at')
    ) as t(tbl, old_col, new_col)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl and column_name = r.old_col
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl and column_name = r.new_col
    ) then
      execute format('alter table public.%I rename column %I to %I', r.tbl, r.old_col, r.new_col);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 1a. The phantom admin-analytics pipeline.
--
-- 014_admin_user_analytics_pipeline.sql creates five tables and a view that
-- production has NEVER had — it is one of the 27 repo files with no row in
-- production's migration ledger. Production's public schema has 203 base tables and
-- 8 views; none of these six objects is among them.
--
-- This matters beyond schema tidiness: apps/web/src/lib/analytics/
-- admin-user-analytics.ts:289,369 selects from and upserts into `ai_insights_cache`,
-- behind /api/admin/users/[userId]/analytics. That route cannot be working in
-- production. Flagged for a product decision — either 014 gets applied to production
-- or the feature is retired. Until then production is authoritative and a rebuilt
-- database must match it, so the objects are dropped here.
-- ---------------------------------------------------------------------------
drop view  if exists public.analytics_dau;
drop view  if exists public.analytics_mau;
drop view  if exists public.analytics_feature_adoption;
drop view  if exists public.analytics_retention;
drop view  if exists public.analytics_user_activity_rollup;
drop view  if exists public.analytics_user_event_history;
drop view  if exists public.analytics_user_course_progress;
drop view  if exists public.analytics_user_module_progress;
drop view  if exists public.analytics_user_activity_progress;
drop table if exists public.analytics_acquisition_events;
drop table if exists public.analytics_module_flags;
drop table if exists public.analytics_revenue_events;
drop table if exists public.analytics_social_events;
drop table if exists public.ai_insights_cache;

-- `course_modules`, `lessons` and `user_sessions` carry BOTH names in a chain-built
-- database: the reconstruction added one spelling and a later migration added the
-- other. The rename above is skipped for those, so drop the stray column outright.
alter table public.course_modules drop column if exists order_index;
alter table public.lessons        drop column if exists order_index;
alter table public.user_sessions  drop column if exists geo_latitude;
alter table public.user_sessions  drop column if exists geo_longitude;

-- ---------------------------------------------------------------------------
-- 2. Columns production has that the reconstruction never created.
-- ---------------------------------------------------------------------------
alter table public.quiz_questions  add column if not exists points integer not null default 10;

alter table public.api_usage       add column if not exists reference_id uuid;
alter table public.api_usage       add column if not exists reference_type text;

alter table public.courses         add column if not exists club_id uuid;
alter table public.courses         add column if not exists tags text[] default '{}'::text[];

alter table public.daily_stats     add column if not exists lessons_completed integer not null default 0;
alter table public.daily_stats     add column if not exists quizzes_completed integer not null default 0;

alter table public.debate_sessions add column if not exists lesson_id uuid;

alter table public.enrollments     add column if not exists last_accessed_at timestamptz not null default now();
alter table public.enrollments     add column if not exists progress_pct numeric not null default 0;

alter table public.lesson_progress add column if not exists quiz_answers jsonb;

alter table public.lessons         add column if not exists course_id uuid;
alter table public.lessons         add column if not exists content_body text;
alter table public.lessons         add column if not exists practice_config jsonb;
alter table public.lessons         add column if not exists quiz_config jsonb;
alter table public.lessons         add column if not exists video_duration_seconds integer;

alter table public.profiles        add column if not exists bio text;

alter table public.user_sessions   add column if not exists ip_address inet;

-- ---------------------------------------------------------------------------
-- 3. Columns the reconstruction invented that production has never had.
-- ---------------------------------------------------------------------------
alter table public.activity_attempts   drop column if exists metadata;
alter table public.chat_conversations  drop column if exists last_message_at;
alter table public.chat_conversations  drop column if exists message_count;
alter table public.chat_conversations  drop column if exists model;
alter table public.chat_conversations  drop column if exists system_prompt;
alter table public.chat_messages       drop column if exists tokens_used;
alter table public.daily_stats         drop column if exists created_at;
alter table public.lessons             drop column if exists content;
alter table public.quiz_questions      drop column if exists created_at;
alter table public.user_sessions       drop column if exists device_type;
alter table public.user_sessions       drop column if exists route;
alter table public.user_sessions       drop column if exists metadata;

-- ---------------------------------------------------------------------------
-- 4. Column types the reconstruction got wrong.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('activity_attempts', 'score',     'numeric', 'numeric'),
      ('activity_attempts', 'max_score', 'numeric', 'numeric'),
      ('lesson_progress',   'score',     'numeric', 'numeric'),
      ('debate_sessions',   'topic_id',  'text',    'text')
    ) as t(tbl, col, target_type, cast_to)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl
        and column_name = r.col and data_type <> r.target_type
    ) then
      execute format('alter table public.%I alter column %I type %s using %I::%s',
                     r.tbl, r.col, r.cast_to, r.col, r.cast_to);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Nullability and defaults.
--    Driven off information_schema so nothing runs unless the column exists; each
--    action is a semantic no-op when the column already matches production.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      -- achievements: production carries no defaults on these
      ('achievements','category','drop default'),
      ('achievements','condition_value','drop default'),
      ('achievements','description','drop default'),
      ('achievements','icon','drop default'),
      -- activities
      ('activities','created_at','drop not null'),
      ('activities','duration_minutes','drop not null'),
      ('activities','is_archived','drop not null'),
      ('activities','metadata','drop not null'),
      ('activities','order_index','drop default'),
      ('activities','phase','drop not null'),
      ('activities','phase','drop default'),
      ('activities','updated_at','drop not null'),
      -- activity_attempts
      ('activity_attempts','attempt_number','drop not null'),
      ('activity_attempts','created_at','drop not null'),
      ('activity_attempts','responses','drop not null'),
      ('activity_attempts','responses','drop default'),
      ('activity_attempts','started_at','drop not null'),
      ('activity_attempts','time_spent_seconds','drop not null'),
      ('activity_attempts','time_spent_seconds','drop default'),
      -- activity_log
      ('activity_log','metadata','drop not null'),
      -- admin_activity_log
      ('admin_activity_log','admin_user_id','set not null'),
      ('admin_activity_log','changes','drop not null'),
      ('admin_activity_log','created_at','drop not null'),
      -- api_usage
      ('api_usage','estimated_cost_usd','drop not null'),
      ('api_usage','input_tokens','set default 0'),
      ('api_usage','input_unit','set default ''tokens''::text'),
      ('api_usage','metadata','drop not null'),
      ('api_usage','output_tokens','set default 0'),
      ('api_usage','output_unit','set default ''tokens''::text'),
      ('api_usage','user_id','set not null'),
      -- chat_conversations
      ('chat_conversations','title','drop not null'),
      ('chat_conversations','title','drop default'),
      -- course_access_rules
      ('course_access_rules','created_at','drop not null'),
      -- course_modules
      ('course_modules','access_level','drop not null'),
      ('course_modules','is_archived','drop not null'),
      ('course_modules','updated_at','drop not null'),
      -- courses
      ('courses','category','drop default'),
      ('courses','description','set not null'),
      ('courses','difficulty','drop default'),
      ('courses','estimated_hours','drop not null'),
      ('courses','estimated_hours','drop default'),
      ('courses','is_archived','drop not null'),
      ('courses','metadata','drop not null'),
      ('courses','visibility','drop not null'),
      -- debate_sessions
      ('debate_sessions','feedback','set not null'),
      ('debate_sessions','overall_band','set not null'),
      ('debate_sessions','prep_time','drop default'),
      ('debate_sessions','speech_time','drop default'),
      ('debate_sessions','topic_difficulty','drop not null'),
      ('debate_sessions','topic_difficulty','set default ''intermediate''::text'),
      ('debate_sessions','total_score','set not null'),
      ('debate_sessions','transcript','drop not null'),
      ('debate_sessions','transcript','drop default'),
      -- lesson_progress
      ('lesson_progress','course_id','set not null'),
      -- lessons
      ('lessons','estimated_minutes','drop not null'),
      ('lessons','estimated_minutes','set default 10'),
      -- profiles
      ('profiles','banner_color','drop not null'),
      ('profiles','banner_color','set default ''blue''::text'),
      ('profiles','display_name','drop default'),
      ('profiles','preferences','drop not null'),
      ('profiles','unlocked_titles','drop not null'),
      -- quiz_questions
      ('quiz_questions','correct_answer','drop not null'),
      ('quiz_questions','question_type','drop default'),
      -- user_sessions
      ('user_sessions','created_at','drop not null'),
      ('user_sessions','is_active','drop not null'),
      ('user_sessions','last_seen_at','drop not null'),
      ('user_sessions','session_start','drop not null')
    ) as t(tbl, col, action)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl and column_name = r.col
    ) then
      execute format('alter table public.%I alter column %I %s', r.tbl, r.col, r.action);
    end if;
  end loop;
end $$;

-- `lessons.lesson_type` and `lessons.course_id` are NOT NULL in production. They are
-- only set here once the columns are guaranteed to exist and the table is empty (a
-- chain rebuild); on production both are already NOT NULL so this is a no-op.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lessons'
      and column_name = 'course_id' and is_nullable = 'YES'
  ) and not exists (select 1 from public.lessons where course_id is null) then
    alter table public.lessons alter column course_id set not null;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 6. A production view that exists in no migration file at all.
--
-- `monthly_usage_summary` was created through the dashboard and never captured.
-- 20260829160000_monthly_usage_summary_security.sql:10 hardens it behind
-- `if to_regclass('public.monthly_usage_summary') is not null`, so on a rebuilt
-- database that migration silently does nothing and the view never appears.
-- Definition below is `pg_get_viewdef` from production, with the grants that
-- 20260829160000 would have applied.
-- ---------------------------------------------------------------------------
create or replace view public.monthly_usage_summary as
  select
    user_id,
    service,
    model,
    date_trunc('month'::text, created_at) as month,
    count(*)                  as total_requests,
    sum(input_tokens)         as total_input,
    sum(output_tokens)        as total_output,
    sum(estimated_cost_usd)   as total_cost_usd
  from public.api_usage
  group by user_id, service, model, (date_trunc('month'::text, created_at));

alter view public.monthly_usage_summary set (security_invoker = true);
revoke all on table public.monthly_usage_summary from public, anon;
grant select on table public.monthly_usage_summary to authenticated, service_role;

commit;
