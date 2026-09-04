# B6 implementation and verification

B6 is implemented on `codex/b6-class-analytics`. The full repository lint gate remains red on the merged baseline's 25 errors and 14 warnings; B6 is not fully cleared for release. No production migration, deployment, parent delivery, or persisted rollup was performed.

## Integration order

1. Worktree created from B3 `d3289d3df5c0c5b20661c1ad1ff791b34b4bf6c8` (`b3-roster-import-export`).
2. B1 `b0cb66350571472d22069abbf078853c5060dac9` (`b1-teacher-writes`) merged cleanly in `b9a0a0f6` before B6's regression pass.
3. B6 changes follow that merge. Keep B3's shared export contract and B1's teacher-workspace write path when integrating downstream. No B1-owned teacher-workspace or teacher-operation files were edited by B6.

## Surfaces and contracts

Both surfaces use the workbench density. The shared class dashboard gains a lazy Analytics tab while retaining its existing default tab. The shared organization overview mounts the centre section only for organization managers; its platform-admin route supplies the existing admin organization role. Server authorization independently enforces access.

- `apps/web/src/lib/analytics/contracts.ts`: `ClassAnalytics`, `CentreAnalytics`, `PostMockReport`, normalized evidence, coverage, provisional counts, and source availability.
- `apps/web/src/lib/analytics/class-rollup.ts`: pure learner-weighted mastery, reteaching, attention, groups, and assessment-specific privacy projection.
- `apps/web/src/lib/analytics/centre-rollup.ts`: pure event deduplication, period rollups, teacher attribution, trend, and workload calculation.
- `apps/web/src/lib/api/analytics/`: authorized repositories, exhaustive reads, timezone boundaries, and normalized operational/scoring events. No raw scorer snapshot crosses the action boundary.
- `apps/web/src/lib/api/ielts/gradebook-repository.ts`: `loadIeltsClassGradebookSnapshot` separates complete loading from `projectIeltsGradebookPage`. The public loader retains cursor pagination and signs media only for its projected page. Analytics loads once and never signs speaking media.
- `apps/web/src/lib/analytics/exports.ts`: composed B3 columns; XLSX by default, CSV optionally. Export accepts only `PostMockReport`.
- `apps/web/src/components/analytics/analytics-print.css`: aggregate-only print output. A stylesheet is necessary under the app CSP. The print projection stays mounted while an assessment report is open; browser printing also excludes teacher-only sections. Printing uses the existing light theme and restores the selected theme afterwards.
- Three Zod-validated analytics/export actions are appended to `apps/web/src/app/actions/admin-classes.ts`. No new top-level server-action module, route handler, schema object, or persisted cache was introduced.
- `apps/web/src/middleware.ts`: reuses the secured request rather than transferring a POST body from the original request twice. This prerequisite fixes a reproduced middleware exception before analytics/export actions could run; CSP, locale and action headers are retained.

Class authorization uses `requireClassManager`, rechecks the class's centre, and preserves IELTS and class pilot access. Centre authorization uses the existing organization-wide manager predicate and organization gate. Privileged clients are created after authorization. Criterion reads use only response IDs discovered through authorized assignments/attempts, then check learner, attempt, revision and source revision. Learner-wide skill states use current authorized roster IDs and are labelled separately from assessment findings.

## Calculation definitions

### Class

- The selected 7/30/90-day window ends at read time and starts at local midnight, including the selected number of calendar days. Default: 30 days. Centre metadata timezone is used when valid; fallback: `Asia/Ho_Chi_Minh`.
- Current active roster only. Assessment samples use submissions in the selected period. Missing scores remain `null`; the coverage denominator includes current learners without evidence.
- Each learner receives equal weight: average that learner's valid samples first, then average learner means. Writing Task 1, Task 2, and Speaking criteria stay separate. Distributions bin learner skill means at the nearest half band.
- Current response revisions only. Published teacher criteria replace the displayed AI criterion band. AI provisional/adjudicated provenance remains independently counted; AI and teacher source counts can overlap. Legacy AI criterion columns without adjudication evidence remain labelled provisional.
- Reteaching prioritizes affected learner count, then weakness severity and a stable key, using the shared class study-plan comparator. Criterion advice requires a relative deficit of at least 0.25 against the learner's mean within the same rubric; this is a product heuristic, not an IELTS pass threshold. Subskill advice requires demonstrated evidence, confidence, and an in-period evidence timestamp. Content tags cannot create a weakness.
- Attention sorts overdue published work first, critical demonstrated weaknesses (existing severity threshold 0.7) second, and repeated recorded absence (at least two) third. Within a tier: severity where present, count, then learner ID. Missing evidence is shown separately.
- Groups use the latest demonstrated band in the selected skill: below 5, 5–5.5, 6–6.5, 7+. Stable band/ID ordering; groups of at most four; five split into three and two; singletons and learners without evidence remain explicit. No membership mutation.
- Parent output contains skill/criterion aggregates, coverage, provisional labels, assessment-specific advice, and methodology. It excludes individual identifiers, comments, rankings, groups, and learner-wide advice. No overall band is exported or displayed by B6, so incomplete/provisional overall results cannot leak through the report.

### Centre

