# Phase 6 — Adaptive Learning: synthesis & build plan

> Synthesizes the four research docs in this folder — `lumist-adaptive-teardown.md` (A),
> `band-prediction.md` (B), `study-plan-engine.md` (C), `learn-mode-activities.md` (D) — into one
> buildable plan. Those docs hold the depth; this is the **decisions + sequencing** layer that
> resolves where they overlap or disagree. Build target: the `ielts` branch, behind `IELTS_ENABLED`.

## 1. What the research converges on

All four independently reached the same three conclusions:

1. **Build native; port four Lumist *ideas*, not its code.** Lumist's adaptive engine is SAT-shaped
   (Prisma, 400–1600 scoring, a ~2,370-line god-service). Carry over: the **evidence ledger**,
   **confidence-as-product**, **plan-items-as-pointers** (not content blobs), and **real SRS** — rebuilt
   on DebateLab's stack.
2. **Explainable, not black-box.** Every predicted band and plan item must show its evidence +
   confidence. There isn't enough IELTS data to calibrate an opaque model yet.
3. **Content is the critical path.** The live IELTS tables are effectively empty. Prediction and
   planning are vacuous without a seeded item bank — so **content seeding (teacher authoring + the
   AI-draft tooling) runs in parallel with the entire build** and gates credibility, not code.

## 2. Design principles

