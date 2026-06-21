# IELTS Band Prediction Model - Track B

Status: research/design recommendation for the next build wave. No production code in this PR.
Date: 2026-06-20.
Target branch: `ielts`.

## Recommendation

Build the IELTS band predictor natively in DebateLab as an explainable, read-optimized learner model:

1. Estimate each skill with a weighted-recency model over real IELTS evidence.
2. Compute overall from the four predicted skill bands using the official IELTS overall aggregation rule.
3. Attach a half-band confidence range, trend, and evidence explanation to every skill.
4. Emit a per-skill and per-subskill weakness profile as Track C's primary input.
5. Keep the first release deterministic and cheap. Do not call an LLM to predict bands.
6. Add an IRT/Elo-style ability engine later, after there is enough IELTS item-response volume to calibrate item difficulty.

Do not port Lumist's SAT predictor code. Borrow its useful design shape - recency-weighted evidence, volume saturation, trend, confidence, and component-level explanations - but re-express the model around DebateLab's IELTS tables, official band math, and RLS/typed repository conventions.

## Findings

### DebateLab and the shipped IELTS engine

The `ielts` branch already has the right substrate for an explainable predictor.

Core IELTS data:

- `ielts_attempts`: attempt shell, status, module, started/submitted/completed times, optional class/assignment links, and an `activity_attempt_id` bridge.
- `attempt_band_scores`: official-ish result transcript per attempt, with typed columns for `listening_raw`, `reading_raw`, four skill bands, and `overall_band`.
- `writing_responses`: typed per-criterion bands: Task Response/Achievement, Coherence and Cohesion, Lexical Resource, Grammar, plus task band, feedback envelopes, reviewer override fields, model metadata, and status.
- `speaking_responses`: typed per-criterion bands: Fluency and Coherence, Lexical Resource, Grammar, Pronunciation, plus per-part speaking band, `phoneme_report`, feedback, reviewer override fields, STT/model metadata, and status.
- `ielts_question_responses`: objective response rows with `is_correct`, `awarded_points`, and timestamps.
- `ielts_questions`: the canonical item bank, with `skill`, `question_type`, `max_points`, and metadata. This is the right place to attach future subskill tags.
- `band_conversions`: raw-to-band lookup for Listening, Academic Reading, and General Training Reading.

Reusable code:

- Official aggregation and conversion helpers already exist in `apps/web/src/lib/scoring/ielts/overall-band.ts` and `apps/web/src/lib/scoring/ielts/band-conversion.ts`.
- Writing and Speaking official-ish task/part rollups already exist in `apps/web/src/lib/scoring/ielts-writing/band-math.ts` and `apps/web/src/lib/scoring/ielts-speaking/band-math.ts`.
- Result reads already go through typed repositories in `apps/web/src/lib/api/ielts/results-repository.ts`, and the result view-model already separates pure shaping in `apps/web/src/lib/ielts/results/*`.
- The learner home already loads recent attempts through `apps/web/src/lib/api/ielts/learner-repository.ts` and displays the latest overall via `apps/web/src/components/ielts/learner/IeltsHome.tsx`.
- The activity engine and question-renderer seam are already in place: `apps/web/src/lib/activity/registry.ts`, `apps/web/src/components/ielts/question-renderer-registry.tsx`, and `apps/web/src/components/ielts/questions/*`.
- Existing gamification lives in `apps/web/src/lib/xp/*` and `apps/web/src/lib/streaks/*`. Use it for motivation signals and dashboard context, but do not make XP/streaks primary band evidence.
- The AI scoring pipeline already exists in `apps/web/src/lib/practice-analysis/*` and IELTS-specific W/S scorer modules. Prediction should read the scorer outputs, not invoke the scorer again.
- The duel MMR system is a useful precedent for a later ability model: `duel_mmr_profiles`, `duel_rating_events`, and `process_debate_duel_rating_internal` show how DebateLab stores hidden proficiency state, event history, provisional state, K-factor-like sensitivity, and shadow calibration.

Important architectural constraint:

- Learn-mode must remain registered activity types and IELTS modules, not core activity-engine edits. The predictor should read the union of Learn and Assess evidence through repositories, but the activity engine stays subject-agnostic.

### Live Supabase inventory

Read-only aggregate queries against live Supabase project `DebateLab - Main` (`rsbnryympenjyzhhchhu`) on 2026-06-20 showed:

| Table | Rows | Prediction relevance |
|---|---:|---|
| `ielts_attempts` | 0 | No live IELTS sittings yet. |
| `attempt_band_scores` | 0 | No live official skill-band rows yet. |
| `writing_responses` | 0 | No live Writing criterion evidence yet. |
| `speaking_responses` | 0 | No live Speaking/phoneme evidence yet. |
| `ielts_question_responses` | 0 | No live objective IELTS item evidence yet. |
| `ielts_questions` | 0 | Item bank unseeded in live DB. |
| `band_conversions` | 51 | Default conversion rows are seeded: 17 Listening, 17 Academic Reading, 17 GT Reading. |
| `activity_attempts` | 16 | Existing debate Learn-mode activity evidence only. |
| `practice_attempts` | 28 | Existing debate/speaking practice evidence only. |
| `duel_mmr_profiles` | 1 | Rating precedent exists; not useful for IELTS prediction data yet. |
| `duel_rating_events` | 0 | No rating event volume yet. |

Existing non-IELTS signals:

- `practice_attempts`: 28 rows from 2026-05-22 through 2026-06-19. Completed debate attempts average about 69/100 in English and Vietnamese; two completed English speaking attempts average 42/100; two Vietnamese speaking attempts average 79/100. The `overall_band` field is categorical debate language feedback such as `Competent` or `Developing`, not IELTS numeric bands.
- `activity_attempts`: 16 rows from 2026-03-23 through 2026-03-24, all beginner debate course activities. Average score ratio is 0.7292, but these are not IELTS item responses.
- `practice_attempts.attempt_snapshot` consistently has `schemaVersion`, `capturedAt`, `session`, and `analysisParams`, which is useful for audit and cold-start context.

Interpretation:

- Production has the schema but not the IELTS learner data. The first prediction release must be honest about cold start.
- Debate history can only be a weak prior for study readiness or English-speaking confidence. It must not be presented as a real IELTS band prediction.
- The product should push a short four-skill diagnostic before showing an overall predicted band with medium confidence.

### Lumist reference

Relevant files inspected in `/Users/jacknguyen/Developer/app-lumist-ai`:

- `lib/services/satScorePredictor.ts`: a first-generation weighted formula using recency-weighted mocks/homework, volume saturation, mastery counts, regularity, study hours, vocabulary, streaks, and variance penalty.
- `lib/services/dualSectionSATPredictor.ts`: a better v2 version with section-level predictions, IRT-inspired difficulty weighting, performance trend, difficulty progression, topic coverage, consistency, volume saturation, vocabulary/streak terms, and a confidence factor based on evidence volume.
- `lib/services/dualSectionDataService.ts`: data gathering that excludes repeats and zero-information attempts, separates mocks from homework, extracts section scores from messy shapes, dedupes mastered questions, tracks topic coverage, tracks last-30-day difficulty distribution, and computes study hours.
- `features/ai-tutor/services/server/planning-evidence.service.ts`: maps report dimensions to available task topics with confidence, limitations, and unmapped skills.
- `features/ai-tutor/services/server/weekly-plan-server.service.ts`: gates weekly plan generation behind diagnostic/mock completion, uses task weights/fallbacks, and guards generation against races.
- `features/review/services/server/auto-add-review-questions.ts`: upserts incorrect questions into an error bank.

What Lumist gets right:

- The prediction is explainable: every component has a value and weighted contribution.
- Recency matters, but old evidence is not discarded.
- Volume improves confidence but saturates.
- Variance and limited evidence reduce confidence.
- Planning evidence is explicit about unmapped dimensions.

What not to port:

- SAT-specific scales, two-section assumptions, hardcoded topic counts, and SAT difficulty names.
- Prisma data access and Lumist's table shapes.
- The exact weights. They are not calibrated for IELTS and would create false precision.
- Streak/vocabulary bonuses as direct score boosts. For IELTS, those should inform engagement and plan adherence, not inflate predicted bands.

### Field research

Official IELTS scoring anchors:

- IELTS Listening and Reading have 40 questions, one mark per correct answer, then conversion to the 9-band scale. IELTS states that exact raw marks can vary by test version; DebateLab's `band_conversions.conversion_key` should therefore remain the source of truth for a specific test. Source: [IELTS scoring in detail](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail).
- Overall IELTS is the average of the four section bands, rounded to the nearest half band; .25 rounds to the next half and .75 to the next whole. Source: [IELTS Australia band score calculation](https://ielts.com.au/australia/results/band-score-calculation) and [IDP IELTS scores](https://ielts.idp.com/results/scores).
- Public raw-band tables for Listening and Reading are useful anchors, but they are average/representative tables. Sources: [IDP Vietnam Listening table](https://ielts.idp.com/vietnam/results/scores/listening/en-gb) and [IDP Reading table](https://ielts.idp.com/southafrica/results/scores/reading).
- Writing is assessed by four criteria and Task 2 carries more weight than Task 1. Source: [IELTS scoring in detail](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail) and [British Council Writing band descriptors PDF](https://takeielts.britishcouncil.org/sites/default/files/ielts_writing_band_descriptors.pdf).
- Speaking uses four equally weighted criteria: Fluency and Coherence, Lexical Resource, Grammatical Range and Accuracy, and Pronunciation. Source: [IDP Speaking scores](https://ielts.idp.com/results/scores/speaking).

Modeling methods:

- Weighted recency/EWMA is the right baseline because it is cheap, explainable, robust with little data, and can use the shipped result rows immediately.
- Regression can improve calibration once there are enough attempts, but an uncalibrated regression will be less explainable than the baseline and fragile with sparse early data.
- IRT/Rasch is the right long-term model for objective item responses because it estimates learner ability and item difficulty on a common latent scale. Source: [Columbia IRT overview](https://www.publichealth.columbia.edu/research/population-health-methods/item-response-theory).
- Elo-style online updates are a practical intermediate path for adaptive learning because they are simple, order-sensitive, and update per response. A multivariate Elo learner model is particularly relevant when items have multiple tags. Source: [Abdi et al., Multivariate Elo-based Learner Model](https://files.eric.ed.gov/fulltext/ED599177.pdf).
- Spaced repetition models such as SM-2 and FSRS are useful for Track C's study plan and weakness remediation scheduling, not for converting evidence into IELTS bands. Sources: [SuperMemo SM-2](https://super-memory.com/english/ol/sm2.htm) and [FSRS algorithm wiki](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm).
- Deliberate practice and mastery learning support the product loop: diagnostic measurement, focused tasks at an appropriate difficulty, reliable measurement, and actionable feedback. Source: [McGaghie et al.](https://www.journalofexpertise.org/articles/volume4_issue2/JoE_4_2_McGaghie_etal.pdf).

## Recommended Design

### Product behavior

The learner-facing language should be:

- "Predicted IELTS band" only when the estimate is based on IELTS evidence.
- "Diagnostic needed" when there are no IELTS skill observations.
- "Low confidence" when the estimate relies on only one skill, one task, old data, or non-IELTS priors.
- "Updates after each mock, drill, Writing score, and Speaking score."

The predictor should never claim to be an official IELTS score. It is a forecast of the next comparable DebateLab IELTS mock under current conditions.

### Signals to read

Primary evidence, by reliability:

| Signal | Tables | Skills | Reliability | Notes |
|---|---|---|---:|---|
| Completed full/skill IELTS attempts | `ielts_attempts`, `attempt_band_scores` | L/R/W/S + overall | 1.00 | Best evidence. Official aggregation already stored. |
| Writing task score | `writing_responses` | Writing + criteria | 0.75 AI, 0.95 teacher override | Use task band and criteria. Task 2 has more predictive value for full Writing. |
| Speaking part score | `speaking_responses` | Speaking + criteria + phoneme | 0.70 AI, 0.95 teacher override | Use part bands and criteria; full three-part attempts get higher coverage. |
| Objective IELTS item responses | `ielts_question_responses`, `ielts_questions`, `band_conversions` | Listening/Reading + question type/subskill | 0.45 to 0.70 | Higher if a timed 40-question section; lower for tiny drills. |
| Learn-mode IELTS activities | `activity_attempts` joined to `activities` metadata that points to `ielts_questions` or `ielts_skill` | Depends on metadata | 0.25 to 0.45 | Requires WS-B.1 metadata contract. |
| Existing DebateLab practice | `practice_attempts`, `activity_attempts` | Cold-start only | 0.05 to 0.15 | Use for readiness copy, not medium/high confidence bands. |
| XP/streaks | `activity_log`, `lib/xp`, `lib/streaks` | Motivation/recency context | 0.00 as score evidence | Useful for Track C adherence, not band math. |

Subskill evidence:

- Listening/Reading: derive weakness by `ielts_questions.skill`, `question_type`, and future `metadata.subskill_tags`.
- Writing: use `task_response_band`, `coherence_cohesion_band`, `lexical_resource_band`, `grammar_band`, `word_count`, and status/reviewer fields.
- Speaking: use `fluency_coherence_band`, `lexical_resource_band`, `grammar_band`, `pronunciation_band`, `speaking_band`, `phoneme_report`, status/reviewer fields, and STT/model metadata.

### Output shape

Implement a pure serializable contract in `apps/web/src/lib/ielts/band-prediction/types.ts`.

```ts
export type IeltsPredictionStatus =
  | "diagnostic_needed"
  | "low_confidence"
  | "medium_confidence"
  | "high_confidence";

export type IeltsTrendDirection = "up" | "down" | "flat" | "unknown";

export interface IeltsBandEstimate {
  band: number | null;
  lower: number | null;
  upper: number | null;
  confidence: number; // 0..1, model confidence rather than official certainty
  status: IeltsPredictionStatus;
  trend: {
    direction: IeltsTrendDirection;
    delta30d: number | null; // band points per 30 days
    evidencePoints: number;
    explanation: string;
  };
  evidence: Array<{
    source:
      | "full_mock"
      | "skill_mock"
      | "writing_task"
      | "speaking_part"
      | "objective_drill"
      | "learn_activity"
      | "debate_prior";
    label: string;
    band: number | null;
    rawScore: number | null;
    weight: number;
    occurredAt: string;
    explanation: string;
  }>;
  explanation: string[];
}

export interface IeltsWeaknessSignal {
  skill: "listening" | "reading" | "writing" | "speaking";
  key: string; // e.g. reading:matching_headings, writing:coherence_cohesion
  labelEn: string;
  labelVi: string;
  severity: "watch" | "weak" | "critical";
  confidence: number;
  evidenceCount: number;
  currentValue: number | null;
  targetValue: number | null;
  reasonEn: string;
  reasonVi: string;
  recommendedActivityFilters: {
    skill: string;
    questionTypes?: string[];
    criteria?: string[];
    subskillTags?: string[];
  };
}

export interface IeltsBandPrediction {
  userId: string;
  asOf: string;
  modelVersion: "weighted-recency-v1";
  module: "academic" | "general_training";
  overall: IeltsBandEstimate;
  skills: {
    listening: IeltsBandEstimate;
    reading: IeltsBandEstimate;
    writing: IeltsBandEstimate;
    speaking: IeltsBandEstimate;
  };
  weaknesses: IeltsWeaknessSignal[];
  limitations: string[];
  nextBestDiagnostic: {
    required: boolean;
    skill: "listening" | "reading" | "writing" | "speaking" | "full_mock" | null;
    reasonEn: string;
    reasonVi: string;
  };
}
```

Track C should depend on this interface, not on raw SQL. The planned data-access function should be:

```ts
export async function loadIeltsPredictionForPlanning(
  userId: string,
  options?: { module?: "academic" | "general_training"; targetBand?: number },
): Promise<IeltsBandPrediction>;
```

### Algorithm

Use `weighted-recency-v1`.

#### 1. Convert raw observations into skill evidence

Each observation has:

```ts
{
  skill,
  band,          // nullable for pure accuracy signals until converted
  occurredAt,
  reliability,   // source trust, 0..1
  coverage,      // how exam-like this observation is, 0..1
  subskills,
  explanation
}
```

Rules:

- Full IELTS attempt skill bands from `attempt_band_scores` enter directly as band observations.
- Objective section attempts use stored `listening_band` and `reading_band`.
- Writing tasks use `task_band`; a full Writing skill observation uses the existing `writingOverallBand` helper over Task 1 and Task 2.
- Speaking parts use `speaking_band`; a full Speaking skill observation uses `attemptSpeakingBand` over available parts.
- Objective drills become a pseudo-band only when there are enough questions in the same skill. For a timed or near-full 40-question section, use the same `band_conversions` conversion. For small drills, convert accuracy to a soft pseudo-band using the local conversion table but cap reliability at 0.45 unless item difficulty calibration exists.
- Debate/practice history can seed a cold-start prior only. It should never push a skill above `low_confidence`.

#### 2. Apply recency weighting

Use exponential decay:

```txt
recencyWeight = exp(-daysAgo / halfLifeDays)
effectiveWeight = reliability * coverage * recencyWeight
```

Recommended half-lives:

- Full/skill IELTS mock: 75 days.
- Writing/Speaking scored tasks: 60 days.
- Objective drills/Learn activities: 45 days.
- Debate prior: 30 days, and only for cold start.

Rationale: skill evidence should not evaporate weekly, but a three-month-old mock should be weaker than last week's attempt.

#### 3. Estimate each skill

For each skill:

```txt
estimatedSkillBand = roundToHalfBand(sum(band_i * effectiveWeight_i) / sum(effectiveWeight_i))
```

If there is no IELTS evidence:

- `band = null`
- `status = diagnostic_needed`
- optional debate/practice evidence appears only in `evidence` and `limitations`.

If there is one weak IELTS observation:

- show the band and a wide range.
- `status = low_confidence`.

#### 4. Confidence and range

Compute skill confidence from evidence volume, quality, recency, and stability:

```txt
effectiveSampleSize = (sum(w)^2) / sum(w^2)
quality = min(1, sum(effectiveWeight) / 2.5)
recency = max(recencyWeight among IELTS observations)
stabilityPenalty = min(0.25, stddev(recentBands) / 4)
confidence = clamp(0, 1, 0.15 + 0.35*quality + 0.25*min(1, effectiveSampleSize/4) + 0.25*recency - stabilityPenalty)
```

Initial confidence bands:

| Confidence | Status | Skill range half-width |
|---:|---|---:|
| `< 0.30` | `diagnostic_needed` or `low_confidence` | 1.5 to 2.0 bands |
| `0.30..0.55` | `low_confidence` | 1.0 band |
| `0.55..0.80` | `medium_confidence` | 0.5 to 1.0 band |
| `>= 0.80` | `high_confidence` | 0.5 band |

This is not a statistical 95% confidence interval until validation data exists. In the UI call it a "confidence range"; in code store enough metadata to calibrate it later.

#### 5. Trend

Trend requires at least three dated IELTS observations for the skill in the last 120 days.

- Fit a simple least-squares slope of band over time.
- Report `delta30d = slope * 30`.
- `up` if `delta30d >= 0.25`, `down` if `<= -0.25`, otherwise `flat`.
- With two observations, show a low-confidence compare-last-two trend.
- With fewer than two IELTS observations, `unknown`.

#### 6. Overall

Do not average official attempt overall rows for the current prediction. Instead:

1. Estimate each skill independently.
2. If all four skill estimates are present, compute overall using `computeOverallBand`.
3. Compute the lower and upper overall range by aggregating the four skill lower/upper values with the same official aggregation helper.
4. Overall confidence is the minimum of the four skill confidences, softened by coverage:

```txt
overallConfidence = min(skill.confidence) * (0.75 + 0.25 * completeSkillCount / 4)
```

If one or more skills are missing:

- `overall.band = null`
- `status = diagnostic_needed`
- `nextBestDiagnostic` points to the missing skill with the least evidence, or `full_mock` when two or more skills are missing.

This is stricter than Lumist and intentionally so. IELTS overall is a four-skill measure; faking missing skills would damage trust.

### Data model

Phase 1 can compute at read time from existing tables. Add a cache table only when the dashboard and Track C plan generation both consume the profile.

Recommended cache table for Phase 2:

```sql
create table public.learner_band_profiles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  module public.ielts_module not null default 'academic',
  model_version text not null,
  computed_at timestamptz not null default now(),

  listening_band numeric(2,1),
  listening_lower numeric(2,1),
  listening_upper numeric(2,1),
  listening_confidence numeric(4,3) not null default 0,
  listening_trend_30d numeric(3,2),

  reading_band numeric(2,1),
  reading_lower numeric(2,1),
  reading_upper numeric(2,1),
  reading_confidence numeric(4,3) not null default 0,
  reading_trend_30d numeric(3,2),

  writing_band numeric(2,1),
  writing_lower numeric(2,1),
  writing_upper numeric(2,1),
  writing_confidence numeric(4,3) not null default 0,
  writing_trend_30d numeric(3,2),

  speaking_band numeric(2,1),
  speaking_lower numeric(2,1),
  speaking_upper numeric(2,1),
  speaking_confidence numeric(4,3) not null default 0,
  speaking_trend_30d numeric(3,2),

  overall_band numeric(2,1),
  overall_lower numeric(2,1),
  overall_upper numeric(2,1),
  overall_confidence numeric(4,3) not null default 0,

  evidence_counts jsonb not null default '{}'::jsonb,
  weakness_profile jsonb not null default '[]'::jsonb,
  explanation jsonb not null default '{}'::jsonb,
  limitations jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, module)
);
```

Quality-bar notes:

- Score/band values are typed numeric columns, not JSON.
- JSON is acceptable for explanation, evidence summaries, and weakness lists, provided Zod validates the shape at repository boundaries.
- RLS: learner SELECT-own; service-role/admin manage; class/teacher policies can be added only if B2B needs teacher visibility.
- Use typed clients and a repository such as `apps/web/src/lib/api/ielts/band-prediction-repository.ts`.

Optional event table for validation:

```sql
create table public.ielts_band_prediction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid references public.ielts_attempts(id) on delete set null,
  model_version text not null,
  prediction_kind text not null check (prediction_kind in ('pre_attempt', 'post_attempt', 'daily_snapshot')),
  predicted_overall_band numeric(2,1),
  predicted_listening_band numeric(2,1),
  predicted_reading_band numeric(2,1),
  predicted_writing_band numeric(2,1),
  predicted_speaking_band numeric(2,1),
  confidence numeric(4,3) not null default 0,
  range_half_width numeric(2,1),
  actual_overall_band numeric(2,1),
  actual_listening_band numeric(2,1),
  actual_reading_band numeric(2,1),
  actual_writing_band numeric(2,1),
  actual_speaking_band numeric(2,1),
  evaluated_at timestamptz,
  created_at timestamptz not null default now()
);
```

This table is for aggregate validation and admin calibration, not learner display.

### UI surfaces

Dashboard / IELTS home:

- Replace "latest overall band" with two adjacent readouts:
  - "Latest official mock" from `attempt_band_scores`.
  - "Predicted next band" from `IeltsBandPrediction`.
- Show range and status: e.g. `6.5 (likely 6.0-7.0)`, `Medium confidence`.
- Show a two-line explanation: "Based mostly on your last full mock and two Writing tasks. Speaking range is wider because only Part 2 has been scored."
- If cold-start: show "Complete a 20-minute diagnostic to unlock prediction" and link to the diagnostic/full mock.

Attempt results:

- Add a "What this means for your predicted band" section below official results.
- If a Writing/Speaking score arrives async, show the prediction updating after the scorer finishes.
- Keep official result styling visually distinct from prediction.

Track C study plan:

- The top of the plan should show the weakest skill and the top 3 weakness signals with reasons.
- Example: "Reading: matching headings is critical because 2/7 recent items were correct and it is pulling the Reading estimate below your target 7.0."

Admin/B2B:

- Teacher view should show predicted band only when the learner has shared class/assignment context or teacher RLS policies cover the attempt.
- Teacher override of W/S responses should trigger recomputation and validation-event capture.

### Reuse map

| Need | Reuse | Build native |
|---|---|---|
| Official overall aggregation | `apps/web/src/lib/scoring/ielts/overall-band.ts` | Add prediction range aggregation around it. |
| R/L raw-to-band anchors | `apps/web/src/lib/scoring/ielts/band-conversion.ts`, `band_conversions` | Add drill pseudo-band logic with reliability caps. |
| W/S criterion bands | `writing_responses`, `speaking_responses`, W/S band math modules | Add extraction into evidence atoms and weakness signals. |
| Objective item accuracy | `ielts_question_responses`, `ielts_questions` | Add metadata contract for subskill tags and Learn-mode question links. |
| Learner home/results | `IeltsHome`, `RecentAttempts`, `IeltsResultsView`, result view-models | Add predicted-band card and explanation components. |
| Data access | `lib/api/ielts/*-repository.ts`, typed Supabase clients | Add `band-prediction-repository.ts` and pure model modules. |
| Gamification | `lib/xp/*`, `lib/streaks/*`, `activity_log` | Use as adherence context only; no score inflation. |
| AI scorer outputs | Existing practice-analysis pipeline and IELTS scorer modules | Read model metadata and scored bands; no prediction LLM. |
| Future ability estimation | `duel_mmr_profiles`, `duel_rating_events` precedent | Add IELTS item/ability profile only after response volume exists. |
| Lumist predictor | Conceptual recency/volume/trend/confidence pattern | Do not port code or weights. |

## Port-vs-build Call

### Base on Lumist

Use these ideas:

- Componentized explanations: every prediction includes inputs and weights.
- Exponential recency weighting.
- Volume saturation rather than linear "more attempts always better."
- Trend over recent mocks.
- Confidence factor from data volume and stability.
- Planning-evidence limitations: explicit "unmapped" or "diagnostic needed" states.
- Error-bank idea for Track C: incorrect objective IELTS questions should become review candidates.

### Build native

Build these inside DebateLab:

- Data access through `lib/api/ielts` repositories with generated Supabase types.
- Pure prediction math in `apps/web/src/lib/ielts/band-prediction/*`.
- Official IELTS aggregation using existing IELTS scoring helpers.
- Weakness profile from DebateLab's typed IELTS tables and item bank.
- RLS-covered `learner_band_profiles` and optional prediction event table when caching is needed.
- UI in the existing IELTS home/results shells, behind `IELTS_ENABLED`.

### Do not port

- Lumist's SAT score scales, constants, section assumptions, Prisma queries, and hardcoded predictor weights.
- Any direct score bonus from streaks, vocabulary count, or study hours.
- Any black-box LLM prediction step.

## Track C Interface

Track C should consume `IeltsBandPrediction` from `loadIeltsPredictionForPlanning`.

Minimum contract for Track C:

- `overall`: target gap and confidence.
- `skills`: per-skill predicted band, range, trend, and evidence.
- `weaknesses`: ordered weakness list with skill, key, severity, confidence, evidence count, bilingual labels/reasons, and activity filters.
- `nextBestDiagnostic`: what to ask the learner to do before planning if evidence is missing.
- `limitations`: why the plan may be broad or low-confidence.

Planning rule recommendation:

- If `overall.status === "diagnostic_needed"`, Track C should generate a diagnostic plan, not a full adaptive study plan.
- If one skill is missing, Track C should schedule that skill's diagnostic first and fill the rest of the week with low-risk foundational tasks.
- If confidence is medium/high, Track C should allocate 60 percent of practice to the top two weaknesses, 25 percent to maintaining stronger skills, and 15 percent to full-test stamina.

## Phased Build Plan

Each card is scoped to one PR and inherits the IELTS quality bar: typed clients, repositories, Zod at boundaries, RLS for new tables, tests, and engine purity.

### WS-B.1 - Prediction signal contract and IELTS metadata

Scope:

- Add `apps/web/src/lib/ielts/band-prediction/types.ts`.
- Define evidence atoms, prediction output, weakness signal contract, and Track C loader signature.
- Extend IELTS authoring/question schemas so `ielts_questions.metadata` has validated optional fields: `subskill_tags`, `difficulty_band_hint`, `track_c_tags`, and `learn_activity_weight`.
- Add tests for metadata parsing.

Done:

- No UI yet.
- Track C can import a stable type.
- Existing content remains valid.

### WS-B.2 - Pure weighted-recency predictor

Scope:

- Implement pure functions in `apps/web/src/lib/ielts/band-prediction/model.ts`.
- Include recency weighting, effective sample size, confidence, range, trend, and overall aggregation via existing `computeOverallBand`.
- Add fixture tests for cold start, one skill missing, full four-skill estimate, variance penalty, trend, and official rounding.

Done:

- `npm test -- band-prediction` passes.
- No database or UI code.

### WS-B.3 - Typed repository aggregation

Scope:

- Add `apps/web/src/lib/api/ielts/band-prediction-repository.ts`.
- Read current user evidence from `ielts_attempts`, `attempt_band_scores`, `writing_responses`, `speaking_responses`, `ielts_question_responses`, `ielts_questions`, and optionally low-confidence `practice_attempts`.
- Use only typed Supabase clients and RLS-respecting reads for learner-facing data.
- Add integration-style tests with mocked repository rows.

Done:

- `loadIeltsBandPrediction()` returns the full prediction object for the current learner.
- Cold-start output is honest and does not invent numeric overall.

### WS-B.4 - IELTS home and results UI

Scope:

- Add a predicted-band card to `IeltsHome`.
- Add prediction impact panel to `IeltsResultsView`.
- Add concise bilingual copy keys for status, range, and diagnostic prompts.
- Keep official result and predicted result visually distinct.

Done:

- Dashboard shows latest official mock and predicted next band separately.
- Cold-start CTA routes to the diagnostic/test library.
- UI remains behind `IELTS_ENABLED`.

### WS-B.5 - Cached profile table and recompute hooks

Scope:

- Add RLS-covered `learner_band_profiles`.
- Add service-role recomputation after objective grading, Writing recompute, Speaking recompute, and teacher override.
- Keep read-time fallback if cache is missing/stale.
- Add `updated_at`, `model_version`, and typed score/range/confidence columns.

Done:

- Profile updates after a scored attempt without client-side writes.
- RLS audit passes.
- Cache and read-time model outputs match in tests.

### WS-B.6 - Track C weakness feed

Scope:

- Build weakness extraction for objective question types, Writing criteria, Speaking criteria, and phoneme report categories.
- Add `loadIeltsPredictionForPlanning()` facade.
- Add bilingual weakness labels and reasons.
- Add tests for top-weakness ordering and target-band gaps.

Done:

- Track C can consume one stable interface and does not query raw prediction tables.

### WS-B.7 - Prediction validation events and admin calibration

Scope:

- Add `ielts_band_prediction_events` with RLS/admin-only access.
- Log pre-attempt predictions before a full mock and evaluate them once attempt bands are completed.
- Add admin aggregate metrics: MAE per skill, within +/-0.5, within +/-1.0, range coverage, confidence calibration, and trend sign accuracy.

Done:

- Model can run in shadow mode before UI promotion.
- Team can decide whether confidence ranges are calibrated.

### WS-B.8 - IRT/Elo shadow model spike

Scope:

- Do not replace `weighted-recency-v1`.
- Add a shadow-only item ability profile after there are enough item responses.
- Use duel MMR patterns: profile table, event table, provisional flag, item difficulty, and admin-only calibration.
- Compare against weighted-recency on held-out next attempts.

Done:

- Decision memo says whether to keep, tune, or discard IRT/Elo upgrade.
- No learner-facing UI unless it beats the baseline and remains explainable.

## Validation Plan

Phase 1 validation:

- Unit tests for all math and rounding.
- Golden fixtures from synthetic learner histories.
- "No evidence" and "partial evidence" tests that verify no fake official overall is emitted.
- Snapshot tests for explanations so UI copy remains understandable.

Shadow validation after launch:

- Before each full mock, log the current prediction as `pre_attempt`.
- After the mock completes, attach actual bands.
- Metrics:
  - MAE per skill and overall.
  - Percent within +/-0.5 and +/-1.0 band.
  - Confidence range coverage.
  - Calibration by confidence bucket.
  - Trend direction accuracy.
  - Separate metrics for AI-only W/S versus teacher-overridden W/S.
- Promotion target for "medium confidence": at least 80 percent of next skill bands within displayed range and overall MAE <= 0.75 bands on the first meaningful cohort.
- Promotion target for "high confidence": at least 85 percent within displayed range and overall MAE <= 0.5 bands.

Data requirements for IRT/Elo upgrade:

- At least several thousand objective item responses across many learners.
- Each objective item needs stable tags and enough attempts for item difficulty.
- W/S needs human override labels or repeated scoring audits before any learned model should adjust scorer outputs.

## Risks and Open Questions

Risks:

- No live IELTS data yet. The first release must lead with diagnostics, not predictions.
- AI Writing/Speaking bands can be biased. Teacher overrides should be treated as higher reliability and used for validation.
- Small drills can overstate ability if item difficulty is unknown. Keep reliability caps until item calibration exists.
- Confidence ranges can sound more statistical than they are. Product copy should say "likely range" or "confidence range," not "95% CI," until validated.
- Debate history is tempting but dangerous. It should only inform cold-start readiness and study-plan onboarding.
- Raw-to-band conversions vary by test version. Use `band_conversions.conversion_key` and never hard-code a single table in prediction code.
- Cached profiles can go stale if recompute hooks miss async scorer completions. Always keep read-time fallback and model-version timestamps.

Open questions:

- Should the first diagnostic be a full four-skill mini-test or a faster L/R objective set plus one Writing Task 2 and one Speaking Part 2?
- What target-band input should Track C use when a learner has not set a goal?
- Do B2B teachers need to see predicted bands before students do?
- Should teacher overrides immediately overwrite AI reliability for future prediction, or should both be retained as separate evidence?
- What is the minimum item-response volume before an IRT/Elo shadow model is worth building?

## Final Call

Ship `weighted-recency-v1` first. It is cheap, transparent, testable, and faithful to the existing DebateLab IELTS engine. It also gives Track C exactly what it needs: a per-skill estimate, a confidence/range, and an ordered weakness profile. Treat Lumist as a reference for explainable component design, not a codebase to port. Treat IRT/Elo as a shadow upgrade after real IELTS response volume exists.
