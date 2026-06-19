-- =============================================================================
-- WS-0.3 — IELTS data model + RLS
-- =============================================================================
-- Masterplan §6. Extends DebateLab's existing content/attempt/scoring substrate
-- (activities/activity_attempts, practice_attempts/analysis_jobs, clubs/classes)
-- rather than duplicating it. ADDITIVE ONLY — no existing table is altered or
-- dropped, so it is safe to apply to a live DB.
--
-- Quality Bar (CI-enforced):
--   * RLS + >=1 policy on every new table (scripts/ci/checks/rls-coverage.ts).
--   * Score/band data lives in TYPED numeric columns, never json/jsonb
--     (scripts/ci/checks/score-columns.ts).
--   * Native PG enums for the IELTS taxonomy so the generated `Database` type
--     carries real string-unions (true "typed end-to-end"). This is a deliberate
--     deviation from the repo's text+CHECK convention, justified by the
--     masterplan's "typed enum" requirement; the value-sets are closed/stable.
--     See docs/ielts/data-access.md (enum-evolution note) for how to add values.
--
-- Security model (server-authoritative writes):
--   * Learner-facing attempt/score rows are written by server actions via the
--     service-role client (mirrors the duel server-clock precedent), so timing
--     and bands cannot be tampered with from the client. RLS therefore grants
--     learners SELECT-own only; admins manage; service_role bypasses RLS.
--   * Answer keys live in a separate `ielts_question_keys` table that NO learner
--     policy can read (fixes the debate engine's "anyone can view quiz answers"
--     weakness). Grading reads keys with service_role.
--   * Org-scoped (B2B teacher) policies are intentionally deferred to WS-5.2;
--     `ielts_attempts` already carries nullable club_id/class_id/assignment_id so
--     those policies can be added later with no schema change.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Enum types (idempotent guards for local `supabase db reset` re-runs)
-- -----------------------------------------------------------------------------
do $$ begin
  create type public.ielts_skill as enum ('listening', 'reading', 'writing', 'speaking');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_module as enum ('academic', 'general_training');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_test_kind as enum ('full_mock', 'skill_set', 'drill');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_content_status as enum ('draft', 'in_qa', 'approved', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_accent as enum ('uk', 'us', 'aus', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_audio_status as enum ('pending', 'generating', 'ready', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_attempt_status as enum ('in_progress', 'submitted', 'scoring', 'completed', 'expired', 'abandoned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ielts_response_status as enum ('pending', 'scoring', 'scored', 'failed', 'overridden');
exception when duplicate_object then null; end $$;

-- The complete IELTS question-type taxonomy (masterplan §6 / authoring-spec §4).
do $$ begin
  create type public.ielts_question_type as enum (
    -- Reading / Listening (objective)
    'mcq_single',
    'mcq_multi',
    'true_false_notgiven',
    'yes_no_notgiven',
    'matching_headings',
    'matching_information',
    'matching_features',
    'sentence_completion',
    'summary_completion',
    'note_table_form_flowchart_completion',
    'short_answer',
    'diagram_label',
    'map_plan_label',
    -- Writing (prompts)
    'writing_task1_academic',
    'writing_task1_general',
    'writing_task2_essay',
    -- Speaking (prompts)
    'speaking_part1',
    'speaking_part2_cuecard',
    'speaking_part3'
  );
exception when duplicate_object then null; end $$;

-- =============================================================================
-- 2. CONTENT (authored by teachers; admin-managed, learner-readable when published)
-- =============================================================================

-- 2.1 ielts_tests — top-level container: a full 4-skill mock, a single-skill set,
--      or a per-type drill.
create table if not exists public.ielts_tests (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  kind public.ielts_test_kind not null default 'full_mock',
  module public.ielts_module not null default 'academic',
  skill public.ielts_skill,                 -- null for full_mock; set for skill_set/drill
  status public.ielts_content_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds > 0),
  description text,
  author_id uuid references public.profiles(id) on delete set null,
  qa_reviewer_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'full_mock' or skill is null)
);

-- 2.2 audio_assets — TTS-generated Listening audio (WS-1.3 fills storage_path).
--      Created before listening_sections (which references it).
create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  test_id uuid references public.ielts_tests(id) on delete cascade,
  kind text not null default 'listening_section'
    check (kind in ('listening_section', 'prompt', 'example')),
  script text,
  voice text,
  accent public.ielts_accent not null default 'uk',
  tts_provider text,
  storage_path text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  status public.ielts_audio_status not null default 'pending',
  version integer not null default 1 check (version > 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.3 passages — Reading stimulus.
create table if not exists public.passages (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.ielts_tests(id) on delete cascade,
  order_index integer not null default 0,
  title text not null,
  body text not null,
  word_count integer check (word_count is null or word_count >= 0),
  genre text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.4 listening_sections — Listening stimulus (script + accent + audio link).
create table if not exists public.listening_sections (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.ielts_tests(id) on delete cascade,
  section_number integer not null check (section_number between 1 and 4),
  order_index integer not null default 0,
  title text,
  script text not null,
  accent public.ielts_accent not null default 'uk',
  audio_asset_id uuid references public.audio_assets(id) on delete set null,
  speakers jsonb not null default '[]'::jsonb,   -- [{ name, accent }]
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (test_id, section_number)
);

-- 2.5 ielts_questions — the item bank (R/L questions AND W/S prompts). NON-secret
--      fields only; the answer key lives in ielts_question_keys.
create table if not exists public.ielts_questions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.ielts_tests(id) on delete cascade,
  passage_id uuid references public.passages(id) on delete cascade,
  listening_section_id uuid references public.listening_sections(id) on delete cascade,
  skill public.ielts_skill not null,
  question_type public.ielts_question_type not null,
  order_index integer not null default 0,
  group_key text,                               -- groups items sharing a stem (matching sets)
  group_instructions text,                      -- e.g. "Questions 1-5 ... NO MORE THAN TWO WORDS"
  prompt text not null,
  options jsonb not null default '[]'::jsonb,    -- choices / candidate headings / features (non-secret)
  max_points integer not null default 1 check (max_points >= 0),
  word_limit integer check (word_limit is null or word_limit > 0),
  visual jsonb,                                  -- chart/diagram/map data (lesson-chunk shape)
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not (passage_id is not null and listening_section_id is not null))
);

-- 2.6 ielts_question_keys — SECRET answer key, explanations, and W/S model answer.
--      Separated so RLS can keep learners out (no learner policy below).
create table if not exists public.ielts_question_keys (
  question_id uuid primary key references public.ielts_questions(id) on delete cascade,
  correct_answer jsonb not null default '{}'::jsonb,
  accept_variants jsonb not null default '[]'::jsonb,  -- spelling/synonym/number variants
  explanation_en text,
  explanation_vi text,
  model_answer text,                            -- Band-9 model (RAG seed; W/S) — text, not a score column
  examiner_notes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.7 band_conversions — raw→band lookup (Listening; Academic vs GT Reading).
--      WS-2.2 seeds exact per-test tables; representative defaults can be seeded later.
create table if not exists public.band_conversions (
  id uuid primary key default gen_random_uuid(),
  conversion_key text not null default 'default',
  skill public.ielts_skill not null check (skill in ('listening', 'reading')),
  module public.ielts_module,                   -- null for listening; academic/gt for reading
  band numeric(2, 1) not null check (band >= 0 and band <= 9),
  raw_min integer not null check (raw_min >= 0),
  raw_max integer not null check (raw_max >= raw_min),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversion_key, skill, module, band)
);

-- =============================================================================
-- 3. ATTEMPTS (learner-owned; server-authoritative writes; SELECT-own RLS)
-- =============================================================================

-- 3.1 ielts_attempts — a sitting of an ielts_test. Carries nullable org FKs so
--      WS-5.2 can add org-scoped policies without a schema change.
create table if not exists public.ielts_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_id uuid not null references public.ielts_tests(id) on delete restrict,
  status public.ielts_attempt_status not null default 'in_progress',
  module public.ielts_module not null default 'academic',
  attempt_number integer not null default 1 check (attempt_number > 0),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  club_id uuid references public.clubs(id) on delete set null,
  class_id uuid references public.classes(id) on delete set null,
  assignment_id uuid references public.club_assignments(id) on delete set null,
  activity_attempt_id uuid references public.activity_attempts(id) on delete set null, -- engine bridge
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3.2 ielts_attempt_sections — per-section timing/state (L 30m+10m / R 60m / W 60m / S ~14m).
create table if not exists public.ielts_attempt_sections (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, -- denormalized for RLS
  skill public.ielts_skill not null,
  section_order integer not null default 0,
  label text,
  passage_id uuid references public.passages(id) on delete set null,
  listening_section_id uuid references public.listening_sections(id) on delete set null,
  time_limit_seconds integer check (time_limit_seconds is null or time_limit_seconds > 0),
  started_at timestamptz,
  deadline_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, section_order)
);

-- 3.3 ielts_question_responses — objective answers per attempt (graded server-side by WS-1.2/2.2).
create table if not exists public.ielts_question_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, -- denormalized for RLS
  question_id uuid not null references public.ielts_questions(id) on delete cascade,
  section_id uuid references public.ielts_attempt_sections(id) on delete set null,
  response jsonb not null default '{}'::jsonb,
  is_correct boolean,
  awarded_points integer check (awarded_points is null or awarded_points >= 0),
  graded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- =============================================================================
-- 4. SCORING (typed numeric band columns — never json/jsonb)
-- =============================================================================

-- 4.1 attempt_band_scores — per-attempt skill bands + overall (the result transcript).
--      Per-criterion W/S detail lives in writing_responses / speaking_responses.
create table if not exists public.attempt_band_scores (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade, -- denormalized for RLS
  listening_raw integer check (listening_raw is null or (listening_raw >= 0 and listening_raw <= 40)),
  reading_raw integer check (reading_raw is null or (reading_raw >= 0 and reading_raw <= 40)),
  listening_band numeric(2, 1) check (listening_band is null or (listening_band >= 0 and listening_band <= 9)),
  reading_band numeric(2, 1) check (reading_band is null or (reading_band >= 0 and reading_band <= 9)),
  writing_band numeric(2, 1) check (writing_band is null or (writing_band >= 0 and writing_band <= 9)),
  speaking_band numeric(2, 1) check (speaking_band is null or (speaking_band >= 0 and speaking_band <= 9)),
  overall_band numeric(2, 1) check (overall_band is null or (overall_band >= 0 and overall_band <= 9)),
  band_conversion_id uuid references public.band_conversions(id) on delete set null,
  computed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id)
);

