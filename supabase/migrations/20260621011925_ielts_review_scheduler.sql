-- =============================================================================
-- WS-6.0.4 — Shared IELTS review scheduler (SM-2 now, FSRS-ready)
-- =============================================================================
-- Foundation-owned shared SRS queue. Track D creates review items; Track C
-- schedules due items. The active scheduler is SM-2, with FSRS-compatible typed
-- columns present but intentionally unused until the FSRS decision is made.
--
-- Security model:
--   * Learners can SELECT only their own rows.
--   * Writes are server-authoritative through service_role.
--   * Review events are append-only.
-- =============================================================================

begin;

do $$ begin
  create type public.ielts_review_algorithm as enum ('sm2_v1', 'fsrs_v1');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_review_rating as enum ('again', 'hard', 'good', 'easy');
exception when duplicate_object then null; end $$;

grant usage on type public.ielts_review_algorithm to authenticated, service_role;
grant usage on type public.ielts_review_rating to authenticated, service_role;

create table if not exists public.ielts_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (
    source_type in (
      'ielts_question',
      'activity',
      'activity_attempt',
      'question_response',
      'writing_response',
      'speaking_response',
      'phoneme_report',
      'manual',
      'synthetic_atom'
    )
  ),
  source_id uuid,
  source_key text not null check (length(btrim(source_key)) > 0),
  skill public.ielts_skill not null,
  focus_area text not null check (length(btrim(focus_area)) > 0),
  review_kind text not null check (length(btrim(review_kind)) > 0),
  question_id uuid references public.ielts_questions(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  activity_attempt_id uuid references public.activity_attempts(id) on delete set null,
  question_response_id uuid references public.ielts_question_responses(id) on delete set null,
  writing_response_id uuid references public.writing_responses(id) on delete set null,
  speaking_response_id uuid references public.speaking_responses(id) on delete set null,
  prompt_en text not null check (length(btrim(prompt_en)) > 0),
  prompt_vi text not null check (length(btrim(prompt_vi)) > 0),
  answer_en text,
  answer_vi text,
  atom_payload jsonb not null default '{}'::jsonb,
  algorithm public.ielts_review_algorithm not null default 'sm2_v1',
  state text not null default 'new' check (
    state in ('new', 'learning', 'review', 'relearning', 'suspended', 'mastered', 'archived')
  ),
  difficulty numeric(6, 3) not null default 5 check (difficulty >= 1 and difficulty <= 10),
  stability numeric(8, 3) not null default 0 check (stability >= 0),
  retrievability numeric(6, 3) not null default 1 check (
    retrievability >= 0 and retrievability <= 1
  ),
  ease_factor numeric(6, 3) not null default 2.5 check (ease_factor >= 1.3),
  interval_days numeric(8, 3) not null default 0 check (interval_days >= 0),
  repetitions integer not null default 0 check (repetitions >= 0),
  lapses integer not null default 0 check (lapses >= 0),
  last_reviewed_at timestamptz,
  due_at timestamptz not null default now(),
  suspended_until timestamptz,
  mastered_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source_key),
  check ((answer_en is null and answer_vi is null) or (answer_en is not null and answer_vi is not null)),
  check (state <> 'suspended' or suspended_until is not null),
  check (state <> 'mastered' or mastered_at is not null)
);

create index if not exists idx_ielts_review_items_user_due
  on public.ielts_review_items(user_id, due_at)
  where state in ('new', 'learning', 'review', 'relearning');
create index if not exists idx_ielts_review_items_question
  on public.ielts_review_items(question_id)
  where question_id is not null;
create index if not exists idx_ielts_review_items_activity
  on public.ielts_review_items(activity_id)
  where activity_id is not null;
create index if not exists idx_ielts_review_items_skill_kind
  on public.ielts_review_items(user_id, skill, review_kind, state);

