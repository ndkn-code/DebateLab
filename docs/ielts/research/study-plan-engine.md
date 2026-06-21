# Track C - Personalized Study-Plan Engine

Date: 2026-06-20
Branch target: `ielts`
Scope: design research and build plan only. No production code in this track.

## Executive Recommendation

Build the study-plan engine natively in DebateLab/Thinkfy. Do not port Lumist's SAT study-plan schema or Prisma services. Use Lumist as a reference for weekly task cadence, onboarding preferences, weak-evidence ranking, duplicate avoidance, and race-condition handling. Build DebateLab-native plan tables, repositories, and pure scheduling algorithms that consume Track B's predicted band + weakness profile and emit Track D's registered Learn-mode activities plus periodic mini-mocks.

The plan's atoms should be:

1. Track D Learn-mode activities, registered through the existing activity engine.
2. Scheduled review items from an IELTS spaced-review queue.
3. Periodic mini-mocks and full mocks through `ielts_tests` / `ielts_attempts`.
4. Writing and Speaking micro-submissions that reuse the existing IELTS AI scoring queues.

The engine should store a plan and dated plan items, not compute the whole plan on every read. Store enough of the prediction snapshot and rationale to make every plan explainable. Recompute only future pending items when performance changes. The "Today" list is computed on read from stored plan items + due reviews + teacher assignments.

## Findings

### DebateLab / Thinkfy

The IELTS vertical is already a native DebateLab product, not a separate app:

- `docs/ielts-masterplan.md` locks the architecture decision: DebateLab is the trunk, the activity engine is the platform, IELTS stays behind `IELTS_ENABLED`, and IELTS-specific behavior must be registered activity types rather than core engine edits.
- `docs/ielts/data-access.md` defines the quality bar: generated Supabase types, typed clients, `lib/api` repositories, Zod at boundaries, RLS from day one, no inline Supabase reads in pages/components, and typed score columns.
- `ielts_questions` is the canonical IELTS item bank. Learn-mode drills and Assess-mode mocks must reference question IDs, not duplicate prompts or answer keys in activity JSON.
- The shipped IELTS schema includes `ielts_tests`, `ielts_questions`, `ielts_question_keys`, `ielts_attempts`, `ielts_attempt_sections`, `ielts_question_responses`, `attempt_band_scores`, `writing_responses`, `speaking_responses`, and `band_conversions`.
- `attempt_band_scores` has typed per-skill and overall bands. Writing and Speaking per-criterion scores live in typed columns on `writing_responses` and `speaking_responses`.
- `ielts_attempts.activity_attempt_id` already exists as the bridge back to the shared activity engine.
- `apps/web/src/components/ielts/question-renderer-registry.tsx` exposes `registerIeltsRenderer`, the right seam for Track D Learn-mode and task renderers.
- `apps/web/src/lib/activity/registry.ts` currently supports `lesson`, `flashcard`, `matching`, `fill_blank`, `drag_order`, and `quiz`. IELTS Learn mode should extend this by registration or by IELTS-specific activity types, not by hard-coding IELTS in the core player.
- `apps/web/src/lib/xp/*` and `apps/web/src/lib/streaks/*` already exist. The study plan must award XP and qualify streaks through these systems, not create IELTS XP or IELTS streak tables.
- `apps/web/src/lib/practice-analysis/*` plus `apps/web/src/lib/ielts/{writing,speaking}-scorer/*` and `apps/web/src/lib/scoring/ielts-*` are already the AI/scoring substrate.
- The duel MMR tables (`duel_mmr_profiles`, `duel_rating_events`) are a useful precedent for ability estimation and event logs, but not a direct model for IELTS study planning. Track B should own the prediction model; Track C should consume its snapshots and update plan state.

Live Supabase inspection on 2026-06-20:

- IELTS content and attempt tables are currently empty: `ielts_tests`, `ielts_questions`, `ielts_attempts`, `attempt_band_scores`, `writing_responses`, and `speaking_responses` all have 0 rows.
- `band_conversions` is seeded with 51 rows: 17 Listening, 17 Academic Reading, 17 General Training Reading, each covering raw 0-40 and bands 0-9.
- The shared activity substrate has real usage: 19 `activities`, 16 completed `activity_attempts`, and average activity attempt duration around 55 seconds.
- Existing activity types in live data are `lesson`, `quiz`, `matching`, `drag_order`, `fill_blank`, and `flashcard`.
- `activity_log` contains `debate_completed`, `lesson_completed`, and `course_started`; IELTS plan completion events need to add `ielts_activity_completed`, `ielts_review_completed`, and `ielts_mock_completed` or equivalent qualifying activity types.
- `practice_attempts` and `analysis_jobs` are modest but active, confirming the queue/result pattern is real: 22 completed practice attempts with scores and 22 completed analysis jobs.
- `xp_events` exists but has 0 rows in live data; legacy `activity_log` and `daily_stats` are still active. Implementation should use the current XP RPC (`award_xp_event`) and let existing compatibility paths handle legacy surfaces.

### Lumist

Lumist has useful product scar tissue, but its study plan is SAT-coupled:

- `study_plan_tasks` is a single task table with `student_profile_id`, bilingual JSON string title/description, `task_type`, `scheduled_date`, `completed_at`, `question_ids`, `assessment_id`, `module_id`, `resource_id`, premium flags, duration, and status.
- `WeeklyPlanServerService` generates tasks for the remaining days of the current week after onboarding and a completed mock-test gate.
- Lumist uses selected study days, tasks-per-day, daily study minutes, and priority modes (`weakest_first`, `balanced`, `test_practice`).
- It uses a placeholder task ID as a generation lock, then polls if another tab/process is generating.
- It ranks topics using deterministic planning evidence, avoids duplicate review topics / lesson practice sets within a week, falls back across task types and sections when content is unavailable, and supports rescheduling/canceling incomplete previous-week tasks.
- The task categories are SAT-shaped: `LESSON`, `REVIEW`, `MINI_TEST`, `HALF_TEST`, `FULL_TEST`, `ERROR_LOG`; category allocation is math/verbal.
- The review bank stores incorrect/manual questions and tracks `last_practiced_at`, `practice_count`, `correct_count`, and archive status. It supports filters like oldest, hardest, weakest, random, and custom tags, but it is not a real spaced-repetition scheduler.
- Lumist's planning evidence code already recognizes IELTS reports, but Listening and Speaking are marked unmapped because Lumist's SAT tutor lacks direct activities for them. DebateLab does have IELTS W/S/L/R surfaces, so the native design should map all four skills.
- Lumist's lesson chunk format is valuable for Track D. `features/lesson/test-ielts-reading-lesson.json` shows a strong IELTS Reading strategy lesson with progressive parts, annotated passages, inline questions, traps, and charts.

Port-vs-build implication: borrow the weekly cadence ideas, race-condition pattern, bilingual task copy discipline, evidence ranking shape, and lesson chunk format. Do not port `study_plan_tasks`, SAT math/verbal category logic, Prisma-generated IDs, random weighted task selection, or the review-bank scheduler.

### Field

Official IELTS constraints:

- IELTS Listening and Reading each contain 40 questions, with 1 mark per correct answer, then raw scores are converted to 9-band scores. IELTS notes exact raw thresholds can vary by test version.
- IELTS Writing uses four criteria: Task Achievement/Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. Task 2 carries more weight than Task 1.
- IELTS Speaking uses four equally weighted criteria: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation.
- The official IELTS Writing descriptors were updated/published publicly in 2023 as full assessment scales and key criteria.

Pedagogy:

- Mastery learning says learners need adequate time, quality instruction, clear task understanding, perseverance, and corrective instruction. This maps directly to diagnostic -> targeted task -> feedback -> re-diagnosis.
- Dunlosky et al. rate practice testing and distributed practice as high-utility learning techniques across learner ages, materials, and outcome measures.
- Deliberate practice is not just "more practice"; it is goal-directed practice with feedback and tasks just beyond current ability. IELTS plans should schedule focused weaknesses, not generic daily IELTS time.
- Spaced repetition should be used for retention atoms, not every IELTS task. It fits vocabulary, collocations, grammar patterns, phoneme contrasts, paraphrase pairs, error-log questions, and recurring traps.
- FSRS models difficulty, stability, and retrievability and can handle early/delayed review more gracefully than a simple SM-2 interval ladder. SM-2 remains useful as a simple fallback or migration baseline.

Product patterns:

- College Board recommends using prior practice-test or assessment results to create a study plan, targeting challenge areas, reviewing question-bank skills, taking another practice test after improvement work, and spacing practice tests when possible.
- MasteryPrep distinguishes adaptive plans from manual plans and exposes target hours, diagnostics, lessons, practice tests, completion, and accuracy to teachers.
- Duolingo's learning path intersperses new lessons with review using spaced repetition. Its XP and leaderboards are tuned to reward learning behavior, not just grinding.
- Duolingo streaks are explicitly habit-forming and work because they create consistent daily practice while allowing flexibility through streak freezes.
- Brilliant's current positioning is "learn by doing": visual, interactive sessions, step-by-step problem solving, adaptive practice around gaps, and streaks/levels/daily goals as adherence supports.

## Recommended Design

### Core Product Loop

The study-plan engine should run this loop:

1. Diagnose: consume Track B's prediction snapshot and weakness profile, plus recent IELTS attempts and activity history.
2. Plan: create a rolling plan from the target band, test date, learner schedule, content inventory, and due reviews.
3. Execute: surface a small "Today" list that launches Track D Learn-mode activities or IELTS mocks.
4. Score: collect objective results, W/S AI scores, phoneme data, activity attempts, and XP/streak events.
5. Adapt: update skill state, review schedules, and future pending plan items when evidence changes.
6. Re-diagnose: schedule mini-mocks and full mocks to refresh Track B's prediction and calibrate the plan.

### Track B Seam

Track B should expose a stable, versioned interface. Track C should not infer a weakness profile by scraping result UI models.

Recommended TypeScript shape:

```ts
export interface IeltsPredictionSnapshot {
  snapshotId: string;
  userId: string;
  generatedAt: string;
  sourceAttemptIds: string[];
  modelVersion: string;
  module: "academic" | "general_training";
  predictedOverallBand: number | null;
  predictedSkillBands: {
    listening: number | null;
    reading: number | null;
    writing: number | null;
    speaking: number | null;
  };
  confidence: number;
  uncertaintyBandHalfSteps: number;
  weaknesses: IeltsWeaknessSignal[];
  strengths: IeltsWeaknessSignal[];
  reasoning: {
    en: string;
    vi: string;
  };
}

export interface IeltsWeaknessSignal {
  signalId: string;
  skill: "listening" | "reading" | "writing" | "speaking";
  focusArea: string;
  questionType?: string;
  criterion?: string;
  phoneme?: string;
  currentBandEstimate?: number | null;
  targetBand?: number | null;
  gapHalfBands: number;
  confidence: number;
  evidenceCount: number;
  recencyDays: number;
  examples: Array<{
    sourceType: "ielts_attempt" | "writing_response" | "speaking_response" | "activity_attempt";
    sourceId: string;
    label: string;
  }>;
  recommendedActivityTags: string[];
  rationale: {
    en: string;
    vi: string;
  };
}
```