-- 4.2 writing_responses — essay submission + per-criterion AI bands + teacher override.
create table if not exists public.writing_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.ielts_questions(id) on delete cascade,
  task_number integer not null default 2 check (task_number in (1, 2)),
  essay text not null default '',
  word_count integer not null default 0 check (word_count >= 0),
  status public.ielts_response_status not null default 'pending',
  -- AI per-criterion bands (0-9):
  task_response_band numeric(2, 1) check (task_response_band is null or (task_response_band >= 0 and task_response_band <= 9)),
  coherence_cohesion_band numeric(2, 1) check (coherence_cohesion_band is null or (coherence_cohesion_band >= 0 and coherence_cohesion_band <= 9)),
  lexical_resource_band numeric(2, 1) check (lexical_resource_band is null or (lexical_resource_band >= 0 and lexical_resource_band <= 9)),
  grammar_band numeric(2, 1) check (grammar_band is null or (grammar_band >= 0 and grammar_band <= 9)),
  task_band numeric(2, 1) check (task_band is null or (task_band >= 0 and task_band <= 9)),
  inline_corrections jsonb not null default '[]'::jsonb,  -- correction spans
  paragraph_feedback jsonb not null default '[]'::jsonb,
  model_answer text,                              -- Band-9 rewrite (WS-3.1)
  feedback_language text not null default 'en' check (feedback_language in ('en', 'vi')),
  prompt_bundle_key text,
  prompt_bundle_version integer,
  model_provider text,
  model_name text,
  reviewer_id uuid references public.profiles(id) on delete set null,   -- teacher override (WS-5)
  reviewed_at timestamptz,
  reviewer_note text,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- 4.3 speaking_responses — audio + transcript + per-criterion bands + typed phoneme_report.
