# Track A: Lumist Adaptive Teardown

Owner: IELTS research track
Date: 2026-06-20
Target branch: `ielts`
Source repos: DebateLab `/Users/jacknguyen/Developer/DebateLab`, Lumist `/Users/jacknguyen/Developer/app-lumist-ai`

## Executive Recommendation

Do not port Lumist's adaptive system as code. Port four product ideas and rebuild the implementation natively on DebateLab:

1. Keep an explainable evidence ledger behind every plan decision.
2. Generate a weekly plan from target, cadence, diagnostic evidence, review debt, and content availability.
3. Treat skipped and incorrect questions as learning evidence, not just submitted wrong answers.
4. Show the learner why the plan changed after each meaningful attempt.

Lumist's system is useful as a reference, but it is deeply SAT-shaped: Math/Verbal sections, 400-1600 score constants, full/half SAT assessments, easy/medium/intense difficulty buckets, Prisma models, generated prefixed IDs, and premium locked task slots. DebateLab should build an IELTS-native adaptive layer on the existing activity engine, IELTS item bank, scorer pipeline, XP/streaks, and RLS-backed typed data layer.

The first build should be a transparent rules-plus-evidence system, not a black-box model. We do not yet have enough IELTS attempt volume to calibrate an opaque predictor. The live Supabase project currently has IELTS content and attempt tables at zero rows except `band_conversions`, so the plan engine must start deterministic, inspectable, and robust to sparse data.

## 1. Findings

### 1.1 Lumist Study Plan Architecture

Lumist's adaptive system is concentrated in a few server services:

- `features/ai-tutor/services/server/weekly-plan-server.service.ts` is the main weekly plan generator. It is roughly 2,370 lines and mixes eligibility checks, concurrency locking, topic ranking, task generation, question selection, premium gating, rescheduling, and payload shaping.
- `features/ai-tutor/services/server/planning-evidence.service.ts` builds diagnostic evidence from imported reports and score sources.
- `features/ai-tutor/services/server/focus-topics-server.service.ts` selects weak topics from recent assessment history.
- `features/ai-tutor/services/server/topic-ranking.service.ts` maps diagnostic skill signals to SAT topic tags and boosts weak topics.
- `features/calendar/services/server/question-selection.service.ts` selects SAT questions for review and mini-tests.
- `lib/services/dualSectionSATPredictor.ts` and `lib/services/dualSectionDataService.ts` compute a transparent-ish SAT score prediction and component breakdown.
- UI lives mainly in `components/shared/WeeklyPlanDialog.tsx`, `components/shared/WeeklyPlanDialogs.tsx`, and `features/ai-tutor/components/AiTutorAdjustPlanDialog.tsx`.

The core data model is Prisma-backed and centered on these concepts:

- `StudentProfile`: target score, test date, daily minutes, tasks per day, auto-generate setting, and relations to plan tasks, focus topics, skill signals, review questions, reports, and daily score snapshots.
- `AiTutorPlanPreference`: plan cadence and user preference inputs such as study days, priority mode, daily minutes, tasks per day, target score, and official test date.
- `StudyPlanTask`: scheduled task rows with localized title/description stored as JSON strings, task category, scheduled date, completed date, question IDs, duration, linked module/resource/assessment, status, and premium flags.
- `StudentFocusTopic`: auto or manually selected weak topics with mastery, counts, category, and ordering.
- `StudentSkillSignal`: diagnostic skill evidence with strength, weakness weight, confidence, source, optional report source, expiry, and versioning.
- `ReviewQuestion`: an error-bank row per student/question with selected/missed reason, notes, practice counts, correction state, and archive state.
- `DailyLumistScore`: cached daily score snapshots for total, Math, and Verbal.

That model is more important as vocabulary than as a schema to copy. DebateLab should keep the concepts of plan, plan item, evidence, focus area, review item, and prediction snapshot, but implement them with UUIDs, raw `supabase-js`, generated Supabase types, repository functions, RLS policies, and Postgres enums.

### 1.2 Lumist Plan Generation Algorithm

Lumist generates a plan for the current week, from today through Sunday.

The high-level flow is:

1. Check that the learner has completed AI tutor onboarding and at least one mock/diagnostic.
2. Compute the UTC week bounds.
3. If a plan exists, optionally ensure the weekly error-log task exists and return it.
4. If generation is needed, insert a placeholder `StudyPlanTask` row as a generation lock.
5. Load current focus topics, assessment insights, half-test availability, planning evidence, target score, daily minutes, tasks per day, priority mode, and premium status.
6. Determine weaker section from planning evidence category bias, falling back to focus topic mastery.
7. Build a daily category plan according to priority mode:
   - `weakest_first`: emphasize the weaker section.
   - `balanced`: alternate Math and Verbal.
   - `test_practice`: favor mini-tests and half-tests, still mixed across sections.
8. Choose task types using weighted random categories:
   - Normal mode: lesson 2, review 3, mini-test 2, half-test 1.
   - Test-practice mode: lesson 1, review 3, mini-test 4, half-test 2.
9. Generate task rows with fallbacks:
   - `LESSON`: choose an uncompleted lesson/practice-set resource for a focus topic.
   - `REVIEW`: choose 5 to 10 questions for one topic.
   - `MINI_TEST`: choose mixed questions across roughly three topics.
   - `HALF_TEST`: choose an uncompleted Math or Verbal half test.
   - `ERROR_LOG`: add a weekly review-bank task if enough active review questions exist.
