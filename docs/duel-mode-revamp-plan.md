# Duel Mode Revamp — Implementation Plan

**Product:** Thinkfy / DebateLab — 1v1 Debate Duel Mode
**Author:** Planning session (senior PM + architect + full-stack)
**Status:** Plan only — no implementation performed. Ready for a future Claude/Codex build session.
**DB verified against:** local project Supabase MCP (`rsbnryympenjyzhhchhu`) + repo migrations `001`–`20260612230948`.

---

## 0. Locked product decisions (from stakeholder)

These are fixed inputs. Every section below honors them.

| # | Decision | Implication |
|---|----------|-------------|
| 1 | **Live synchronous** duels | Both debaters online at once; real-time turns with a **server-authoritative clock**. |
| 2 | **Spoken voice** input | Mic + live transcription (reuse Deepgram + audio pipeline + AI judge). No typed-text mode in v1. |
| 3 | **Build ELO, keep it hidden ("shadow")** | Finish the rating engine and compute/store ratings on every eligible duel, but **do not expose rank/leaderboard UI yet**. Behind a flag (`DUEL_RANKED_UI_ENABLED=false`) so we validate calibration before showing it. |
| 4 | **AI-opponent backfill** for empty queues | If no human matches within a timeout, match against the existing AI debater. **AI-backfilled duels are `rated=false`** so they never pollute the shadow ELO dataset. They **still cost the standard 200-orb entry** (no AI discount). |

