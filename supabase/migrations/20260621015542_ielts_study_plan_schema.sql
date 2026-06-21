-- =============================================================================
-- WS-6.1.2 — IELTS study-plan schema
-- =============================================================================
-- Stores learner-owned adaptive goals and dated plan items. The pure Track C
-- generator works from contracts and fixtures; persisted rows keep pointer
-- columns to the existing IELTS/activity/review substrates rather than copying
-- prompts, answers, or scoring payloads.
--
-- Security model:
--   * Learners can SELECT only their own plans and items.
--   * Writes are server-authoritative through service_role.
--   * Bands/scores stay in typed numeric columns; explainability lives in JSONB.
-- =============================================================================

begin;

do $$ begin
  create type public.ielts_study_plan_status as enum (
    'active',
    'paused',
    'completed',
    'archived'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_plan_item_status as enum (
    'scheduled',
    'available',
    'started',
    'completed',
    'missed',
    'skipped',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_plan_item_kind as enum (
    'learn_activity',
    'review',
    'mini_mock',
    'full_mock',
    'writing_submission',
    'speaking_submission',
    'teacher_assignment'
  );
exception when duplicate_object then null; end $$;

grant usage on type public.ielts_study_plan_status to authenticated, service_role;
grant usage on type public.ielts_plan_item_status to authenticated, service_role;
grant usage on type public.ielts_plan_item_kind to authenticated, service_role;

create schema if not exists private;

create or replace function private.has_unique_smallints(p_values smallint[])
returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select cardinality(p_values) = (
    select count(distinct item)::integer
    from unnest(p_values) as item
  );
$$;

create or replace function private.has_unique_ielts_skills(
  p_values public.ielts_skill[]
) returns boolean
language sql
immutable
strict
set search_path = ''
as $$
  select cardinality(p_values) = (
    select count(distinct item)::integer
    from unnest(p_values) as item
  );
$$;

create table if not exists public.ielts_study_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  module public.ielts_module not null default 'academic',
  status public.ielts_study_plan_status not null default 'active',
  target_test_date date not null,
  target_overall_band numeric(2, 1) not null default 6.5 check (
    target_overall_band >= 0
    and target_overall_band <= 9
    and round(target_overall_band * 2) = target_overall_band * 2
  ),
  target_listening_band numeric(2, 1) check (
    target_listening_band is null
    or (
      target_listening_band >= 0
      and target_listening_band <= 9
      and round(target_listening_band * 2) = target_listening_band * 2
    )
  ),
  target_reading_band numeric(2, 1) check (
    target_reading_band is null
    or (
      target_reading_band >= 0
      and target_reading_band <= 9
      and round(target_reading_band * 2) = target_reading_band * 2
    )
  ),
  target_writing_band numeric(2, 1) check (
    target_writing_band is null
    or (
      target_writing_band >= 0
      and target_writing_band <= 9
      and round(target_writing_band * 2) = target_writing_band * 2
    )
  ),
  target_speaking_band numeric(2, 1) check (
    target_speaking_band is null
    or (
      target_speaking_band >= 0
      and target_speaking_band <= 9
      and round(target_speaking_band * 2) = target_speaking_band * 2
    )
  ),
  focus_skills public.ielts_skill[],
  daily_minutes integer not null check (daily_minutes between 5 and 240),
  study_days smallint[] not null check (
    cardinality(study_days) between 1 and 7
    and study_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
    and private.has_unique_smallints(study_days)
  ),
  timezone text not null default 'Asia/Ho_Chi_Minh' check (length(btrim(timezone)) > 0),
  feedback_language text not null default 'en' check (feedback_language in ('en', 'vi')),
  plan_horizon_days integer not null default 14 check (plan_horizon_days between 1 and 60),
  plan_version integer not null default 1 check (plan_version > 0),
  baseline_prediction_snapshot_id text,
  latest_prediction_snapshot_id text,
  predicted_overall_band numeric(2, 1) check (
    predicted_overall_band is null
    or (
      predicted_overall_band >= 0
      and predicted_overall_band <= 9
      and round(predicted_overall_band * 2) = predicted_overall_band * 2
    )
  ),
  predicted_listening_band numeric(2, 1) check (
    predicted_listening_band is null
    or (
      predicted_listening_band >= 0
      and predicted_listening_band <= 9
      and round(predicted_listening_band * 2) = predicted_listening_band * 2
    )
  ),
  predicted_reading_band numeric(2, 1) check (
    predicted_reading_band is null
    or (
      predicted_reading_band >= 0
      and predicted_reading_band <= 9
      and round(predicted_reading_band * 2) = predicted_reading_band * 2
    )
  ),
  predicted_writing_band numeric(2, 1) check (
    predicted_writing_band is null
    or (
      predicted_writing_band >= 0
      and predicted_writing_band <= 9
      and round(predicted_writing_band * 2) = predicted_writing_band * 2
    )
  ),
  predicted_speaking_band numeric(2, 1) check (
    predicted_speaking_band is null
    or (
      predicted_speaking_band >= 0
      and predicted_speaking_band <= 9
      and round(predicted_speaking_band * 2) = predicted_speaking_band * 2
    )
  ),
  prediction_confidence numeric(4, 3) check (
    prediction_confidence is null
    or (prediction_confidence >= 0 and prediction_confidence <= 1)
  ),
  prediction_summary jsonb not null default '{}'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  last_replanned_at timestamptz,
  next_reassessment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    focus_skills is null
    or (
      cardinality(focus_skills) between 1 and 4
      and private.has_unique_ielts_skills(focus_skills)
    )
  )
);