10. Cap free learners at two tasks per day and mark higher task slots premium locked.
11. Reschedule incomplete previous-week tasks into current-week capacity when possible.

Useful ideas:

- The weekly horizon keeps the plan understandable and avoids pretending to know the full study journey.
- Fallback task generation lets the system keep producing value even when content coverage is uneven.
- Weak-topic ranking combines actual attempts and diagnostic uploads instead of using one source only.
- The task payload stores why it exists, even if Lumist does not expose that reasoning as strongly as it should.

Problems to avoid:

- The service is too large and has too many responsibilities.
- Random task ordering is hard to audit and reproduce.
- The placeholder-row lock is clever but brittle; an idempotent Postgres RPC or advisory-lock function is cleaner.
- Premium slot logic is intertwined with pedagogy. DebateLab should keep payments/entitlements separate from adaptive sequencing.
- The model is SAT-coupled at nearly every layer.

### 1.3 Lumist Adaptation Loop

Lumist adapts through three loops:

- Focus topics refresh from recent assessment history. The strongest detail is that it counts skipped assigned questions as weakness, not only submitted wrong answers.
- Planning evidence maps external diagnostic reports into skill signals, then maps those skills back to Lumist topic tags.
- Weekly plan generation reranks topics and changes future tasks based on the updated evidence.

The focus-topic algorithm looks at recent assessment attempts, aggregates assigned questions by topic, and prioritizes topics with incorrect or skipped responses. It also applies low-sample penalties, sorts lower accuracy higher, considers question volume, gives verbal grammar some priority, and fills defaults when there is not enough evidence.

`PlanningEvidenceService` is the most transferable design. It builds evidence atoms with source exam, source dimension, normalized strength, weakness weight, coverage weight, confidence, raw evidence, prioritized topics, unmapped skills, score readout, and limitations. It already knows about exams beyond SAT, including IELTS Academic, IELTS General Training, Duolingo English Test, TOEIC LR, and VSTEP 3-5. The exact mappings are Lumist-specific, but the pattern is right: every recommendation should point back to structured evidence and known limitations.

### 1.4 Lumist Prediction Model

Lumist has two SAT score prediction systems:

- `satScorePredictor.ts`: an older single total-score formula with weights for mock score, homework, volume, mastery, regularity, study hours, vocab, streak, and an instability penalty.
- `dualSectionSATPredictor.ts`: a newer Math/Verbal predictor using mock score, homework, IRT-like mastery, trend, difficulty progression, topic coverage, consistency, volume saturation, vocabulary, and streak. It exposes component weights, sigma, confidence, weighted sum, and section predictions.

The newer predictor is useful as a transparency reference, not as a model to copy. It uses SAT-specific score ranges, section scores, difficulty labels, and vocabulary/streak bonuses. The important carry-over is the API shape: predictions should be cached as snapshots, recomputed only when meaningful new evidence appears, and shown with component contributions and confidence.

For IELTS, initial prediction should be simpler and more defensible:

- Reading/Listening: use raw score and `band_conversions` for full or section attempts, with confidence from item count, recency, and whether the attempt was timed.
- Writing/Speaking: use the existing AI scorer criterion bands and phoneme report, with confidence from scorer completion, audio/text quality flags, prompt type, and recency.
- Overall: apply IELTS' official equal averaging and half-band rounding rules.
- Skill states: maintain criterion and question-type weakness, not just module-level bands.

### 1.5 Lumist Review/Error Bank

Lumist has an error bank, not real spaced repetition.

`ReviewQuestion` tracks incorrect or unanswered assessment questions, reasons, notes, practice count, correct count, last practice time, archive state, and correction state. `auto-add-review-questions.ts` automatically upserts missed questions after assessments. `ReviewPracticeServerService` supports modes such as recent, oldest, hard, weakest, lucky, and custom.

This is worth carrying over, but DebateLab should go one step further. IELTS needs a review queue with due dates and memory state for objective question mistakes, vocabulary/collocation snippets, grammar patterns, pronunciation phonemes, and writing/speaking micro-skills. Start with SM-2 because it is simple, inspectable, and cheap. Keep fields compatible with a later FSRS upgrade when there is enough review history.

### 1.6 Lumist UI

Lumist's UI surface has three relevant pieces:

- A weekly plan reveal dialog shown once per week from dashboard routes, with grouped-by-day tasks.
- A plan adjustment dialog for target score, test date, daily minutes, tasks per day, study days, and priority mode.
- Task cards with icons, estimated duration, localized title/description, premium labels, and event dispatch after generation.

This maps well to IELTS, but the UI should not be a modal-first product. IELTS learners need a persistent Learn dashboard:

- Today and this week.
- Predicted bands and confidence.
- Weakness reasons.
- Due review.
- Mock and assignment obligations.
- Next best activity.

Modal reveal can be a nice first-run or weekly moment, but the durable surface should be `/ielts/learn` inside the existing learner shell.

### 1.7 DebateLab Current State

The `ielts` branch already has the correct foundation:

- Masterplan: `docs/ielts-masterplan.md` defines the native v2 plan, the Learn-vs-Assess split, the principle that "the activity engine IS the platform", and the quality bar.
- Data conventions: `docs/ielts/data-access.md` requires typed clients, repository reads, Zod boundaries, RLS, generated Supabase types, and `ielts_questions` as the canonical item bank.
- IELTS tables: `ielts_attempts`, `attempt_band_scores`, `writing_responses`, `speaking_responses`, `ielts_question_responses`, `ielts_questions`, `ielts_question_keys`, and `band_conversions`.
- Debate activity tables: `activity_attempts` and `practice_attempts`.
- Engine to reuse: `lib/activity/registry.ts`, `components/activities/*`, and `components/ielts/question-renderer-registry.tsx` with `registerIeltsRenderer`.
- Gamification to reuse: `lib/xp/*` and `lib/streaks/*`.
- AI to reuse: `lib/practice-analysis/*`, `lib/ielts/writing-scorer/*`, and `lib/ielts/speaking-scorer/*`.
- Ability-estimation precedent: duel MMR tables and functions, especially `duel_mmr_profiles` and `process_debate_duel_rating`.
- Learner shell and gating: `components/ielts/learner/IeltsHome.tsx`, `/ielts/*`, and `IELTS_ENABLED`.

The live Supabase project confirms that the platform data exists but IELTS is still at pre-content scale:

| Area | Live count / shape |
| --- | --- |
| `ielts_tests`, `ielts_questions`, `ielts_question_keys`, `passages`, `listening_sections`, `audio_assets` | 0 rows |
| `ielts_attempts`, `ielts_attempt_sections`, `ielts_question_responses`, `attempt_band_scores`, `writing_responses`, `speaking_responses` | 0 rows |
| `band_conversions` | 51 rows: listening `none`, reading `academic`, reading `general_training` |
| `activities` | 19 rows across lesson, quiz, drag_order, fill_blank, flashcard, matching |
| `activity_attempts` | 16 rows |
| `practice_attempts` | 28 rows |
| `analysis_jobs` | 28 rows |
| `xp_events`, `xp_seasons`, `xp_season_user_totals` | 0 rows |
| `duel_mmr_profiles` | 1 row |
| `classes` | 1 row |

Implication: the adaptive layer must degrade gracefully when IELTS has no attempts and limited content. The first diagnostic experience and item metadata quality are blocking dependencies for a meaningful plan.

### 1.8 Field Research

IELTS itself is criterion-referenced and transparent:

- IELTS official scoring explains that overall band is the average of the four component bands rounded to the nearest half band. A `.25` average rounds up to the next half band and a `.75` average rounds up to the next whole band. Listening and Reading have 40 questions, one mark per correct answer, converted to the 9-band scale, with exact raw marks varying slightly by test version. See [IELTS scoring in detail](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail).
- IELTS official resources publish Writing and Speaking marking criteria and band descriptors. Writing uses Task Achievement/Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. Speaking uses Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation. See [IELTS resources for setting scores](https://ielts.org/organisations/ielts-for-organisations/understanding-ielts-scoring/resources-for-setting-your-ielts-scores), [IELTS Writing band descriptor update](https://ielts.org/news-and-insights/ielts-writing-band-descriptors-and-key-assessment-criteria), and [Speaking public descriptors](https://assets.cambridgeenglish.org/webinars/ielts-speaking-band-descriptors.pdf).

Adaptive learning field patterns support an explainable, modular design:

- Bloom's mastery learning frame emphasizes defining mastery, adapting instruction, and allowing different time/support per learner. See [ERIC ED053419](https://eric.ed.gov/?id=ED053419).
- Adaptive system surveys separate rules-based, decision-tree, and advanced algorithm systems, and call out the need for modular content, assessment, competency mapping, and stable metadata. See [EDUCAUSE adaptive learning systems](https://er.educause.edu/articles/2016/10/adaptive-learning-systems-surviving-the-storm).
- Spaced repetition should be explicit state, not just "review recent wrong answers". SM-2 gives a simple item-level interval/ease model. See [SuperMemo SM-2](https://super-memory.com/english/ol/sm2.htm). FSRS adds difficulty, stability, and retrievability, but needs review-history volume. See [open-spaced-repetition FSRS](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler) and [Anki's FSRS summary](https://faqs.ankiweb.net/what-spaced-repetition-algorithm).
- Consumer learning apps suggest that streaks, daily goals, and levels help habit formation, but DebateLab already has XP and streaks. Brilliant's public product language emphasizes interactive problem-solving, adapting to gaps, and daily goals. See [Brilliant](https://brilliant.org/). Duolingo publicly treats streak milestones as a major learner motivation surface. See [Duolingo streak celebrations](https://blog.duolingo.com/streak-celebration-parties/).

The design takeaway: IELTS adaptation should be a rules-based system with strong evidence, metadata, and explanations first. It can become more algorithmic after DebateLab has enough labeled IELTS attempts.

## 2. Recommended DebateLab Design

### 2.1 Product Principles

1. Learn-mode is registered activity types only. Do not edit the core activity engine for IELTS-specific behavior.
2. Every plan decision must have a learner-readable reason and a developer-readable evidence payload.
3. Treat Assess and Learn as the same learning substrate with different intent. Assess writes high-confidence evidence; Learn writes lower-stakes formative evidence.
4. Reuse XP and streaks. Do not create IELTS-specific engagement counters.
5. Use cheap-first inference. Gemini Flash key-pool and Groq are acceptable defaults; Claude is reserved for calibration/evaluation; avoid DeepSeek.
6. Build VN-first EN+VI copy as first-class localized content, not as JSON strings inside text columns.
7. Keep IELTS behind `IELTS_ENABLED`.

### 2.2 Data Model

Add a small native adaptive schema. Names are recommendations; exact migration naming can follow repo conventions.

#### `ielts_adaptive_profiles`

One row per learner/test kind. This replaces Lumist's SAT-oriented `AiTutorPlanPreference` and the adaptive subset of `StudentProfile`.

Fields:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `test_kind ielts_test_kind not null`
- `target_overall_band numeric(2,1)`
- `target_module_bands jsonb not null default '{}'`
- `official_test_date date`
- `study_days smallint[] not null default '{1,2,3,4,5}'`
- `daily_minutes integer not null default 30`
- `tasks_per_day integer not null default 2`
- `priority_mode text not null check in ('weakest_first','balanced','test_practice')`
- `locale text not null default 'vi-VN'`
- `auto_generate boolean not null default true`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

RLS: learner can read/update own row; teacher/admin visibility only through existing class/club relationships if needed.

#### `ielts_skill_states`

The current learner model by skill, module, question type, and criterion. This is the IELTS-native equivalent of Lumist focus topics plus skill signals.

Fields:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `test_kind ielts_test_kind not null`
- `module ielts_module not null`
- `skill_key text not null`
- `question_type ielts_question_type`
- `criterion text`
- `band_estimate numeric(2,1)`
- `mastery_score numeric not null check (mastery_score between 0 and 1)`
- `confidence numeric not null check (confidence between 0 and 1)`
- `evidence_count integer not null default 0`
- `last_evidence_at timestamptz`
- `explanation jsonb not null default '{}'`
- `updated_at timestamptz not null default now()`

Unique: `(user_id, test_kind, module, skill_key, question_type, criterion)`.

#### `ielts_adaptive_evidence`

Append-only evidence atoms used to explain plans and predictions.

Fields:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `source_table text not null`
- `source_id uuid not null`
- `source_kind text not null check in ('mock','section','activity','writing_score','speaking_score','phoneme','review','diagnostic_import')`
- `test_kind ielts_test_kind`
- `module ielts_module not null`
- `skill_key text not null`
- `question_type ielts_question_type`
- `criterion text`
- `raw_score numeric`
- `band numeric(2,1)`
- `normalized_strength numeric not null check (normalized_strength between 0 and 1)`
- `weakness_weight numeric not null check (weakness_weight between 0 and 1)`
- `confidence numeric not null check (confidence between 0 and 1)`
- `recency_weight numeric not null check (recency_weight between 0 and 1)`
- `reason_en text not null`
- `reason_vi text not null`
- `raw_evidence jsonb not null default '{}'`
- `created_at timestamptz not null default now()`

This table is the audit trail. It is what Lumist almost has with `PlanningEvidence`, but stored natively and queryable.

#### `ielts_study_plans`

One generated plan per learner and week.

Fields:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `adaptive_profile_id uuid not null references ielts_adaptive_profiles(id)`
- `test_kind ielts_test_kind not null`
- `week_start date not null`
- `week_end date not null`
- `status text not null check in ('draft','active','superseded','completed','cancelled')`
- `generation_reason text not null check in ('initial','weekly','force_regenerate','post_attempt','teacher_assignment')`
- `input_snapshot jsonb not null`
- `explanation jsonb not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Unique partial: one active plan per `(user_id, test_kind, week_start)`.

#### `ielts_plan_items`

The learner-facing to-do rows.

Fields:

- `id uuid primary key`
- `plan_id uuid not null references ielts_study_plans(id) on delete cascade`
- `user_id uuid not null references profiles(id)`
- `scheduled_for date not null`
- `position integer not null`
- `title_en text not null`
- `title_vi text not null`
- `description_en text`
- `description_vi text`
- `module ielts_module not null`
- `skill_key text not null`
- `question_type ielts_question_type`
- `item_kind text not null check in ('lesson','practice','review','mini_mock','section_mock','full_mock','writing_prompt','speaking_prompt')`
- `activity_type text`
- `activity_id uuid`
- `ielts_test_id uuid references ielts_tests(id)`
- `ielts_question_ids uuid[] not null default '{}'`
- `estimated_minutes integer not null`
- `due_at timestamptz`
- `status text not null check in ('scheduled','started','completed','skipped','cancelled','superseded')`
- `completion_source_table text`
- `completion_source_id uuid`
- `evidence_ids uuid[] not null default '{}'`
- `recommendation_reason jsonb not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

This table launches existing activities or IELTS mocks; it does not own rendering.

#### `ielts_review_items`

Spaced review state for missed questions and micro-skills.

Fields:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `source_question_id uuid references ielts_questions(id)`
- `source_response_id uuid`
- `module ielts_module not null`
- `skill_key text not null`
- `question_type ielts_question_type`
- `review_kind text not null check in ('question','vocabulary','grammar','pronunciation','writing_criterion','speaking_criterion')`
- `prompt_fingerprint text`
- `state text not null check in ('learning','review','relearning','suspended')`
- `due_at timestamptz not null`
- `interval_days numeric not null default 0`
- `ease_factor numeric not null default 2.5`
- `difficulty numeric`
- `stability numeric`
- `retrievability numeric`
- `repetitions integer not null default 0`
- `lapses integer not null default 0`
- `last_grade smallint`
- `last_reviewed_at timestamptz`
- `explanation jsonb not null default '{}'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Use SM-2 fields now. Keep `difficulty`, `stability`, and `retrievability` nullable for future FSRS migration.

#### `ielts_band_prediction_snapshots`

Cached, explainable prediction snapshots.

Fields:

- `id uuid primary key`
- `user_id uuid not null references profiles(id)`
- `test_kind ielts_test_kind not null`
- `overall_band numeric(2,1)`
- `module_bands jsonb not null`
- `criterion_bands jsonb not null default '{}'`
- `confidence numeric not null check (confidence between 0 and 1)`
- `method_version text not null`
- `evidence_ids uuid[] not null default '{}'`
- `explanation jsonb not null`
- `limitations jsonb not null default '[]'`
- `created_at timestamptz not null default now()`

Recompute after full mock, section mock, scorer completion, or explicit user request. Return cached otherwise.

### 2.3 Algorithm

#### Evidence Ingestion

Convert every relevant learning event into evidence atoms:

- Full IELTS mock: high-confidence module-level and overall evidence.
- Section attempt: high-confidence module evidence when timed and complete; medium confidence otherwise.
- Objective question response: low-to-medium confidence evidence by module, question type, skill key, and error reason. Skips count as weakness.
- Writing score: criterion evidence from task achievement/response, coherence and cohesion, lexical resource, grammatical range and accuracy.
- Speaking score: criterion evidence from fluency/coherence, lexical resource, grammar, pronunciation, plus phoneme-level evidence.
- Debate activity attempt used for IELTS Learn-mode: formative evidence only, lower confidence.
- Review item outcome: memory-strength evidence only, not band evidence unless the item maps cleanly to an IELTS skill.

Recommended normalization:

- Objective correctness: `normalized_strength = correct ? 1 : 0`, with partial support if the renderer records partial credit later.
- Reading/Listening raw score: convert to band via `band_conversions`, then `normalized_strength = band / 9`.
- Writing/Speaking criteria: `normalized_strength = criterion_band / 9`.
- Recency: half-life 30 days for practice and 60 days for full mocks.
- Source confidence:
  - Full timed mock: 1.0
  - Section timed mock: 0.8
  - AI-scored Writing/Speaking: 0.65 to 0.85 depending on quality flags
  - Learn activity: 0.35 to 0.55
  - Review outcome: 0.2 to 0.35
  - Imported diagnostic: 0.6 to 0.8 depending on source completeness

Each evidence atom stores `reason_en` and `reason_vi`, for example:

- EN: "You missed 4 of 6 matching-headings questions in timed Academic Reading."
- VI: "Ban sai 4/6 cau Matching Headings trong bai Reading Academic co tinh gio."

#### Skill State Update

Maintain one current state per skill key. The first version can be a weighted transparent blend:

```
weighted_strength =
  sum(normalized_strength * confidence * recency_weight * source_weight)
  / sum(confidence * recency_weight * source_weight)

mastery_score = clamp(weighted_strength, 0, 1)
band_estimate = round_to_half(mastery_score * 9)
confidence = clamp(1 - exp(-effective_evidence / 8), 0, 0.95)
weakness_weight = (1 - mastery_score) * confidence
```

For objective R/L item selection, use the duel system's MMR/Elo pattern as a precedent: seed new learners at band 5.5, update lightly after each question response using item difficulty/band metadata, and expose the update reason. Do not build a full IRT model until item metadata and response volume justify it.

#### Plan Generation

Plan generation should be a deterministic server operation:

1. Lock `(user_id, test_kind, week_start)` with a Postgres advisory lock or idempotent RPC.
2. Load adaptive profile, current skill states, due review items, active B2B assignments, recent attempts, available content, and latest prediction snapshot.
3. If no IELTS evidence exists, generate a diagnostic-first plan:
   - one short R/L diagnostic or section mock if content exists,
   - one Writing prompt,
   - one Speaking prompt,
   - optional engine-native orientation activity.
4. If evidence exists, allocate weekly capacity:
   - 15% due review/SRS,
   - 45% weakest IELTS skills and criteria,
   - 25% exam coverage and timed practice,
   - 15% learner/teacher goals or upcoming assignment.
5. Respect priority mode:
   - `weakest_first`: shift 15% more capacity to highest weakness.
   - `balanced`: enforce module coverage across the week.
   - `test_practice`: shift 20% more capacity to timed mocks and mini-mocks.
6. Select content from `ielts_questions` using module, test kind, question type, skill key, difficulty/band metadata, availability of answer keys, and prior exposure.
7. Produce `ielts_plan_items` that point to existing activities, IELTS tests, or question sets.
8. Attach evidence IDs and localized reasons to every item.
9. Award XP/streak only when the learner completes the underlying activity or attempt through existing `lib/xp/*` and `lib/streaks/*`.

Avoid Lumist's weighted randomness in v1. Deterministic ranking makes support, debugging, and learner explanations easier. Add seeded tie-breaking later if plans feel repetitive.

#### Adaptation Loop

After each meaningful event:

1. Ingest evidence.
2. Update skill states.
3. Recompute prediction snapshot if the event meaningfully changes band evidence.
4. Replan only incomplete future items.
5. Do not churn today's already-started tasks.
6. If a teacher assignment exists, schedule it as fixed capacity before personal adaptive tasks.
7. Write a plan-change explanation:
   - "Added Listening distractor review because you missed 5 map-label questions."
   - "Moved full mock to Saturday because your class assignment is due Friday."

Use a small set of event triggers:

- `ielts_submit_attempt_section`
- Writing scorer completion
- Speaking scorer/phoneme completion
- Learn activity completion
- Review session completion
- Teacher assignment creation/update

### 2.4 UI Surface

Build the durable surface first:

- `/ielts/learn`: current plan, today's tasks, week strip, due review, predicted bands, weakness chips, recent changes, and assignment obligations.
- `/ielts/learn/settings`: plan cadence, target bands, test date, priority mode, study days, locale, and auto-generate toggle.
- `/ielts/learn/review`: due review queue, error bank, reasons, and filters by module/question type/criterion.
- `/ielts/results`: add "Why this plan changed" entry points from attempt results into the next plan items.

Plan item cards should include:

- Module and task kind.
- Estimated minutes.
- Start/resume action.
- "Why this?" in EN+VI.
- Evidence chips such as "Recent mock", "Skipped questions", "Writing coherence".
- Completion state from `activity_attempts` or `ielts_attempts`.

Do not create a separate IELTS XP/streak widget. Use existing DebateLab XP/streak components and source types, adding IELTS-compatible source metadata if needed.

### 2.5 Reuse Map

| Need | Reuse | Build native |
| --- | --- | --- |
| Item bank | `ielts_questions`, `ielts_question_keys`, `passages`, `listening_sections`, `audio_assets` | Add adaptive metadata fields/tags if missing: skill key, band range, difficulty, distractor/error tags |
| R/L rendering | `components/ielts/question-renderer-registry.tsx`, `registerIeltsRenderer` | Plan launch wrappers that feed question sets into registered renderers |
| Learn activities | `lib/activity/registry.ts`, `components/activities/*`, `activity_attempts` | IELTS activity types registered externally, no core-engine edits |
| Mock/Assess | `ielts_attempts`, `ielts_attempt_sections`, `ielts_question_responses`, server timing RPCs | Plan items that schedule section/full mocks |
| Band conversion | `band_conversions`, `attempt_band_scores`, scoring utilities | Prediction snapshots and confidence/explanation layer |
| Writing | `writing_responses`, `lib/ielts/writing-scorer/*` | Criterion evidence ingestion and Writing-specific plan items |
| Speaking | `speaking_responses`, `lib/ielts/speaking-scorer/*`, phoneme report | Pronunciation review items and criterion evidence ingestion |
| AI pipeline | `lib/practice-analysis/*` | Cheap-first orchestration for plan explanations only when deterministic reasons are insufficient |
| Gamification | `lib/xp/*`, `lib/streaks/*` | Extend source/category types only as required; do not duplicate |
| Ability estimate precedent | `duel_mmr_profiles`, duel MMR migrations/functions | IELTS skill state and later item-difficulty updates |
| B2B | classes, class assignments, IELTS assignment migrations | Fixed assignment capacity inside the plan |
| Typed data | `apps/web/src/types/supabase.ts`, `lib/api/ielts/*`, Zod schemas | New `lib/api/ielts/adaptive/*` repositories and schemas |
| Feature gating | `IELTS_ENABLED` learner shell | Gate every route/action/component |

## 3. Port-vs-Build Call

| Lumist mechanism | Call | DebateLab implementation | Why |
| --- | --- | --- | --- |
| Weekly plan concept | Port idea | `ielts_study_plans` plus `ielts_plan_items` | The weekly horizon is understandable and operationally useful |
| `StudyPlanTask` schema | Rebuild native | UUID tables, RLS, generated Supabase types, localized columns/jsonb | Lumist's prefixed IDs, Prisma coupling, and JSON-string localization do not fit DebateLab |
| Plan cadence/preferences | Port idea | `ielts_adaptive_profiles` | Target band, test date, study days, minutes, and priority mode transfer well |
| Placeholder row generation lock | Discard | Postgres advisory lock or idempotent RPC | Placeholder tasks pollute data and hide failure modes |
| Focus topics | Rebuild native | `ielts_skill_states` by module, criterion, question type, and skill key | IELTS weakness is criterion/module-specific, not SAT topic-only |
| Planning evidence atoms | Port and improve | `ielts_adaptive_evidence` append-only table | This is the strongest Lumist idea; make it queryable and learner-visible |
| Skipped-question penalty | Port | Evidence ingestion treats skipped as weakness | Especially important for timed IELTS behavior |
| Question selector | Rebuild native | Query `ielts_questions` with IELTS metadata and prior exposure | Lumist's selector is SAT tag and difficulty-range specific |
| Review/error bank | Port and improve | `ielts_review_items` with SM-2 fields | Lumist has an error bank but not true SRS |
| Score prediction shape | Port idea | `ielts_band_prediction_snapshots` with components, confidence, limitations | The explanation shape is useful; SAT math is not |
| SAT score formulas | Discard | IELTS raw-to-band, criterion-band, and confidence heuristics | SAT 400-1600 constants cannot transfer |
| Math/Verbal split | Discard | IELTS modules and criteria | IELTS is L/R/W/S plus Writing/Speaking criteria |
| Premium-locked plan slots | Discard for adaptive core | Entitlements outside plan algorithm | Pedagogy should not be entangled with payment state |
| Modal weekly reveal | Rebuild as secondary UI | Persistent `/ielts/learn` dashboard, optional weekly reveal | IELTS learners need a durable study surface |
| LocalStorage dialog dedupe | Rebuild server-first | User-level plan status plus client niceties | Server state is more reliable across devices |
| Huge service object | Discard | Small modules: evidence, skill state, selection, generation, adaptation | Easier to test, audit, and keep engine-pure |
| Bilingual task strings | Rebuild native | EN+VI fields or typed localized jsonb | Avoid parsing arbitrary JSON strings from text |
| Weighted random mix | Modify | Deterministic ranked allocation with seeded tie-breaks later | Explanations and reproducibility matter more in v1 |

## 4. Highest-Leverage Ideas for Tracks B/C/D

1. Evidence ledger first. Track B band prediction and Track C study planning should share the same `ielts_adaptive_evidence` table. This prevents two competing "truths" about learner ability.
2. Confidence is part of the product. Every predicted band and plan reason should show confidence and limitations, especially while live IELTS data is sparse.
3. Plan items should be launch pointers, not content blobs. Use `ielts_questions`, IELTS mocks, and registered activity types instead of inventing a new plan renderer.
4. Review should become real SRS. Lumist's error log is a good seed, but IELTS needs due dates for objective mistakes, pronunciation targets, lexical chunks, and writing/speaking criteria.
5. Determinism beats cleverness in v1. Lumist's random/fallback generator works, but DebateLab should produce plans that support can reproduce from a generation run.

## 5. Phased Build Plan

Each card is scoped to one PR and assumes docs-only Track A is already merged.

### WS-A1: Adaptive Schema Foundation

Add migrations for `ielts_adaptive_profiles`, `ielts_adaptive_evidence`, `ielts_skill_states`, `ielts_study_plans`, `ielts_plan_items`, `ielts_review_items`, and `ielts_band_prediction_snapshots`.

Acceptance:

- RLS enabled on every table.
- Learners can read/write only their own adaptive rows.
- Admin/service role policies match existing IELTS conventions.
- Generated Supabase types updated.
- Zod schemas added under `lib/api/ielts/adaptive/schema.ts`.
- Tests cover policy expectations and schema parsing.

### WS-A2: Evidence Builder

Create `lib/api/ielts/adaptive/evidence-repository.ts` and `lib/ielts/adaptive/evidence-builder.ts`.

Acceptance:

- Builds evidence atoms from `ielts_attempts`, `ielts_question_responses`, `attempt_band_scores`, `writing_responses`, and `speaking_responses`.
- Skipped objective questions count as weakness.
- W/S criterion bands become criterion-level evidence.
- Evidence has EN+VI reasons.
- No answer keys are exposed to learner-readable APIs.
- Unit tests cover R/L, W/S, skipped, sparse, and stale evidence.

### WS-A3: Skill State Updater

Implement skill-state aggregation and confidence calculation.

Acceptance:

- Updates `ielts_skill_states` from evidence atoms.
- Uses deterministic weighted blend with recency/source confidence.
- Stores explanation payload with top contributing evidence IDs.
- Provides a read API for learner dashboard and plan generation.
- Tests cover confidence saturation, recency decay, and no-evidence defaults.

### WS-A4: IELTS Question Metadata and Selector

Add or validate IELTS question metadata required for adaptive selection, then build a selector.

Acceptance:

- `ielts_questions` supports skill key, band/difficulty range, and optional error/distractor tags.
- Selector filters by module, test kind, question type, skill, band range, prior exposure, and answer-key availability.
- Selector returns deterministic ordered candidates with seeded tie-breaks.
- Tests cover empty-bank fallback and no answer-key leakage.

### WS-A5: Weekly Plan Generator

Build `lib/ielts/adaptive/weekly-plan-generator.ts` and a server action/RPC wrapper.

Acceptance:

- Generates a weekly plan from profile, skill states, review debt, assignments, and content availability.
- Uses idempotency/advisory lock per learner/test kind/week.
- Supports initial diagnostic-first plan when no evidence exists.
- Writes localized plan item reasons and evidence IDs.
- Does not edit `lib/activity/registry.ts` core behavior.
- Tests cover priority modes, fixed assignments, no content, and plan regeneration.

### WS-A6: Learner Plan UI

Add the persistent `/ielts/learn` surface.

Acceptance:

- Gated by `IELTS_ENABLED`.
- Shows today's items, week plan, predicted band, confidence, weakness chips, due review, and assignments.
- Plan item cards launch existing IELTS mocks or registered activity types.
- EN+VI copy is present for all new user-facing strings.
- Uses existing XP/streak components; no IELTS-specific gamification clone.
- Component tests cover empty state, diagnostic state, active plan, and completed item state.

### WS-A7: Adaptation Triggers

Wire plan adaptation after attempts and scorer completion.

Acceptance:

- Completion of R/L section attempts, Writing scorer, Speaking scorer/phoneme, Learn activity attempts, and review sessions can enqueue or run adaptation.
- Incomplete future items can be superseded; started/today items are stable.
- Plan change reasons are stored and visible.
- Integration tests cover post-mock, post-writing-score, and teacher-assignment conflicts.

### WS-A8: Review Queue and SRS

Build IELTS review items and SM-2 scheduling.

Acceptance:

- Missed/skipped objective questions create or update `ielts_review_items`.
- W/S scorer weaknesses can create review items by criterion or micro-skill.
- SM-2 review updates `due_at`, interval, ease, repetitions, and lapses.
- `/ielts/learn/review` launches review through registered activity/question renderers.
- Tests cover first review, lapse, ease floor, duplicate prevention, and suspended items.

### WS-A9: Prediction Snapshot V1

Create transparent IELTS band prediction snapshots.

Acceptance:

- R/L predictions use raw-to-band conversions where available.
- W/S predictions use criterion scores and phoneme quality flags.
- Overall score follows IELTS official averaging/rounding.
- Snapshot includes confidence, limitations, and top evidence.
- Cached snapshot returns until meaningful new evidence appears.
- Tests cover official rounding, sparse evidence, stale evidence, and confidence wording.

### WS-A10: Teacher/Class Integration

Expose plan and assignment interactions to B2B flows.

Acceptance:

- Class assignments reserve plan capacity and are shown as fixed items.
- Teachers can see aggregate plan progress without accessing private answer keys or unrelated learner data.
- Learner plan explains when an assignment affects scheduling.
- RLS tests cover class teacher visibility and non-member denial.

## 6. Risks and Open Questions

### Risks

- Content scarcity: live IELTS content tables are empty. Adaptive planning cannot be credible until there is enough tagged R/L/W/S content.
- Metadata quality: question type alone is not enough. We need skill keys, target band/difficulty, and error/distractor tags.
- Prediction trust: without labeled IELTS outcomes, predicted bands must be presented as estimates with confidence and limitations.
- W/S scorer variance: plan changes based on AI scores should account for scorer confidence and input quality.
- Plan churn: if the plan changes after every small activity, learners may lose trust. Only incomplete future items should adapt.
- RLS/answer-key leakage: adaptive selection must never expose `ielts_question_keys` to learner clients.
- Cost control: plan explanations should be deterministic by default; LLMs are for scorer outputs or rare summarization.
- B2B conflict: teacher-assigned mocks may conflict with personal adaptive plans. Fixed assignments should win.
- VN-first quality: bilingual reasons must be human-reviewable, not opaque machine-translated strings buried in JSON text.

### Open Questions

- What is the canonical IELTS skill taxonomy for `skill_key`? Options: Cambridge-style question skills, band-descriptor criteria, CEFR micro-skills, or a DebateLab-specific hybrid.
- Should Learn-mode objective practice create `activity_attempts` only, or should it also create lightweight `ielts_attempts` for unified analytics?
- How much item metadata can be authored manually in the first content wave?
- What should be the minimum diagnostic before a personalized plan unlocks?
- Should prediction snapshots be visible before the learner completes at least one timed section?
- Should class/teacher assignment progress be allowed to influence personal band prediction, or only personal plan scheduling?
- Is SM-2 enough for v1 review, or should we store FSRS-compatible fields immediately and keep the algorithm behind a feature flag?
- Where should localized plan copy live long term: columns, typed jsonb, or shared i18n dictionaries?

## Source Notes

Local DebateLab sources inspected:

- `docs/ielts-masterplan.md`
- `docs/ielts/data-access.md`
- `apps/web/src/lib/activity/registry.ts`
- `apps/web/src/components/activities/*`
- `apps/web/src/components/ielts/question-renderer-registry.tsx`
- `apps/web/src/lib/api/ielts/*`
- `apps/web/src/lib/ielts/writing-scorer/*`
- `apps/web/src/lib/ielts/speaking-scorer/*`
- `apps/web/src/lib/practice-analysis/*`
- `apps/web/src/lib/xp/*`
- `apps/web/src/lib/streaks/*`
- IELTS, XP, and duel MMR migrations under `supabase/migrations/*`

Local Lumist sources inspected:

- `features/ai-tutor/services/server/weekly-plan-server.service.ts`
- `features/ai-tutor/services/server/planning-evidence.service.ts`
- `features/ai-tutor/services/server/topic-ranking.service.ts`
- `features/ai-tutor/services/server/focus-topics-server.service.ts`
- `features/ai-tutor/services/server/student-skill-signal.service.ts`
- `features/ai-tutor/services/server/onboarding-server.service.ts`
- `features/calendar/services/server/question-selection.service.ts`
- `features/calendar/services/server/assessment-insights.service.ts`
- `features/calendar/services/server/study-plan-tasks.service.ts`
- `features/review/services/server/auto-add-review-questions.ts`
- `features/review/services/server/review-practice-server.service.ts`
- `lib/services/satScorePredictor.ts`
- `lib/services/dualSectionSATPredictor.ts`
- `lib/services/dualSectionDataService.ts`
- `components/shared/WeeklyPlanDialog.tsx`
- `components/shared/WeeklyPlanDialogs.tsx`
- `features/ai-tutor/components/AiTutorAdjustPlanDialog.tsx`
- `features/ai-tutor/utils/onboarding.ts`
- `prisma/schema.prisma`

Live Supabase inspected via MCP:

- Public table schemas, RLS shape, row counts, and selected groupings for IELTS, activity, practice, XP, classes, and duel-rating tables.

Field sources:

- [IELTS scoring in detail](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail)
- [IELTS resources for setting scores](https://ielts.org/organisations/ielts-for-organisations/understanding-ielts-scoring/resources-for-setting-your-ielts-scores)
- [IELTS Writing band descriptors and criteria update](https://ielts.org/news-and-insights/ielts-writing-band-descriptors-and-key-assessment-criteria)
- [IELTS Speaking public band descriptors](https://assets.cambridgeenglish.org/webinars/ielts-speaking-band-descriptors.pdf)
- [Bloom, Learning for Mastery, ERIC ED053419](https://eric.ed.gov/?id=ED053419)
- [EDUCAUSE, Adaptive Learning Systems: Surviving the Storm](https://er.educause.edu/articles/2016/10/adaptive-learning-systems-surviving-the-storm)
- [SuperMemo SM-2 algorithm](https://super-memory.com/english/ol/sm2.htm)
- [Free Spaced Repetition Scheduler](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler)
- [Anki FAQ: FSRS](https://faqs.ankiweb.net/what-spaced-repetition-algorithm)
- [Brilliant](https://brilliant.org/)
- [Duolingo streak celebrations](https://blog.duolingo.com/streak-celebration-parties/)
