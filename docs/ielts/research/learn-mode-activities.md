# IELTS Learn Mode: Micro-Activities

Track D research doc for `docs/ielts/research/learn-mode-activities.md`.

## Executive recommendation

Build Learn mode natively in DebateLab/Thinkfy as a guided IELTS practice path made of registered micro-activity types, not as a Lumist fork and not as a second learning engine.

The product shape should be:

- `courses` = IELTS learning paths.
- `course_modules` = units.
- `activities` = lesson nodes / micro-activity sequences.
- `activity_attempts` = Learn-mode attempts.
- `ielts_attempts` = Assess-mode mock attempts.
- Progress, XP, streaks, and weakness signals = `activity_attempts ∪ ielts_attempts`.

The first production slice should ship a tight, exam-prep-appropriate loop:

1. Diagnose from mocks and micro-activity history.
2. Schedule 1 daily lesson plus due review cards.
3. Give immediate feedback, bilingual explanations, and a visible "why this is next" rationale.
4. Update subskill mastery and SRS due dates.
5. Feed Track B's weakness profile and Track C's study-plan scheduler.

Adopt the Duolingo/Brilliant mechanics that create habit and clarity: guided path, short lessons, immediate feedback, XP, streaks, daily goals, personalized review, mistake review, mastery states, and progress checkpoints. Drop or avoid punitive hearts/energy, aggressive leagues, gambling-like chests, and engagement mechanics that make paid exam prep feel unserious. IELTS learners are buying measurable progress, not a toy economy.

## Findings

### DebateLab/Thinkfy: what exists

The current IELTS branch already has the Assess side and most platform substrate:

- `docs/ielts-masterplan.md` explicitly says "the activity engine IS the platform" and defines Learn as bite-size, untimed, immediate-feedback, mastery/SRS work on the shared attempt substrate.
- `docs/ielts/data-access.md` defines `ielts_questions` as the canonical IELTS item bank and says progress/XP/streaks must union `activity_attempts` and `ielts_attempts`.
- `ielts_questions`, `ielts_question_keys`, `passages`, `listening_sections`, `audio_assets`, `ielts_attempts`, `ielts_question_responses`, `attempt_band_scores`, `writing_responses`, `speaking_responses`, and `band_conversions` exist locally with typed RLS-first migrations.
- The learner shell is gated by `IELTS_ENABLED` in `apps/web/src/lib/features.ts`.
- The IELTS renderer registry exists in `apps/web/src/components/ielts/question-renderer-registry.tsx` with `registerIeltsRenderer`.
- Writing/Speaking task renderers are registered through `apps/web/src/components/ielts/questions/register-task-renderers.ts`.
- Objective grading is deterministic under `apps/web/src/lib/scoring/ielts/*`.
- AI Writing/Speaking scorers and phoneme analysis exist under `apps/web/src/lib/ielts/{writing,speaking}-scorer/*`, `apps/web/src/lib/ielts/pronunciation/*`, and `apps/web/src/lib/scoring/ielts-pronunciation/*`.
- Existing generic activity types are closed around `lesson`, `quiz`, `matching`, `fill_blank`, `drag_order`, and `flashcard` in `apps/web/src/lib/activity/registry.ts`, `apps/web/src/lib/activity/validators.ts`, `apps/web/src/lib/types/admin.ts`, `components/activities/*`, `app/actions/activities.ts`, and the `activities.activity_type` check constraint.
- XP/streaks are already present in `apps/web/src/lib/xp/*`, `apps/web/src/lib/streaks/*`, `xp_events`, `activity_log`, `daily_stats`, and profile streak columns. Do not rebuild them.
- `duel_mmr_profiles` and duel server-clock migrations are good precedents for explainable ability/state estimation and server-authoritative timing, but Learn mode should not reuse duel tables.

Live Supabase grounding from `DebateLab - Main` (`rsbnryympenjyzhhchhu`, Postgres 17.6):

- Existing platform rows: `courses` 5, `course_modules` 46, `activities` 19, `activity_attempts` 16, `daily_stats` 33.
- IELTS content/attempt rows are empty: `ielts_tests`, `ielts_questions`, `ielts_question_keys`, `ielts_attempts`, `ielts_question_responses`, `attempt_band_scores`, `writing_responses`, and `speaking_responses` are all 0 rows.
- `band_conversions` has 51 rows: 17 Listening, 17 Academic Reading, 17 General Training Reading, each covering raw 0-40.
- `activities.activity_type` is still constrained to the six current generic types.
- `activity_log.activity_type` allows `lesson_completed`, `quiz_completed`, `debate_completed`, `course_started`, `course_completed`, `streak_milestone`, `level_up`, `chat_session`, `login`, and `duel_completed`.
- Live `courses` does not yet have the local `subject` column from `20260619153000_courses_subject_axis.sql`. Treat schema sync as a prerequisite before any Learn-mode path work depends on subject scoping.