Track C stores the snapshot ID and a compact typed score snapshot on `ielts_study_plans`, plus JSONB rationale for explainability. Track B remains the owner of prediction math.

### Track D Seam

Track D should register Learn-mode activities that can be launched from a plan item. The plan engine should not render IELTS question types directly.

Recommended activity atom contract:

```ts
export interface IeltsLearnAtom {
  activityType:
    | "ielts_strategy_lesson"
    | "ielts_question_drill"
    | "ielts_error_review"
    | "ielts_vocab_review"
    | "ielts_writing_microtask"
    | "ielts_speaking_microtask"
    | "ielts_pronunciation_drill";
  skill: "listening" | "reading" | "writing" | "speaking";
  focusArea: string;
  estimatedMinutes: number;
  questionIds: string[];
  reviewItemIds?: string[];
  rendererTags: string[];
  scoringMode: "objective" | "ai_writing" | "ai_speaking" | "self_check";
}
```

The persisted `activities.content` should contain only references and presentation metadata. Prompt, options, visual, answer key, and model answers stay in `ielts_questions` / `ielts_question_keys`.

### Data Model

Use stored plans + stored plan items + stored review scheduler state. Compute today's display by overlaying these rows with due reviews, teacher assignments, and current time.

#### New enums

```sql
create type public.ielts_study_plan_status as enum (
  'active', 'paused', 'completed', 'archived'
);

create type public.ielts_plan_item_kind as enum (
  'learn_activity', 'review', 'mini_mock', 'full_mock', 'writing_submission', 'speaking_submission', 'teacher_assignment'
);

create type public.ielts_plan_item_status as enum (
  'scheduled', 'available', 'started', 'completed', 'missed', 'skipped', 'cancelled'
);

create type public.ielts_review_algorithm as enum (
  'fsrs_v1', 'sm2_v1'
);

create type public.ielts_review_rating as enum (
  'again', 'hard', 'good', 'easy'
);
```

#### `ielts_study_plans`

One active plan per learner/module. Keeps target, date, preferences, prediction snapshot, and explainability.

Key columns:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `module ielts_module not null`
- `status ielts_study_plan_status not null default 'active'`
- `target_test_date date not null`
- `target_overall_band numeric(2,1) not null`
- `target_listening_band numeric(2,1)`, `target_reading_band`, `target_writing_band`, `target_speaking_band`
- `baseline_prediction_snapshot_id uuid` or text if Track B uses non-table snapshots
- `latest_prediction_snapshot_id uuid`
- `predicted_overall_band numeric(2,1)`, typed skill predicted bands
- `prediction_confidence numeric(4,3)`
- `daily_minutes integer not null`
- `study_days smallint[] not null` using ISO weekdays 1-7
- `timezone text not null default 'Asia/Ho_Chi_Minh'`
- `feedback_language text not null check (feedback_language in ('en','vi'))`
- `plan_horizon_days integer not null default 14`
- `plan_version integer not null default 1`
- `generated_at timestamptz not null default now()`
- `last_replanned_at timestamptz`
- `next_reassessment_at timestamptz`
- `explanation jsonb not null default '{}'::jsonb`
- `created_at`, `updated_at`

RLS: SELECT-own. Mutations through server actions/service role. Teacher visibility can be added later by joining class assignments if B2B wants class study plans.

#### `ielts_study_plan_items`

Dated commitments. Completed rows are immutable except for metadata enrichment.

Key columns:

- `id uuid primary key`
- `plan_id uuid not null references ielts_study_plans(id) on delete cascade`
- `user_id uuid not null references profiles(id)`
- `kind ielts_plan_item_kind not null`
- `status ielts_plan_item_status not null default 'scheduled'`
- `scheduled_date date not null`
- `available_at timestamptz`
- `due_at timestamptz`
- `started_at`, `completed_at`, `cancelled_at`
- `skill ielts_skill`
- `focus_area text not null`
- `question_type ielts_question_type`
- `criterion text`
- `activity_id uuid references activities(id)` for Learn-mode atoms
- `ielts_test_id uuid references ielts_tests(id)` for mini/full mocks
- `ielts_question_id uuid references ielts_questions(id)` for single-prompt W/S microtasks
- `review_item_id uuid references ielts_review_items(id)`
- `assignment_id uuid references club_assignments(id)`
- `activity_attempt_id uuid references activity_attempts(id)`
- `ielts_attempt_id uuid references ielts_attempts(id)`
- `writing_response_id uuid references writing_responses(id)`
- `speaking_response_id uuid references speaking_responses(id)`
- `estimated_minutes integer not null`
- `priority_score numeric(8,4) not null default 0`
- `source_prediction_snapshot_id uuid/text`
- `source_weakness_signal_ids text[] not null default '{}'`
- `rationale_en text not null`
- `rationale_vi text not null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at`, `updated_at`

Add CHECK constraints so each item kind has the right reference:

- `learn_activity` requires `activity_id`.
- `mini_mock` / `full_mock` require `ielts_test_id`.
- `review` requires `review_item_id` or `activity_id`.
- `writing_submission` / `speaking_submission` require `ielts_question_id` or `activity_id`.

RLS: SELECT-own. Server-authoritative writes. Index `(user_id, scheduled_date, status)`.

#### `ielts_learner_focus_states`

Plan-local ability/mastery state per skill/focus area. This is not Track B's full model; it is the scheduling cache that lets Track C rank and explain work.