- Sessions: completed occurrences plus unlinked legacy attendance sessions containing records. Linked attendance does not duplicate an occurrence.
- Active learners: distinct learners with any recorded attendance mark, submitted homework, or submitted class-assigned mock in the period. An attendance mark, including absence, represents product usage here; it is not a claim of physical attendance.
- Mocks: distinct assigned full-mock attempts with all four scored skill sections present. Teacher-confirmed and provisional counts remain separate.
- Turnaround: distinct response/homework submission revisions receiving their first available published feedback in the period. Known submission-to-feedback durations produce the median; unknown historical revision timestamps are excluded from the median but retained in the count. Coverage is exposed beside the median. Pending is the outstanding feedback backlog as of the period end, including older submissions.
- AI grading: one successfully scored response, even across revision, retry and adjudication history. Complete criterion proof is grouped by revision, stage and scoring run; criterion rows never multiply deliveries. Legacy scored responses can qualify from their stored AI band and scoring timestamp.
- Teacher rows use recorded attendance and feedback actors. A teacher's first published review of a response revision is visible even when AI provided earlier feedback. Current class memberships are labelled as current assignments. Centre totals come from distinct events/learners, never sums of teacher rows.
- Estimated marking workload covered = qualifying AI-graded Task 2 responses × marking minutes ÷ 60. Default: **20 minutes**. Task 1, Speaking, retries, and teacher-only grading do not enter the default estimate. The adjustment is bounded to 0–120 minutes and stored locally per viewer and centre.
- The assumption uses the lower end of a commercial teaching-site estimate of 20–30 minutes for detailed Task 2 feedback: [My English Pages](https://www.myenglishpages.com/ielts-writing-feedback-for-teachers/). It is not a measured Thinkfy saving. Teacher review time is unmeasured, so the UI calls this estimated workload rather than net time saved.

Required source failures invalidate the report rather than becoming zero totals. Unavailable learner-wide subskills and gated centre IELTS sources have explicit partial-source labels.

## Measured query cost

Reproduce with `npm run test:class-analytics`, specifically `src/lib/api/analytics/snapshot.test.ts`.

Fixture: 150 learners, one assigned mock, 300 Writing responses, 1,200 criterion rows, no courses or attendance. Real repository query builders run against an in-memory PostgREST transport; no live database or network is used.

| Measurement | Result |
| --- | ---: |
| Complete gradebook snapshot queries | 13 |
| Additional criterion-evidence queries | 4 |
| Total measured queries | 17 |
| Returned rows across those queries | 2,102 |
| JSON response bytes delivered by fixture transport | 676,758 |
| Elapsed snapshot + evidence + aggregation, one recorded run | 31.15 ms |
| Additional queries for projecting 100 + 50 learner pages | 0 |
| Speaking-media signing requests | 0 |

The transport counts its actual fixture payload bytes; it does not emulate server-side SELECT column projection. This is not a production payload-size prediction. Authorization, timezone, learner-wide skill-state, attendance and centre-dashboard reads are outside this measurement. The plan's approximately 21 queries per fully populated legacy page / 42 across two pages remains an estimate, not a measured baseline speedup. Live production latency remains unverified.

## Verification

Passed:

- `npm run test:class-analytics`: 23 tests covering >100 learners, >1,000 evidence rows, exhaustive pagination, chunking, later-page failure, snapshot cursor preservation, current revisions, teacher overrides, provenance, sparse evidence, deterministic groups/ranking, timezone/DST boundaries, duplicate events, incomplete mocks, historical revision feedback, attendance/occurrence deduplication, cross-class learner deduplication, and parent privacy in both formats/locales.
- Access fixtures exercise actual class/organization predicates for platform admins, owners/admins/head teachers, assigned and unassigned teachers, students, cross-centre membership, and disabled gates. Scoring tests inspect privileged query scopes and exclude foreign class/centre responses.
- `test:middleware`: a real localized `NextRequest` POST passes the middleware while retaining CSP, pathname and server-action headers. A browser call to the actual analytics action returns its expected unauthenticated failure with HTTP 200, including after changing the period.
- `audit:design-system`, `test:design-system`, web typecheck and `ci:checks`.
- `test:ielts-lms-pilot` (including gradebook/review-target/class-access contracts), `test:ielts-results`, `test:ielts-study-plan`, `test:ielts-assignments`, `test:teacher-workspace`, `test:export`, `test:roster-import`, `test:admin-classes`, and `test:admin-class-schedules`.
- Browser fixture matrix: both real analytics views, EN/VI, light/dark, 1280×720, 1440×900, 768×1024, and 390×844: 32 cases, zero document overflow, zero framework overlays or blank pages. Empty/partial/unavailable states: another 12 mobile cases, zero overflow or overlays.
- Skill selection updates group headings. The marking assumption updates the formula, persists after reload, and opens by keyboard. Keyboard type-ahead selected Reading and Tab moved into the criterion table; focus traversal was exercised. Generated EN/VI PDFs were text-checked for excluded learner identifiers and teacher-only headings; the dark-theme PDF was also visually inspected and theme restoration checked.

Not cleared / remaining gaps:

- Full `npm run lint`: **25 errors, 14 warnings**, matching the merged B3/B1 baseline count. A separate archived-HEAD lint run established the baseline; no B6-specific finding remains. Existing blockers include the B1 workbench effect, oversized gradebook/scorer files, and existing IELTS/scoring complexity/type violations. These were not fixed by editing B1-owned or unrelated files.
- Browser checks use temporary fixture pages rendering the real components in `PageContainer`; the fixture page was removed. Signed-in production teacher/admin/organization shells and authorized server-action downloads were not exercised end-to-end.
- Native select arrow-key behavior was inconclusive in the browser automation environment; focus, native type-ahead, selection through the browser's select command, and other keyboard controls were verified. A manual keyboard pass on the authenticated surfaces is still required.
- No live schema/RLS test or production latency measurement. Repositories compile against generated schema types and fail explicitly when required sources are unavailable.
- Metrics are read-time projections from current records and retained event history, not an immutable historical reporting warehouse. Earlier revised IELTS submission timestamps may be unavailable; current effective mock completion/confirmation state can change after review. No persisted rollup was introduced to hide that limitation.

Revenue, automatic assignments, saved groups, parent delivery, and measured net time savings remain outside B6.