### Lumist: what to learn from it

Lumist is valuable as a reference, but its SAT/Prisma coupling makes direct porting wrong for Learn mode.

Useful Lumist patterns:

- Weekly plan generation in `features/ai-tutor/services/server/weekly-plan-server.service.ts` gates plans on onboarding + diagnostic, avoids duplicate weekly plans, uses a placeholder task as a race guard, schedules only remaining selected study days, mixes lesson/review/mini-test/test tasks, avoids duplicate topics within a week, and adds an error-log task when enough review questions exist.
- Student skill signals in `features/ai-tutor/services/server/student-skill-signal.service.ts` use `skill_key`, `weakness_weight`, `confidence_score`, and `source` with expiry. This is the right shape for Track B, but the skill keys must be IELTS-native.
- Planning evidence in `features/ai-tutor/services/server/planning-evidence.service.ts` maps external diagnostic measurements to content topics with transparent support levels, unmapped-skill reporting, and limitations. This is exactly the kind of explainability IELTS band plans need.
- Review/error bank services under `features/review/services/server/*` auto-add missed questions, dedupe by student/question, track correction status, and store learner reflection notes. This maps well to IELTS "mistake bank" and "why I missed this" flows.
- Lesson chunks in `features/lesson/types.ts` and `LessonChunkRenderer.tsx` support localized chunks, progressive reveal, charts, images, questions, annotations, and eliminate-style interactions. The `test-ielts-reading-lesson.json` prototype is a strong reference for IELTS reading strategy lessons.

Do not port:

- Prisma models, prefixed sequential IDs, SAT domain taxonomy, SAT-specific question selectors, Lumist coins/store economy, or its weekly-plan randomness as-is.
- Lumist's `multiple_choice | numeric` question shape as the canonical content model. DebateLab already has `ielts_questions` and IELTS-specific renderers.

### Field: what sticky learning products do

