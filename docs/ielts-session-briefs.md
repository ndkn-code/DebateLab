# Thinkfy IELTS — Coding Session Briefs (v2: DebateLab-native, Phase 0)

> Paste **one brief at a time** into a fresh Codex / Claude Code session. Each is self-contained.
> Always include the **Shared context** block below.
> Full plan: `/Users/jacknguyen/Developer/DebateLab/docs/ielts-masterplan.md` (v2). **Obey the Quality Bar (§2) — it's the Definition of Done for every card.**

---

## Shared context (paste with every brief)

We're adding a **top-tier 4-skill IELTS product natively inside the existing DebateLab/Thinkfy app** (its consumer brand is Thinkfy). IELTS becomes a new **subject** alongside debate, selectable in the app's mode switcher. We are NOT forking, NOT creating a new repo, NOT introducing Prisma, NOT migrating any data.

- **One working repo:** `/Users/jacknguyen/Developer/DebateLab` (Next.js 16, React 19, TS, **raw `@supabase/supabase-js`**, Tailwind 4, existing design system + AI layer + LMS + gamification). You build here.
- **Reference-only repo:** `/Users/jacknguyen/Developer/app-lumist-ai` (Lumist, a separate SAT app). **Read-only.** We port exactly two things from it later — its payments subsystem and its lesson-chunk authoring format — and study a couple of algorithms. Never run Lumist, never write to it, never touch its DB.
- **Database:** DebateLab's existing Supabase project. New IELTS tables are added here **with RLS policies from day one**.
- **Supabase MCP situation (footgun):** the `supabase-debatelab` MCP (`mcp__supabase-debatelab__*`) is THIS app's DB — use it for schema/types/migrations/RLS checks. The account/cloud MCP (`mcp__5f6495dd-...__*`) is **Lumist's** DB — reference only, never write. Before any DB write, confirm you're on DebateLab (you should see `debate_duels`, `practice_attempts`, `profiles`; NOT `student_profiles`, `assessment_attempts`). MCP tools may be deferred — load via ToolSearch.
- **No Prisma.** Data access = `@supabase/supabase-js` upgraded with generated types + a `lib/api` repository layer.

**QUALITY BAR — Definition of Done for every card (non-negotiable, CI-enforced):** typed end-to-end (generated DB types + `<Database>` generic; no `any`; reads via `lib/api`, no inline queries in pages/components) · Zod at every boundary, one canonical create path · RLS-with-policies on every new table (org-scoped where B2B) · unit+integration tests (scoring & payments require coverage thresholds) · lint-enforced file-size/complexity caps, typed columns (no untyped `Json` scores) · follows `lib/api`/`app/actions`/`components`/`packages/shared` conventions + `audit:design-system` passes.

Start every session by reading the masterplan + this brief, then explore the named files before writing code. Be a meticulous senior/staff engineer: plan first, present the plan, checkpoint before anything irreversible.

---

## WS-0.1 — Quality foundation `[BLOCKING — do this first; it IS the quality guarantee]`

**Objective:** Stand up the typed data layer + the CI-enforced quality gates that every later IELTS card depends on. After this, sub-bar code physically cannot merge.

