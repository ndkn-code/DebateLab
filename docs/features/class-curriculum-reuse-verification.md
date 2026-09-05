# Class curriculum reuse verification

Verified in worktree `571d`, branch `codex/class-curriculum-reuse`, based on `origin/main` commit `53e107cb`, on 2026-09-05. Fast mode was not enabled or global settings changed; Standard was user-confirmed at dispatch, not independently measurable by this implementation.

## Checks completed

- `npm run audit:design-system`: passed.
- `npm run test:design-system`: passed.
- `npm run lint`: passed, 0 errors; 12 existing warnings outside the changed files.
- `npm run typecheck -w @thinkfy/web`: passed.
- `npm run test:class-curriculum-reuse`: 5 contract tests passed.
- `npm run test:admin-classes`: passed.
- `npm run test:admin-class-schedules`: passed.
- `npm run test:ielts-lms-pilot`: passed.
- `npm run test:lms-material-pipeline`: passed.
- `npm run test:teacher-workspace`: passed.
- `node --test scripts/class-curriculum-reuse/behavior.test.mjs`: 15 PostgreSQL behavior tests passed.
- `git diff --check`: passed.

The database tests execute the actual new migration/RPCs on PostgreSQL 15.18 in a disposable Unix-socket-only local database. They cover draft create/readback, submission configuration, exclusion of learner tables, same-key replay, mismatched request conflict, permission revocation before replay, plain-teacher and cross-center denial, invalid/duplicate selections, injected late-insert rollback and same-request retry, changed source/module detection, material rights/audience/class-scope exclusion, DST wall-clock shifts, null dates, nonexistent local times, empty selection, end boundaries, invalid dates/timezones, anonymous denial, and simultaneous duplicate requests.

## Browser acceptance

Ego Lite task space 78, local acceptance URL `http://127.0.0.1:57918`, verified server root `/Users/jacknguyen/.codex/worktrees/571d/DebateLab`. No audit space was manipulated.

The harness bundles the actual `ReuseClassDialog`, production primitives and token CSS. Its callback ports call the real SQL RPCs with a fixed local fixture actor; it never connects to remote Supabase.

- EN/VI × light/dark × 1280×720, 1440×900, 768×1024, 390×844: 16 combinations, selection and review in each, 32 states total.
- Every state: document scroll width ≤ client width, no horizontal dialog overflow, primary action within the viewport, no error alert.
- Measured dialog radius 12px and title 20px after correcting primitive utility precedence.
- Keyboard: initial focus stays in the dialog, Tab moves within it, and Escape closes it and restores focus to the entry button.
- Actual shifted-date review showed 30 calendar days, unchanged local clock times, material release/expiry and assignment due before/after values.
- Browser create/readback produced a draft. A deliberately lost success response followed by page reload, reopen and retry recovered the same class; exactly one class existed for that submitted title.
- A source change at commit returned to selection, preserved the edited class name, kept the deselected material deselected, and displayed refreshed content with a plain-language message.
- Screenshots and raw matrix JSON are local artifacts under `output/class-curriculum-reuse/` and are not bundled into production.

## Limits and release boundary

The database fixture is a **contract fixture, not a complete Supabase replica**. It includes the needed columns, representative constraints and permission predicates, the production rights/idempotency helper logic, and audit stand-ins. Unrelated production triggers, storage, GoTrue, RLS table-read plumbing and PostgREST/session transport are not exercised. Production placement trigger compatibility was inspected from source. Apply and verify on a fully migrated staging Supabase instance before release.

The browser run verifies actual dialog behavior and database persistence through callback ports. It does not establish a deployed Next.js session, real teacher-sidebar integration, or successful rendering of the destination class workspace after Next navigation. The integration calls the existing authorized teacher class route; its guard and loader were inspected. The harness uses local fallback font availability rather than the app's `next/font` delivery.

No production migration, production class, learner invitation, message, merge or deployment was performed. The migration remains a release prerequisite. Shared course references, whole-course selectivity, organization-scoped approved material placements, and exclusion of linked assignments are intentional model boundaries, explained in the review.

## Reproduce locally

With PostgreSQL 15 available on the local `/tmp` socket:

```sh
npm ci --ignore-scripts
npm run test:class-curriculum-reuse
scripts/class-curriculum-reuse/reset-local.sh
node scripts/class-curriculum-reuse/browser-server.mjs
```

The reset command drops/recreates **only** `thinkfy_reuse_571d`; no environment-selected remote database is used. The browser server is a development harness outside application entrypoints and binds only `127.0.0.1`.
