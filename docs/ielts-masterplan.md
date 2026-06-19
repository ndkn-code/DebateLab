# Thinkfy IELTS — Grand Masterplan (v2: DebateLab-native)

> **Status:** Locked v2 (post-audit). Supersedes the v1 fork-Lumist plan entirely.
> **Author:** Architecture session, 2026-06-17.
> **One-liner:** Build a top-tier, AI-graded, 4-skill IELTS product **natively inside the existing DebateLab/Thinkfy app** — reusing its already-built learning engine, AI layer, LMS, gamification, and design system; **porting two crown jewels from Lumist** (payments + the lesson-chunk authoring format); and building the IELTS-specific layer (mock engine, band scoring, question types, pronunciation) net-new. Serves B2C self-study + B2B teacher-led classes.

---

## 0. Why this plan changed (read once)

A read-only architecture + code-health audit of both codebases (2026-06-17) reversed the original "fork Lumist" decision:

- **DebateLab is already a platform, not a debate demo.** Its content/auto-grading engine, async AI-scoring pipeline (incl. a `speaking` evaluator), AI provider stack, LMS (Classes + Club OS), gamification, and design system are **built and tested** — the tables are empty only because of a hardcoded `STUDENT_COURSES_ENABLED=false` flag. The one true gap is **payments**.
- **Lumist is healthy but SAT-coupled exactly where IELTS differs** (scoring curve, `multiple_choice|numeric` enum across 46 files, SAT taxonomy across 30 files, a `generate_prefixed_sequential_id` PK function under 107/137 models). Both auditors independently said **"reference, not fork."**
- **Net:** building native in DebateLab is the smaller, cleaner lift **and** the better long-term foundation — and it deletes the fork plan's entire risk category (no new repo, no Prisma, no `multiSchema`, no shared-DB coexistence, no debate migration).

**Lumist's role now:** a reference codebase from which we **faithfully port exactly two things** — the payments subsystem and the lesson-chunk authoring format (which already has an IELTS Reading prototype) — and study others (timing algorithms, review-bank pattern) as design references.

---

## 1. Vision & North Star

Build the IELTS product no Vietnamese competitor has shipped cleanly: **a full 4-skill computer-delivered test experience with transparent, criterion-level AI band scoring, delivered into BOTH a self-study consumer app AND a teacher's classroom workflow.**

**White space (validated):** VN players do AI scoring *or* teacher-led courses, rarely both in one workflow; ELSA owns phonemes but isn't a full examiner; most make unverifiable accuracy claims. We win with **phoneme-level pronunciation inside a full 4-skill examiner**, **transparent per-criterion scoring with the official math**, and **AI grading delivered into a teacher's workflow** (assign → AI pre-grades → teacher overrides → analytics).

**North-star metric:** weekly AI-graded submissions per active learner; B2B: teacher grading-hours saved per class.

**Platform vision (beyond v1):** the real long-term product is a **bite-size, interactive learning platform** (Duolingo/Brilliant-style) where debate, IELTS, and future subjects are verticals on one extensible activity engine — and full timed mock tests are just *one mode* of that engine, not the whole product. The IELTS build is the first heavy exercise of that engine; we build it so the engine **generalizes**, not so it ossifies around exams. (DebateLab already ships the Duolingo-style activity engine — this is an extension of it, not a new system.)

---

## 2. The Engineering Quality Bar (NON-NEGOTIABLE — this is the guarantee)

Quality ≥ Lumist is enforced structurally, in CI, on every commit. Encoded once in Phase 0, then required by every workstream's Definition of Done.

**Definition of Done (every workstream):**
1. **Typed end-to-end.** Supabase DB types generated; client uses the `<Database>` generic; no `any` in new code; reads go through `lib/api` repositories (no inline `supabase.from(...)` in pages/components).
2. **Validated.** Zod schemas at every API/server-action boundary; one canonical create path per entity (no divergent paths).
3. **Isolated.** RLS-with-policies on every new table from day one; org-scoped policies where B2B applies (no purely per-route isolation). An automated RLS-coverage check fails CI if a new table lacks policies.
4. **Tested.** Unit + integration tests for the workstream; **scoring and payments paths require coverage thresholds**; tests run in CI and gate merge.
5. **Bounded.** Lint-enforced file-size/complexity caps (no god-files); typed columns for structured data (no untyped `Json` for scores).
6. **Consistent.** Follows DebateLab's `lib/api` (loaders) + `app/actions` (mutations) + `components` + `packages/shared` conventions; design-system audit (`audit:design-system`) passes.
7. **Engine-pure.** IELTS/exam-specific logic (band scoring, timed-mock orchestration) lives in IELTS modules or *registered* activity types — **never hard-coded into the core activity engine**, which stays subject- and mode-agnostic so future bite-size activity types and other subjects slot in cheaply. A new activity type = {schema + player + validator/scorer + authoring builder} registered in one place.