**Read first (DebateLab)**
- `apps/web/src/lib/supabase/*` (client setup — note it's currently untyped), `apps/web/src/types/database.ts` (hand-written today), `apps/web/src/lib/api/*` + `apps/web/src/app/actions/*` (the loader/mutation conventions), `package.json` scripts (`test:*`, `audit:design-system`), `supabase/migrations/*`, and the CI config (`.github/workflows/*` or equivalent).
- Masterplan §2 (the Quality Bar) — this card implements it.

**Build**
1. **Generate real Supabase DB types** (via `supabase gen types` or the `supabase-debatelab` MCP `generate_typescript_types`) into a generated file; add the **`<Database>` generic** to `createClient`/`createServerClient`. Make it **additive** — new code is fully typed; existing untyped code keeps compiling.
2. **Repository discipline:** confirm/establish the `lib/api` repository pattern and add a lint rule/check that **bans inline `supabase.from(...)` in pages/components** (reads go through `lib/api`).
3. **Validation convention:** a small Zod-at-boundary helper/pattern for server actions + route handlers; document "one canonical create path per entity."
4. **RLS-coverage check:** a script that flags any `public` table lacking RLS policies; wire it into CI as a gate.
5. **Lint caps:** ESLint `max-lines` / complexity rules (no god-files); ban untyped `Json` for score columns by convention.
6. **CI gates:** ensure CI runs and **gates** typecheck + lint + tests + `audit:design-system`; add coverage thresholds for `scoring`/`payments` paths.

**Guardrails:** do not break existing debate code (typegen + generic are additive; migrate call-sites lazily). Don't touch Lumist.

**Acceptance:** CI fails on a deliberately sub-bar change (untyped, no-RLS, god-file, missing test) and passes on a compliant demo table (typed + RLS + Zod + test). Existing app still builds + tests green.

**Out of scope:** IELTS schema/content (WS-0.3), subject axis (WS-0.2).

---

## WS-0.2 — Subject axis + flip on the engine `[depends on WS-0.1]`

**Objective:** Introduce `subject` (debate | ielts) as a first-class dimension orthogonal to the existing EN/VI language axis; add IELTS to the switcher; enable the already-built (but flagged-off) learning engine for the IELTS track.

**Read first (DebateLab)**
- `apps/web/src/lib/features.ts` (the `STUDENT_COURSES_ENABLED` flag), the locale/switcher (`apps/web/src/i18n/*`) and `packages/shared/src/practice/language.ts` (`PRACTICE_LANGUAGE_CONFIG` — the config-map pattern to mirror), root layout/routing, and the activity-engine entry points (`app/actions/activities.ts`, `components/activities/*`, the course/activity routes).

**Build**
1. Add a `subject` axis (debate | ielts) in routing/state + as a tag on engine content; keep it orthogonal to EN/VI.
2. Extend the mode switcher with an IELTS entry; scope nav, dashboards, and content queries by active subject.
3. Flip `STUDENT_COURSES_ENABLED` on **scoped to the IELTS track** (debate behavior unchanged) so the existing activity engine surface is reachable under IELTS.

**Acceptance:** selecting IELTS loads the (currently empty) engine surface scoped to subject=ielts; debate is completely unaffected; subject persists across navigation. DoD satisfied.

**Out of scope:** IELTS content, renderers, scoring.

---

## WS-0.3 — IELTS data model + RLS `[depends on WS-0.1]`

**Objective:** Create the IELTS-specific schema — typed columns, RLS from day one, one canonical create path — extending the existing activity/attempt substrate.

**Read first**
- Masterplan §6 (data model). DebateLab's existing content/attempt schema (`supabase/migrations/*`, the activities/activity_attempts + practice_attempts/analysis_jobs DDL) to extend rather than duplicate.

**Build (SQL migrations + regenerate types)**
1. Question-type enum + `subject`/`skill` dimensions; `passages`, `listening_sections`, `audio_assets`.
2. Mock structure on the existing attempt substrate (timed multi-section).
3. Scoring tables with **typed columns (no untyped Json)**: `band_conversions`, `attempt_band_scores` (per-criterion + computed bands).
4. `writing_responses` + `speaking_responses` (incl. a typed `phoneme_report` shape) on the submission substrate.
5. **RLS policies on every new table** (learner-owned; org-scoped where B2B later applies). Regenerate DB types (WS-0.1 pipeline).

**Acceptance:** migrations apply on a Supabase branch first (review SQL), RLS-coverage check green, types regenerated, a smoke read/write works typed. Then apply to primary after review.

**Out of scope:** renderers, scoring logic, authoring UI (later cards).

---

### Fan-out map
Run **WS-0.1 solo first**. Then **0.2 / 0.3** in parallel; **4.1** can also start (it depends only on 0.1). Once **0.3** lands, every Wave-1 card below is parallel-safe — fan them across your sessions (your ~4 accounts become the cap, so run in batches).

- `4.1` → dep **0.1** (start early)
- `1.1` `1.2` `1.3` `2.1` `3.1` `3.2` → dep **0.3**
- `3.3` → dep **3.2** · `2.2` (results/band layer) → dep **2.1 + 1.2** (generate when needed)

---

## Wave 1 briefs

> Every card below inherits the **Shared context** block + the **Quality Bar DoD** at the top of this doc. Be a meticulous senior/staff engineer: read the named files, present a plan, then implement. Lumist is **read-only reference** — re-express its ideas in DebateLab's stack (typed `supabase-js`, no Prisma, no god-files). Honor masterplan **§2.7 engine-purity**: new behavior goes in IELTS modules or *registered activity types*, never hard-coded into the core engine.

### WS-1.1 — Lift the lesson-chunk authoring format `[dep 0.3]`
**Objective:** Bring Lumist's content-authoring model into DebateLab (re-expressed/typed) and extend DebateLab's admin authoring for IELTS item types, with Draft→QA→Publish + versioning.
**Read:** Lumist `features/lesson/types.ts` (the discriminated-union Zod chunk schema — TEXT/IMAGE/QUESTION/VIDEO/CHART, progressive "parts", ANNOTATE/ELIMINATE, per-chunk locale), `ChunkEditor.tsx`, `LessonChunkRenderer.tsx`, inline-question creation in `app/api/admin/lessons/route.ts`, and the target shape `features/lesson/test-ielts-reading-lesson.json`. DebateLab `apps/web/src/components/admin/courses/*` (existing builders), `apps/web/src/components/courses/renderers/*`, `app/actions/courses.ts`.
**Build:** a typed chunk schema (in `packages/shared` or `lib`), authoring UI for IELTS chunk/question types (built on the activity registry), a QA/publish workflow + content versioning.
**Acceptance:** a teacher can author + QA + publish each IELTS chunk/question type; the IELTS-reading prototype shape round-trips; DoD met (typed, Zod, RLS, tests).
**Out of scope:** TTS (1.3), test assembly (2.1), scoring (3.x).

### WS-1.2 — IELTS question-type renderers + answer-eval `[dep 0.3]`
**Objective:** Player components + variant-tolerant auto-grading for every IELTS objective question type, registered as activity types.
**Read:** DebateLab `apps/web/src/lib/activity/registry.ts`, `lib/activity/validators.ts`, `components/activities/*`, `ActivityPlayerWrapper.tsx`, and the server-scoring pattern in `app/actions/activities.ts` (scoreQuiz/scoreMatching/scoreFillBlank/…). Lumist `lib/assessment/answer-comparison.ts` (reference for matching/numeric/variant logic — extend, don't copy).
**Build:** renderers + server-authoritative scorers for T/F/NG, Y/N/NG, matching (headings/info/features), sentence/summary/note/table/flowchart completion, short answer, diagram/map/plan labeling, MCQ single/multi — each a **registered activity type** ({schema+player+validator+scorer}). Accept-variant tolerance for completion types.
**Acceptance:** every type renders, captures, and auto-grades server-side; scores are typed; engine-purity preserved (registry, not core edits); DoD met.
**Out of scope:** timed orchestration (2.1), Writing/Speaking (3.x).

### WS-1.3 — TTS Listening-audio pipeline `[dep 0.3]`
**Objective:** Generate multi-accent Listening audio from hand-authored scripts and attach it to `listening_sections`/`audio_assets`.
**Read:** the `audio_assets`/`listening_sections` schema from 0.3; DebateLab `lib/ai/*` provider/env patterns; Supabase Storage usage in the repo.
**Build:** a script→audio pipeline (provider env-driven — Azure/Google/ElevenLabs, picked on cost/quality), multi-voice/accent (UK/US/AUS) per speaker, store to Supabase Storage + write a typed `audio_asset` row, and a preview/regenerate control in the authoring UI.
**Acceptance:** a listening section authored as a script renders playable multi-accent audio; assets versioned + typed; DoD met.
**Out of scope:** the listening question UI (1.2), test timing (2.1).

### WS-2.1 — Timed multi-section mock engine (Assess mode) `[dep 0.3]`
**Objective:** A timed, computer-delivered full-mock orchestration layer **on top of** the existing `activity_attempts` substrate (this is the "Assess" mode — §2.7: a layer, not a core edit).
**Read:** DebateLab `app/actions/activities.ts` (attempt lifecycle), `components/activities/ActivityPlayerWrapper.tsx`, results assembly `lib/results/session-result.ts`. Lumist `features/assessment/services/server/assessment-attempt.service.ts` (clean, generic attempt/section lifecycle — reference the DESIGN) and `lib/assessment/time-calculation.ts` (reference the timing ALGORITHM only — keep ours bounded, do NOT reproduce the 1,395-line god-file).
**Build:** section timer + per-section deadlines (L 30m+10m / R 60m / W 60m / S ~14m), pause/resume, section navigation, Listening audio playback, submit→grade→persist. Reuse objective scorers from 1.2.
**Acceptance:** a user can sit a full timed Reading + Listening section with pause/resume and section nav; attempt + section timing persisted + typed; engine core untouched; DoD met.
**Out of scope:** raw→band conversion + results UI (2.2, generate next), Writing/Speaking scoring (3.x).

### WS-3.1 — IELTS Writing scorer `[dep 0.3]`
**Objective:** A new rubric/prompt bundle in DebateLab's existing async AI-scoring pipeline that band-scores Writing transparently.
**Read:** DebateLab `lib/practice-analysis/*` (service/persistence/request/retry-guard/snapshot/**prompt-bundles**), `lib/practice-analysis/evaluators/*`, `api/practice-attempts/route.ts`, `api/queues/practice-analysis/route.ts`, `lib/prompts.ts` (schema-builder pattern), `lib/ai/provider-selection.ts`, `lib/corpus/*` (RAG). The `attempt_band_scores` schema from 0.3.
**Build:** an IELTS Writing rubric + prompt bundle (4 criteria: TR/TA, CC, LR, GRA), **Task-2 double-weighting + half-band rounding** computed into typed band columns; inline corrections (grammar/lexis/cohesion spans); paragraph feedback; Band-9 model rewrite via a new IELTS exemplar corpus in `lib/corpus/*`; VN-language explanation option. Route via the cheap-first provider policy; meter usage.
**Acceptance:** an essay → per-criterion + overall band with the correct weighting/rounding math, inline corrections, and a model rewrite; all via the existing queue/job/poll/results machinery; scoring tests meet coverage threshold; DoD met.
**Out of scope:** Speaking (3.2), payments/metering UI (4.x).

### WS-3.2 — IELTS Speaking scorer (async) `[dep 0.3]`
**Objective:** Record→transcribe→band-score Speaking on the existing pipeline, reusing the `speaking` evaluator.
**Read:** DebateLab `lib/practice-analysis/evaluators/speaking.ts` (already exists), the practice-analysis pipeline (as in 3.1), `lib/stt/*` (Deepgram + repair; consider Groq-Whisper for cost), `lib/prompts.ts`. The `speaking_responses`/`attempt_band_scores` schema from 0.3.
**Build:** audio capture → STT → an IELTS Speaking rubric/prompt bundle (FC, LR, GRA, Pron) → typed per-criterion + overall band (mean→half-band); "exact lines where marks were lost." Reuse the queue/job/results machinery.
**Acceptance:** a recorded Part 1/2/3 answer → transcript + transparent 4-criteria band; reuses the async pipeline; DoD met.
**Out of scope:** phoneme detail (3.3), live conversational examiner (later).

### WS-3.3 — Phoneme pronunciation (Azure Speech) `[dep 3.2]`
**Objective:** Add phoneme-level pronunciation into the Speaking Pronunciation criterion (the launch differentiator).
**Read:** WS-3.2's Speaking pipeline + the typed `phoneme_report` shape from 0.3; `lib/ai/*` provider/env patterns.
**Build:** integrate Azure Speech Pronunciation Assessment (accuracy/fluency/completeness/prosody + word- and phoneme-level vs reference IPA); store a typed `phoneme_report`; feed it into the Pronunciation sub-score; expose a per-sound (color-coded IPA) view. Env-driven + metered.
**Acceptance:** a speaking result shows a per-phoneme map and the Pronunciation band reflects it; cost metered; DoD met.
**Out of scope:** non-speaking skills.

### WS-4.1 — Port Lumist payments `[dep 0.1]` (start early)
**Objective:** Faithfully port Lumist's payment/subscription/metering subsystem into DebateLab's typed `supabase-js` stack and wire it to DebateLab's existing entitlement gate. Port the scar-tissue, not Prisma.
**Read (Lumist, reference):** `features/subscription/services/server/subscription-server.service.ts`, `revenuecat-webhook.service.ts`, `features/stripe-payment/services/server/stripe-server.service.ts`, `app/api/webhooks/stripe/route.ts`, `lib/stripe/*`, `lib/zalopay/*`, `features/zalopay-payment/services/server/zalopay-server.service.ts`, `app/api/public/payment/zalopay/callback/route.ts`, `lib/config/pricing.ts`, `lib/middleware/{feature-gate,subscription-access}.ts`, satellites `features/{referral,discount-codes,affiliate}`, and the payment test patterns under `tests/`. **DebateLab:** `apps/web/src/lib/entitlements.ts` (the gate to wire into), `lib/api/orbs.ts` + existing `referrals` (reconcile, don't duplicate).
**Build:** re-express Stripe + ZaloPay + RevenueCat (VNPay later) checkout + webhooks in DebateLab's stack, preserving the **idempotency** (dedup tables, advisory locks, out-of-order protection, signature verification, dispute handling); `user_feature_usage`-style metering; retune `FEATURE_LIMITS` for Thinkfy. Use DebateLab's id convention (NOT Lumist's `generate_prefixed_sequential_id`). RLS on all payment tables.
**Guardrails:** money path — preserve every idempotency guarantee; reuse Lumist's test scenarios; **payments coverage threshold is mandatory** (DoD).
**Acceptance:** a real checkout + webhook grants/meters entitlement through the existing gate; idempotent under replay/out-of-order; payment tests pass at threshold; DoD met.
**Out of scope:** pricing UI polish, B2B org billing (Phase 5).