comment on table public.ielts_study_plans is
  'Learner-owned IELTS adaptive plan goals, schedule preferences, prediction summary, and explainability.';
comment on column public.ielts_study_plans.focus_skills is
  'Optional declared focus. When present, de-focused skills receive maintenance only.';
comment on column public.ielts_study_plans.study_days is
  'ISO weekdays 1-7 selected for study.';

create unique index if not exists idx_ielts_study_plans_one_active
  on public.ielts_study_plans(user_id, module)
  where status = 'active';
create index if not exists idx_ielts_study_plans_user_status
  on public.ielts_study_plans(user_id, status, updated_at desc);

create table if not exists public.ielts_study_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.ielts_study_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.ielts_plan_item_kind not null,
  status public.ielts_plan_item_status not null default 'scheduled',
  scheduled_date date not null,
  available_at timestamptz,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  skill public.ielts_skill not null,
  focus_area text not null check (length(btrim(focus_area)) > 0),
  question_type public.ielts_question_type,
  criterion text,
  activity_id uuid references public.activities(id) on delete set null,
  ielts_test_id uuid references public.ielts_tests(id) on delete set null,
  ielts_question_id uuid references public.ielts_questions(id) on delete set null,
  review_item_id uuid references public.ielts_review_items(id) on delete set null,
  assignment_id uuid references public.club_assignments(id) on delete set null,
  activity_attempt_id uuid references public.activity_attempts(id) on delete set null,
  ielts_attempt_id uuid references public.ielts_attempts(id) on delete set null,
  writing_response_id uuid references public.writing_responses(id) on delete set null,
  speaking_response_id uuid references public.speaking_responses(id) on delete set null,
  estimated_minutes integer not null check (estimated_minutes between 1 and 240),
  priority_score numeric(8, 4) not null default 0 check (priority_score >= 0),
  source_prediction_snapshot_id text,
  source_weakness_keys text[] not null default '{}'::text[],
  rationale_en text not null check (length(btrim(rationale_en)) > 0),
  rationale_vi text not null check (length(btrim(rationale_vi)) > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (kind <> 'learn_activity' or activity_id is not null)
    and (kind not in ('mini_mock', 'full_mock') or ielts_test_id is not null)
    and (kind <> 'review' or review_item_id is not null or activity_id is not null)
    and (kind <> 'writing_submission' or ielts_question_id is not null or activity_id is not null)
    and (kind <> 'speaking_submission' or ielts_question_id is not null or activity_id is not null)
    and (kind <> 'teacher_assignment' or assignment_id is not null)
  )
);

comment on table public.ielts_study_plan_items is
  'Dated IELTS study-plan commitments. Rows point to activities, tests, review items, questions, or teacher assignments.';
comment on column public.ielts_study_plan_items.source_weakness_keys is
  'IeltsWeaknessSignal.key values from the shared adaptive contract that explain this item.';

create index if not exists idx_ielts_study_plan_items_user_date_status
  on public.ielts_study_plan_items(user_id, scheduled_date, status);
create index if not exists idx_ielts_study_plan_items_plan_date
  on public.ielts_study_plan_items(plan_id, scheduled_date, priority_score desc);
create index if not exists idx_ielts_study_plan_items_review
  on public.ielts_study_plan_items(review_item_id)
  where review_item_id is not null;
create index if not exists idx_ielts_study_plan_items_activity
  on public.ielts_study_plan_items(activity_id)
  where activity_id is not null;
create index if not exists idx_ielts_study_plan_items_test
  on public.ielts_study_plan_items(ielts_test_id)
  where ielts_test_id is not null;

alter table public.ielts_study_plans enable row level security;
alter table public.ielts_study_plan_items enable row level security;

revoke all on public.ielts_study_plans from anon, authenticated;
revoke all on public.ielts_study_plan_items from anon, authenticated;
grant select on public.ielts_study_plans to authenticated;
grant select on public.ielts_study_plan_items to authenticated;
grant select, insert, update, delete on public.ielts_study_plans to service_role;
grant select, insert, update, delete on public.ielts_study_plan_items to service_role;

drop policy if exists "Users view own IELTS study plans" on public.ielts_study_plans;
create policy "Users view own IELTS study plans" on public.ielts_study_plans
  for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users view own IELTS study plan items" on public.ielts_study_plan_items;
create policy "Users view own IELTS study plan items" on public.ielts_study_plan_items
  for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

commit;