Key columns:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `module ielts_module not null`
- `skill ielts_skill not null`
- `focus_area text not null`
- `question_type ielts_question_type`
- `criterion text`
- `phoneme text`
- `mastery_score numeric(5,2) not null default 50 check between 0 and 100`
- `band_estimate numeric(2,1)`
- `target_band numeric(2,1)`
- `gap_half_bands numeric(4,1) not null default 0`
- `confidence numeric(4,3) not null default 0`
- `evidence_count integer not null default 0`
- `last_evidence_at timestamptz`
- `last_practiced_at timestamptz`
- `next_due_at timestamptz`
- `source_prediction_snapshot_id uuid/text`
- `explanation jsonb not null default '{}'::jsonb`
- unique `(user_id, module, skill, focus_area, coalesce(question_type), coalesce(criterion), coalesce(phoneme))`

These rows are updated after Track B snapshots, activity attempts, objective grading, W/S scoring, and review events.

#### `ielts_review_items`

Spaced-review queue. This is the native replacement for Lumist's review bank.

Review items can point at an `ielts_question`, an activity, a W/S response, or a small synthetic retention atom. Use JSONB only for deeply nested atom payload, not for scheduler scores.

Key columns:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `status text not null default 'active' check in ('active','suspended','archived')`
- `algorithm ielts_review_algorithm not null default 'fsrs_v1'`
- `skill ielts_skill not null`
- `focus_area text not null`
- `review_kind text not null` values such as `vocab`, `grammar`, `collocation`, `phoneme`, `trap`, `question_retry`, `strategy`
- `question_id uuid references ielts_questions(id)`
- `activity_id uuid references activities(id)`
- `source_response_id uuid`
- `source_response_type text`
- `prompt_en text`, `prompt_vi text`
- `answer_en text`, `answer_vi text`
- `difficulty numeric(6,3) not null default 5`
- `stability numeric(8,3) not null default 0`
- `retrievability numeric(6,3) not null default 1`
- `ease_factor numeric(6,3)` for SM-2 fallback
- `interval_days integer not null default 0`
- `repetitions integer not null default 0`
- `lapses integer not null default 0`
- `last_reviewed_at timestamptz`
- `due_at timestamptz not null default now()`
- `suspended_until timestamptz`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at`, `updated_at`

#### `ielts_review_events`

Append-only review history.

Key columns:

- `id uuid primary key`
- `review_item_id uuid not null references ielts_review_items(id) on delete cascade`
- `user_id uuid not null references profiles(id)`
- `plan_item_id uuid references ielts_study_plan_items(id)`
- `activity_attempt_id uuid references activity_attempts(id)`
- `rating ielts_review_rating not null`
- `is_correct boolean`
- `response_ms integer`
- `previous_due_at timestamptz`
- `next_due_at timestamptz`
- `previous_interval_days integer`
- `next_interval_days integer`
- `previous_difficulty`, `next_difficulty`, `previous_stability`, `next_stability`, `previous_retrievability`, `next_retrievability`
- `created_at timestamptz not null default now()`

#### `ielts_study_plan_revisions`

Append-only explanation log for trust and debugging.

Key columns:

- `id uuid primary key`
- `plan_id uuid not null references ielts_study_plans(id) on delete cascade`
- `user_id uuid not null references profiles(id)`
- `from_version integer`
- `to_version integer not null`
- `trigger_type text not null`
- `trigger_source_type text`
- `trigger_source_id uuid/text`
- `summary_en text not null`
- `summary_vi text not null`
- `changed_item_count integer not null default 0`
- `before_snapshot jsonb not null default '{}'::jsonb`
- `after_snapshot jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

### Stored vs Computed

Store:

- Active plan settings and target.
- Future plan items for a rolling 14-day horizon.
- Review item scheduler state and review events.
- Focus-area mastery cache.
- Plan revision explanations.

Compute on read:

- The "Today" list from `ielts_study_plan_items` due/available today + overdue review items + teacher assignments.
- Weekly progress summaries from completed plan items, `activity_attempts`, `ielts_attempts`, `writing_responses`, `speaking_responses`, XP, and streak data.
- The visual calendar grouping.

Do not pre-generate a full 6-month day-by-day plan. Generate a 14-day detailed plan plus a weekly forecast. Long plans decay quickly as Track B predictions and learner adherence change.

### Generation Algorithm

Inputs:

- `target_overall_band`, optional per-skill targets, `target_test_date`, module, timezone.
- Learner schedule: study days, daily minutes, preferred intensity.
- Track B prediction snapshot and weakness signals.
- Content inventory: published `ielts_tests`, `ielts_questions`, Track D Learn atoms/activities, available mini-mocks, review items.
- Learner history: `activity_attempts`, `ielts_attempts`, `attempt_band_scores`, `ielts_question_responses`, W/S responses, review events, missed plan items.
- B2B assignments when present.

Step 1: Determine study mode by time left.

- `cram`: 0-13 days. Prioritize mini-mocks, high-yield weak spots, timing, review, and confidence. Avoid big new-topic chains.
- `sprint`: 14-42 days. Weekly mini-mock, one full mock every 1-2 weeks, heavy weakness targeting.
- `standard`: 43-120 days. Foundation + deliberate practice + weekly reassessment.
- `long_horizon`: 120+ days. Lower mock density, stronger SRS and skill-tree progression.

Step 2: Budget minutes.

Start with `weekly_minutes = daily_minutes * study_days.length`.

Recommended default allocation:

- 55-65 percent deliberate practice on top weaknesses.
- 15-25 percent spaced review and error-log review.
- 10-20 percent assessment via mini-mocks/full mocks.
- 5-10 percent strategy lessons or warmups.

Adjust by mode:

- Cram: raise assessment/review, lower new lessons.
- Sprint: raise weak-skill output tasks.
- Long horizon: raise lessons and review.

Step 3: Score weakness priorities.

For each Track B weakness signal:

```text
priority =
  gap_half_bands
  * skill_exam_weight
  * criterion_weight
  * confidence
  * recency_weight
  * content_availability_weight
  * volatility_weight
  * urgency_weight
```

Recommended weights:

- `skill_exam_weight`: 1.0 for each IELTS skill because overall band averages four skills. Increase to 1.15 for the lowest skill if it is more than 1.0 band below target, because learners perceive uneven skills as risk.
- `criterion_weight`: Writing Task 2 = 1.25, Writing Task 1 = 0.85, Speaking Pronunciation = 1.15 when phoneme evidence is strong, objective R/L question types = raw-error share.
- `recency_weight`: 1.0 for evidence in last 14 days, decays to 0.65 by 60 days.
- `content_availability_weight`: 1.0 direct Track D activity exists, 0.7 related activity exists, 0.35 no good activity yet.
- `volatility_weight`: 1.15 for low-confidence estimates needing diagnostic work.
- `urgency_weight`: ramps up as target date approaches.

Step 4: Select atoms.

Map each priority to atom families:

- Listening: signposting, distractors, map/plan labels, note/table completion, accent exposure, section difficulty, paraphrase recognition.
- Reading: TFNG/YNNG, matching headings, matching information, summary completion, sentence completion, skimming/scanning, passage genre.
- Writing: Task 1 overview/data selection, Task 2 position/development, coherence, lexical range/collocation, grammar accuracy, timing.
- Speaking: Part 1 fluency, Part 2 structure/timing, Part 3 development, lexical range, grammar flexibility, pronunciation/phoneme drills.
- Retention: vocabulary, collocations, grammar patterns, recurring traps, phoneme minimal pairs, missed objective items.

Prefer a mix:

- New concept -> strategy lesson.
- Weak question type -> question drill.
- Prior miss -> error review or review item.
- W/S criterion gap -> micro-submission.
- Low prediction confidence -> mini-mock.

Step 5: Schedule the next 14 days.

Rules:

- Each study day should have 2-5 items, not one giant task.
- Default daily shape for 30 minutes:
  1. 5 minutes due reviews.
  2. 12-15 minutes highest-priority drill or lesson.
  3. 10-12 minutes output/task practice or question drill.
  4. Optional 3-minute reflection if a W/S or mock result arrived.
- For 15 minutes: one due-review block plus one focused activity.
- For 60 minutes: due reviews, two focus activities, one W/S output or mini-section.
- For 120 minutes: include a longer timed section or full mock segment, with a break.
- Never schedule full Writing and full Speaking AI submissions on the same light day.
- Do not schedule a full mock the day after a full mock unless the user explicitly selects cram mode.
- Put mini-mocks after 2-4 targeted practice sessions on the same skill.
- Interleave skill types to reduce fatigue, but keep clusters tight enough for mastery.
- Preserve teacher assignments as fixed items and plan around them.

Step 6: Explain.

Every plan and item needs rationale:

- "Why this skill?"
- "What evidence triggered it?"
- "What score/band gap it targets?"
- "Why today?"
- "What changes if the learner completes/skips it?"

This is non-negotiable because the product constraint says explainable over black box.

### Spaced Review Scheduler

Recommendation: build FSRS-ready scheduler state from day one and use a conservative FSRS implementation if package/license review passes. Keep an SM-2 fallback behind the same table shape.

Why:

- FSRS's difficulty/stability/retrievability model maps better to irregular real learners and supports early/delayed reviews.
- IELTS review items are heterogeneous: vocabulary, phonemes, grammar, question traps. A richer model will pay off.
- SM-2 is simpler and acceptable as a fallback but is less expressive for delayed reviews and workload tuning.

Launch behavior:

- Use four ratings: Again, Hard, Good, Easy.
- Create review items automatically from:
  - incorrect R/L answers,
  - W/S recurring criterion issues,
  - phoneme errors above threshold,
  - vocabulary/collocations from feedback,
  - manually saved questions or teacher-assigned review.
- Cap due-review minutes to 20-25 percent of daily plan volume.
- If due reviews exceed the cap, sort by retrievability risk, target-band relevance, and lateness.
- Archive review items after repeated Easy/Good outcomes and no recurrence for 60-90 days.

Outcome mapping:

- Objective wrong -> Again.
- Objective correct but slow, guessed, or repeated trap -> Hard.
- Objective correct within expected time -> Good.
- Correct across multiple attempts with high confidence -> Easy.
- Writing/Speaking issue repeated in a new submission -> Again/Hard for that review atom.
- Pronunciation phoneme improved above threshold twice -> Good/Easy.

### Adaptation Triggers

Replan future pending items only. Never rewrite completed history.

Immediate triggers:

- Track B publishes a new prediction snapshot.
- Any `attempt_band_scores` row changes and the resulting skill band differs by at least 0.5.
- W/S scorer finishes and any criterion differs from the prior estimate by at least 0.5.
- A mini-mock reveals a new top-three weakness.
- A learner completes a plan item with high mastery: accuracy >= 85 percent or W/S criterion meets target.
- A learner misses 2 planned study days in 7 days or misses 3 items in a row.
- A teacher assignment appears or changes.
- Target band, test date, schedule, or module changes.
- Content inventory changes: new Track D activity, new published test, retired item.

