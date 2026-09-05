# Learner home local evidence harness

Renders the actual DashboardContent and calls getDashboardData with synthetic
Supabase query results shared with the loader tests. This is not evidence of live
authentication, production records, or successful production practice sessions.

From the repository root:

```sh
node scripts/qa/learner-home/install.mjs
node scripts/qa/learner-home/mock-rest.mjs
```

In another terminal, start this checkout's Next server with a same-origin mock
Supabase URL (keeps the real CSP in force):

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:3073/vi/dev/learner-home-qa NEXT_PUBLIC_SUPABASE_ANON_KEY=thinkfy-local-qa-only npm run dev -w @thinkfy/web -- --hostname 127.0.0.1 --port 3073
```

Open `/vi/dev/learner-home-qa?scenario=empty` or the EN equivalent in a dedicated
Ego task space. Scenarios: `empty`, `unavailable`, `partial`, `recovered`. The
`qa_home_scenario` cookie overrides the query to let the real Retry button refresh
into another source state without remounting the home. `qa_home_delay=1` adds a
one-second fixture delay for pending-state checks. Remove both cookies after QA.
Use the real `thinkfy_theme=light|dark` cookie and reload to exercise themes.

The fixture account is `00000000-0000-0000-0000-000000000073`. The mock REST
process listens only on loopback port 3074 and accepts profile reads/updates only
for that account. It records welcome dismissal in memory, including a
`fixture_marker` preference that must survive the write. Restarting it resets
that data. The localhost-only temporary route proxies this mock transport so the
production welcome component runs unchanged; it cannot reach real users.

After QA, stop the two terminal processes and remove all temporary entrypoints:

```sh
node scripts/qa/learner-home/install.mjs --remove
```

Never commit the generated `apps/web/src/app/[locale]/dev/learner-home-qa`
directory. The templates are outside the app and add no deployed Vercel function.
Evidence from this task lives in `qa-artifacts/learner-home/` (gitignored), with a
reviewable summary in `docs/design-evidence/learner-home-trust.md`.