create table if not exists public.speaking_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.ielts_attempts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.ielts_questions(id) on delete cascade,
  part_number integer check (part_number in (1, 2, 3)),
  audio_storage_path text,
  transcript text not null default '',
  status public.ielts_response_status not null default 'pending',
  -- AI per-criterion bands (0-9):
  fluency_coherence_band numeric(2, 1) check (fluency_coherence_band is null or (fluency_coherence_band >= 0 and fluency_coherence_band <= 9)),
  lexical_resource_band numeric(2, 1) check (lexical_resource_band is null or (lexical_resource_band >= 0 and lexical_resource_band <= 9)),
  grammar_band numeric(2, 1) check (grammar_band is null or (grammar_band >= 0 and grammar_band <= 9)),
  pronunciation_band numeric(2, 1) check (pronunciation_band is null or (pronunciation_band >= 0 and pronunciation_band <= 9)),
  speaking_band numeric(2, 1) check (speaking_band is null or (speaking_band >= 0 and speaking_band <= 9)),
  -- phoneme_report: typed shape validated by Zod in lib/api/ielts (WS-3.3 fills it);
  -- stored as jsonb because it is a deeply-nested per-word/per-phoneme array. The
  -- pronunciation SCORE itself is the typed pronunciation_band column above.
  phoneme_report jsonb not null default '{}'::jsonb,
  feedback jsonb not null default '{}'::jsonb,
  feedback_language text not null default 'en' check (feedback_language in ('en', 'vi')),
  prompt_bundle_key text,
  prompt_bundle_version integer,
  model_provider text,
  model_name text,
  stt_provider text,
  reviewer_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  reviewer_note text,
  scored_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