Scheduled triggers:

- Nightly lightweight refresh of "today/tomorrow" availability and overdue handling.
- Weekly plan refresh, preserving completed items and teacher assignments.
- Periodic re-diagnostic:
  - Standard/long horizon: mini-mock weekly, full mock every 3-4 weeks.
  - Sprint: mini-mock weekly and full mock every 1-2 weeks.
  - Cram: focused mini-mocks every 2-3 days, full mock only if time permits recovery/review.

Replan policy:

- Preserve today's started items.
- Preserve fixed teacher assignments.
- Preserve completed and skipped rows.
- Cancel or reschedule future unstarted items with revision entries.
- Lower daily load after adherence misses; raise only after 7-day adherence >= 80 percent.
- When content is unavailable for a weakness, schedule the closest adjacent atom and record a content gap in plan rationale for authoring.

### UI Surface

#### IELTS Home

Extend the current IELTS learner home (`IeltsHome`) with a plan summary band:

- Current predicted band vs target band.
- Test date countdown.
- Today's completion status.
- Next reassessment.
- CTA: "Start today's plan" / "Create plan" / "Update plan".

Keep the current recent attempts and featured tests.

#### Today Task List

Primary daily surface. It should be available at `/ielts/today` or embedded as the first section of `/ielts`.

Each task card:

- skill icon and item kind,
- estimated minutes,
- status,
- short rationale in learner language,
- source evidence label, for example "from Reading mini-mock, matching headings",
- CTA that launches the activity/mock/W/S task,
- completion feedback and XP awarded.

The list should be small. For most users, show 2-4 tasks. Put extra due reviews behind "More review due" rather than making the day feel impossible.

#### Study Plan Page

Route: `/ielts/study-plan`.

Sections:

- Target setup: target band, test date, module, study days, daily minutes, feedback language.
- Plan reasoning: latest Track B prediction, gap summary, top weaknesses, why this plan.
- Calendar/timeline: 14-day detailed plan, weekly forecast beyond that.
- Reassessment schedule: mini-mocks/full mocks and why they are placed.
- Review queue: due today, upcoming, high-risk retention items.
- Controls: pause, regenerate future plan, reduce/increase load, change test date, change target.
- Revision log: "Plan changed because..."

Do not expose a mysterious black-box "AI plan". Use concrete evidence and editable commitments.

#### Results Integration

After a mock or W/S score:

- Show "What changed in your plan" with before/after top weaknesses.
- Offer a one-click update if auto-replan is disabled; otherwise show the revision log.
- Create review items directly from missed questions/feedback.

#### Teacher/B2B Fast-Follow

For class assignments:

- Teacher can see completion and plan adherence per learner.
- Teacher assignments are fixed items in the learner plan.
- Teacher can override target date/band for a class cohort later, but v1 should keep plans learner-owned.

### Reuse Map

| Need | Reuse / Extend |
| --- | --- |
| Learner IELTS shell | `apps/web/src/components/ielts/learner/IeltsHome.tsx`, `apps/web/src/lib/api/ielts/learner-repository.ts` |
| Plan reads/writes | Add `apps/web/src/lib/api/ielts/study-plan-*` repositories; use `createTypedServerClient` / `createTypedAdminClient` |
| Learn activity execution | `apps/web/src/lib/activity/registry.ts`, `apps/web/src/components/activities/*`, new Track D registered IELTS activity types |
| IELTS question rendering | `apps/web/src/components/ielts/question-renderer-registry.tsx`, `registerIeltsRenderer`, `QuestionHost` |
| Item bank | `ielts_questions`, `ielts_question_keys`, `passages`, `listening_sections`, `audio_assets` |
| Mocks and reassessment | `ielts_tests`, `ielts_attempts`, `ielts_attempt_sections`, `ielts_question_responses`, `MockTestPlayer` |
| Objective scoring | `apps/web/src/lib/scoring/ielts/*`, `apps/web/src/lib/api/ielts/grade-attempt.ts`, `band_conversions` |
| Writing/Speaking scoring | `writing_responses`, `speaking_responses`, `apps/web/src/lib/ielts/writing-scorer/*`, `apps/web/src/lib/ielts/speaking-scorer/*`, queue routes |
| Pronunciation | `apps/web/src/lib/ielts/pronunciation/*`, `apps/web/src/lib/scoring/ielts-pronunciation/*` |
| Ability precedent | `duel_mmr_profiles`, `duel_rating_events` as event-sourced ability inspiration only |
| XP | `apps/web/src/lib/xp/model.ts`, `apps/web/src/lib/xp/server.ts`, `award_xp_event` RPC |
| Streaks | `apps/web/src/lib/streaks/model.ts`; add IELTS qualifying events rather than separate streaks |
| B2B assignments | `club_assignments.ielts_test_id`, `ielts_attempts.assignment_id`, assignment manager/results views |
| Feature flag | Existing `IELTS_ENABLED` gate |
| Data quality | `docs/ielts/data-access.md`, generated Supabase `Database` types, Zod schemas, RLS checks |

## Port-vs-Build Call

### Build Native in DebateLab

Build these natively:

- `ielts_study_plans`, `ielts_study_plan_items`, review scheduler tables, focus-state cache, revision log.
- Plan generation pure module under `apps/web/src/lib/ielts/study-plan/*`.
- Typed repositories and actions under `apps/web/src/lib/api/ielts/*` and `apps/web/src/app/actions/ielts/*`.
- Study-plan UI in the existing IELTS learner shell.
- XP/streak integration through existing DebateLab systems.
- Track B and Track D typed seams.

