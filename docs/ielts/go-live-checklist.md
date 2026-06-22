# IELTS Go-Live Checklist

**Core principle — launch is a reversible flag flip.** `IELTS_ENABLED` is OFF in production today, so
IELTS is admin-only and debate is byte-identical. Flipping `NEXT_PUBLIC_IELTS_ENABLED=true` exposes
IELTS to all users; flipping it back is an **instant kill-switch with zero debate impact**. So launch
is low-risk and rollback is one env change + redeploy.

**Legend:** 🤖 Codex (repo + Supabase MCP + Vercel + browser/computer-use QA) · 👤 You (decisions,
cloud secrets) · 🧑‍🏫 Co-founder (content). Current prod = `main` @ `5b767cc`.

---

## Phase 0 — Pre-flight audit 🤖  *(run now; no launch actions)*
- [ ] **Env gap report** — list Vercel **production** env var names (values hidden); flag missing vs
      required: `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (Speaking pronunciation), the Google TTS
      service account `GOOGLE_TTS_SERVICE_ACCOUNT_JSON` (AUS listening audio), `CRON_SECRET` (replan
      cron), `NEXT_PUBLIC_IELTS_ENABLED` (should still be off/unset), and confirm the existing
      AI (Gemini/Groq/Deepgram), Supabase, and payment keys.
- [ ] **Deploy health** — confirm the latest `main` (`5b767cc`) production deploy on Vercel built +
      deployed cleanly; capture warnings.
- [ ] **Cron** — confirm `apps/web/vercel.json` registers `/api/cron/ielts-replan` and `CRON_SECRET`
      is set; call the route with the secret and confirm a 200.
- [ ] **DB advisors** — run Supabase security + performance advisors; report any RLS gaps,
      SECURITY DEFINER issues, or missing indexes on the `ielts_*` / `activities` / club tables.
- [ ] **Migration parity** — confirm every `supabase/migrations/*ielts*` (esp. the Wave-6.3 ones:
      `skill_drill` plan kind + constraint, reading/writing activity types, review-rating
      idempotency) is recorded as applied on prod.

## Phase 1 — Content floor 🧑‍🏫 + 🤖
- [ ] 🧑‍🏫 Author the real item bank: **≥2 full Academic mocks** (L/R/W/S) with answer keys +
      listening scripts (via the authoring UI / bulk import).
- [ ] 🤖 **Listening audio** — run the WS-6.3e backfill so every `listening_sections.script` has an
      audio asset (us/uk via Deepgram; AUS needs the Google key from Phase 0).
- [ ] 🤖 **Content-readiness report** — count published mocks, questions per skill, audio coverage,
      keys present. Floor = **≥1 full mock that plays end-to-end and scores all 4 skills**.
- [ ] 👤 Decide whether to keep or wipe the `ielts-demo-v1` seed once real content exists
      (cleanup block in `scripts/ielts/seed-demo.sql`).

## Phase 2 — End-to-end QA 🤖  *(browser + computer-use, on prod behind the admin gate — no flip yet)*
- [ ] **B2C flow** as `ndkn.work`: onboarding → diagnostic → predicted band → study plan + Today →
      skill drill → timed mock → results deep-dive → `/ielts/review` → home retention. Screenshot
      each; check console + network. Confirm planner recommends **practice only** + `/ielts/learn`
      is hidden with the upsell.
- [ ] **Scoring runs**: submit a Writing task + a Speaking recording → AI bands + criterion feedback
      return (and a phoneme report if Azure is set).
- [ ] **Listening plays**: audio loads + plays in the mock player.
- [ ] **B2B flow** as `contact.tuandat`: Learn/courses path renders → open + complete an activity →
      XP/evidence/mastery update (verify in DB).
- [ ] **Mobile QA**: home, mock player, Learn path on a phone viewport.
- [ ] **Debate regression**: a normal non-admin account sees no IELTS; debate unchanged.
- [ ] Compile a pass/fail QA report with screenshots + a severity-ranked defect list.

## Phase 3 — Launch 👤 → 🤖
- [ ] 👤 Give the go (content floor met + QA green + secrets provisioned).
- [ ] 🤖 Set `NEXT_PUBLIC_IELTS_ENABLED=true` in Vercel **production**. It's a `NEXT_PUBLIC_` var →
      **baked at build time → trigger a redeploy**, not just an env save.
- [ ] 🤖 Confirm the redeploy succeeded and IELTS is now visible to a non-admin test account.

## Phase 4 — Post-launch verification + monitoring 🤖
- [ ] **Real-user prod walkthrough**: a fresh non-admin account is offered IELTS and the full flow
      works.
- [ ] **Monitor (24–48h)**: Vercel logs / error rate, scoring queues processing, the nightly cron
      firing.
- [ ] **Rollback ready**: any breakage → set `NEXT_PUBLIC_IELTS_ENABLED=false` + redeploy →
      instant kill-switch, debate untouched.

---

### Human-only prerequisites (👤 — Codex cannot create these)
- An **Azure Speech** resource → `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION` (pronunciation scoring).
- A **Google Cloud TTS** service account → `GOOGLE_TTS_SERVICE_ACCOUNT_JSON` (AUS listening voices).
- A **`CRON_SECRET`** value set in Vercel (any strong random string).
- The **go decision** + the flag flip approval.