-- =============================================================================
-- 5. Indexes (FK lookups + learner time-series)
-- =============================================================================
create index if not exists idx_passages_test on public.passages(test_id, order_index);
create index if not exists idx_listening_sections_test on public.listening_sections(test_id, section_number);
create index if not exists idx_audio_assets_test on public.audio_assets(test_id) where test_id is not null;
create index if not exists idx_ielts_questions_test on public.ielts_questions(test_id, order_index);
create index if not exists idx_ielts_questions_passage on public.ielts_questions(passage_id) where passage_id is not null;
create index if not exists idx_ielts_questions_listening on public.ielts_questions(listening_section_id) where listening_section_id is not null;
create index if not exists idx_ielts_tests_status on public.ielts_tests(status, skill);
create index if not exists idx_band_conversions_lookup on public.band_conversions(conversion_key, skill, module);

create index if not exists idx_ielts_attempts_user_created on public.ielts_attempts(user_id, created_at desc);
create index if not exists idx_ielts_attempts_test on public.ielts_attempts(test_id);
create index if not exists idx_ielts_attempts_club on public.ielts_attempts(club_id) where club_id is not null;
create index if not exists idx_ielts_attempts_class on public.ielts_attempts(class_id) where class_id is not null;
create index if not exists idx_ielts_attempt_sections_attempt on public.ielts_attempt_sections(attempt_id, section_order);
create index if not exists idx_ielts_attempt_sections_user on public.ielts_attempt_sections(user_id);
create index if not exists idx_ielts_question_responses_attempt on public.ielts_question_responses(attempt_id);
create index if not exists idx_ielts_question_responses_user on public.ielts_question_responses(user_id);
create index if not exists idx_attempt_band_scores_user on public.attempt_band_scores(user_id, created_at desc);
create index if not exists idx_writing_responses_attempt on public.writing_responses(attempt_id);
create index if not exists idx_writing_responses_user on public.writing_responses(user_id, created_at desc);
create index if not exists idx_writing_responses_status on public.writing_responses(status);
create index if not exists idx_speaking_responses_attempt on public.speaking_responses(attempt_id);
create index if not exists idx_speaking_responses_user on public.speaking_responses(user_id, created_at desc);
create index if not exists idx_speaking_responses_status on public.speaking_responses(status);

-- =============================================================================
-- 6. RLS — enable + policies on EVERY new table
--    (private.is_admin(uuid) is the existing admin helper from migration 013.)
-- =============================================================================

-- 6.1 Content: learner-readable when published; admin-managed. ----------------
alter table public.ielts_tests enable row level security;
drop policy if exists "IELTS tests are viewable when published" on public.ielts_tests;
create policy "IELTS tests are viewable when published" on public.ielts_tests
  for select using (status = 'published' or private.is_admin((select auth.uid())));
drop policy if exists "Admins manage IELTS tests" on public.ielts_tests;
create policy "Admins manage IELTS tests" on public.ielts_tests
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.audio_assets enable row level security;
drop policy if exists "IELTS audio is viewable when its test is published" on public.audio_assets;
create policy "IELTS audio is viewable when its test is published" on public.audio_assets
  for select using (
    private.is_admin((select auth.uid()))
    or exists (select 1 from public.ielts_tests t where t.id = audio_assets.test_id and t.status = 'published')
  );
drop policy if exists "Admins manage IELTS audio" on public.audio_assets;
create policy "Admins manage IELTS audio" on public.audio_assets
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.passages enable row level security;
drop policy if exists "IELTS passages are viewable when published" on public.passages;
create policy "IELTS passages are viewable when published" on public.passages
  for select using (
    private.is_admin((select auth.uid()))
    or exists (select 1 from public.ielts_tests t where t.id = passages.test_id and t.status = 'published')
  );