Why:

- DebateLab's IELTS data model is already typed and RLS-covered.
- The activity engine and IELTS renderer registry are the right substrate.
- Lumist is SAT/math-verbal/Prisma coupled.
- A native plan model can explain IELTS bands, criteria, question types, phonemes, and Track D atoms without translation hacks.

### Borrow from Lumist

Borrow these behaviors:

- Selected study days, tasks-per-day/daily-minutes preferences.
- Current-week/rolling-horizon planning, not a static months-long schedule.
- Placeholder/advisory-lock equivalent to prevent duplicate plan generation.
- Topic/weakness ranking from external evidence.
- Duplicate avoidance within a week.
- Fallback across activity types when the ideal content is unavailable.
- Previous-week carry-over and rescheduling rules.
- Bilingual task title/rationale discipline.
- Lesson chunk authoring format and progressive IELTS Reading lesson patterns.

### Do Not Port

Do not port:

- `study_plan_tasks` as-is.
- Prisma models or prefixed sequential IDs.
- SAT `math`/`verbal` planning categories.
- Random weighted task generation as the primary algorithm.
- Review bank filters as the scheduler.
- Premium task-lock logic into planning v1; entitlements should gate execution where the product/payment layer already expects it.

## Phased Build Plan

Each card should be one PR and obey `docs/ielts/data-access.md`.

### WS-C.1 - Track B contract and fixtures

Define `IeltsPredictionSnapshot` and `IeltsWeaknessSignal` contracts in a shared IELTS module. Add Zod schemas, fixtures, and tests. Provide a temporary fixture repository so Track C can build before Track B persists real snapshots.

Done:

- Pure TypeScript types and Zod schemas exist.
- Fixture snapshots cover all four skills, W/S criteria, phoneme weakness, low-confidence diagnostic case, and empty-history case.
- No UI depends on Track B internals.

### WS-C.2 - Study-plan schema + RLS

Add migrations for `ielts_study_plans`, `ielts_study_plan_items`, `ielts_learner_focus_states`, `ielts_review_items`, `ielts_review_events`, and `ielts_study_plan_revisions`.

Done:

- RLS enabled with SELECT-own and admin/manage policies.
- Score/band fields are typed numeric columns.
- CHECK constraints enforce item-kind references.
- Generated Supabase types updated.
- RLS and score-column CI checks pass.

### WS-C.3 - Content inventory and atom map

Build a typed content inventory repository that lists eligible Track D Learn activities, published IELTS tests, question counts by skill/question type, and content gaps.

Done:

- `getIeltsPlanInventory()` returns direct/related/unavailable mappings for weakness signals.
- Inventory never exposes `ielts_question_keys`.
- Tests cover empty IELTS content, partial content, and full content.

### WS-C.4 - Pure plan generation engine

Implement `generateIeltsStudyPlan()` as a pure function using target/date/preferences/prediction/inventory/history.

Done:

- Produces a 14-day detailed schedule and weekly forecast.
- Handles cram/sprint/standard/long-horizon modes.
- Respects daily minutes and selected study days.
- Produces item rationales in EN+VI.
- Unit tests cover skill prioritization, schedule caps, mini-mock placement, unavailable content fallback, and teacher fixed items.

### WS-C.5 - FSRS-ready review scheduler

Implement review item creation and scheduling with FSRS-ready columns and SM-2 fallback.

Done:

- Review items can be created from wrong R/L answers, W/S feedback, phoneme reports, and manual saves.
- Four-button rating updates due date and scheduler state.
- Daily due queue respects review-minute cap.
- Tests cover Again/Hard/Good/Easy, overdue items, archive criteria, and fallback algorithm.

### WS-C.6 - Plan repositories and server actions

Add typed repositories and actions for create/update/replan/today/complete-item.

Done:

- Zod boundary validation for all mutations.
- One canonical create path per plan.
- Plan generation uses a DB-safe lock or transaction pattern; duplicate tabs cannot generate duplicate plans.
- Actions preserve completed items and create revision logs.

### WS-C.7 - Study Plan page

Build `/ielts/study-plan` with target setup, reasoning, 14-day calendar, review queue, reassessment schedule, and revision log.

Done:

- Uses existing design system and IELTS shell.
- Bilingual EN+VI copy.
- Empty state supports no Track B snapshot yet by prompting diagnostic.
- All reads go through repositories.

### WS-C.8 - Today list in IELTS home

Add the learner's "Today" task list to the IELTS home and/or `/ielts/today`.

Done:

- Shows 2-5 prioritized tasks.
- Launches Track D activity, mini-mock, W/S submission, or review.
- Shows rationale and estimated minutes.
- Handles overdue, missed, and completed states.

### WS-C.9 - Adaptation hooks after attempts and AI scores

Wire plan adaptation to objective grading, W/S scorer completion, pronunciation results, and Track B snapshot updates.

Done:

- New result can update focus state, create review items, and replan future pending items.
- Revision log explains changes.
- Completed/started/current-day items are preserved.
- Tests cover 0.5-band deltas, top-weakness changes, missed-task load reduction, and target-date changes.

### WS-C.10 - XP and streak integration

Award XP for plan item completion and add IELTS activity types to streak qualification.

Done:

- Uses `awardXpEvent` with idempotency keys.
- No new IELTS XP/streak tables.
- Streak state recognizes IELTS plan activity, review, and mock completions.
- XP rewards are proportional to effort and learning value, not grindable review spam.

### WS-C.11 - Explainability and analytics

Add plan/item reasoning utilities, analytics events, and debug views for admins.

