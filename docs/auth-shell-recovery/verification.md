# Verification and release boundary

Base: `origin/main` at `53e107cb`. Branch: `codex/auth-shell-recovery`. No production deployment, database migration, RLS modification, service-role query, or feature-body redesign.

The production incident at 2026-09-05 15:43:19 UTC and deployment `dpl_F3aZrkuWU8X49vY1CxxTQjteSMvH` were supplied in the task. This work does not claim that Supabase infrastructure is fixed or that production improved. All new failure measurements below use an isolated, synthetic local provider.

## Behavior and budgets

- Maintenance evaluation remains first and unchanged. Existing maintenance failure policy is preserved.
- Explicit public/auth/maintenance/telemetry routes skip irrelevant middleware session refresh. Protected IELTS descendants are not public.
- Cookie session middleware verifies `getUser`, with a 4-second total deadline and an abort signal. A timeout cannot forward a protected mutation. API/non-GET failures return 503 plus Retry-After; definite invalid API credentials return 401. Handler ownership, entitlements and RLS remain authoritative.
- Bearer/service authorization remains handler-owned. The shared `requireRequestAuth` path now distinguishes verified identity, invalid credentials and temporary dependency failure; it bounds authentication without imposing a new deadline on downstream database queries.
- Successful refresh cookies propagate into both the response and forwarded Cookie header, including intl responses. A completed rotation survives a subsequent failed user check without authorizing the request. Transient sign-out writes are discarded; late results cannot mutate returned responses. CSP/nonces, locale cookies, query paths and the single POST-body handoff are preserved.
- The protected shell bounds identity at 4 seconds. Profile and navigation start together with 3-second limits; optional replay gets 300ms within that window. Enrollment gets 1 second. The local subject cookie read adds no remote work. This is a bound on shell-owned dependency waits, not on independently rendered feature bodies.
- Confirmed missing/incomplete profile goes to localized onboarding; profile errors/timeouts go to recovery. Teacher navigation failures on teacher routes go to recovery rather than inventing access or rendering learner navigation. Off teacher routes, usable content remains with a localized retry notice.
- Shell navigation loads capability only, not full reviews or notification counts. Unknown review count/badge is null. Enrollment unavailability remains denied but is distinguishable from confirmed non-enrollment. The IELTS launch/admin gate is unchanged.
- Theme restoration never calls auth on public/recovery pages; existing theme cookies resolve immediately. Optional protected restoration gets 200ms.

## Automated checks

Passed:

- `npm run audit:design-system`
- `npm run test:design-system`
- `npm run lint` (zero errors; 12 existing warnings outside this change)
- `npm run typecheck -w @thinkfy/web`
- `npm run test:middleware` (13 behavioral/policy tests)
- `npm run test:auth-shell-recovery -w @thinkfy/web` (11 tests)
- `npm run test:maintenance`
- `npm run test:teacher-workspace`
- `npm run test:entitlements`
- `npm run test:subject`
- `npm run test:ielts-learner`
- `npm run test:ielts-lms-pilot`
- `npm run test:ielts-data-model`
- `npm run test:settings`
- `npm run test:payments` (23 tests)
- `tsx --conditions=react-server --test src/lib/security/content-security-policy.test.ts src/lib/security/mermaid-csp.test.ts src/lib/auth/redirects.test.ts src/lib/supabase/cookie-options.test.ts` from apps/web (10 tests)
- `git diff --check`

Fault coverage includes never-resolving promises, abort propagation and suppression of late retries, 401 versus 503, invalid/missing sessions, rotated refresh cookies, intl Cookie forwarding, unchanged POST bodies, zero public auth calls, profile missing versus unavailable, locale-safe next URLs, request-local budget isolation, capability failure, and unknown enrollment/counts.

## Local app evidence

Ego Lite task space 74 only; audit space 63 was not accessed. The dev server was explicitly launched from this worktree on port 3104. Its dev stack and generated module paths resolve under `/Users/jacknguyen/.codex/worktrees/a4ed/DebateLab/apps/web`. The fixture listens only on `127.0.0.1:54329`, uses an `example.invalid` identity, and contains no real account credentials/data.

Reproduce:

1. `node scripts/qa/auth-shell-fixture.mjs`
2. `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54329 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only npm run dev -w @thinkfy/web -- --port 3104`
3. Use the fixture's loopback `/__qa?mode=healthy|hang|unavailable|expired|profile-error|optional-error` control with an explicitly synthetic Supabase cookie. This control is outside Next.js; it is not a deployable Vercel entrypoint.

Observed via Ego serverFetch and live DOM:

| Scenario | Result |
| --- | --- |
| Hanging auth, direct `/vi/auth/recovery` | 144ms, recovery content, zero provider auth calls |
| Hanging auth, `/vi/ielts/home?view=week` | 4,127ms including redirect/render, localized recovery, intended query retained, one auth call |
| Hanging auth, POST `/api/sessions/end` | HTTP 503 in 4,057ms, no handler mutation |
| Profile failure, `/vi/settings?tab=account` | 4,581ms including initial compilation/redirect/render; recovery, no onboarding redirect |
| Optional capability membership read hangs, `/en/resources` | 3,776ms including compilation/render; resource content usable with unavailable-navigation notice |
| Expired identity, `/vi/resources?source=expired` | Browser reaches `/vi/auth/login?next=%2Fresources%3Fsource%3Dexpired` |
| Restore provider and press shell Retry | Notice clears; stays on `/vi/resources` |
| Recovery Retry with `/vi/resources?source=fixture` | Returns to that exact path/query with usable content |

Both recovery and the usable shell with unavailable-navigation notice passed EN/VI × light/dark × 1280×720, 1440×900, 768×1024, 390×844: 32 DOM checks total. Every document had scrollWidth == clientWidth; recovery buttons stayed within the viewport. Live copy was checked in each locale. Theme transitions were allowed to settle before measurement. Theme-cookie persistence remains handled by the existing action.

## Limitations

- The pre-existing mobile navigation button still has the English accessible label “Navigation” on a Vietnamese route; shared navigation localization remains owned by PR47. The new recovery and unavailable-data copy is localized.
- Ego screenshot capture repeatedly timed out. No screenshot evidence is claimed; layout evidence is live DOM/geometry and computed styles. Visual pixel-level review remains pending.
- A synthetic hanging membership query inside the existing settings **page body** still exceeded Ego's 20-second HTTP budget. `settings/page.tsx:59` independently awaits `getUserOrganizationAffiliation`; that feature-body read is outside this shell patch. The same failure in shell navigation resolved correctly on `/resources` as recorded above.
- No live authenticated production end-to-end improvement is claimed. Production ownership and behavior must be verified after a separately authorized release.

## Virtual integration checks

`git merge-tree --write-tree` against the completed implementation commit:

- PR47 head `0da26733819b1a0e05a7492bde9b415d079cea24`: expected content conflicts in protected `layout.tsx` and `teacher-workspace-sidebar.ts`. Sidebar consumer imports merged textually. Reconciliation requirements are in integration.md; this is **not** a verified combined PR47 build.
- PR49 head `aa2b788997cfecb31f457d54945a472daa8b9fe7`: clean virtual merge, resulting tree `f54f64aa9bd7d4f4c1f31c2cb53806af4d267fff`.

These checks created Git objects only; they did not merge either draft into the working branch or main.

The clean PR49 virtual tree was exported to a disposable `/tmp/thinkfy-auth-pr49.*` directory and passed TypeScript checking against the installed dependency tree. No source files from that export were copied back. PR47's known semantic conflicts remain intentionally unresolved in this independent draft.
