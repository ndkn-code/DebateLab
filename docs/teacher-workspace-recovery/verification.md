# Teacher workspace recovery verification

Draft implementation; not cleared for merge or deployment until browser QA is completed.

## Implementation

Started from fetched `origin/main` at `53e107cba8efe25fd3d4993c88321d1eb191d2db`
in `/Users/jacknguyen/.codex/worktrees/a2bb/DebateLab`, branch
`codex/teacher-workspace-recovery`.

- `server-presentation.ts` and `loading-policy.ts`: authorize first, then load only
  the requested surface or active data tab. Capability has a 5-second deadline;
  requested presentation sources share a further 5-second budget. Failures produce
  explicit `partial`/`unavailable`; permission errors discard all data and deny.
- Classes and class overview need only the authorized class projection. Summary
  counts are explicitly unrequested; links open the relevant teaching page.
- Calendar needs only its range. Opening an event adds `eventId` to the existing URL
  and loads that event's authorized detail. Missing details never fabricate rosters,
  attendance, homework, or materials. Retry retains the event and range/filter query.
- Assignments, materials, announcements, gradebooks, and attendance have separate
  status gates. A failed source cannot become an empty-state claim or editable data.
  Class-detail data tabs request their own source and retain class/query context.
- Review loader: 5-second deadline also covers the existing sidebar caller; database
  queries use an AbortSignal. Selected-class requests narrow SQL before fetching.
  Existing manager checks, capability checks, RLS and scoped profile reads remain.
- Assignment missing counts use active class membership, not unloaded event metrics.
- Readable EN/VI loading and retry states; slow loading exposes recovery at 12 seconds.

No migration, new production function entrypoint, shared navigation redesign, production
demo change, merge, or deployment. The temporary QA route and allowedDevOrigins change
were removed. `qa-fixture.tsx.txt` preserves the development-only fixture source for
reproduction; it is not an app route.

## Automated verification

Commands run from the worktree (individual tsx commands from `apps/web`):

- `npm run audit:design-system`
- `npm run test:design-system`
- `npm run lint` (12 pre-existing warnings, zero errors)
- `npm run typecheck -w @thinkfy/web`
- `npm run test:teacher-workspace` including 18 new behavioral tests
- `npm run test:ielts-lms-pilot`
- `npm run test:lms-material-pipeline`
- `npx tsx src/lib/api/class-lms/teacher-review-queue.test.ts` (4 tests)
- `npx tsx src/lib/api/class-lms/teacher-calendar-model.test.ts`
- `git diff --check`

The new behavioral tests cover route isolation, partial/empty distinctions, review
retry and revocation, capability deadline/error/denial, selected class denial, event
detail scope, calendar/detail failure, late completion, and each content-source failure.
Fake dependencies exercise the production presentation orchestration with a bounded
authorized class set; they do not exercise live Supabase or bypass production auth.

Initial test setup failures were corrected: installed missing worktree dependencies;
ran standalone tsx checks from the web workspace to resolve its aliases; corrected
fixture typing and a narrowed-state TypeScript comparison. No gates were weakened.

## Browser evidence and limits

Used only Ego Lite spaces 70 and 71. Space 63 and all other tasks' spaces were untouched.
Space 70's tab became unresponsive and was closed; space 71 was created after confirming
70 no longer existed. Both were cleaned up. Local Next ran on port 3108 from this
worktree. The fixture visibly identified `a2bb` and its synthetic, no-write context.

Observed EN class fixture at 900×963 and 390×844: three class cards and open-class actions
rendered, unavailable review/progress/attendance values were explicit. At 390×844,
document width and viewport width both measured 390. The initial render exposed a
false `0 learners` caption; the final code masks skipped class details as well as failures.
Read source audit screenshot `16-thinkfy-teacher-demo-current.png`: production evidence
was an all-content skeleton with teacher navigation still present.

Browser verification is **incomplete**: Page.navigate, Runtime.evaluate,
Page.captureScreenshot, and Accessibility.getFullAXTree intermittently timed out.
The 127.0.0.1 fixture initially also had blocked Next dev assets; a temporary origin
allowance was attempted, but subsequent connection/evaluation failures prevented a
reliable interaction run. Initial DOM/overflow evidence therefore does not prove hydrated
retry behavior. No successful final screenshots or full EN/VI × light/dark ×
1280×720, 1440×900, 768×1024, 390×844 matrix are claimed. Re-run that matrix, class-tab
navigation, calendar event open/retry, recovery after a failed review read, and loading
recovery before removing draft status.

## Remaining integration boundaries

The protected layout independently awaits `loadTeacherSidebarSummary`, authentication,
and other shell data. Its review caller now benefits from the bounded review loader,
but the independent capability/notification waits and fallback labels/counts remain
in shared files outside this task's ownership. A local authenticated route logged a
presentation capability timeout yet took 47 seconds end-to-end before later requests
returned quickly; this does not establish a live end-to-end latency improvement.
Those shell waits need a separately owned follow-up; no other tasks were contacted.

The general presentation deadline bounds waiting, not cancellation of every existing
SDK operation. A timed-out read may finish in the background, but cannot update the
returned model. Review database reads are explicitly cancelled. There is no automatic
retry loop and no cache of authorized data across requests. Each retry rechecks access.
Unrequested class summary metrics are intentionally not fetched in the background;
teachers open the relevant page to load them. The existing class roster/lessons tabs
remain navigation guidance rather than new roster functionality.