Done:

- Every plan item has rationale.
- Plan revision rows show trigger and changed items.
- Analytics track plan_created, item_started, item_completed, item_missed, replan_triggered, review_due_completed, mini_mock_completed.
- Admin debug view can inspect why a plan chose an item without exposing answer keys.

### WS-C.12 - B2B class-plan surface

Extend class IELTS dashboards to show plan adherence and upcoming assigned mocks.

Done:

- Teachers can view assigned mock completion and learner plan adherence for their classes.
- RLS is org-scoped and tested.
- Teachers cannot see private self-study details unless policy/product explicitly allows it.

## Risks and Open Questions

Risks:

- Content sparsity: live IELTS content is currently empty. The planner must degrade gracefully to diagnostics, strategy lessons, and content-gap reporting until Track D and content authoring catch up.
- Track B dependency: without a stable prediction/weakness contract, Track C will either overfit to result tables or duplicate prediction logic. WS-C.1 should happen first.
- Overplanning: a long daily schedule can reduce trust. Keep a 14-day detailed horizon and explain changes.
- Review overload: SRS can bury learners. Cap review minutes and prioritize by band relevance.
- XP gaming: review loops can be grindable. Use daily/weekly XP caps and source idempotency.
- W/S scoring latency: AI-scored items may finish after the plan was generated. Replan asynchronously and show a revision note.
- Timezone consistency: DebateLab is VN-first but users may travel. Store learner timezone on the plan and normalize scheduled dates carefully.
- RLS complexity for B2B: learner-owned self-study and class-visible assigned work need separate policies.
- Algorithm trust: if plan changes feel arbitrary, learners will ignore it. Revision logs and item rationales are product-critical, not nice-to-have.

Open questions:

- What exact Track B table or snapshot ID will exist? If Track B stays computed-only, Track C should persist its own immutable prediction snapshot copy.
- What is Track D's final activity type taxonomy? The plan engine can work with tags, but stronger typed activity categories will make explanations better.
- Should teacher-assigned tasks override learner self-study order or appear as fixed blocks around which the plan schedules?
- What entitlement limits apply to AI-scored W/S tasks and premium plans? Planning should avoid scheduling tasks the learner cannot run, or clearly mark them locked.
- How aggressive should full mocks be for users under 14 days from the test? Product should choose between confidence-building and diagnostic accuracy.
- Do we need a separate vocabulary/collocation item bank, or should early vocabulary review items be generated only from learner errors and W/S feedback?
- Is FSRS package/license acceptable for production? If not, start with SM-2-compatible scheduling but keep the FSRS-ready schema.

## Source Notes

Local DebateLab:

- `docs/ielts-masterplan.md`
- `docs/ielts/data-access.md`
- `supabase/migrations/20260618205215_ielts_data_model.sql`
- `supabase/migrations/20260620120000_ielts_authoring.sql`
- `supabase/migrations/20260620120000_ielts_mock_engine.sql`
- `supabase/migrations/20260620130000_ielts_b2b_class_assignments.sql`
- `apps/web/src/lib/activity/registry.ts`
- `apps/web/src/components/ielts/question-renderer-registry.tsx`
- `apps/web/src/lib/api/ielts/learner-repository.ts`
- `apps/web/src/lib/xp/*`
- `apps/web/src/lib/streaks/*`
- `apps/web/src/lib/practice-analysis/*`
- `apps/web/src/lib/ielts/{writing,speaking}-scorer/*`

Live Supabase:

- Inspected `public` table counts, selected column shapes, IELTS row counts, `band_conversions` coverage, activity type distribution, activity attempts, practice attempts, analysis jobs, activity log, and MMR profile summary via Supabase MCP on 2026-06-20.

Local Lumist:

- `/Users/jacknguyen/Developer/app-lumist-ai/database/tables.sql`
- `features/ai-tutor/services/server/weekly-plan-server.service.ts`
- `features/ai-tutor/services/server/planning-evidence.service.ts`
- `features/calendar/services/server/study-plan-tasks.service.ts`
- `features/review/services/server/*`
- `features/lesson/types.ts`
- `features/lesson/test-ielts-reading-lesson.json`
- `tests/unit/weekly-plan-server.service.test.ts`
- `tests/unit/ai-tutor-planning-evidence.test.ts`

External:

- [IELTS scoring in detail](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail)
- [IELTS Writing band descriptors and key assessment criteria](https://ielts.org/news-and-insights/ielts-writing-band-descriptors-and-key-assessment-criteria)
- [College Board: Build Your Study Plan](https://satsuite.collegeboard.org/practice/build-your-study-plan)
- [MasteryPrep: Study Plan Management](https://masteryprep.zendesk.com/hc/en-us/articles/39850628230555-Study-Plan-Management)
- [Bloom via ERIC: Learning for Mastery](https://eric.ed.gov/?id=ED053419)
- [Dunlosky et al. 2013: Effective learning techniques](https://journals.sagepub.com/doi/abs/10.1177/1529100612453266)
- [Open Spaced Repetition: FSRS](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler)
- [SuperMemo Algorithm](https://help.supermemo.org/wiki/SuperMemo_Algorithm)
- [Duolingo: new learning path and spaced repetition](https://blog.duolingo.com/new-duolingo-home-screen-design/)
- [Duolingo: Time Spent Learning Well](https://blog.duolingo.com/time-spent-learning-well/)
- [Duolingo: habit research behind streaks](https://blog.duolingo.com/how-duolingo-streak-builds-habit/)
- [Brilliant: Learn by doing](https://brilliant.org/)
