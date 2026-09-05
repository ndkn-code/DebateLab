# Live duel entry verification — 2026-09-05

## Behavior and implementation

Human matchmaking never invokes AI automatically. After 12 seconds an optional button states that AI starts now and costs 200 Credits. It is the sole AI invocation path. The existing endpoint requires explicit AI consent and an owned ticket ID.

The migration locks that ticket before doing any ledger work. Cancelled/expired tickets cannot create or charge an AI duel. An already matched ticket returns its existing room, whether human or AI. The original 200-credit ledger entries, unrated AI start, permissions and ready/start rules are preserved. Old unbound AI RPC callers fail closed after migration.

Client cancellation invalidates delayed entry, poll, match-navigation and AI responses. Cancellation failure leaves a retry action. If a room already exists, cancellation shows an explicit Open room action rather than navigating. A late entry result is cancelled by its exact ticket ID. Leaving uses a best-effort keepalive cancellation; server ticket expiry remains the fallback for browser/network termination.

The lobby retains the authored motion and stored practice language while translating the interface. It shows participant names, human/AI identity, creator identity, readiness, persistent selectable URL/code, QR and a capability-driven action. No email, message, real invitation, microphone or recording was used.

## Gates

All four required gates passed: `npm run audit:design-system`, `npm run test:design-system`, `npm run lint`, and `npm run typecheck -w @thinkfy/web`. Lint reports 12 existing warnings outside this change, no errors. `npm run ci:checks` passed. `npm run test:duel-entry` passes 22 tests (8 PostgreSQL behavior tests and 14 client/consent/clipboard/render tests).

Exact-head GitHub CI status is recorded on the draft PR; local checks above are separate from CI.

## Local test coverage

`npm run test:duel-entry` runs actual PostgreSQL migration behavior through PGlite plus client guard, consent, clipboard, capability and EN/VI rendered-component tests. Scenarios cover one charge on retry, both cancellation orderings, expired/foreign/missing/changed tickets, a human match winning the race, no timer-driven AI invocation, late async responses, denied/missing clipboard, and role-specific Vietnamese actions with an English motion.

The existing live `duel:shadow` harness was updated for the required ticket argument. It was not run against production: it creates users and changes credit balances. Local PostgreSQL tests exercise the affected migration without production credentials.

## Ego browser evidence

Dedicated Ego space **77**, never audit space 63. Local Next server was explicitly started from worktree **4bed** on port **3187**; every matrix row verified `data-qa-worktree="4bed"`.

The local-only fixture mounts the real components and intercepts duel requests with clearly named QA data. It uses a dummy local Supabase URL and no production credentials. The harness source is `scripts/fixtures/duel-entry-qa.tsx`; the temporary app route is removed before commit.

Observed interactions:

- Human queue remained active at **52 seconds**, with **0 AI endpoint requests**, one queue POST, and enabled cancellation. This exceeds the removed 35-second auto-start threshold.
- Explicit AI click sent exactly one request with `opponent: "ai"`, `consent: true`, and the selected ticket ID. A delayed AI response released after cancellation did not navigate.
- Forced cancellation failure displayed localized feedback and left retry enabled. Retry followed by a delayed matched poll stayed on the queue page and exposed **Mở phòng** (Open room) recovery.
- Denied clipboard produced the Vietnamese manual-copy message; the full `/vi/debates/QA1234` URL and `QA1234` code remained read-only/selectable. No network invite request was sent.
- Mark ready sent `{ready:true}`, updated to **1/2 đã sẵn sàng**, and changed the action to **Bỏ sẵn sàng**.

The matrix covers lobby, matchmaking preferences and active queue × EN/VI × light/dark × 1280×720, 1440×900, 768×1024, 390×844 (48 combinations). See `browser-matrix.json`. Dimensions are native CSS pixels, device scale 1, with explicit resize dispatch and a style-settle delay. No horizontal document overflow or missing translation keys was found. The optional AI button was also checked at 390px: it wrapped within the page.

## Limits and release dependency

Production `/vi/debates` returned **504 MIDDLEWARE_INVOCATION_TIMEOUT**, ID `iad1::c48tl-1788626045602-c82df486b242`, before rendering. This independently confirms an infrastructure blocker, not any lobby bug. End-to-end authenticated production verification remains unavailable.

Ego `Page.captureScreenshot` timed out. Browser evidence is real DOM, computed geometry and interaction evidence; no pixel-perfect screenshot comparison is claimed.

Migration `20260905170000_duel_explicit_ai_choice.sql` must accompany this code in a later release. It is tested locally, not applied to production. No production merge, deployment, credit purchase or charge was performed.