- **Goal-driven & skill-targeted, NOT completionist.** Real IELTS learners study toward a target and
  concentrate on the skills they need — they do not grind all four equally. The system therefore
  supports **per-skill target bands** and an optional **declared focus** (e.g. "I only need Writing to
  6.5"). The plan weights effort by gap-to-target × exam-weight and **respects a declared focus** rather
  than forcing all four skills (it keeps a light "maintenance" touch on de-focused skills so they don't
  regress). Foundational study (core grammar/vocab/strategy) is offered, but selection is goal-led.
- **Diagnostic-first.** Until a learner sits a diagnostic, show diagnostics — never a predicted band.
- **One evidence ledger.** Assess (mocks, W/S) and Learn (micro-activities) both write to one
  append-only store; prediction, mastery, and planning are all **derived views** over it. This kills the
  "two competing truths about ability" risk every doc flagged.
- **Reuse the platform.** New behaviour = registered activity types (never core-engine edits); reuse the
  existing XP/streaks, AI pipeline + phoneme engine, and the typed/RLS data layer + CI quality bar.
  Debate stays byte-identical (§2.7).

## 3. Unified architecture

```
        ┌──────────────── ielts_adaptive_evidence (append-only ledger) ────────────────┐
        │   written by BOTH:  Assess (mock / W/S results)  +  Learn (activity attempts) │
        └───────────────┬─────────────────────────────────────────────┬────────────────┘
                        ↓                                               ↓
              ielts_skill_states                                ielts_review_items
        (derived current mastery /                         (ONE SM-2 scheduler, FSRS-ready
         weakness per subskill — the                        columns; the shared SRS queue)
         single "truth" about ability)
                        ↓
   ┌────────────────────┼─────────────────────────────────────┐
   ↓                    ↓                                       ↓
TRACK B            TRACK C                                   TRACK D
band prediction →  study-plan engine        ←schedules→      Learn-mode activities
(predicted bands   (goal → diagnostic → 14-day plan +        (registered micro-activity types;
 + weakness)        "Today"; consumes B, schedules D+reviews)  emit evidence + review items)
```

Everything writes to one ledger; prediction, planning, and mastery are derived from it.

## 4. Seam decisions (the overlaps, resolved)

| Seam | Conflict across docs | Decision |
|---|---|---|
| Ability/mastery store | B `learner_band_profiles`, C `ielts_learner_focus_states`, D `ielts_subskill_mastery` | **Collapse to one foundation:** `ielts_adaptive_evidence` (events) → `ielts_skill_states` (derived mastery) → `learner_band_profiles` (prediction cache only). |
| Review scheduler | C "owns" it; D "ships it first" | **Foundation, owned by neither:** one `ielts_review_items` + a shared `lib/ielts/review/` SM-2 module. D writes reviews; C schedules them. |
| SM-2 vs FSRS | C wants FSRS (license risk) | **SM-2 now, FSRS-compatible columns.** Defers the license decision; no functional loss. |
| Weakness contract | B `IeltsWeaknessSignal`, C variant, D skill-signal | **Adopt B's `IeltsWeaknessSignal` verbatim** (skill/key/severity/`recommendedActivityFilters`/bilingual). C consumes it; D's mastery feeds it. |
| Subskill taxonomy | enums vs dictionary | **One `ielts_subskills` dictionary table** (not enum). B's `reading:matching_headings`-style keys become rows. Needs the taxonomy call (§8). |
| Activity atoms | C `IeltsLearnAtom` enum vs D registered types | **D owns the activity types; C references them by the same keys.** |

## 5. The goal model (onboarding's output)

A learner goal = **overall target band + optional per-skill targets + test date + optional focus skills
+ weekly availability**, stored on `ielts_study_plans`. The generator:
`priority = gap_to_skill_target × skill_exam_weight × criterion_weight × confidence × recency ×
content_availability × urgency`, **excluding de-focused skills** when a focus is declared (light
maintenance only). Default overall target **6.5** if unset.

## 6. Onboarding (new — Wave 6.1)

The entry to the whole loop, and a first-class flow (no doc made it one):
**Welcome → Goal** (target band, optional per-skill, test date, focus skills) **→ quick Diagnostic**
(L + R + one Task-2 + one Part-2 — faster than a full 4-skill mock) **→ first generated plan + a
predicted-band estimate with confidence.** Reuses the mock engine (diagnostic), Track B (estimate),
Track C (first plan). Gated behind `IELTS_ENABLED`.

## 7. Phased build plan

The three feature docs propose 33 cards (B:8, C:12, D:13). Consolidated:

- **Wave 6.0 — Adaptive Foundation** (build FIRST; everything depends on it): `courses.subject` sync +
  the `ielts_subskills` dictionary · the shared `ielts_adaptive_evidence` + `ielts_skill_states` schema
  + `ielts_questions` adaptive metadata · the unified typed contracts (weakness signal, prediction
  snapshot, learn-atom, goal model — collapses B.1/C.1/D.13) · the shared review scheduler
  (`ielts_review_items` + SM-2, FSRS-ready — collapses C.5/D.4) · the activity-registry typed-interface
  refactor (D.1).
- **Wave 6.1 — Cores + onboarding (parallel):** B prediction model + repo · D first text activity types
  · **D authoring + AI-draft tooling (bootstraps content)** · C pure plan engine · **the onboarding flow
  (§6).**
- **Wave 6.2 — Surfaces + adaptation:** prediction UI · plan page + "Today" list · adaptation hooks ·
  Learn-mode UI + remaining activity types (listening clips, pronunciation minimal-pairs via the phoneme
  engine, reading skim/scan, grammar-fix).
- **Wave 6.3 — Validation, B2B, polish:** prediction cache + validation/shadow-IRT spike · XP/streak
  wiring (reuse) · analytics + B2B class-plan surface + unit checkpoints.
- **Parallel, non-code: content seeding** — teacher authoring + the Wave-6.1 AI-draft tooling. The gate.

## 8. Founder decisions (recommended defaults in **bold**)

1. **Subskill taxonomy** (blocks the Foundation schema) → a **hybrid**: Cambridge question-type skills
   for R/L + band-descriptor criteria for W/S + a few cross-cutting micro-skills (collocation,
   paraphrase). Dictionary table, so it grows.
2. **Diagnostic shape** → the **faster** one (L + R + one Task-2 + one Part-2), not a full mock.
3. **SM-2 vs FSRS** → **SM-2 now, FSRS-ready columns.**
4. **Default target band** when unset → **6.5**.
5. **B2B vs personal** → teacher-assigned results **feed personal prediction**, but fixed teacher
   assignments always win plan slots.
