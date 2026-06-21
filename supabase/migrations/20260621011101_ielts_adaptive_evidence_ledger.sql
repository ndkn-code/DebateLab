-- =============================================================================
-- WS-6.0.2 — Adaptive evidence ledger + skill-state foundation
-- =============================================================================
-- One append-only ledger (`ielts_adaptive_evidence`) feeds one derived learner
-- ability table (`ielts_skill_states`). Assess-mode results and Learn-mode
-- activity attempts write the same evidence atoms; prediction, planning, and
-- mastery read the derived state rather than inventing parallel truths.
--
-- Security model:
--   * Learners can SELECT their own evidence/state only.
--   * Writes are server-authoritative via service_role. No learner INSERT/UPDATE
--     policies are created.
--   * `ielts_adaptive_evidence` is append-only by grants: service_role receives
--     INSERT/SELECT, not UPDATE/DELETE.
-- =============================================================================

begin;

do $$ begin
  create type public.ielts_adaptive_evidence_type as enum (
    'mock_result',
    'section_result',
    'objective_response',
    'writing_score',
    'speaking_score',
    'phoneme_signal',
    'learn_activity',
    'review_result',
    'diagnostic_import',
    'manual_adjustment'
  );
exception when duplicate_object then null; end $$;

-- Keep the JSONB item-bank metadata flexible while validating the adaptive keys
-- all downstream engines agree on.
do $$ begin
  alter table public.ielts_questions
    add constraint ielts_questions_adaptive_metadata_check
    check (
      (
        not (metadata ? 'subskill_tags')
        or jsonb_typeof(metadata -> 'subskill_tags') = 'array'
      )
      and (
        not (metadata ? 'track_c_tags')
        or jsonb_typeof(metadata -> 'track_c_tags') = 'array'
      )
      and (
        not (metadata ? 'difficulty_band_hint')
        or (
          jsonb_typeof(metadata -> 'difficulty_band_hint') = 'number'
          and (metadata ->> 'difficulty_band_hint')::numeric between 0 and 9
          and round((metadata ->> 'difficulty_band_hint')::numeric * 2)
            = (metadata ->> 'difficulty_band_hint')::numeric * 2
        )
      )
      and (
        not (metadata ? 'learn_activity_weight')
        or (
          jsonb_typeof(metadata -> 'learn_activity_weight') = 'number'
          and (metadata ->> 'learn_activity_weight')::numeric between 0 and 1
        )
      )
    );
exception when duplicate_object then null; end $$;

comment on constraint ielts_questions_adaptive_metadata_check
  on public.ielts_questions is
  'Validates optional adaptive-learning metadata: subskill_tags, difficulty_band_hint, track_c_tags, learn_activity_weight.';

comment on column public.ielts_questions.metadata is
  'Flexible item metadata. Adaptive keys are validated by ielts_questions_adaptive_metadata_check.';

create index if not exists idx_ielts_questions_adaptive_subskill_tags
  on public.ielts_questions using gin ((metadata -> 'subskill_tags'))
  where metadata ? 'subskill_tags';

create index if not exists idx_ielts_questions_adaptive_difficulty_band
  on public.ielts_questions (((metadata ->> 'difficulty_band_hint')::numeric))
  where metadata ? 'difficulty_band_hint';

create table if not exists public.ielts_adaptive_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subskill_key text not null references public.ielts_subskills(key)
    on update cascade on delete restrict,
  skill public.ielts_skill not null,
  module public.ielts_module not null default 'academic',
  test_kind public.ielts_test_kind,
  question_type public.ielts_question_type,
  criterion text,
  evidence_type public.ielts_adaptive_evidence_type not null,
  evidence_value numeric(5, 4) not null
    check (evidence_value >= 0 and evidence_value <= 1),
  band_estimate numeric(2, 1)
    check (band_estimate is null or (band_estimate >= 0 and band_estimate <= 9)),
  raw_score numeric(8, 3),
  confidence numeric(4, 3) not null
    check (confidence >= 0 and confidence <= 1),
  source_table text not null check (source_table in (
    'ielts_attempts',
    'ielts_attempt_sections',
    'ielts_question_responses',
    'attempt_band_scores',
    'writing_responses',
    'speaking_responses',
    'activity_attempts',
    'practice_attempts',
    'ielts_review_items',
    'manual_import'
  )),
  source_id uuid not null,
  reason_en text not null,
  reason_vi text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint ielts_adaptive_evidence_subskill_skill_check
    check (
      (skill = 'listening' and subskill_key like 'listening:%')
      or (skill = 'reading' and subskill_key like 'reading:%')
      or (skill = 'writing' and subskill_key like 'writing:%')
      or (skill = 'speaking' and subskill_key like 'speaking:%')
    )
);

