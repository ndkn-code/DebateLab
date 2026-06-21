# Wave 6.3 — Execution to Lumist parity

Status: PLAN (2026-06-21). Owner: orchestrator (Claude) generates cards → Codex/Claude build → integrate to `ielts`.

## Where we are

The IELTS engine is feature-complete and **shipped to `main` behind an admin-only gate**
(commit ecf5f5f): authoring · 4-skill AI scoring · timed mocks · results/bands · B2B
assignment · learner shell · the full adaptive layer (prediction → study plan → Learn →
onboarding → AI-draft tooling → surfaces). A demo fixture (`scripts/ielts/seed-demo.sql`)
makes every surface render for admins today.

The binding constraints to "Lumist-level execution" are now **content** (co-founder, ~1 week)
and **depth/polish on three axes**: Learn activity breadth, prediction trustworthiness, and
the exam-fidelity details that make a prep app feel real. This wave plans those three.

Quality bar unchanged: 8 CI gates, debate byte-identical, engine-purity (no exam logic in the
core engine), diagnostic-first (never show a band without evidence), bilingual EN/VI.

---

## Workstream A — Learn-mode activity types

Today there are **3 text types** (`ielts_vocab_collocation`, `ielts_paraphrase_transform`,
`ielts_gap_fill`) registered over `ielts_questions` via `lib/ielts/learn/text-activities.ts`,
rendered by the learn-path UI, emitting evidence through `completeActivity` (XP + evidence +
mastery — do NOT re-award). Lumist's depth comes from a **drill per subskill per skill**. We
add types so every weakness the predictor surfaces has a matching practice activity.

Add (each = content schema + renderer + AI-draft authoring + `activity_type` enum value +
evidence emission; reuse `completeActivity`):

- **Reading**: `ielts_skim_main_idea` (timed gist), `ielts_scan_detail`, `ielts_tfng_reasoning`
  (True/False/Not Given with rationale), `ielts_matching_practice` (headings/features).
- **Listening** (needs audio — see C1): `ielts_dictation` (gap-fill from audio),
  `ielts_keyword_spotting`, `ielts_signpost_prediction`.
- **Writing**: `ielts_sentence_transform`, `ielts_cohesion_linker`, `ielts_task1_overview`
  (write the overview sentence), `ielts_paragraph_order`.
- **Speaking** (needs Azure — see C2): `ielts_minimal_pairs` (discrimination),
  `ielts_shadowing` (record → phoneme score), `ielts_part2_structure_builder`,
  `ielts_discourse_markers`.

Design rules: every type maps to ≥1 `ielts_subskills.key` (drives weakness→activity routing in
the study-plan generator); the renderer is a pure client component with a typed content schema;
authoring gets an AI-draft path (extend the micro-item draft queue). Sequence reading+writing
text types first (no new infra), then listening (after C1), then speaking (after C2).

## Workstream B — Band-prediction validation harness

The served model is `weighted-recency-v1` (per-subskill EWMA over `ielts_adaptive_evidence` →
`ielts_skill_states` → `computeOverallBand`, half-band rounding, confidence range + trend,
diagnostic-first). It is already better than a naive "last mock" or simple average — **Lumist's
weakness is exactly that naïveté**: a single recent-score heuristic, no per-subskill evidence,
no uncertainty, and no calibration against real outcomes (it will confidently show a band off by
a full point). We do not want to *match* that; we want to **prove ours and keep improving it**.

Build (all pure + testable; no user-facing change until a model demonstrably wins):

1. **Backtest engine** (`lib/scoring/ielts-prediction/backtest.ts`, pure): replay a learner's
   chronological evidence; at each mock boundary, compute the prediction made *before* mock N and
   compare to mock N's **actual** bands. Metrics per-skill + overall: MAE, signed bias,
   within-half-band hit-rate, and **calibration** (does an 80% confidence interval contain the
   truth 80% of the time?). Brier score for "on track to hit target by test date".
2. **Shadow models**: run alternatives alongside v1 — a 2PL **IRT** per-subskill ability estimate,
   an **Elo**-style update, optionally a small Bayesian model — logging their predictions vs v1.
   Compare on the backtest set; promote a challenger only when it beats v1 on MAE *and*
   calibration. v1 stays served until then. (Shadow logging table or jsonb on the prediction
   snapshot; no user-facing surface.)
3. **Synthetic fixtures**: deterministic trajectories with a known "true ability" (extend the
   seed pattern) to unit-test predictor recovery + harness math pre-launch, before real cohorts
   exist.
4. **Admin "Prediction Quality" dashboard**: aggregate metrics over users with ≥2 mocks —
   calibration plot, per-skill error, drift over time. Internal only.
5. **Confidence recalibration**: tune the served interval so empirical coverage matches the
   claimed level.

Pre-launch this runs on synthetic data (validates the math); post-launch it runs on real cohorts
(validates the model and drives improvements). This is the moat: a *calibrated, evidence-grounded,
self-validating* predictor, not a guess.

## Workstream C — Lumist-parity execution punch-list (prioritized)

1. **Listening audio + content volume [BLOCKING for real listening].** Wire the WS-1.3 TTS
   pipeline so every `listening_sections.script` gets an audio asset (us/uk via Deepgram aura —
   key present; AUS needs a Google key — env gap). Real mocks at exam length (40Q L/R, full
   passages) come from the co-founder; our job is the audio + the authoring ergonomics.
2. **Azure pronunciation [env gap].** No Azure creds in `apps/web/.env.local` → `assessPronunciation`
   is currently a no-op, so Speaking phoneme scoring and pronunciation drills are inert. Add creds +
   verify the WS-3.3 phoneme path end-to-end.
3. **Results deep-dive.** Per-question review with rationale (explanations columns already exist),
   reading-passage + listening-transcript highlighting, writing annotations, speaking phoneme
   heatmap (after C2). Band-9 model answers for W/S.
4. **Review/SRS surface.** A daily "Review" page driven by `ielts_review_items` (SM-2 now,
   FSRS-ready) with due-today counts + reminders.
5. **Gamification/retention.** Streaks, daily goals, XP already flow through the engine; surface
   them on the IELTS home; consider an IELTS league reusing the leaderboard infra.
6. **Question-type renderer completeness + polish.** Audit every `ielts_question_type` renderer
   (matching, diagram/map-label, table/flow completion) for parity + mobile polish.
7. **B2B class study-plan surface** (deferred from 6.2) — teacher view of a class's adaptive plans.

---

## Sequencing → cards

- **6.3a (parallel now):** reading + writing text activity types (A, no new infra); listening
  audio wiring (C1); Azure enablement + verify (C2).
- **6.3b:** prediction validation harness (B1–B3 + B5) on synthetic fixtures — startable now.
- **6.3c:** results deep-dive + explanations/model answers (C3); review surface (C4).
- **6.3d:** listening + speaking activity types (A, after C1/C2); prediction admin dashboard (B4);
  gamification (C5); renderer audit (C6).

Each card: typed + tested, behind the IELTS gate, debate untouched, 8 gates green, splice
`supabase.ts` if it adds tables (CLI has no token), bilingual strings at parity.
