# Teacher assistant workspace — review evidence

Implemented on `codex/teacher-assistant-workspace`, based on `53e107cb` (includes #43 and #45). No production merge, deployment, migration application or student messaging was performed.

## Result

The center assistant is extracted into a conversation workbench with desktop history, a mobile history drawer, scoped center name, class-specific starter prompts, readable Markdown and sources, retained per-conversation drafts, and a visible Send/Stop composer. Proposal review is inline with the answer and uses names/localized fields. External/shared actions require review; private notes and drafts are automatic, with explicit recovery for failed saves.

The existing server action now uses durable, actor-owned runs and a 90-second lease. Progress, history and Stop use authenticated Supabase RPCs independently of Next's serialized action queue. Stop and completion/automatic actions serialize on database locks. Expired runs become retryable failures; retries keep the request identity and get a new lease. A stale attempt cannot complete or execute automatic actions. No per-class retry loop or new Vercel function entrypoint was added.

## Verification

- `npm run audit:design-system`: passed.
- `npm run test:design-system`: passed.
- `npm run lint`: passed; 12 existing warnings outside the changed assistant code.
- `npm run typecheck -w @thinkfy/web`: passed.
- `npm run ci:checks`: passed, including RLS coverage and frozen Vercel function inventory.
- `npm run test:center-operations`: passed, 29 web tests plus 49 service tests.
- `npm run test:ai-coach`: passed.
- `git diff --check`: passed.

`sql-qa.mjs` executes the original chat schema/functions plus the new migration in isolated PGlite. It stubs authentication/membership and external command effects, not the new SQL functions. It verifies read-only summary/history/index, early stop, late completion rejection, fresh retry leases and rejection of old leases, scoped internal note, required review for shared trial assessment, cancellation, idempotent confirmation, explicit failed-draft retry, stop between answer and automatic action, actor isolation and revoked membership. No live database was changed. Output: `sql-qa.log`.

To reproduce the SQL check, install `@electric-sql/pglite` into a temporary directory, then run from the repo root:

```sh
PGLITE_MODULE=/absolute/temp/node_modules/@electric-sql/pglite/dist/index.js node output/teacher-assistant-revamp/sql-qa.mjs
```

## Browser checks

Ego Lite task space 69, isolated from audit space 63. The local server was launched explicitly in this worktree on port 3123. The development-only preview uses the production `TeacherAssistant` with a clearly marked persisted QA API and synthetic QA Teacher Center / QA Debate class / QA Student data. The QA toolbar is separate from product UI.

Verified interactions: read-only summary; executed homework draft; saved internal note; retained draft after refresh; failed request with visible retry; retry without duplicate user message; Stop retains draft and produces no later answer/write; proposal cancel produces zero mocked external effects; confirm produces one effect and removes pending controls; mobile history opens, Escape closes it, and New conversation closes it; Vietnamese request returns Vietnamese answer and localized proposal/source controls. Reload during a request recovered the completed history with no duplicate user message.

The 16-case viewport matrix covers EN/VI × light/dark × 1280×720, 1440×900, 768×1024, 390×844. Every case has `documentElement.scrollWidth === clientWidth`; Send remains within the viewport. Measurements: `viewport-matrix.json`. Screenshots are the corresponding locale/theme/width PNGs. `vi-dark-mobile-summary.png` additionally shows a fresh Vietnamese answer after the mobile drawer correction. Historical conversation content remains in its original language when switching locale; UI labels change locale.

## Release requirements and limits

Apply `supabase/migrations/20260905150000_teacher_workspace.sql` before releasing the new assistant. The migration has been executed only in isolated PostgreSQL, not the live Supabase project. Live provider/organization end-to-end behavior was not exercised: the supplied account's center membership/setup limitation remains outside this task, and it is not evidence of a reproduced live assistant failure. The production center shell with real organization data still needs a post-migration smoke check. Browser reload/navigation occasionally timed out in the Ego/Next development session; these were not classified as production defects.

Stop prevents work that has not committed; committed receipts remain visible. The bounded server action is not a durable background worker: if its host disappears, the lease times out and the teacher retries. The client handles selected-conversation status and retains local drafts; history/proposals/runs are server-backed.

## Provenance

See `composition.md` and `apps/web/src/components/center-operations/teacher-assistant/README.md`. Lumist AgentComposer and AgentConversationList source was partially adapted from local revision `73875b1267cb3a6e36a82af2cd1469285a57e9e1`; runtime informed the control/lease design. The existing Beautiful UI ChatFrame is reused with its MIT provenance. Mobbin references were visually inspected; no Lumist branding, token palette, or unbounded retry behavior was copied.