drop policy if exists "Admins manage IELTS passages" on public.passages;
create policy "Admins manage IELTS passages" on public.passages
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.listening_sections enable row level security;
drop policy if exists "IELTS listening sections are viewable when published" on public.listening_sections;
create policy "IELTS listening sections are viewable when published" on public.listening_sections
  for select using (
    private.is_admin((select auth.uid()))
    or exists (select 1 from public.ielts_tests t where t.id = listening_sections.test_id and t.status = 'published')
  );
drop policy if exists "Admins manage IELTS listening sections" on public.listening_sections;
create policy "Admins manage IELTS listening sections" on public.listening_sections
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.ielts_questions enable row level security;
drop policy if exists "IELTS questions are viewable when published" on public.ielts_questions;
create policy "IELTS questions are viewable when published" on public.ielts_questions
  for select using (
    private.is_admin((select auth.uid()))
    or exists (select 1 from public.ielts_tests t where t.id = ielts_questions.test_id and t.status = 'published')
  );
drop policy if exists "Admins manage IELTS questions" on public.ielts_questions;
create policy "Admins manage IELTS questions" on public.ielts_questions
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

-- 6.2 Answer keys: NO learner policy. Admin-managed only; service_role bypasses
--      RLS for server-side grading. (anon revoked as defense-in-depth.)
alter table public.ielts_question_keys enable row level security;
revoke all on public.ielts_question_keys from anon;
drop policy if exists "Admins manage IELTS answer keys" on public.ielts_question_keys;
create policy "Admins manage IELTS answer keys" on public.ielts_question_keys
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

-- 6.3 Band conversions: reference data, readable by any authenticated user.
alter table public.band_conversions enable row level security;
drop policy if exists "Band conversions are viewable by authenticated users" on public.band_conversions;
create policy "Band conversions are viewable by authenticated users" on public.band_conversions
  for select using ((select auth.uid()) is not null);
drop policy if exists "Admins manage band conversions" on public.band_conversions;
create policy "Admins manage band conversions" on public.band_conversions
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

-- 6.4 Attempts / responses / scores: learner SELECT-own + admin manage.
--      Learner-facing writes are server-authoritative (service_role) — see header.
--      Org-scoped (teacher) policies are added in WS-5.2.
alter table public.ielts_attempts enable row level security;
drop policy if exists "Users view own IELTS attempts" on public.ielts_attempts;
create policy "Users view own IELTS attempts" on public.ielts_attempts
  for select using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));
drop policy if exists "Admins manage IELTS attempts" on public.ielts_attempts;
create policy "Admins manage IELTS attempts" on public.ielts_attempts
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.ielts_attempt_sections enable row level security;
drop policy if exists "Users view own IELTS attempt sections" on public.ielts_attempt_sections;
create policy "Users view own IELTS attempt sections" on public.ielts_attempt_sections
  for select using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));
drop policy if exists "Admins manage IELTS attempt sections" on public.ielts_attempt_sections;
create policy "Admins manage IELTS attempt sections" on public.ielts_attempt_sections
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.ielts_question_responses enable row level security;
drop policy if exists "Users view own IELTS question responses" on public.ielts_question_responses;
create policy "Users view own IELTS question responses" on public.ielts_question_responses
  for select using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));
drop policy if exists "Admins manage IELTS question responses" on public.ielts_question_responses;
create policy "Admins manage IELTS question responses" on public.ielts_question_responses
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.attempt_band_scores enable row level security;
drop policy if exists "Users view own IELTS band scores" on public.attempt_band_scores;
create policy "Users view own IELTS band scores" on public.attempt_band_scores
  for select using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));
drop policy if exists "Admins manage IELTS band scores" on public.attempt_band_scores;
create policy "Admins manage IELTS band scores" on public.attempt_band_scores
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.writing_responses enable row level security;
drop policy if exists "Users view own IELTS writing responses" on public.writing_responses;
create policy "Users view own IELTS writing responses" on public.writing_responses
  for select using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));
drop policy if exists "Admins manage IELTS writing responses" on public.writing_responses;
create policy "Admins manage IELTS writing responses" on public.writing_responses
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

alter table public.speaking_responses enable row level security;
drop policy if exists "Users view own IELTS speaking responses" on public.speaking_responses;
create policy "Users view own IELTS speaking responses" on public.speaking_responses
  for select using (user_id = (select auth.uid()) or private.is_admin((select auth.uid())));
drop policy if exists "Admins manage IELTS speaking responses" on public.speaking_responses;
create policy "Admins manage IELTS speaking responses" on public.speaking_responses
  for all using (private.is_admin((select auth.uid()))) with check (private.is_admin((select auth.uid())));

commit;