IELTS official scoring confirms the assessment spine Learn mode must serve. Listening and Reading each have 40 questions and raw scores convert to the 9-band scale; Writing uses four criteria with Task 2 weighted more than Task 1; Speaking uses four equally weighted criteria: Fluency/Coherence, Lexical Resource, Grammatical Range/Accuracy, and Pronunciation ([IELTS scoring in detail](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail)). Official resources expose Writing and Speaking descriptors and sample tasks ([IELTS score-setting resources](https://ielts.org/organisations/ielts-for-organisations/understanding-ielts-scoring/resources-for-setting-your-ielts-scores)).

Duolingo's current path model is guided, unit-based, and explicitly intersperses new material with spaced review. Its own 101 guide says units contain a few vocabulary/grammar topics, get harder as you progress, and include personalized practice based on due review and mistakes ([Duolingo 101](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/)). Its path redesign maps old crowns to path levels and spaces levels from different skills through the path ([Duolingo path redesign](https://blog.duolingo.com/new-duolingo-home-screen-design/)). Its 2026 mini-units are shorter and focused on immediate use ([Duolingo mini-units](https://blog.duolingo.com/intermediate-mini-units/)).

Duolingo's hearts/energy lesson is more cautionary than aspirational for paid IELTS prep. Duolingo says Hearts penalized each mistake and could discourage beginners; Energy is a tested replacement designed to be less punitive ([Duolingo Energy](https://blog.duolingo.com/duolingo-energy/)). For Thinkfy IELTS, do not use mistake-lives. Mistakes are evidence and review inventory.

Brilliant's official product surface is closer to the right premium learning stance: guided Learning Paths, interactive lessons, hands-on practice, checkpoints, XP, streaks, progress tracking, and no credential theater ([Brilliant Learning Paths](https://brilliant.org/help/features/what-are-learning-paths/), [Brilliant Product Features](https://brilliant.org/help/features/), [Brilliant Basics](https://brilliant.org/help/using-brilliant/)). Adopt the "learn by doing" style, especially progressive explanations and checkpoints.

For scheduling, SM-2 is simple and explainable, while FSRS is the modern direction. SuperMemo lists SM-2, FSRS, SM-19, and SM-20 in the family of repetition algorithms ([SuperMemo Algorithm](https://help.supermemo.org/wiki/SuperMemo_Algorithm)). FSRS is open and adapts to a learner's memory while allowing reviews early or late ([FSRS](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler)). Recommendation: ship an explainable SM-2-like scheduler first with FSRS-compatible fields so Track C can upgrade after enough review history.

Mastery learning fits exam prep: diagnostic baseline, clear sequenced objectives, formative checks, mastery thresholds, advancement after mastery, and continued practice until mastery ([ASCO Post summary of mastery learning](https://ascopost.com/issues/september-10-2016/mastery-learning-a-new-paradigm-for-oncology-medical-education/)).

## Recommended design

### Product mechanics: adopt vs drop

Adopt:

- Guided path with units and lessons.
- Daily goal, XP, streak, and gentle reminders.
- Immediate feedback and visible explanation after each response.
- Mastery levels per subskill, not just course completion.
- Mistake bank and spaced review queue.
- Checkpoints at the end of each unit.
- "Why this lesson" rationale from diagnostic, recent mistakes, due reviews, or teacher assignment.
- Free preview limits through entitlements/payments, not punitive lives.

Drop or de-emphasize:

- Hearts/energy/lives. They punish experimentation and are wrong for an exam-prep product.
- Heavy leagues as the core loop. If used, keep them optional/org-scoped; paid IELTS learners should not feel pushed into XP grinding over band improvement.
- Random chests, gambling-like rewards, and generic badges.
- Black-box "AI plan says so" recommendations.

### Learn-mode activity taxonomy

Each type is a registered activity type with:

- Zod content schema.
- Player component.
- Server scorer/validator.
- Authoring builder/import mapping.
- `ielts_question` / passage / listening-section source references where applicable.
- Bilingual feedback.

| Activity type | Purpose | Source data | Scoring signal |
|---|---|---|---|
| `ielts_vocab_collocation` | Build topic vocabulary, collocations, academic word choice, and false-friend awareness. | Passage text, Writing/Speaking topics, teacher vocab lists, generated distractors. | Correct choice / typed answer, first-try flag, response time, confidence. |
| `ielts_paraphrase_transform` | Train synonym/paraphrase recognition for Reading/Listening and sentence transformation for Writing. | Existing question prompt, passage sentence, answer explanation, model answer. | Semantic match from deterministic choices first; optional cheap LLM for typed paraphrase in later PR. |
| `ielts_gap_fill` | Bite-size completion drill using the same rules as IELTS summary/sentence/note/table completion. | `ielts_questions` completion items + `ielts_question_keys.accept_variants`. | Variant-tolerant deterministic grading through existing IELTS scoring helpers. |
| `ielts_listening_micro_clip` | Train short audio decoding: numbers, names, distractors, signposts, map/plan labels. | `listening_sections`, `audio_assets`, script segment metadata. | Exact/variant answer, replay count, distractor hit, time. |
| `ielts_pronunciation_minimal_pair` | Train phoneme contrasts and word stress for VN-first speakers. | Speaking prompts, curated minimal pairs, TTS/reference audio, Azure phoneme reports. | Existing phoneme engine: per-phoneme accuracy, word-level pronunciation, improvement trend. |
| `ielts_reading_skim_scan` | Train locating, heading, and claim-verification speed before full passages. | `passages` paragraph metadata, `ielts_questions` group/question type. | Locate accuracy, evidence sentence match, time under soft target. |
| `ielts_grammar_fix` | Train GRA and Writing error repair using short corrections. | Writing feedback, teacher-authored examples, generated draft items. | Fixed sentence correctness, error category, repeated lapse. |

Two optional later types:

- `ielts_strategy_chunk`: a Lumist-style progressive explanation with embedded questions. Good for the first lesson of a unit; should still complete through `activity_attempts`.
- `ielts_speaking_fluency_prompt`: 30-60 second micro-speaking prompt before a full Speaking response; uses STT and cheap rubric hints, not full scorer every time.

### Data model

Reuse the course/activity spine and add only Learn-mode-specific tables.

Existing tables to reuse:

- Path/unit/activity: `courses`, `course_modules`, `activities`.
- Attempts: `activity_attempts`.
- IELTS item bank: `ielts_questions`, `ielts_question_keys`, `passages`, `listening_sections`, `audio_assets`.
- Assess attempts/results: `ielts_attempts`, `ielts_question_responses`, `attempt_band_scores`, `writing_responses`, `speaking_responses`.
- Gamification: `xp_events`, `activity_log`, `daily_stats`, profile streak fields.

Required schema additions:

```sql
-- Dictionary, not enum: subskills will evolve with content.
create table public.ielts_subskills (
  code text primary key,
  skill public.ielts_skill not null,
  question_type public.ielts_question_type,
  label_en text not null,
  label_vi text not null,
  description_en text,
  description_vi text,
  band_floor numeric(2,1),
  band_ceiling numeric(2,1),
  tags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Queryable provenance so activities can point at the item bank without copying it.
create table public.ielts_activity_sources (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  source_type text not null check (source_type in (
    'ielts_question',
    'ielts_passage',
    'listening_section',
    'audio_asset',
    'writing_response',
    'speaking_response',
    'teacher_authored'
  )),
  source_id uuid,
  role text not null default 'primary',
  subskill_code text references public.ielts_subskills(code),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index public_ielts_activity_sources_activity_idx
  on public.ielts_activity_sources(activity_id, source_type, role);

-- Per-user mastery; explainable and cheap.
create table public.ielts_subskill_mastery (
  user_id uuid not null references public.profiles(id) on delete cascade,
  subskill_code text not null references public.ielts_subskills(code),
  mastery_score numeric(5,2) not null default 0 check (mastery_score between 0 and 100),
  confidence numeric(4,3) not null default 0 check (confidence between 0 and 1),
  attempts_count integer not null default 0,
  correct_count integer not null default 0,
  recent_accuracy numeric(5,2),
  last_practiced_at timestamptz,
  last_evidence jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, subskill_code)
);

-- Shared with Track C: the atoms Track C schedules.
create table public.ielts_review_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subskill_code text not null references public.ielts_subskills(code),
  source_type text not null,
  source_id uuid,
  due_at timestamptz not null default now(),
  interval_days numeric(8,2) not null default 0,
  ease_factor numeric(5,2) not null default 2.50,
  repetitions integer not null default 0,
  lapses integer not null default 0,
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'relearning', 'suspended', 'mastered')),
  priority_score numeric(8,3) not null default 0,
  last_grade integer check (last_grade between 0 and 5),
  last_reviewed_at timestamptz,
  fsrs_difficulty numeric(8,4),
  fsrs_stability numeric(8,4),
  fsrs_retrievability numeric(8,4),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AI-generated draft queue; teacher QA required before activities become published.
create table public.ielts_micro_item_drafts (
  id uuid primary key default gen_random_uuid(),
  source_question_id uuid references public.ielts_questions(id) on delete set null,
  source_passage_id uuid references public.passages(id) on delete set null,
  source_listening_section_id uuid references public.listening_sections(id) on delete set null,
  activity_type text not null,
  subskill_code text references public.ielts_subskills(code),
  draft_content jsonb not null,
  answer_key jsonb not null default '{}',
  rationale_en text,
  rationale_vi text,
  model_provider text,
  model_name text,
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'approved', 'rejected', 'published')),
  reviewer_id uuid references public.profiles(id) on delete set null,
  published_activity_id uuid references public.activities(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Important implementation calls:

- Ship/apply the existing `courses.subject` migration before relying on IELTS course paths. The local migration exists; live Main is behind.
- Expand `activities.activity_type` and `ActivityType` only after turning the existing switch-based activity engine into a registry map. That one-time engine refactor is subject-agnostic; all IELTS behavior lands in registered types.
- Do not put answer keys into `activities.content`. Micro-activity content may include public prompts/options and `ielts_activity_sources`; grading reads keys server-side.
- Add RLS for all new tables on the first migration. Learners can read their own mastery/review rows; admins manage taxonomy/drafts; teachers get org-scoped reads in the B2B PR.

### Mastery model

Subskill examples:

- `reading_tfng_verify_claim`
- `reading_matching_headings_main_idea`
- `reading_scan_specific_detail`
- `listening_numbers_dates`
- `listening_distractor_repair`
- `writing_task2_position_development`
- `writing_cohesion_reference`
- `writing_collocation_precision`
- `speaking_pronunciation_minimal_pairs`
- `speaking_fluency_extend_answer`

Update mastery after every Learn attempt and after every Assess result.

For each activity completion:

```ts
quality = 0..5
accuracy = score / maxScore
difficultyWeight = easy: 0.8, medium: 1.0, hard: 1.2
recencyWeight = exp(-daysSince / 21)
signal = (accuracy * 100 * difficultyWeight)
masteryScore = clamp(0, 100, 0.72 * old + 0.28 * signal)
confidence = clamp(0, 1, 1 - exp(-attemptsCount / 8)) * evidenceQuality
```

Evidence quality is higher for exam-authentic item-bank questions, lower for generated drafts, and highest for recent full mocks. Store `last_evidence` with an explainable envelope:

```json
{
  "reason": "Recent Reading mock missed 3/5 TFNG claim-verification items; today's drill was first-try correct.",
  "sources": [
    { "type": "ielts_attempt", "id": "..." },
    { "type": "activity_attempt", "id": "..." }
  ],
  "calculation": {
    "oldMastery": 48.2,
    "signal": 86.0,
    "newMastery": 58.8,
    "confidence": 0.62
  }
}
```

Mastery labels:

- `0-39`: Focus needed.
- `40-64`: Building.
- `65-84`: Test-ready with review.
- `85-100`: Mastered, keep on SRS.

Do not lock paid learners out of later content purely because mastery is low. Use soft guidance and teacher/learner override.

### Spaced-review scheduler

Ship a deterministic SM-2-like scheduler first because every due review can be explained in plain language. Keep FSRS-compatible fields for Track C's later upgrade.

Quality grade:

- `5`: correct first try, no hint, normal time.
- `4`: correct first try but slow, or minor spelling accepted.
- `3`: correct after hint/self-correction.
- `2`: incorrect but explanation viewed and learner marked "understood".
- `1`: incorrect attempt.
- `0`: blank/skipped.

Schedule update:

```ts
if grade < 3:
  repetitions = 0
  lapses += 1
  intervalDays = grade === 2 ? 1 : 0.25
  easeFactor = max(1.3, easeFactor - 0.2)
  state = "relearning"
else:
  repetitions += 1
  if repetitions === 1: intervalDays = 1
  else if repetitions === 2: intervalDays = 3
  else intervalDays = round(intervalDays * easeFactor)
  easeFactor = max(1.3, easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)))
  state = repetitions >= 3 ? "review" : "learning"

dueAt = now + min(intervalDays, daysUntilExam - 1)
```

Priority:

```ts
priority =
  overdueDays * 2.0 +
  weaknessWeight * 5.0 +
  examWeight * 3.0 +
  recentMissBoost +
  teacherAssignmentBoost -
  fatiguePenalty
```

Explanation examples:

- "Due today because you missed this collocation yesterday and it has not survived a review yet."
- "High priority because TFNG claim verification is your weakest Reading subskill and appears in your target mock."
- "Review, not new lesson: you have 7 due cards and your exam date is 18 days away."

Track C seam:

- Track C schedules `ielts_review_cards` and path lessons as the daily plan.
- Track D owns activity types and completion signals.
- Track B consumes `ielts_subskill_mastery` and Assess rows to synthesize weakness and band prediction.

### Authoring path

Extend WS-1.1 rather than creating a new authoring silo.

Authoring surfaces:

- Existing IELTS workbook/import gains optional `Subskill Code`, `Micro-activity candidates`, and `Learn mode notes`.
- Admin IELTS item editor gains a "Generate micro-items" action for published/approved questions.
- A "Micro-item drafts" queue lets teachers approve/reject/edit drafts before publish.

AI drafting rules:

- Use Gemini Flash / Groq first; no DeepSeek; Claude only for rubric-sensitive QA batches.
- Generate from existing original content only: passage, script, prompt, answer key, explanation, and model answer.
- Require provenance: source IDs, source text slice, answer-key dependency, generated rationale.
- Require bilingual EN/VI explanation.
- Never publish AI drafts automatically.
- Never copy answer keys into learner-visible `activities.content`.

Examples:

- From a `true_false_notgiven` question, draft a `ielts_paraphrase_transform` card and a `ielts_reading_skim_scan` card.
- From a `sentence_completion` question, draft an `ielts_gap_fill` card with the original word limit and accept variants.
- From a Listening script segment, draft a `ielts_listening_micro_clip` card around a distractor/correction.
- From a Writing response, draft `ielts_grammar_fix` and `ielts_vocab_collocation` cards tied to the learner's error categories.
- From a Speaking phoneme report, draft `ielts_pronunciation_minimal_pair` review cards for failed phonemes.

### UI surface

Use a work-focused, exam-prep UI. Keep it motivational, not childish.

IELTS home:

- "Today" panel with 1 path lesson, due reviews, and optional full mock CTA.
- "Why this today" rationale using recent mock/micro-activity evidence.
- Band profile teaser with transparent sources.
- Streak/XP reused from current dashboard components.

Path screen:

- Sections/units by skill and target band: Reading Foundations, Listening Accuracy, Writing Task 2, Speaking Fluency, etc.
- Unit nodes show mastery state and due-review count.
- Learners can browse, but the recommended next node stays visually primary.

Lesson player:

- 5-8 micro steps, 4-7 minutes.
- Top progress bar, XP/streak indicator, EN/VI toggle.
- One action per screen.
- Immediate feedback: correct answer, why, trap, next review date.
- For generated items, show "Based on: Reading Passage 2 / Matching Headings" to keep trust.

Review queue:

- "Due today", "From mistakes", and "Before your next mock".
- Let learners start a 3-minute, 7-minute, or "clear due" session.
- No lives. Misses go back into the queue with an explanation.

Results:

- After each lesson: XP, subskills changed, review cards scheduled, next suggestion.
- On IELTS results pages: show which Learn-mode activities address each missed subskill.

Teacher/B2B:

- Teachers assign units, daily goals, or review queues to classes.
- Teacher sees class heatmap by subskill and due-review compliance.

## Reuse map

| Need | Reuse | Add |
|---|---|---|
| Path/unit/activity spine | `courses`, `course_modules`, `activities` | Sync `courses.subject`; store IELTS path metadata. |
| Activity registration | `lib/activity/registry.ts`, `validators.ts`, `components/activities/*`, `ActivityPlayerWrapper` | Convert switch to registry interface; register IELTS types in an IELTS module. |
| IELTS item rendering | `registerIeltsRenderer`, `QuestionHost`, `components/ielts/questions/*` | Embed item-bank questions inside Learn cards by source refs. |
| Objective grading | `lib/scoring/ielts/*`, `ielts_question_keys` | Activity scorers delegate to existing normalizers/variant logic. |
| Writing/Speaking feedback | `writing_responses`, `speaking_responses`, AI scorer pipeline | Generate learner-specific review cards from scored responses. |
| Pronunciation | `lib/ielts/pronunciation/*`, `phoneme_report` | Minimal-pair Learn player and phoneme review scheduling. |
| Attempts/progress | `activity_attempts`, `ielts_attempts`, `attempt_band_scores` | Unioned repository/view for IELTS progress. |
| XP/streaks | `lib/xp/*`, `lib/streaks/*`, `xp_events`, `daily_stats`, profile streak fields | Add IELTS metadata and qualify Learn completions cleanly. |
| Authoring | WS-1.1 authoring/import, `create_ielts_question_with_key`, `ielts_content_versions` | Micro-item draft queue, source refs, subskill tags. |
| B2B assignment | `classes`, `clubs`, `club_assignments`, IELTS B2B migration | Assign Learn units/review queues as class work. |
| Ability precedent | `duel_mmr_profiles`, duel rating/server-clock migrations | Use as design precedent for explainable updates; do not reuse duel tables. |

## Port-vs-build call

Base on Lumist:

- Lesson-chunk authoring ideas: localized chunks, progressive reveal, `TEXT` / `QUESTION` / `CHART` / `ANNOTATE`, inline question editing, JSON paste/import, and the IELTS Reading lesson prototype.
- Weekly-plan scar tissue: diagnostic gate, selected study days, race guard/idempotency, duplicate-topic avoidance, "remaining days this week", and error-bank insertion.
- Skill-signal shape: `weakness_weight`, `confidence_score`, `source`, expiry, and explicit limitations.
- Error/review bank behavior: auto-add misses, dedupe, correction status, learner reflection notes.

Build native in DebateLab:

- The registered activity types and players.
- The `ielts_subskills`, mastery, SRS, and activity source-ref tables.
- The scheduler and daily Learn plan on `activity_attempts ∪ ielts_attempts`.
- The authoring workflow around `ielts_questions`, not Lumist `questions`.
- The XP/streak integration through `lib/xp` and `lib/streaks`.
- The UI in Thinkfy's IELTS shell, behind `IELTS_ENABLED`.

Why:

- Lumist's concepts are useful, but its implementation is SAT-first and Prisma-first.
- DebateLab already has the engine, item bank, grading, AI pipeline, RLS conventions, and gamification.
- Native build preserves masterplan engine-purity and avoids divergent item banks.

## Phased build plan

### WS-D.1 — Activity registry foundation

Scope: one PR.

- Convert `lib/activity/registry.ts`, `validators.ts`, `ActivityPlayerWrapper`, and `app/actions/activities.ts` from switch-only handling to a typed registry interface: `{ type, defaultPhase, defaultContent, validate, score, Player }`.
- Keep the six existing activity types byte-identical in behavior.
- Add tests proving existing activities score the same.
- Do not add IELTS-specific behavior in this PR.

Done: current activities pass existing tests; a dummy registered type can validate/score in unit tests.

### WS-D.2 — IELTS subject/path schema sync

Scope: one PR.

- Ensure `courses.subject` is applied to the target DB and typed.
- Add `ielts_subskills` and seed the v1 taxonomy.
- Add path metadata conventions for IELTS courses/modules.
- Add RLS policies and generated types.

Done: live/local schema agree; IELTS paths can be queried separately from debate; debate courses remain unchanged.

### WS-D.3 — Activity source refs and first text micro-types

Scope: one PR.

- Add `ielts_activity_sources`.
- Register `ielts_vocab_collocation`, `ielts_paraphrase_transform`, and `ielts_gap_fill`.
- Implement Zod schemas, players, deterministic scorers, and authoring previews.
- Ensure answer keys stay server-side.

Done: teacher can create a published activity pointing at `ielts_questions`; learner can complete it; `activity_attempts` stores response/score.

### WS-D.4 — Mastery + SRS tables

Scope: one PR.

- Add `ielts_subskill_mastery` and `ielts_review_cards`.
- Implement mastery update and SM-2-like scheduler in `lib/api/ielts/learn`.
- Add explainability envelope.
- Unit-test quality grades, intervals, lapses, caps, and mastery update math.

Done: activity completion updates mastery and creates/updates due review cards.

### WS-D.5 — IELTS Learn repositories and progress union

Scope: one PR.

- Add typed repositories for Learn home, path, due reviews, and progress.
- Implement `activity_attempts ∪ ielts_attempts` aggregation.
- Include live feature flag gating through `IELTS_ENABLED`.

Done: API returns path progress, due reviews, recent Learn attempts, recent Assess attempts, and explainable next recommendation.

### WS-D.6 — Learner UI: Today, path, lesson result

Scope: one PR.

- Add IELTS Learn home sections: Today, due review, path progress, recent Learn.
- Add path/unit screen.
- Add lesson completion screen with XP, mastery delta, and next due date.
- Reuse existing dashboard/streak/XP components.

Done: learner can enter Learn mode from `/ielts`, complete one activity, and see updated progress.

### WS-D.7 — Authoring extension + AI draft queue

Scope: one PR.

- Add `ielts_micro_item_drafts`.
- Extend WS-1.1 authoring/import with subskill tags and micro-item draft actions.
- Add cheap-first AI draft generation from published item-bank content.
- Add teacher QA/edit/publish workflow.

Done: AI can draft micro-items from an IELTS question/passage; teacher can approve into an `activities` row with source refs.

### WS-D.8 — Listening micro-clips

Scope: one PR.

- Register `ielts_listening_micro_clip`.
- Add script segment metadata and audio clip offsets, without duplicating audio assets.
- Implement player with replay count and deterministic grading.

Done: a learner completes a 15-45 second listening drill from a Listening section; replay count is captured.

### WS-D.9 — Pronunciation minimal pairs

Scope: one PR.

- Register `ielts_pronunciation_minimal_pair`.
- Reuse existing Azure phoneme service and typed phoneme report.
- Add target phoneme/minimal-pair metadata and per-sound feedback.
- Keep model/phoneme cost metered.

Done: a learner records a minimal-pair item and gets phoneme-level feedback plus review scheduling.

### WS-D.10 — Reading skim/scan and grammar-fix

Scope: one PR.

- Register `ielts_reading_skim_scan` and `ielts_grammar_fix`.
- Add paragraph/evidence selection UI for skim/scan.
- Add grammar error-category schema and deterministic choices first.

Done: both activity types publish, score, update mastery, and feed SRS.

### WS-D.11 — XP/streak/analytics integration

Scope: one PR.

- Add IELTS Learn metadata to `awardXpEvent`.
- Decide whether to keep `activity_type='lesson_completed'` with `metadata.subject='ielts'` or add a new constrained `ielts_learn_completed` event. Recommendation: keep `lesson_completed` for streak compatibility, add metadata, and only add a new event type if analytics needs a distinct constraint value.
- Update streak qualification tests to include IELTS Learn completions.
- Add analytics events for due reviews, lesson start/complete, mastery updates.

Done: IELTS Learn completions award XP once, count toward streaks, update `daily_stats`, and are filterable by subject.

### WS-D.12 — Unit checkpoints and teacher assignment

Scope: one PR.

- Add unit checkpoint activities that mix due review + unseen items.
- Let teachers assign IELTS Learn units/review queues to classes.
- Add class progress heatmap by subskill.

Done: teacher assigns a Learn unit; students complete it; teacher sees mastery and completion.

### WS-D.13 — Track B/C integration contract

Scope: one PR.

- Publish a typed contract for Track B weakness profile inputs and Track C scheduling atoms.
- Include examples from `activity_attempts`, `ielts_attempts`, `writing_responses`, `speaking_responses`, `ielts_subskill_mastery`, and `ielts_review_cards`.
- Add fixture tests.

Done: Track B and Track C can consume Learn-mode signals without reaching into UI code.

## Risks and open questions

Risks:

- Live schema drift: Main has IELTS tables but not `courses.subject`. Schema sync must happen before path work.
- Existing activity engine is not yet a true registry; the first PR must generalize it without changing debate behavior.
- Content volume is the real launch bottleneck. Empty live `ielts_questions` means Learn mode needs AI-assisted draft tooling plus teacher QA early.
- Generated micro-items can create subtle wrong answers. Require source provenance, answer-key separation, and QA before publish.
- Too much gamification can reduce trust. Keep rewards secondary to band progress.
- Pronunciation micro-drills can get expensive if every attempt calls Azure. Batch, cache, and meter; use lightweight local/TTS-only practice where full phoneme scoring is unnecessary.
- SRS can overwhelm near exam day. Cap daily review load and explain tradeoffs.
- Mastery confidence will be low at launch because there is little attempt data. UI must say "early signal" until enough evidence exists.

Open questions:

- Should IELTS Learn paths be one default Academic path plus GT overlays, or separate Academic/GT paths from day one?
- What is the minimum seed taxonomy teachers can maintain: 25 subskills, 40, or more?
- Should leagues be disabled globally for IELTS at launch, org-only, or reused quietly through XP totals?
- How much learner freedom should paid B2C users have to jump ahead versus following the recommended path?
- Should AI-generated learner-specific grammar cards from Writing responses require teacher review in B2B classes, or can they be private learner-only drafts?
- What daily default should VN-first IELTS learners see: 10 XP / 5 minutes, or a target tied to exam date and band gap?
- When Track C adopts FSRS, do we migrate existing SM-2 fields or run FSRS only after a minimum review-history threshold?

## Source notes

Local DebateLab/Thinkfy:

- `docs/ielts-masterplan.md`
- `docs/ielts/data-access.md`
- `docs/ielts-content-authoring-spec.md`
- `supabase/migrations/20260618205215_ielts_data_model.sql`
- `supabase/migrations/20260619153000_courses_subject_axis.sql`
- `supabase/migrations/20260620120000_ielts_authoring.sql`
- `supabase/migrations/20260620120000_ielts_mock_engine.sql`
- `apps/web/src/lib/activity/registry.ts`
- `apps/web/src/app/actions/activities.ts`
- `apps/web/src/components/activities/*`
- `apps/web/src/components/ielts/question-renderer-registry.tsx`
- `apps/web/src/components/ielts/questions/register-task-renderers.ts`
- `apps/web/src/lib/xp/*`
- `apps/web/src/lib/streaks/*`
- `apps/web/src/lib/ielts/*`
- `apps/web/src/lib/scoring/ielts*`

Local Lumist reference:

- `/Users/jacknguyen/Developer/app-lumist-ai/features/ai-tutor/services/server/weekly-plan-server.service.ts`
- `/Users/jacknguyen/Developer/app-lumist-ai/features/ai-tutor/services/server/student-skill-signal.service.ts`
- `/Users/jacknguyen/Developer/app-lumist-ai/features/ai-tutor/services/server/planning-evidence.service.ts`
- `/Users/jacknguyen/Developer/app-lumist-ai/features/review/services/server/*`
- `/Users/jacknguyen/Developer/app-lumist-ai/features/lesson/types.ts`
- `/Users/jacknguyen/Developer/app-lumist-ai/features/lesson/components/LessonChunkRenderer.tsx`
- `/Users/jacknguyen/Developer/app-lumist-ai/features/lesson/components/ChunkEditor.tsx`
- `/Users/jacknguyen/Developer/app-lumist-ai/features/lesson/test-ielts-reading-lesson.json`

External:

- [IELTS scoring in detail](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail)
- [IELTS score-setting resources](https://ielts.org/organisations/ielts-for-organisations/understanding-ielts-scoring/resources-for-setting-your-ielts-scores)
- [Duolingo path redesign](https://blog.duolingo.com/new-duolingo-home-screen-design/)
- [Duolingo 101](https://blog.duolingo.com/duolingo-101-how-to-learn-a-language-on-duolingo/)
- [Duolingo mini-units](https://blog.duolingo.com/intermediate-mini-units/)
- [Duolingo Energy](https://blog.duolingo.com/duolingo-energy/)
- [Brilliant Learning Paths](https://brilliant.org/help/features/what-are-learning-paths/)
- [Brilliant Product Features](https://brilliant.org/help/features/)
- [Brilliant Basics](https://brilliant.org/help/using-brilliant/)
- [SuperMemo Algorithm](https://help.supermemo.org/wiki/SuperMemo_Algorithm)
- [Free Spaced Repetition Scheduler](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler)
- [Mastery learning overview](https://ascopost.com/issues/september-10-2016/mastery-learning-a-new-paradigm-for-oncology-medical-education/)