comment on table public.ielts_adaptive_evidence is
  'Append-only adaptive-learning evidence atoms from Assess and Learn. This ledger is the source of truth for IELTS ability derivation.';

comment on column public.ielts_adaptive_evidence.evidence_value is
  'Normalized mastery signal from 0 to 1. Raw marks and IELTS bands stay in typed columns.';

comment on column public.ielts_adaptive_evidence.source_table is
  'Polymorphic source table name for the immutable source row that emitted this evidence atom.';

create index if not exists idx_ielts_adaptive_evidence_user_created
  on public.ielts_adaptive_evidence(user_id, created_at desc);

create index if not exists idx_ielts_adaptive_evidence_user_subskill
  on public.ielts_adaptive_evidence(user_id, module, subskill_key, created_at desc);

create index if not exists idx_ielts_adaptive_evidence_subskill
  on public.ielts_adaptive_evidence(subskill_key);

create index if not exists idx_ielts_adaptive_evidence_source
  on public.ielts_adaptive_evidence(source_table, source_id);

create table if not exists public.ielts_skill_states (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subskill_key text not null references public.ielts_subskills(key)
    on update cascade on delete restrict,
  skill public.ielts_skill not null,
  module public.ielts_module not null default 'academic',
  question_type public.ielts_question_type,
  criterion text,
  mastery_score numeric(5, 4) not null default 0
    check (mastery_score >= 0 and mastery_score <= 1),
  band_estimate numeric(2, 1)
    check (band_estimate is null or (band_estimate >= 0 and band_estimate <= 9)),
  confidence numeric(4, 3) not null default 0
    check (confidence >= 0 and confidence <= 1),
  weakness_weight numeric(4, 3) not null default 0
    check (weakness_weight >= 0 and weakness_weight <= 1),
  evidence_count integer not null default 0 check (evidence_count >= 0),
  last_evidence_at timestamptz,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, module, subskill_key),
  constraint ielts_skill_states_subskill_skill_check
    check (
      (skill = 'listening' and subskill_key like 'listening:%')
      or (skill = 'reading' and subskill_key like 'reading:%')
      or (skill = 'writing' and subskill_key like 'writing:%')
      or (skill = 'speaking' and subskill_key like 'speaking:%')
    )
);

comment on table public.ielts_skill_states is
  'Derived current mastery and weakness per learner, module, and IELTS subskill. This is the single ability truth.';

comment on column public.ielts_skill_states.mastery_score is
  'Current normalized mastery estimate from 0 to 1, derived from ielts_adaptive_evidence.';

create index if not exists idx_ielts_skill_states_user
  on public.ielts_skill_states(user_id, module, updated_at desc);

create index if not exists idx_ielts_skill_states_subskill
  on public.ielts_skill_states(subskill_key);

create index if not exists idx_ielts_skill_states_weakness
  on public.ielts_skill_states(user_id, module, weakness_weight desc)
  where confidence > 0;

alter table public.ielts_adaptive_evidence enable row level security;
drop policy if exists "Users view own IELTS adaptive evidence"
  on public.ielts_adaptive_evidence;
create policy "Users view own IELTS adaptive evidence"
  on public.ielts_adaptive_evidence
  for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

alter table public.ielts_skill_states enable row level security;
drop policy if exists "Users view own IELTS skill states"
  on public.ielts_skill_states;
create policy "Users view own IELTS skill states"
  on public.ielts_skill_states
  for select
  to authenticated
  using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));

revoke all on table public.ielts_adaptive_evidence from anon, authenticated, service_role;
grant select on table public.ielts_adaptive_evidence to authenticated;
grant select, insert on table public.ielts_adaptive_evidence to service_role;

revoke all on table public.ielts_skill_states from anon, authenticated, service_role;
grant select on table public.ielts_skill_states to authenticated;
grant select, insert, update on table public.ielts_skill_states to service_role;

commit;