**What this fixes vs each codebase:** closes DebateLab's untyped-client gap; bans Lumist's god-files, RLS gaps, untyped score `Json`, dual-create-path, and thin CI. New IELTS code is type-safe + isolated + tested by construction.

**Honest scope:** the bar guarantees *new IELTS code*; it doesn't retroactively rewrite existing debate code (typegen improves it repo-wide regardless). Quality still depends on sessions following the bar — but CI gates make violations fail to merge, not slip through.

---

## 3. Locked decisions (decision log)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Trunk | **DebateLab/Thinkfy itself** — build IELTS natively in the existing app, repo, stack, and DB. No fork, no new repo. |
| 2 | Stack | Existing DebateLab: Next.js 16, React 19, TS, **raw `@supabase/supabase-js` (upgraded with generated types + repository layer)**, Tailwind 4, the existing design system. **No Prisma.** |
| 3 | DB | The existing DebateLab Supabase DB. IELTS tables added with RLS from day one. No migration of anything. |
| 4 | Reuse (DebateLab, already built) | Activity/content engine + auto-grading; async AI-scoring pipeline (+ `speaking` evaluator); AI provider router/key-pool/STT/RAG/telemetry/rubric-bundles; LMS (Classes + Club OS); gamification (XP/streaks/leagues/smart-popups); design system; EN/VI i18n. |
| 5 | Port (Lumist → re-expressed in DebateLab's stack) | **Payments/subscriptions/metering** (+ satellites) and the **lesson-chunk authoring format + renderer**. Port the logic/scar-tissue, not Prisma. |
| 6 | Build net-new | Subject/track axis; IELTS question types + renderers + answer-eval; **timed multi-section mock engine + band scoring**; IELTS Writing/Speaking scorer prompts/rubrics; phoneme pronunciation (Azure Speech); band prediction + study plan. |
| 7 | Launch scope | Full 4-skill computer-delivered mock; **lean seed content, grow weekly**. |
| 8 | Content | Strictly hand-authored (scripts hand-authored; Listening audio via multi-accent TTS). Authoring throughput is the launch gate, not engineering. |
| 9 | Platform | Web-first responsive; native mobile next. |
| 10 | Speaking | Async record-then-score at launch; **phoneme-level (Azure Speech) from launch**; live conversational examiner = fast-follow. |
| 11 | Models | Multi-provider cheap-first via DebateLab's existing router: Gemini Flash (key-pool) + Groq (Gemma/Llama) primary; avoid DeepSeek; Claude sparingly; Azure Speech (phoneme); Deepgram/Groq-Whisper (STT). |
| 12 | Monetization | B2C freemium + metered AI grading (reuse ported payments + DebateLab's entitlement gate). B2B per-seat/org. |
| 13 | Locale | VN-first, bilingual EN + VI; VNPay/ZaloPay rails (via ported payments). |
| 14 | B2B | Internal classes first via DebateLab's existing Classes + Club OS; org-scoped RLS; multi-tenant-ready. |

**Confirmed:** Lumist-SAT is a separate project — not touched. Debate stays exactly as-is; IELTS is a new subject in the same app.

---

## 4. Competitive positioning (cheat-sheet)

Table stakes: all 4 skills, full CD-mock UI, all major Reading/Listening question types, AI Writing scorer (4 criteria + **Task-2 double weighting**), AI Speaking scorer (4 criteria), vocab SRS, study plan, band prediction, VN UI + price, cite the **official 2024 band descriptors**. Differentiators we own: **phoneme depth inside a full examiner**, **transparent per-criterion scoring**, **AI-grading inside the teacher workflow**. (Benchmarks: luyennoi/YouPass/Prep/ZIM/DOL/Edmicro/ELSA — see audit notes.)

---

## 5. Architecture (native)

```
        ┌─────────────────────────────────────────────────────────┐
        │             THINKFY = the existing DebateLab app          │
        │        Next 16 · supabase-js (typed) · existing DB        │
        │                                                           │
   Axes │  Subject:  Debate │ IELTS        Language: EN │ VI        │
        │                                                           │
        │  ┌── Already built & reused ───────────────────────────┐ │
        │  │ activity/content engine · auto-grading · async AI    │ │
        │  │ scoring pipeline (+speaking eval) · AI router/key-   │ │
        │  │ pool/STT/RAG/telemetry · LMS (Classes+Club OS) ·     │ │
        │  │ gamification (XP/streaks/leagues/popups) · design sys │ │
        │  └──────────────────────────────────────────────────────┘ │
        │  ┌── Ported from Lumist (re-expressed, typed) ─────────┐  │
        │  │ payments/subscriptions/metering · lesson-chunk format│  │
        │  └──────────────────────────────────────────────────────┘ │
        │  ┌── Built net-new (on the substrate above) ──────────┐   │
        │  │ subject axis · IELTS question types/renderers ·      │   │
        │  │ timed mock engine · band scoring · W/S scorer        │   │
        │  │ prompts · phoneme (Azure) · band prediction          │   │
        │  └──────────────────────────────────────────────────────┘ │
        └─────────────────────────────────────────────────────────┘
   Lumist-SAT: separate product/DB — untouched (reference only)
```

**Data layer:** stay on `@supabase/supabase-js`, but upgrade to the quality bar — generated `Database` types + `<Database>` generic, a `lib/api` repository layer, Zod at boundaries, RLS on all new tables, reviewed SQL migrations (DebateLab's existing `supabase/migrations` approach). Equal type-safety to Lumist's Prisma, leaner stack, no ORM.

**Subject axis:** add `subject` (debate | ielts) as a first-class dimension, orthogonal to the existing EN/VI language axis. The switcher gains an IELTS entry. Flip `STUDENT_COURSES_ENABLED` on, scoped to the IELTS track.

**Design principle — the activity engine IS the platform (the long-term moat):** DebateLab already ships a Duolingo-style activity engine with a type *registry* (`lib/activity/registry.ts` + validators + per-type players/builders). Treat it as a first-class, extensible, **subject- and mode-agnostic** primitive. Run it in two clearly-separated **modes** on the shared `activity_attempts` substrate — **Learn** (bite-size, untimed, immediate feedback, mastery/SRS — the Duolingo/Brilliant loop) and **Assess** (timed, exam conditions, band scoring). IELTS uses both. Leave clean extension points (build later, don't preclude now): a *rich interactive* activity type for Brilliant-grade manipulables, and a mastery/skill-tree + SRS progression layer. The IELTS mock + band-scoring is a layer **on top** of this engine, never baked **into** it (enforced by Quality-Bar DoD §2.7).

---

## 6. Data model (IELTS additions; all new tables RLS-covered, typed)

Extend the existing engine; add IELTS-specific tables in `public` with policies.

- **Dimensions:** `subject` + `skill` (listening|reading|writing|speaking) on content.
- **Question types (typed enum, one canonical create path):** Reading/Listening — `mcq_single`, `mcq_multi`, `true_false_notgiven`, `yes_no_notgiven`, `matching_headings`, `matching_information`, `matching_features`, `sentence_completion`, `summary_completion`, `note_table_form_flowchart_completion`, `short_answer`, `diagram_label`, `map_plan_label`. Writing — `writing_task1_academic`, `writing_task1_general`, `writing_task2_essay`. Speaking — `speaking_part1`, `speaking_part2_cuecard`, `speaking_part3`.
- **Stimuli:** `passages` (reading), `listening_sections` (script + generated audio asset + accent + section 1–4), `audio_assets` (script, voice/accent, tts_provider, storage_url, version). Reuse the lesson-chunk JSON for diagrams/maps.
- **Mock structure:** reuse the activity/attempt substrate; add a timed multi-section orchestration layer (L 30m+10m / R 60m / W 60m / S ~14m).
- **Scoring (typed columns, not Json):** `band_conversions` (per-test raw→band; Academic vs GT for Reading); `attempt_band_scores` (per-criterion sub-scores + computed skill band + overall). Encode the math: Speaking = mean(FC,LR,GRA,Pron)→round .5; Writing = (Task1×1/3)+(Task2×2/3)→round .5, each task = mean(TR/TA,CC,LR,GRA); R/L = raw→band; Overall = mean(L,R,W,S) rounded (.25→.5, .75→next).
- **W/S submissions:** reuse the practice-attempt + submission substrate; `writing_responses` (essay, word count, per-criterion AI feedback, inline corrections, teacher_override, status); `speaking_responses` (audio url, transcript, per-criterion bands, **phoneme_report**, teacher_override, status).
- **Learner model:** reuse skill-signal/progress; add `learner_band_profile` (estimated band per skill + trend) + a cross-skill weakness synthesis for personalization.

---

## 7. AI scoring engine

Reuse DebateLab's pipeline (queue → job state machine → retry → idempotency → results) and its **versioned rubric/prompt-bundle abstraction** — IELTS scorers are new bundles, not new machinery.

- **Writing scorer:** per-criterion bands (TR/TA,CC,LR,GRA) → task band → Task-2-weighted overall; inline corrections; paragraph feedback; Band-9 model rewrite via RAG over hand-authored exemplars; VN-language option.
- **Speaking scorer (async):** record → STT (Deepgram/Groq-Whisper) → 4-criteria band; **Azure Speech phoneme report** feeds the Pronunciation criterion (per-sound IPA, color-coded); "exact lines where you lost marks." Live examiner = fast-follow on the existing duel/voice infra.
- **Reading/Listening:** deterministic auto-grading (variant-tolerant) → raw → band; LLM only for on-demand explanations.
- **Transparency + cost:** always per-criterion + official math; cheap-first routing (Gemini key-pool/Groq), Claude gated; every call metered (`user_feature_usage`) + logged (`ai_provider_requests`).

---

## 8. Authoring, monetization, B2B

**Authoring (the human bottleneck):** lift Lumist's lesson-chunk format (re-expressed, typed) — it already has an IELTS Reading prototype. Extend DebateLab's existing admin authoring for IELTS item types; Draft→QA→Publish + versioning. TTS pipeline for Listening audio. Launch with ~2–3 full mocks + drills/skill; grow weekly.

**Monetization (B2C):** port Lumist's payments; freemium + metered AI grading (YouPass-style caps) on the existing entitlement gate; VNPay/ZaloPay primary.

**B2B (reuse DebateLab's LMS):** extend Classes + Club OS for IELTS classes; the teacher grading workflow (AI pre-grade → teacher review/override → student result) reuses the existing submission→`coach_reviews` loop; org-scoped RLS; manager dashboards.

---

## 9. Phased plan of record (parallel-safe; every card obeys the Quality Bar DoD §2)

> `[P]` = parallel-safe once deps met. No debate-migration phase exists — IELTS is additive.

### PHASE 0 — Foundation & Quality Bar *(gates everything)*
- **WS-0.1 — Quality foundation** `[blocking]` Generate Supabase DB types + add `<Database>` generic; establish/confirm the `lib/api` repository pattern; add lint rules (file-size/complexity caps), the Zod-at-boundaries convention, an RLS-coverage CI check, test thresholds (scoring/payments), and a CI that gates typecheck+lint+test+design-audit. **Done:** CI enforces the full DoD; a sample typed+RLS'd+tested table passes all gates.
- **WS-0.2 — Subject axis + flip on the engine** `[dep 0.1]` Add `subject` (debate|ielts) orthogonal to EN/VI; switcher gains IELTS; scope nav/content by subject; flip `STUDENT_COURSES_ENABLED` for the IELTS track. **Done:** IELTS mode loads the (empty) engine; debate unaffected.
- **WS-0.3 — IELTS data model + RLS** `[dep 0.1]` Migrations for IELTS question types, passages, listening_sections, audio_assets, band_conversions, attempt_band_scores, writing/speaking_responses — typed columns + RLS policies. **Done:** schema in place, RLS check green.

### PHASE 1 — Authoring & content pipeline
- **WS-1.1 — Lift the lesson-chunk authoring format** `[P, dep 0.3]` Port Lumist's chunk schema + renderer design (re-expressed/typed); extend DebateLab's admin authoring for IELTS items; Draft→QA→Publish + versioning. **Done:** each IELTS item type authorable + published.
- **WS-1.2 — IELTS question-type renderers + answer-eval** `[P, dep 0.3]` All R/L interaction types + variant-tolerant grading strategies. **Done:** every type renders, captures, auto-grades.
- **WS-1.3 — TTS Listening pipeline** `[P, dep 0.3]` Script → multi-accent audio → preview/regen → publish. **Done:** a listening section plays generated audio.
- **WS-1.4 — Seed content** `[dep 1.1,1.3]` Teachers author the lean launch bank on the tooling.

### PHASE 2 — Mock delivery + objective skills (Reading/Listening)
- **WS-2.1 — Timed multi-section mock engine** `[dep 0.3]` Section timing, pause/resume, navigation, audio — on the existing activity/attempt substrate. **Done:** sit a full timed R/L section.
- **WS-2.2 — Raw→band + results/analytics + review** `[dep 2.1,1.2]` Band conversion, results, per-question explanations. **Done:** R/L attempt → band + review.

### PHASE 3 — AI scoring (Writing & Speaking)
- **WS-3.1 — Writing scorer** `[P, dep 0.3]` New rubric/prompt bundle in the existing pipeline; 4 criteria + Task-2 weighting + inline corrections + model-answer RAG. **Done:** essay → transparent band report.
- **WS-3.2 — Speaking scorer (async)** `[P, dep 0.3]` Reuse pipeline + `speaking` evaluator; record→STT→4 criteria. **Done:** spoken answer → band.
- **WS-3.3 — Phoneme pronunciation (Azure)** `[P, dep 3.2]` Integrate Azure Speech into the Pronunciation criterion (IPA, per-sound). **Done:** speaking result shows phoneme map.

### PHASE 4 — Payments port + monetization
- **WS-4.1 — Port Lumist payments** `[dep 0.1]` Re-express the Stripe/VNPay/ZaloPay/RevenueCat + webhook + idempotency + advisory-lock + metering logic into DebateLab's typed supabase-js stack; wire to the existing entitlement gate. Preserve the scar-tissue (signature verify, dedup, out-of-order safety). **Done:** a real checkout + webhook grants/meters entitlement; payment tests pass.
- **WS-4.2 — Freemium + metered grading + band prediction + study plan** `[P, dep 4.1,3.x,2.2]` Tiers + AI-grading caps; band estimate; IELTS study plan. **Done:** paywall + metering + plan live.

### PHASE 5 — B2B for IELTS (reuse LMS)
- **WS-5.1 — Extend Classes/Club OS for IELTS** `[dep 5? /0.3]` IELTS classes/assignments; teacher grading workflow (AI pre-grade → override) on the existing submission→coach_reviews loop. **Done:** assign→AI→override→return works for IELTS.
- **WS-5.2 — Org-scoped RLS + dashboards** `[P, dep 5.1]` Org isolation policies + manager/teacher IELTS dashboards. **Done:** cross-org access blocked (tested); dashboards render.

### Cross-cutting
- **WS-X.1 — i18n EN/VI** `[P]` (mostly exists; extend for IELTS copy + VN feedback).
- **WS-X.2 — Analytics/AI-cost telemetry** `[P]` (reuse existing).

### Suggested fan-out
**WS-0.1 solo first** (blocking — it stands up the quality gates). Then **0.2 / 0.3** → then a wide parallel wave: **1.1 / 1.2 / 1.3 / 2.1 / 3.1 / 3.2 / 4.1**. Content (1.4) runs continuously on the tooling.

---

## 10. Risks, assumptions, next actions

**Risks**
- **Content throughput** is the launch gate (hand-authored). Mitigate: great authoring tooling (1.1/1.3) + lean-seed-grow-weekly.
- **Free-tier Gemini key rotation** is fragile/against ToS at scale — fine for beta; keep Groq/paid as a config-flip fallback (mechanism already exists).
- **Payments port fidelity** — port faithfully + reuse Lumist's test patterns; don't re-derive idempotency from scratch.
- **Re-deriving the mock/band-scoring engine** is the main net-new risk — mitigated by building on the existing tested attempt substrate + referencing Lumist's timing algorithms.
- **Quality drift** — mitigated by the CI-enforced Quality Bar (§2); a card can't merge sub-bar.

**Assumptions (confirmed):** Lumist untouched; debate stays as-is (no migration); quality bar is mandatory.

**Immediate next actions**
1. Run **WS-0.1** (quality foundation) — solo, blocking. It both enables IELTS work and *is* the quality guarantee made real.
2. Then fan out **0.2 / 0.3**, then the Phase-1/2/3 wave + the payments port (4.1).
3. Stand up the content team on the WS-1.1/1.3 tooling as soon as the schema (0.3) lands.