create table if not exists public.ielts_review_events (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid not null references public.ielts_review_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_item_id uuid,
  activity_attempt_id uuid references public.activity_attempts(id) on delete set null,
  rating public.ielts_review_rating not null,
  quality_grade smallint not null check (quality_grade between 0 and 5),
  is_correct boolean,
  response_ms integer check (response_ms is null or response_ms >= 0),
  previous_state text not null check (
    previous_state in ('new', 'learning', 'review', 'relearning', 'suspended', 'mastered', 'archived')
  ),
  next_state text not null check (
    next_state in ('new', 'learning', 'review', 'relearning', 'suspended', 'mastered', 'archived')
  ),
  previous_due_at timestamptz not null,
  next_due_at timestamptz not null,
  previous_interval_days numeric(8, 3) not null check (previous_interval_days >= 0),
  next_interval_days numeric(8, 3) not null check (next_interval_days >= 0),
  previous_ease_factor numeric(6, 3) not null check (previous_ease_factor >= 1.3),
  next_ease_factor numeric(6, 3) not null check (next_ease_factor >= 1.3),
  previous_repetitions integer not null check (previous_repetitions >= 0),
  next_repetitions integer not null check (next_repetitions >= 0),
  previous_lapses integer not null check (previous_lapses >= 0),
  next_lapses integer not null check (next_lapses >= 0),
  previous_difficulty numeric(6, 3) not null check (previous_difficulty >= 1 and previous_difficulty <= 10),
  next_difficulty numeric(6, 3) not null check (next_difficulty >= 1 and next_difficulty <= 10),
  previous_stability numeric(8, 3) not null check (previous_stability >= 0),
  next_stability numeric(8, 3) not null check (next_stability >= 0),
  previous_retrievability numeric(6, 3) not null check (
    previous_retrievability >= 0 and previous_retrievability <= 1
  ),
  next_retrievability numeric(6, 3) not null check (
    next_retrievability >= 0 and next_retrievability <= 1
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_ielts_review_events_item_created
  on public.ielts_review_events(review_item_id, created_at desc);
create index if not exists idx_ielts_review_events_user_created
  on public.ielts_review_events(user_id, created_at desc);
create index if not exists idx_ielts_review_events_plan_item
  on public.ielts_review_events(plan_item_id)
  where plan_item_id is not null;

create schema if not exists private;

create or replace function private.prevent_ielts_review_events_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'IELTS_REVIEW_EVENTS_APPEND_ONLY';
end;
$$;

drop trigger if exists trg_ielts_review_events_append_only on public.ielts_review_events;
create trigger trg_ielts_review_events_append_only
  before update or delete on public.ielts_review_events
  for each row execute function private.prevent_ielts_review_events_mutation();

create or replace function public.record_ielts_review_rating(
  p_review_item_id uuid,
  p_rating public.ielts_review_rating,
  p_quality_grade smallint,
  p_next_state text,
  p_next_due_at timestamptz,
  p_next_interval_days numeric,
  p_next_ease_factor numeric,
  p_next_repetitions integer,
  p_next_lapses integer,
  p_next_difficulty numeric,
  p_next_stability numeric,
  p_next_retrievability numeric,
  p_reviewed_at timestamptz default now(),
  p_is_correct boolean default null,
  p_response_ms integer default null,
  p_plan_item_id uuid default null,
  p_activity_attempt_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
) returns public.ielts_review_items
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.ielts_review_items%rowtype;
  v_updated public.ielts_review_items%rowtype;
begin
  if p_quality_grade < 0 or p_quality_grade > 5 then
    raise exception 'IELTS_REVIEW_INVALID_GRADE';
  end if;
  if p_response_ms is not null and p_response_ms < 0 then
    raise exception 'IELTS_REVIEW_INVALID_RESPONSE_MS';
  end if;

  select * into v_item
  from public.ielts_review_items
  where id = p_review_item_id
  for update;
  if not found then
    raise exception 'IELTS_REVIEW_ITEM_NOT_FOUND';
  end if;

  update public.ielts_review_items
  set state = p_next_state,
      due_at = p_next_due_at,
      interval_days = p_next_interval_days,
      ease_factor = p_next_ease_factor,
      repetitions = p_next_repetitions,
      lapses = p_next_lapses,
      difficulty = p_next_difficulty,
      stability = p_next_stability,
      retrievability = p_next_retrievability,
      last_reviewed_at = p_reviewed_at,
      updated_at = now()
  where id = p_review_item_id
  returning * into v_updated;

  insert into public.ielts_review_events (
    review_item_id,
    user_id,
    plan_item_id,
    activity_attempt_id,
    rating,
    quality_grade,
    is_correct,
    response_ms,
    previous_state,
    next_state,
    previous_due_at,
    next_due_at,
    previous_interval_days,
    next_interval_days,
    previous_ease_factor,
    next_ease_factor,
    previous_repetitions,
    next_repetitions,
    previous_lapses,
    next_lapses,
    previous_difficulty,
    next_difficulty,
    previous_stability,
    next_stability,
    previous_retrievability,
    next_retrievability,
    metadata,
    created_at
  ) values (
    v_item.id,
    v_item.user_id,
    p_plan_item_id,
    p_activity_attempt_id,
    p_rating,
    p_quality_grade,
    p_is_correct,
    p_response_ms,
    v_item.state,
    p_next_state,
    v_item.due_at,
    p_next_due_at,
    v_item.interval_days,
    p_next_interval_days,
    v_item.ease_factor,
    p_next_ease_factor,
    v_item.repetitions,
    p_next_repetitions,
    v_item.lapses,
    p_next_lapses,
    v_item.difficulty,
    p_next_difficulty,
    v_item.stability,
    p_next_stability,
    v_item.retrievability,
    p_next_retrievability,
    coalesce(p_metadata, '{}'::jsonb),
    p_reviewed_at
  );

  return v_updated;
end;
$$;

revoke all on function public.record_ielts_review_rating(
  uuid,
  public.ielts_review_rating,
  smallint,
  text,
  timestamptz,
  numeric,
  numeric,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  timestamptz,
  boolean,
  integer,
  uuid,
  uuid,
  jsonb
) from public, anon, authenticated;
grant execute on function public.record_ielts_review_rating(
  uuid,
  public.ielts_review_rating,
  smallint,
  text,
  timestamptz,
  numeric,
  numeric,
  integer,
  integer,
  numeric,
  numeric,
  numeric,
  timestamptz,
  boolean,
  integer,
  uuid,
  uuid,
  jsonb
) to service_role;

alter table public.ielts_review_items enable row level security;
alter table public.ielts_review_events enable row level security;

revoke all on public.ielts_review_items from anon, authenticated;
revoke all on public.ielts_review_events from anon, authenticated;
grant select on public.ielts_review_items to authenticated;
grant select on public.ielts_review_events to authenticated;
grant select, insert, update, delete on public.ielts_review_items to service_role;
grant select, insert on public.ielts_review_events to service_role;

drop policy if exists "Users view own IELTS review items" on public.ielts_review_items;
create policy "Users view own IELTS review items" on public.ielts_review_items
  for select using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

drop policy if exists "Users view own IELTS review events" on public.ielts_review_events;
create policy "Users view own IELTS review events" on public.ielts_review_events
  for select using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

commit;