**Economy & forfeit rules (stakeholder-confirmed):**
- Every duel costs **200 orbs at start**, including AI-backfill.
- On abandonment, the **non-forfeiting player is fully refunded (200 orbs) with no rating change**; the **forfeiting player gets no refund**. Both refunded if both abandon before any human speech.
- For **matchmaking/rated-eligible** duels only: the **forfeiter takes a hidden MMR loss**; the **opponent-of-a-forfeiter gains no MMR** (asymmetric — can't farm wins off rage-quits). A sustained disconnect past the grace window during your turn counts as a forfeit. Normal symmetric ELO applies only to fully **judged** matchmaking duels.

**Deliverable of the build sessions:** ship Duel Mode to all users (remove the admin-only gate) as a polished, casual-but-competitive-underneath live voice duel, comparable in quality to the AI practice + AI judge flow.

---

## Build status (updated 2026-06-13)

**Phase 0 (DB foundation) — IMPLEMENTED & shadow-verified.** Migrations written to `supabase/migrations/` and applied to the project DB:
- `20260613090000_duel_server_clock` — `phase_deadline` column + `duel_phase_duration()` + maintenance trigger (DB-authoritative clock) + overdue index.
- `20260613090100_duel_rating_forfeit_internalization` — restored the dropped `duel_entry` orb type + added `duel_refund`; `outcome_reason`/`forfeited_by`/`ai_opponent` columns; internalized the (already-complete) judged Elo behind a `service_role` function with an auth wrapper; **forfeit Elo** (forfeiter loses, opponent no gain); **`forfeit_debate_duel()`** RPC with the confirmed refund policy.
- `20260613090200_duel_watchdog_function` — `advance_overdue_debate_duels()` forward-progress function (auto-submit placeholder + advance → no soft-locks). **`pg_cron` scheduling deferred** to the judge-endpoint session.
- `20260613090300_duel_security_integrity_hardening` — `finalize_debate_duel_stats` participant gate + idempotency (`stats_finalized_at`); pinned `generate_duel_share_code` `search_path`; hardened `can_access_duel` body; revoked `anon` execute on the server-only helper RPCs.

**Bugs found & fixed along the way:** (1) `orb_transactions` check constraint had silently **lost `duel_entry`** (a later migration recreated it) — duel start would have failed the credit charge; (2) `finalize_debate_duel_stats` had **no auth gate and no idempotency** (XP-farm + double-XP on retry); (3) the rating engine was **NOT a stub** (audit corrected — it was fully implemented).

**Shadow test:** `scripts/duel-shadow-test.ts` (`npm run duel:shadow [-- --judge]`) fakes a 4-speech duel, calls the real judge, and validates judged Elo (+20/−20, K=40, idempotency), the low-confidence exclusion branch, forfeit asymmetry, refunds, and the abandonment branch. **28/28 assertions pass (incl. the real model); fully self-cleaning** (DB verified back to baseline). Artifacts in `qa-artifacts/duel-shadow/`.

**Phase 1 (backend correctness) — IMPLEMENTED & verified.** Migration `20260613090400_duel_forfeit_refund_fix`; code in `apps/web/src/lib/api/debate-duels.ts`, `src/types/debate-duel.ts`, and routes `…/[shareCode]/judge/route.ts` + `…/[shareCode]/forfeit/route.ts`:
- **Speech-submit hardening** — overwrite-allowing upsert → insert-once (`ignoreDuplicates`); a resubmit / retry / watchdog-placeholder is now an idempotent no-op (can't overwrite a speech or double-advance the phase).
- **Server clock in the room view** — `serverTime`, `phaseDeadline`, `outcomeReason` are now surfaced (enables skew-corrected client countdowns; consumed in the UI phase).
- **Idempotent judging** — `judgeAndFinalizeDebateDuel` no-ops if a judgment already exists (no double-LLM on retry); new `judgeDebateDuelRoom` + `POST …/judge` let a present client finish a duel stuck in `judging` (closes the soft-lock at the judging step).
- **Forfeit** — `POST …/forfeit` → `forfeit_debate_duel`. **Bug caught by the shadow test & fixed:** the refund went through `adjust_orb_balance`, which a later migration turned into a self-only / practice-only helper (it would `FORBIDDEN` on the opponent refund) — rewrote refunds inline and internalized the resolver (`forfeit_debate_duel_internal`) so the watchdog/shadow can drive it. Typecheck passes (exit 0).

**Phase 2 (realtime + forfeit UI + placeholders) — IMPLEMENTED & verified (typecheck + lint clean).** Client-only (no migration). Files: `hooks/use-debate-duel-room.ts`, `lib/debate-duels/shared.ts`, `components/debates/{duel-room-page,duel-result-page,duel-illustration}.tsx`, `types/debate-duel.ts`, `public/images/duel/`.
- **Realtime hook** — added Supabase **Presence** (online/connected dots per debater) alongside the `postgres_changes` backstop; a **client-side judging backstop** that pokes the idempotent `POST /judge` when a duel is parked in `judging` with no judgment (closes the soft-lock from the client side); exposes `onlineUserIds`.
- **Server-authoritative timer** — `getPhaseRemainingSeconds` now counts down against `phase_deadline` (server-owned) instead of the client-computed `phaseStartedAt`. (A skew-correction offset was prototyped then dropped — the React rules disallow ref-in-render / setState-in-effect for it, and `phase_deadline` + the server watchdog are the real enforcement; `serverTime` stays in the payload for a future fetcher-captured offset.)
- **Forfeit UI** — a "Forfeit duel" control + inline confirm in the live room (`POST /forfeit`), and a **won-by-forfeit / cancelled result screen** (`forfeitedBy` now surfaced in the room view) so forfeited duels no longer hit "result unavailable". Non-judged-but-completed shows a friendly "Judging…" state.
- **Placeholder illustrations** — `DuelIllustration` renders `/images/duel/<name>.webp` with a labelled placeholder fallback until the art is dropped; wired into the judging + forfeit-result screens. Drop-point: `apps/web/public/images/duel/` (README lists filenames; prompts in §13).

**Phase 3 — watchdog scheduled + AI-opponent backfill (end-to-end).**
- **Watchdog scheduled** (`20260613091000_duel_watchdog_schedule`): `pg_cron` job `duel-watchdog` runs `advance_overdue_debate_duels()` every 5s. This is what makes the live flow actually progress — `prep` / `rebuttal-prep` have no speaker to advance them, so without it a duel stalls at "Shared prep." (The no-client `pg_net` judge handoff is still deferred to deploy.)
- **AI speech generator** (`lib/debate-duels/ai-opponent.ts`): self-contained `generateDuelAiSpeech` (DeepSeek primary, Gemini fallback) produces an on-side spoken opening / rebuttal that responds to the human's speeches. Shadow-proven end to end (`npm run duel:shadow -- --ai`): the AI generated a 354-word opening + a 224-word rebuttal and the judge decided the full AI duel — **31/31 assertions, self-cleaning**.

**AI backfill — IMPLEMENTED end-to-end & verified** (migration `20260613092000_duel_ai_backfill`):
- `ensureAiOpponentUser()` (lib) — lazily creates the sentinel AI user (`ai-opponent@thinkfy.system`) via the admin API.
- `create_ai_backfill_duel` (DB) + `createDebateDuelAiBackfill` (lib) — human = proposition (charged 200), AI = opposition (free), `ai_opponent`, `rated=false`, starts in_progress; marks the human's queued ticket matched so the existing poll redirects them in.
- `submit_ai_duel_speech` (DB) — inserts the AI's opposition speech (round 2 / 4) and advances; idempotent.
- `aiTurnDebateDuel` (lib) + `POST …/[shareCode]/ai-turn` — generates the AI speech (`generateDuelAiSpeech`) and submits it; the human's client triggers it when it observes the AI's turn (hook `isAiTurn`), mirroring the auto-judge backstop. Room shows "AI Sparring Partner is composing its response…".
- `POST …/matchmaking/ai-backfill` + matchmaking-page wiring — offers a "practice against an AI" button after ~12s queued and auto-starts after ~35s, then redirects into the room.
- Watchdog (`20260613092000`) updated to **not** auto-placeholder the AI's (opposition) phases — it waits for the client-driven `/ai-turn`.
- **Shadow: `npm run duel:shadow -- --ai` → 40/40** (AI generated a 339-word opening + 206-word rebuttal, judge decided; full create → AI-turns → judging DB flow verified; self-cleaning to baseline). Typecheck + lint clean (0 errors).
- Caveat: the live two-browser flow isn't E2E-tested in a browser (needs two authed admin sessions); verified via shadow + typecheck + lint + pattern-matching.

**Duel UI refresh — DONE (real illustrations wired).** All 20 generated illustrations are in `public/images/{duel,smart-popups,rewards}/`. The hub (`duel-hub-page.tsx`) is rebuilt illustration-forward — a hero band (`thinkfy_duel_hero_v1`), the subtext softened out of a bare box, and the two mode cards now use `DuelIllustration` with `thinkfy_duel_matchmaking_v1` / `thinkfy_duel_hero_v2`. The matchmaking searching state shows the radar illustration; the room "AI is judging" state shows `thinkfy_duel_ai_opponent_v1`; the forfeit result shows `thinkfy_duel_victory_v1` / `thinkfy_duel_rematch_v1`. Verified: typecheck 0, lint 0 errors, **design-system typography audit passed** (no ad-hoc type values), no new raw colors. (Browser-E2E not reachable — hub is auth + admin gated.)

**Launch prep — DONE (2026-06-13).**
- **Admin gate → launch feature flag.** `DUEL_ENABLED` / `NEXT_PUBLIC_DUEL_ENABLED` added to `lib/features.ts` (default OFF → admins-only, preserving shadow-testing), plus `canAccessDuels(supabase, userId) = DUEL_ENABLED || isAdminUser` in `lib/auth/admin.ts`. Swapped into all **5 page guards + 13 `/api/debate-duels` routes** (+ the matchmaking `getAdminUser` helper) and the **sidebar nav** (`DUEL_ENABLED || isAdmin`, so the entry appears for everyone on launch). Launch = set `NEXT_PUBLIC_DUEL_ENABLED=true` — no code change.
- **`pg_net` no-client judge handoff.** Migration `20260613093000_duel_judging_pg_net_handoff`: installs `pg_net`, adds `judge_dispatched_at`, `dispatch_overdue_duel_judging()` (reads `duel_judge_endpoint` + `duel_watchdog_secret` from **Supabase Vault**, `net.http_post`s to `/judge` for any duel parked in `judging` >20s with no client, 90s retry backoff), scheduled via `pg_cron` `duel-judging-dispatch` every 15s. **Safe no-op until the Vault secrets are set.** TS: `judgeDebateDuelRoomInternal(shareCode)` (service-role, no participant gate) + a Bearer-secret branch on `POST /judge` (`DUEL_WATCHDOG_SECRET ?? CRON_SECRET`); the finalizer is now service-role-preferring (`getDuelWriteClient()` + `process_debate_duel_rating_internal`) so it completes with no cookie. Selection predicate unit-checked; no-op guard verified.
- **Two latent pre-launch bugs caught by the new shadow scenario & fixed** (both would have soft-locked the *first real duel* in `judging`): `store_debate_duel_judgment` rejected service-role (`auth.uid()=null`) callers → `20260613094000` (mirror the `finalize_debate_duel_stats` gate); `finalize_debate_duel_stats` inserted `activity_log.activity_type='duel_completed'` which the check constraint disallowed → `20260613095000` (additive). `finalizeDuelAnalytics` also made non-fatal so a stats hiccup can never block completion.
- **Popups.** `out-of-orbs-modal` (was a Sparkles icon) + `referral-credits-dialog` now use `thinkfy_popup_out_of_orbs_v1` / `thinkfy_popup_referral_v1`. The DB-driven smart-popup *campaigns* were intentionally left on their bespoke per-campaign art (the generic `thinkfy_popup_feature/feedback/reminder` would be a downgrade).
- **Lobby.** The matchmaking "opponent matched" header is now illustration-forward (`thinkfy_duel_matchmaking_v2`).
- **Verification:** typecheck 0, lint 0 errors, design-system audit passed, **shadow `--judge --ai` = 49/49** (incl. the new no-cookie internal-finalize + idempotency scenario), DB self-cleaned to baseline (0 leftover shadow users).

**Deploy-time steps (config only, not code):** set `NEXT_PUBLIC_DUEL_ENABLED=true`; in Supabase SQL run `select vault.create_secret('<app-url>','duel_judge_endpoint')` and `select vault.create_secret('<secret>','duel_watchdog_secret')`; set `DUEL_WATCHDOG_SECRET` (or reuse `CRON_SECRET`) in the web env to the same secret.

**Still optional / deferred:** broadcast-based realtime steering (the `postgres_changes` + presence backstop is sufficient for v1); live two-browser E2E in a real browser (covered by shadow + typecheck + lint).

---

## 1. Product audit — current Duel Mode

**Verdict: ~70% built, 0% released.** The feature is genuinely substantial — not a stub — but it is gated admin-only behind a *"1v1 Debate is coming soon"* wall, and several load-bearing pieces are stubbed or client-trusting. It reads as a strong v0 prototype that was paused before hardening.

### What works conceptually
- **Two entry paths:** friend invite (6-char share code) and ranked matchmaking (10-minute ticket).
- **Real debate format:** shared prep → proposition opening → opposition opening → rebuttal prep → proposition rebuttal → opposition rebuttal → judging → result. Spoken, with live transcription.
- **AI judge** produces a comparative ballot (6 criteria), per-side feedback, round breakdown, and clash map — reusing the practice judge.
- **Result screen** is genuinely rich: winner badge, confidence, ballot, round breakdown, clash map, transcript, "ask the coach" follow-up.
- **Integrity monitor** tracks tab-switching/paste/blur for matchmaking duels.

### Product gaps & rough edges
| Area | Problem |
|------|---------|
| **Access** | Admin-only gate (`isAdminUser`) → no real users can play. |
| **Cold start** | Matchmaking needs two humans queuing on the same topic/difficulty/timer combo *simultaneously*, with **exact-match** criteria → queue is almost always empty. No AI fallback. |
| **Soft-locks** | If a player never submits their final speech, the duel hangs forever in `opposition-rebuttal` (no server timeout). |
| **No forfeit / abandon** | No surrender, no opponent-left handling, no reconnect affordance. A player is trapped for the full duration. |
| **No presence** | UI can't show "opponent connected / typing / left." |
| **No user-facing history or rank** | History API exists (`/api/debate-duels/history`) but isn't surfaced. Rating never changes. |
| **Mobile** | The live room is a desktop grid; cramped and partly off-screen on phones. |
| **Onboarding** | No "what is a duel / how it works" moment; the format (4 speeches, prep windows) is not taught. |
| **Rematch/next** | Result page links a rematch CTA, but there's no smooth "queue again / next opponent" loop. |

---

## 2. Technical audit — current implementation

Stack: Next.js (App Router, `apps/web`, `@thinkfy/web`) monorepo, Supabase (Postgres + Auth + Realtime + Storage), SWR for data, Zustand for solo-practice session state, Deepgram STT, Gemini/DeepSeek LLM providers. No Supabase Edge Functions — **all server logic is Next.js route handlers + Postgres `SECURITY DEFINER` RPCs**.

### Key files (verified)
- **Server orchestration:** [apps/web/src/lib/api/debate-duels.ts](apps/web/src/lib/api/debate-duels.ts) — `createDebateDuelRoom`, `getDebateDuelRoom`, `joinDebateDuelRoom`, `setDebateDuelReady`, `startDebateDuelRoom`, `submitDebateDuelSpeech`, `judgeAndFinalizeDebateDuel`, `recordDebateDuelIntegrityEvent`, `enterDebateDuelMatchmaking`, `cancelDebateDuelMatchmaking`.
- **API routes:** `apps/web/src/app/api/debate-duels/**` — `route.ts`, `[shareCode]/{route,join,ready,start,result,integrity}.ts`, `[shareCode]/speeches/[roundNumber]/route.ts`, `matchmaking/ticket/route.ts`, `history/route.ts`.
- **Realtime/data hook:** [apps/web/src/hooks/use-debate-duel-room.ts](apps/web/src/hooks/use-debate-duel-room.ts) — SWR poll (`DUEL_POLL_INTERVAL_MS = 3000`) **plus** Supabase `postgres_changes` on the 4 duel tables, channel `debate-duel-{shareCode}`; any change → `mutate()`.
- **Phase logic:** [apps/web/src/lib/debate-duels/shared.ts](apps/web/src/lib/debate-duels/shared.ts) — `getNextDuelPhase`, `getPhaseDescriptor`, `getPhaseRemainingSeconds` (client-computed from `phase_started_at`).
- **Integrity monitor:** [apps/web/src/hooks/use-duel-integrity-monitor.ts](apps/web/src/hooks/use-duel-integrity-monitor.ts).
- **Types:** [apps/web/src/types/debate-duel.ts](apps/web/src/types/debate-duel.ts).
- **Components:** `apps/web/src/components/debates/` — `duel-hub-page`, `duel-create-page`, `duel-matchmaking-page`, `duel-room-page`, `duel-setup-flow`, `duel-result-page`, `duel-transcript-tab`, `duel-clash-map`.

### Critical technical weaknesses (these are the revamp's spine)
1. **Client-authoritative clock.** Timers are computed in the browser from `phase_started_at`; the server neither enforces deadlines nor rejects late/early speeches. Clock skew breaks the countdown; a determined client can submit after time. **(Highest priority.)**
2. **No phase watchdog.** Phase advance is purely event-driven (on speech submit). A silent/disconnected speaker = permanent soft-lock; judging may never trigger.
3. **Realtime is poll-heavy and presence-blind.** 3s polling *and* postgres_changes (redundant, racey), no presence, no reconnect/abandon model.
4. **Rating engine — corrected audit (NOT a stub).** `process_debate_duel_rating()` is **fully implemented** (Elo expected-score, tiered K-factor 40/32/24, delta math, `duel_rating_events` writes, `duel_mmr_profiles` updates) — an earlier sub-agent misreported it as a stub; reading the live function definition disproved that. The real gaps are: (a) it hard-requires `auth.uid()` to be a participant, so a **service-role / watchdog caller silently `FORBIDDEN`s** (rating only runs when a participant's own request triggers it); and (b) there is **no forfeit path** (forfeiter-loses / winner-no-gain). Fix = internalize the math behind a service-role-callable function + add a forfeit variant.
5. **Security surface.** Duel `SECURITY DEFINER` RPCs (`can_access_duel`, `store_debate_duel_judgment`, `finalize_debate_duel_stats`) are callable directly by `anon`/`authenticated` via PostgREST (confirmed via advisors). Speech rows are upsertable (overwrite). `generate_duel_share_code` has mutable `search_path`.
6. **Speech validation is thin.** Empty/short transcripts accepted; audio never validated against `duration_seconds`; no idempotency on resubmit.
7. **No tests** for duel state machine, timers, or matchmaking.

---

## 3. Database / schema audit (verified via MCP)

8 duel tables exist; the 6 live ones are **all in the `supabase_realtime` publication** (realtime is on). No edge functions. `pg_cron`/`pg_net`/`http` extensions are **available but not installed** (key enabler for the watchdog).

### Tables (verified columns/constraints)
- **`debate_duels`** — `status ∈ {lobby,in_progress,judging,completed,expired,cancelled}`, `current_phase ∈ {lobby,prep,proposition-opening,opposition-opening,rebuttal-prep,proposition-rebuttal,opposition-rebuttal,judging,completed}`, `duel_kind ∈ {custom,matchmaking}`, `rated bool=false`, `integrity_status ∈ {clean,warned,suspicious,no_contest}`, timers (`prep_time_seconds=120`, `opening_time_seconds=180`, `rebuttal_time_seconds=120`), `entry_cost=200`, `phase_started_at`, `started_at`, `completed_at`, `expires_at=now()+24h`, `rating_processed_at`, `rating_excluded_reason`, `practice_language ∈ {en,vi}`, `practice_topic_key`, `topic_category_key`, side fields.
- **`debate_duel_participants`** — `role ∈ {proposition,opposition}` (nullable until assigned), `joined_at`, `ready_at`, `credits_charged_at`, `completed_at`, `display_name_snapshot`, `avatar_url_snapshot`.
- **`debate_duel_speeches`** — `round_number ∈ [1,4]`, `speech_type ∈ {opening,rebuttal}`, `side`, `transcript`, `audio_storage_path`, `duration_seconds`, `metadata jsonb`. **(4 speeches total per duel.)**
- **`debate_duel_judgments`** — `winner_side`, `winner_participant_id`, `judge_model`, `confidence numeric`, `verdict jsonb`, `summary`.
- **`debate_duel_matchmaking_tickets`** — `status ∈ {queued,matched,cancelled,expired}`, topic/difficulty/timers, `expires_at=now()+10m`, `matched_duel_id`, `matched_ticket_id`, `practice_language`, `topic_category_key`.
- **`debate_duel_integrity_events`** — `action_type`, `severity ∈ {info,warning,critical}`, `is_suspicious`, `suspicious_reason`.
- **`duel_mmr_profiles`** — `rating numeric=1000 (0..3000)`, `matches_count`, `wins`, `losses`, `provisional=true`, `seed_source ∈ {default,skill_snapshot}`, `seed_snapshot`, `last_match_at`.
- **`duel_rating_events`** — `result ∈ {win,loss}`, `rating_before/after/delta`, `expected_score`, `k_factor`, `integrity_status`, `judge_confidence`. **(Schema AND write path both exist — `process_debate_duel_rating()` writes here. Corrected from the earlier 'stub' note; only the forfeit path is missing.)**

### Security advisors (duel-relevant)
- **WARN — anon-executable `SECURITY DEFINER`:** `can_access_duel`, `store_debate_duel_judgment`, `finalize_debate_duel_stats` reachable by `anon` via `/rest/v1/rpc/*`. Revoke `EXECUTE` from `anon`/`authenticated` (these should be called only by the service-role server).
- **WARN — authenticated-executable RPCs:** `join_debate_duel`, `start_debate_duel`, `set_debate_duel_ready`, `enter/cancel_debate_duel_matchmaking`, `process_debate_duel_rating`, `ensure_duel_mmr_profile` — decide per-RPC whether direct client RPC is intended; the Next.js layer already wraps them, so prefer revoking and calling via service role.
- **WARN — mutable `search_path`:** `generate_duel_share_code` (+ others). Pin `search_path`.
- **WARN — leaked-password protection disabled** (account-wide; note, not duel-specific).

**Schema conclusion:** the data model is **good and largely sufficient**. The revamp is mostly *behavior* (server clock, watchdog, rating write-path, presence, security grants) plus a handful of additive columns — **not** a schema rewrite. No destructive migration needed; existing duel volume is negligible (prototype data).

---

## 4. Realtime vs semi-realtime — recommendation

**Recommendation: Live synchronous with a server-authoritative clock — implemented as Supabase Realtime (Presence + Broadcast) for liveness, `postgres_changes` as the durable backstop, and a Postgres `pg_cron` watchdog as the source of truth for phase deadlines.**

Rationale: the locked decision is live + voice, which is exactly where today's build is weak (client clock, no watchdog, no presence). The fix is not "more polling" — it's moving **authority** to the server and using realtime only for low-latency UX.

### Transport design
- **Server time + deadlines are authoritative.** When a phase starts, the server stamps `phase_started_at` and computes `phase_deadline = phase_started_at + duration`. Room payloads and broadcasts include `server_time` so clients can correct clock skew (`offset = server_time − client_now`) and render an accurate countdown to `phase_deadline`.
- **Phase advancement = event-driven + watchdog.** Normal path: active speaker submits → server advances. Safety net: a `pg_cron` job (`advance_overdue_debate_duels`, every ~5s) force-advances any `in_progress` duel past its deadline (auto-submitting whatever transcript exists, or an empty placeholder flagged in `metadata`), so **no duel can ever soft-lock**. When the watchdog reaches `judging`, it triggers judging (via a present client, with a `pg_net` HTTP fallback to an internal judge endpoint if both players are gone).
- **Presence** (`channel.track()`) drives "opponent connected / reconnecting / left" UI and feeds abandonment logic.
- **Broadcast** carries ephemeral signals that shouldn't hit the DB every tick: "opponent is preparing," "opponent started speaking," mic-level/recording state. **No live transcript is shown to either debater** (not your own, not the opponent's). STT still runs in the background and the transcript is logged/stored for judging and the post-duel transcript tab — the live stage shows only a recording indicator + audio levels.
- **`postgres_changes`** stays as the durable backstop for the canonical room state (status/phase/speeches/judgment), but the redundant 3s SWR poll is **removed** in favor of realtime + a single reconcile fetch on (re)connect.

> Async/correspondence mode is explicitly **out of scope** for v1 (decision #1) but the schema supports it later — the watchdog/deadline model degrades gracefully into per-turn deadlines.

---

## 5. Proposed user flow

```
                 ┌────────────────────────── Duel Hub ──────────────────────────┐
                 │  [ Quick Match ]   [ Challenge a Friend ]   [ Your Duels ▸ ]  │
                 └───────────────┬───────────────────────┬──────────────────────┘
        Quick Match              │                       │  Challenge a Friend
                                 ▼                       ▼
                    ┌──────────── Setup ───────────┐   ┌──────── Setup ────────┐
                    │ category · difficulty · time │   │ topic · side · timers │
                    └───────────────┬──────────────┘   └───────────┬───────────┘
                                    ▼                              ▼
                       ┌──── Matchmaking ────┐            ┌──── Lobby (invite) ────┐
                       │ animated VS search  │            │ share code / QR        │
                       │ Presence + ticket   │            │ seats · ready · start  │
                       │  ⏱ N s no human ──▶ AI backfill  └────────────┬───────────┘
                       └──────────┬──────────┘                         │
                                  └───────────────┬─────────────────────┘
                                                  ▼
                         ┌──────────────── Live Duel Room ────────────────┐
                         │  Shared prep ⏱  → P opening → O opening →       │
                         │  Rebuttal prep ⏱ → P rebuttal → O rebuttal     │
                         │  presence · server clock · turn banner · mic   │
                         └───────────────────────┬─────────────────────────┘
                                                 ▼
                              ┌──── Judging (AI) animated ────┐
                              └───────────────┬────────────────┘
                                              ▼
                         ┌────────────── Result ──────────────┐
                         │ winner · ballot · clash map · coach │
                         │  [ Rematch ]  [ New opponent ]      │
                         └─────────────────────────────────────┘
```

Key flow upgrades vs today: AI backfill on the matchmaking branch; presence everywhere; a teaching "how a duel works" first-run card; abandonment → graceful forfeit/refund; a real "queue again / new opponent" loop from Result.

---

## 6. Proposed system architecture

```
 Browser (Duel Room)
   │  ├─ Supabase Realtime: Presence (connected/AFK) + Broadcast (ephemeral signals)
   │  ├─ Supabase Realtime: postgres_changes (durable room state backstop)
   │  └─ Next.js API (service-role mutations only; no direct client RPC)
   ▼
 Next.js Route Handlers  ── orchestrate ──▶  Postgres RPCs (SECURITY DEFINER, service-role only)
   │   create/join/ready/start/submit/judge/result/integrity/matchmaking
   │
   ├─ Deepgram (live STT)                     Postgres
   ├─ Gemini 2.5 Flash judge (judgeDebateDuel)   ├─ duel tables (authoritative state + deadlines)
   └─ Audio → Supabase Storage                   ├─ pg_cron watchdog: advance_overdue_debate_duels() every 5s
                                                 │     └─ pg_net → internal /judge fallback when no client present
                                                 └─ rating write-path: process_debate_duel_rating() (real ELO, shadow)
```

**Source-of-truth principle:** Postgres owns duel state and deadlines. Next.js owns LLM/STT/storage side effects and is the only caller of mutating RPCs (revoke client RPC grants). Realtime is a delivery optimization, never authority. The watchdog guarantees forward progress independent of any client.

---

## 7. Frontend component plan

Target feel: **Duolingo/Brilliant** — generous whitespace, strong hierarchy, friendly-not-childish, **no subtitle under every title**, no "Trường Teen" string in UI. Mobile-first for the live room.

### New / rebuilt components (`apps/web/src/components/debates/`)
| Component | Purpose |
|-----------|---------|
| `duel-hub-page.tsx` *(rebuild)* | 3 clean cards: Quick Match · Challenge a Friend · Your Duels. Remove admin gate. Job-board-style card grid; remove dense subtext. |
| `duel-how-it-works.tsx` *(new)* | First-run teaching card/sheet: the 4-speech format, prep windows, voice, judging. Dismissible, remembered. |
| `duel-matchmaking-page.tsx` *(rebuild)* | Animated "VS" searching state with presence, elapsed timer, **"finding a human… (N s) → bringing in an AI sparring partner"** transition; cancel. |
| `duel-lobby.tsx` *(extract from `duel-setup-flow.tsx`)* | Seats, ready states with presence dots, invite (code + QR), start. |
| `duel-room-page.tsx` *(major rebuild)* | Mobile-first single-column live stage: turn banner, server-synced ring timer, mic state, your-notes drawer, opponent presence/status. **No live transcript text is shown to either debater** — render only a recording/mic-level indicator; STT still runs and is logged (see §4). Consumes the new realtime hook. |
| `duel-stage-timer.tsx` *(new)* | Server-authoritative countdown ring (renders to `phase_deadline` w/ skew correction); states: prep, your turn, opponent turn, overtime grace. |
| `duel-turn-banner.tsx` *(new)* | "Your opening — speak now" / "Listening to {opponent}" / "Prep". |
| `duel-presence-bar.tsx` *(new)* | Both avatars with live connected/reconnecting/left chips. |
| `duel-result-page.tsx` *(refresh)* | Keep the strong ballot/clash content; restyle for whitespace + mobile; add **Rematch** / **New opponent** loop; hide any rank/rating UI behind `DUEL_RANKED_UI_ENABLED`. |
| `duel-history-page.tsx` *(new)* | User-facing past duels (wire the existing history API) with W/L, topic, opponent, replay link. |
| `duel-clash-map.tsx`, `duel-transcript-tab.tsx` *(polish)* | Finish/clean; ensure graceful empty states. |
| `duel-abandon-dialog.tsx` *(new)* | Forfeit/leave confirmation + "opponent left" outcome screen. |

### Hooks
- `use-debate-duel-room.ts` *(rewrite)* → realtime-first (Presence + Broadcast + postgres_changes), single reconcile fetch on connect/reconnect, server-time skew offset, no 3s poll.
- `use-duel-presence.ts` *(new)* → wraps Realtime Presence (track self, read opponent).
- `use-duel-stage-clock.ts` *(new)* → derives remaining time from `phase_deadline` + offset; emits `onExpire`.
- `use-duel-integrity-monitor.ts` *(keep, extend)* → unchanged contract; ensure it no-ops for AI-backfill duels appropriately.

---

## 8. Backend / API plan

Principle: **all mutations go through Next.js route handlers using the service-role client; revoke direct client `EXECUTE` on duel RPCs.** Add server-authoritative timing and the watchdog.

### Route handlers (`apps/web/src/app/api/debate-duels/`)
| Route | Change |
|-------|--------|
| `route.ts` (POST create) | Remove admin gate; keep rate-limit; set `rated` correctly (custom = unrated). |
| `[shareCode]/route.ts` (GET) | Include `server_time` + `phase_deadline`; trim payload; add presence-agnostic canonical state. |
| `[shareCode]/join`, `/ready`, `/start` | Keep; ensure atomic via RPC; emit a Broadcast "state changed" nudge. |
| `[shareCode]/speeches/[roundNumber]` (POST) | **Server-side deadline + phase + round validation**; reject duplicate/late submissions (idempotent on `(duel_id, round_number)`); flag empty/short via integrity; advance phase server-side. |
| `[shareCode]/judge` *(new, internal)* | Idempotent judging trigger with a DB advisory lock; callable by a present client **and** by the watchdog via `pg_net` (shared-secret header). |
| `[shareCode]/result` (GET) | Keep; hide rating fields behind flag. |
| `[shareCode]/forfeit` *(new)* | Voluntary forfeit / leave; resolves duel, refund policy, integrity note. |
| `[shareCode]/integrity` (POST) | Keep. |
| `matchmaking/ticket` (GET/POST/DELETE) | Add **AI-backfill**: if `queued` past `MATCH_AI_BACKFILL_SECONDS`, create an AI-opponent duel (`rated=false`); relax exact-match (bucket timers, widen difficulty over time). |
| `history/route.ts` (GET) | Wire to the new history page. |

### Economy & forfeit (server-enforced)
- **Charge 200 orbs at start** for all duels (human, friend, AI-backfill) — already the default; keep.
- **Abandonment/forfeit resolution** (in `forfeit` route + watchdog): non-forfeiting player → full 200-orb refund + no rating change; forfeiter → no refund. Both refunded if abandoned before any human speech.
- **Forfeit rating (matchmaking/rated only):** forfeiter takes a hidden MMR loss; the other side gains nothing. AI/friend/custom duels are unrated → no MMR movement.

### Env / flags
- `DUEL_RANKED_UI_ENABLED=false` (shadow ELO).
- `DUEL_MATCH_AI_BACKFILL_SECONDS=20` (tune).
- `DUEL_JUDGE_PROVIDER` already exists (`getDuelJudgeProvider`) → default Gemini 2.5 Flash.
- `DUEL_WATCHDOG_SECRET` (shared secret for the `pg_net` → `/judge` fallback).
- Overtime grace window (`DUEL_PHASE_GRACE_SECONDS=3`).

---

## 9. Database migration plan (additive, non-destructive)

New migrations under `supabase/migrations/` (timestamped). No table drops; existing prototype rows are fine.

1. **`enable_duel_scheduler`** — `create extension if not exists pg_cron; create extension if not exists pg_net;` (+ `http` if needed).
2. **`duel_server_clock`** — add `debate_duels.phase_deadline timestamptz`; backfill function to set it from `phase_started_at + duration`; helper `duel_phase_duration(phase, prep, opening, rebuttal)`.
3. **`duel_watchdog`** — `advance_overdue_debate_duels()` (force-advance past deadline, auto-submit placeholder speech with `metadata.auto=true`, move to `judging`/`completed`); `cron.schedule('duel-watchdog','*/5 * * * * *', ...)` (5s). Includes abandonment: if a participant is absent past grace during their turn, auto-forfeit that speech and flag.
4. **`duel_judging_trigger`** — when watchdog sets `judging` with no recent client activity, `pg_net` POST to internal `/api/debate-duels/{code}/judge` with `DUEL_WATCHDOG_SECRET`.
5. **`duel_rating_engine`** — implement real ELO in `process_debate_duel_rating()`: compute `expected_score` from both `duel_mmr_profiles.rating`, `k_factor` (provisional vs settled), write `duel_rating_events`, update `duel_mmr_profiles` (rating/wins/losses/matches/provisional/last_match_at). **Gate: only `rated=true` AND `duel_kind='matchmaking'` AND `integrity_status IN ('clean','warned')` AND human-vs-human.** (Computed always; UI hidden by flag → shadow.) **Forfeit asymmetry:** for a forfeited matchmaking duel, apply the rating **loss to the forfeiter only** (record a `duel_rating_events` row for them) and **no gain/row for the opponent**; symmetric win/loss ELO applies only to fully judged matchmaking duels.
6. **`duel_speech_no_overwrite`** — replace upsert-overwrite with insert-once + unique `(duel_id, round_number)`; reject re-submit at DB level.
7. **`duel_security_grants`** — `revoke execute` from `anon`/`authenticated` on server-only RPCs (`can_access_duel`, `store_debate_duel_judgment`, `finalize_debate_duel_stats`, `process_debate_duel_rating`, and the join/ready/start/matchmaking RPCs if the Next.js layer is the sole caller); pin `search_path` on `generate_duel_share_code` et al.
8. **`duel_abandon_forfeit`** — columns/states for forfeits: `debate_duels.outcome_reason` (`judged|forfeit|abandoned|expired`), participant `forfeited_at`. **Refund:** full 200-orb refund to the non-forfeiting player (via `adjust_orb_balance`), no refund to the forfeiter; both refunded if abandoned before any human speech. The forfeiter's hidden MMR loss is applied through `process_debate_duel_rating()` (migration 5) for matchmaking duels only.
9. *(optional)* **`duel_ai_opponent`** — `debate_duels.ai_opponent boolean=false` + an AI participant identity convention (system user / sentinel) so AI duels render cleanly and are excluded from rating.

> Verify each RPC body before editing (the build session should `select pg_get_functiondef(...)` for `process_debate_duel_rating`, `start_debate_duel`, `enter_debate_duel_matchmaking`, `join_debate_duel`, `submit`-path, and `store_debate_duel_judgment` first).

---

## 10. AI judge integration plan

The judge is the most reusable asset — keep it, harden the trigger.

- **Reuse** `judgeDebateDuel()` + `buildDuelJudgmentPrompt()` ([apps/web/src/lib/gemini.ts](apps/web/src/lib/gemini.ts), [apps/web/src/lib/prompts.ts](apps/web/src/lib/prompts.ts)) and `store_debate_duel_judgment` RPC. Model: **Gemini 2.5 Flash** via `getDuelJudgeProvider()` (DeepSeek fallback). Telemetry via `recordAiQualityRun()`.
- **Idempotent trigger:** new `/judge` endpoint takes a Postgres **advisory lock** on the duel id; if a judgment already exists → return it. Both a present client *and* the watchdog (`pg_net`) can call it; only one wins.
- **Robustness:** validate the LLM JSON against the `DebateDuelJudgment` shape before `store_*`; on malformed output, retry once then store a minimal safe verdict + `qualityWarnings`. Never leave a duel stuck in `judging`.
- **AI-opponent duels:** the AI's speeches are produced by the existing opponent engine ([apps/web/src/lib/truong-teen/opponent-quality.ts](apps/web/src/lib/truong-teen/opponent-quality.ts) / `/api/rebuttal` infra) at the matched difficulty; the same judge scores both sides. These duels are `rated=false`.
- **Shadow rating link:** after judging, call `process_debate_duel_rating()` (now real). It computes/stores ratings for eligible duels but **the UI shows nothing** until the flag flips. Add an **admin** rating-events inspector (extend `dashboard/admin/duels`) to eyeball calibration during the shadow period.

---

## 11. UI/UX revamp plan (site-wide polish toward Duolingo/Brilliant)

Design system is solid (Tailwind v4 `@theme`, base-ui dialogs, CVA buttons, cyan `#00B8D9` brand). Tighten consistency and apply the duel polish broadly.

**Principles to enforce (per stored preferences):** generous whitespace; one clear title, **no explanatory subtext under every title**; job-board-style card grids; friendly-not-childish; strong hierarchy; minimal clutter.

**⚠️ Dark-mode token gotcha (known issue):** do **not** use Tailwind `/opacity` modifiers on theme color tokens (e.g. `bg-primary/10`) — they bake the light-mode literal and break dark mode. Use solid tokens or `opacity-*` utilities. Audit duel + popup components for this.

### Concrete moves
- **Modal radius & shadow tokens:** standardize on `rounded-[28px]` frame / `rounded-2xl` buttons / `rounded-xl` controls; introduce `shadow-modal`/`shadow-card`/`shadow-button` tokens and replace ad-hoc `shadow-2xl`.
- **Illustration frames:** define one aspect contract (`object-cover` in a fixed `h-[200px] w-[240px]`-style frame) and a visible skeleton/fallback; stop letterboxing/cropping mismatched art.
- **Subtext audit:** remove `DialogDescription` subtitles where they're noise (title-select, onboarding, support) — fold essential context into body or drop.
- **Duel screens:** rebuild for whitespace and mobile (Section 7); the live room becomes a calm, single-focus stage rather than a dense dashboard grid.
- **Button/touch sizing:** consistent scale (primary `h-12`, secondary `h-11`, compact `h-10`); 44px min targets.

---

## 12. Popup / referral modal redesign plan

Two offenders identified: **referral dialog** ([apps/web/src/components/shared/referral-credits-dialog.tsx](apps/web/src/components/shared/referral-credits-dialog.tsx)) and the **smart-popup frame** ([apps/web/src/components/shared/smart-popup-host.tsx](apps/web/src/components/shared/smart-popup-host.tsx)).

### Referral dialog — why it feels cluttered & the fix
Today: 7 stacked sections crammed into ~304px width (illustration, oversized title, reward badge, description, link box, 2-button social grid, fallback) with ad-hoc vertical rhythm. **Redesign:**
- **One hero illustration** (relevant: two friends + a credit-coin spark — see prompts) in a clean fixed frame.
- **One headline**, no competing subtitle; the reward is the headline ("Give 50, get 50").
- **Primary action = copy link** (big, single, satisfying). Social share collapses to small secondary icons (or a single "Share" that opens the native sheet on mobile).
- Even spacing scale (one rhythm: 24px section gaps), wider content column, more breathing room.
- Reduce element count from 7 → ~4 (illustration · headline · copy-link · secondary share).

### Smart-popup frame — sizing/illustration fix
- Lock the illustration aspect + `object-cover`; ship art that matches the frame so survey/feature popups stop looking letterboxed.
- Replace any off-topic art (the "irrelevant illustration") with intent-matched illustrations (prompts below).
- Keep the well-built survey internals; just fix the frame + art + remove subtext-under-title.

---

## 13. Illustration / image-generation prompts (for ChatGPT)

Following the referenced imagegen-frontend-web methodology: **locked palette, one committed style, transparent backgrounds, no text in image, anti-AI-slop, deliberate second-read detail.** Drop results into `apps/web/public/images/...` and wire as placeholders (see file plan). Use `.webp`, transparent where noted.

**LOCKED PALETTE (use in every prompt):** primary cyan `#00B8D9`; deep teal `#0788A0`; light aqua `#8BE8F7`; ink `#102936`; muted slate `#657B84`; cream surface `#F3FCFE`; reward amber `#FFD166`; success green `#34C759`. **Style lock:** modern flat vector illustration, soft geometric shapes, subtle long shadows, gentle rounded forms, friendly-but-credible (Brilliant/Duolingo-adjacent, *not* childish), thin consistent linework, low-chroma palette-matched gradients only. **Global negatives:** no text/letters, no purple/blue glow gradients, no floating blobs, no fake logos, no drop-shadow soup, no photoreal, no clip-art mascots.

> Naming convention: `thinkfy_duel_[slug]_v1.webp`, `thinkfy_popup_[slug]_v1.webp`.

1. **Duel hub hero / empty-state** — `thinkfy_duel_hero_v1` — *Two stylized debaters at facing podiums with a subtle "VS" energy between them rendered as a clean spark/bolt in cyan `#00B8D9`, balanced symmetric composition, cream `#F3FCFE` background, amber `#FFD166` accent on the spark. Second-read detail: a tiny speech-bubble exchanging between them. Flat vector, transparent background, 16:10 horizontal.*
2. **Matchmaking "searching for opponent"** — `thinkfy_duel_matchmaking_v1` — *A radar/orbit motif: one debater avatar centered, soft concentric cyan rings searching outward, a second silhouette just appearing at the edge. Calm, hopeful, motion implied. Transparent background, square 1:1.*
3. **AI sparring partner (backfill identity)** — `thinkfy_duel_ai_opponent_v1` — *A friendly, clearly-AI debate sparring partner: a soft geometric robot/orb character holding a tiny gavel or note card, cyan `#00B8D9` + light aqua, warm not cold, credible not cartoonish. Reads instantly as "AI, on your side to practice." Transparent background, square 1:1.*
4. **Victory / result** — `thinkfy_duel_victory_v1` — *A debater raising a small laurel or ribbon, confetti in amber `#FFD166` + cyan, restrained (not party-popper chaos), proud and earned. Second-read detail: a small scorecard in hand. Transparent background, 4:3.*
5. **Close / honorable-effort (loss/tie) result** — `thinkfy_duel_rematch_v1` — *Two debaters shaking hands or fist-bumping over a podium, mutual-respect tone, encouraging "go again" energy, cyan + cream. Transparent background, 4:3.*
6. **Referral hero (replacement for `share-thinkfy.webp`)** — `thinkfy_popup_referral_v1` — *Two friends side by side passing a glowing credit-coin (amber `#FFD166`) between them, a subtle "+50 / +50" implied by two small coin sparkles (no actual numerals/text), warm and generous, cream background. Clean, ONE clear focal moment (not busy). Transparent background, 3:2.*
7. **Feedback survey popup** — `thinkfy_popup_feedback_v1` — *A friendly speech bubble with a small star-rating motif and a pencil, inviting tone, cyan + amber accent. Matches popup frame aspect. Transparent background, 4:3.*
8. **Feature announcement popup** — `thinkfy_popup_feature_v1` — *A gift/spark reveal motif (a card lifting to show a cyan spark), "something new" energy, restrained. Transparent background, 4:3.*
9. **Reminder / streak popup** — `thinkfy_popup_reminder_v1` — *A soft bell with a gentle cyan ring and a small flame/streak ember in amber, calm not alarming. Transparent background, 4:3.*
10. **Out-of-credits upsell** — `thinkfy_popup_out_of_orbs_v1` — *An empty/near-empty coin jar with one last amber coin glinting, hopeful refill arrow in cyan, not punitive. Transparent background, 4:3.*

For each: request 2–3 variations, pick the one that best matches the locked style, and keep all duel/popup art in the **same** illustration system so the product feels cohesive.

---

## 14. Implementation phases (sequenced)

**Phase 0 — Foundations & safety (server clock + watchdog + grants).** *Highest leverage; fixes soft-locks and the trust model.* Migrations 1–4, 6, 7; server-side speech validation; `server_time`/`phase_deadline` in payloads; revoke RPC grants. *Exit:* no duel can soft-lock; late/duplicate speeches rejected; judging always fires.

**Phase 1 — Realtime liveness.** Rewrite the room hook to Presence + Broadcast + postgres_changes, remove 3s poll, add skew-corrected clock; presence bar + reconnect UI; forfeit/abandon flow (migration 8). *Exit:* opponent connection state is visible; reconnect works; leaving resolves cleanly.

**Phase 2 — Cold-start: AI backfill + matchmaking relaxation.** AI-opponent duels (`rated=false`), backfill timer, bucketed matchmaking criteria, friendly "bringing in an AI sparring partner" UX (migration 9). *Exit:* a solo user can always get a duel quickly.

**Phase 3 — Shadow ELO.** Implement real `process_debate_duel_rating()` (migration 5), keep all rank UI behind `DUEL_RANKED_UI_ENABLED=false`, add admin rating-events inspector. *Exit:* ratings compute correctly on eligible human duels; data accrues for validation; zero rank UI shown.

**Phase 4 — UX revamp & release.** Rebuild hub/room/matchmaking/result/history for whitespace + mobile; how-it-works teaching; rematch/new-opponent loop; **remove admin gate** → launch. Wire placeholder illustrations. *Exit:* feature is live, polished, mobile-clean.

**Phase 5 — Popup/illustration polish (parallelizable).** Referral + smart-popup redesign; drop in new illustrations; subtext audit; dark-mode opacity-token audit. *Exit:* popups feel spacious and on-brand.

**Phase 6 — Flip ranked (later, after shadow validation).** Once ELO calibration is trusted: set `DUEL_RANKED_UI_ENABLED=true`, expose rank badges, ranked queue, seasons, leaderboard tie-in.

---

## 15. File-by-file task breakdown (for the build session)

> Verify current contents before editing; paths are confirmed to exist unless marked *(new)*.

### Database (`supabase/migrations/`)
- *(new)* `..._enable_duel_scheduler.sql` — install `pg_cron`, `pg_net`.
- *(new)* `..._duel_server_clock.sql` — `phase_deadline` column + `duel_phase_duration()` + backfill.
- *(new)* `..._duel_watchdog.sql` — `advance_overdue_debate_duels()` + 5s cron + abandonment.
- *(new)* `..._duel_judging_trigger.sql` — `pg_net` fallback to `/judge`.
- *(new)* `..._duel_rating_engine.sql` — real `process_debate_duel_rating()`.
- *(new)* `..._duel_speech_no_overwrite.sql` — insert-once + unique `(duel_id, round_number)`.
- *(new)* `..._duel_security_grants.sql` — revoke client `EXECUTE`; pin `search_path`.
- *(new)* `..._duel_abandon_forfeit.sql` — outcome/forfeit columns + refund.
- *(new, optional)* `..._duel_ai_opponent.sql` — `ai_opponent` flag + identity.

### Backend (`apps/web/src/`)
- `lib/api/debate-duels.ts` — remove admin gate; server-side deadline/phase/round validation in `submitDebateDuelSpeech`; idempotent judging via advisory lock; AI-backfill in `enterDebateDuelMatchmaking`; forfeit; include `server_time`/`phase_deadline`; call real `process_debate_duel_rating`.
- `app/api/debate-duels/[shareCode]/judge/route.ts` *(new)* — idempotent judge trigger (client + watchdog secret).
- `app/api/debate-duels/[shareCode]/forfeit/route.ts` *(new)*.
- `app/api/debate-duels/[shareCode]/speeches/[roundNumber]/route.ts` — enforce server validation.
- `app/api/debate-duels/matchmaking/ticket/route.ts` — AI backfill + relaxed matching.
- `app/api/debate-duels/route.ts`, `.../{join,ready,start,result,integrity,history}` — gate removal, payload trims, flag-gated rating fields.
- `lib/debate-duels/shared.ts` — server-deadline-aware phase helpers; keep client renderers.
- `lib/ai/provider-selection.ts` — confirm `getDuelJudgeProvider` default.
- `types/debate-duel.ts` — add `server_time`, `phase_deadline`, `outcome_reason`, `ai_opponent`, presence types.

### Frontend (`apps/web/src/`)
- `hooks/use-debate-duel-room.ts` — realtime-first rewrite (drop poll, add skew offset, reconcile-on-connect).
- `hooks/use-duel-presence.ts` *(new)*, `hooks/use-duel-stage-clock.ts` *(new)*.
- `components/debates/duel-hub-page.tsx` — rebuild (3 cards, no gate, no subtext).
- `components/debates/duel-room-page.tsx` — major mobile-first rebuild.
- `components/debates/duel-stage-timer.tsx`, `duel-turn-banner.tsx`, `duel-presence-bar.tsx`, `duel-how-it-works.tsx`, `duel-abandon-dialog.tsx`, `duel-history-page.tsx` *(all new)*.
- `components/debates/duel-matchmaking-page.tsx` — animated search + AI-backfill UX.
- `components/debates/duel-setup-flow.tsx` → extract `duel-lobby.tsx`.
- `components/debates/duel-result-page.tsx` — restyle + rematch/new-opponent loop + flag-gate rank.
- `app/[locale]/(protected)/debates/**` — remove admin-only redirects; add `/debates/history` route.

### Popups / design (`apps/web/src/`)
- `components/shared/referral-credits-dialog.tsx` — declutter rebuild (7→4 elements).
- `components/shared/smart-popup-host.tsx` — illustration aspect lock + subtext removal.
- `app/globals.css` — `shadow-modal/card/button` tokens; confirm radius scale.
- `public/images/{duel,smart-popups,rewards}/` — drop new `thinkfy_*` illustrations as placeholders.
- **Audit pass:** grep duel + popup components for `/[0-9]` opacity modifiers on theme tokens (dark-mode bug) and for subtitle-under-title.

### Admin / observability
- `app/[locale]/(protected)/dashboard/admin/duels/page.tsx` — add **shadow rating-events inspector** (rating deltas, expected score, K, integrity) for calibration.
- `lib/analytics/events.ts` — duel funnel events (Section 16).

---

## 16. Testing plan

- **Unit (Vitest, `npm run test:*` pattern):** phase machine (`getNextDuelPhase`, deadline math, skew correction); ELO math (`expected_score`, K-factor, delta, provisional graduation) with golden cases; matchmaking bucketing; speech validation (empty/short/late/duplicate). Add `test:duels` script.
- **DB function tests:** `advance_overdue_debate_duels()` force-advance + no-soft-lock; `process_debate_duel_rating()` writes correct events only for eligible duels; insert-once speech constraint; RPC grant revocation (anon/authenticated cannot call server-only RPCs).
- **Integration (two-client simulation):** scripted dual-session duel (reuse the `ai-opponent-shadow` harness style under `scripts/`) covering create→join→ready→start→4 speeches→judge→result; opponent-disconnect mid-turn → watchdog forfeit; both-disconnect → `pg_net` judging fallback; AI-backfill path.
- **Realtime/manual:** Presence transitions, reconnect after network drop, clock accuracy across skewed clients (verify via `preview_*` against `npm run dev:web`).
- **Mobile:** room/lobby/result at 380px (`preview_resize`) — no off-screen controls; light + dark.
- **Security:** confirm advisors clear for the revoked RPCs; verify late/duplicate speech rejected server-side; verify AI duels never write rating events.
- **Analytics:** assert duel funnel events fire (`duel_started`, `duel_match_found`, `duel_ai_backfill`, `duel_speech_submitted`, `duel_completed`, `duel_forfeit`, `duel_rematch`).

---

## 17. Risks, tradeoffs, open questions

### Risks & mitigations
- **`pg_cron` 5s watchdog load.** Cheap at current scale; index `debate_duels (status, phase_deadline)`. If it ever grows, move to a single partial index + LIMIT batches.
- **`pg_net` judging fallback reliability.** It's best-effort; the present-client path is primary. Keep the watchdog idempotent and retried so a missed `pg_net` call self-heals next tick.
- **Voice + two strangers latency/awkwardness.** Mitigated by clear turn banners, presence, prep windows, and AI backfill (most early duels will be vs AI anyway).
- **ELO calibration wrong.** Exactly why it's in shadow first — validate via the admin inspector before flipping the flag.
- **AI-backfill perceived as "fake."** Be transparent ("AI sparring partner"), mark clearly, keep unrated. Don't disguise a bot as a human.
- **Realtime rewrite regressions.** Phase 0 (DB authority) lands first so correctness doesn't depend on the realtime layer; realtime is a UX layer over a correct core.

### Tradeoffs taken
- Postgres-native watchdog (`pg_cron`) over an external worker/queue — fewer moving parts, no new infra, fits the no-edge-functions reality.
- Realtime as UX-only, DB as authority — slightly more server round-trips, far less cheating/desync surface.
- Reuse the practice AI judge wholesale — fastest path to quality; accept its current rubric.

### Resolved decisions (stakeholder-confirmed 2026-06-12)
1. **AI-backfill cost** — AI-backfill duels **still cost the full 200 orbs** (no discount).
2. **Abandonment refund** — **full 200-orb refund to the non-forfeiting player, no refund to the forfeiter**; both refunded if abandoned before any human speech.
3. **Forfeit & hidden MMR** — forfeiting a **matchmaking** duel = **hidden MMR loss for the forfeiter**; the opponent **gains no MMR**. Unrated (AI/friend/custom) duels have no MMR movement. Symmetric ELO only on judged matchmaking duels.
4. **Languages** — ship **both `en` and `vi` at launch** (topic banks, judge prompts, and Deepgram STT already support both via `practice_language`).
5. **Live transcript visibility** — **no live transcript shown to either debater** during the duel. STT still runs and transcripts are **logged/stored** for judging and the post-duel transcript tab; the live stage shows only a recording/mic-level indicator, never the text.

### Deferred (out of scope for v1)
- **Spectate / replay** — not in v1; revisit after launch.

### Open questions
- None blocking. Phases 0–4 are fully specified and ready to build.

---

*End of plan. Recommended first build session: Phase 0 (server clock + watchdog + grants) — it removes the soft-lock/cheating risk and makes every later phase safe to build on.*
