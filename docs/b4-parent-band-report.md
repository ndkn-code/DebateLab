# B4 parent-facing monthly band report

Implemented on `codex/b4-parent-band-report`, based on `b3-roster-import-export`.
The report uses the momentum surface mode. Class managers open it through the existing class export menu, choose a student and month, then print/save an A4 PDF or download XLSX. English and Vietnamese share one report model. The default month is the previous completed month in the centre's time zone.

## Data contract

`apps/web/src/lib/ielts/parent-report/contract.ts` defines the JSON-safe `ParentBandReport` v1:

- Report period, centre time zone, generation date, and student/class/centre identity.
- Latest scored assessment within the selected month, four independently dated skill bands, and all measured observations from the selected month plus five preceding months.
- Current rubric bands, response/task/part/revision identity, and answer-key / AI / teacher / mixed provenance. The screen shows one latest task or part per productive skill; XLSX carries all monthly rubric rows.
- Recorded attendance sessions and present/late/absent/unmarked counts. Attendance percentage excludes unmarked sessions and never claims full timetable coverage.
- Two suggested next steps derived from the weakest displayed rubric bands. Staff may replace them for this session; edits are not persisted.

No email addresses, raw feedback, audio, provider details, or provisional numeric fields cross the report boundary. Stable internal IDs remain in the DTO for selection/grouping but are omitted from the parent workbook.

## Score and history rules

The report reuses the gradebook's effective-score and response/review revision projection. Overall stays null when fewer than four skills are available or the effective score is flagged provisional. The UI explains the missing result and keeps available skill bands visible. No partial skills are averaged into an invented overall. Mixed teacher/AI sources remain distinct; Listening and Reading are labelled answer-key results.

A month means submission dates in the centre's IANA time zone, with DST-aware boundaries and a cap at generation time. Reports include the latest corrections available when generated, not reconstructed month-end snapshots. Every trajectory point is an observed assessment; missing scores and missing calendar months break the line.

Historical attendance respects occurrence roster snapshots, cancelled/future occurrences, membership dates, and explicit attendance records. Gradebook cursors and report readers exhaust pagination; repeated cursors/pages fail instead of returning a successful partial report.

## Integration and exports

Read actions were appended to the already-approved `app/actions/admin-classes.ts`. Each invocation validates input and rechecks class-manager authorization and IELTS workspace capability before trusted reads. Student membership is checked before student history is read. No migration, route handler, new top-level server-action module, new chart library, or PDF engine was added.

XLSX composes B3's shared column arrays and typed export helpers. Its six sheets are Summary, Skills this month, Trajectory, Criteria, Attendance, and Next steps. Scores remain numeric, missing values blank, text formula-safe, and dates explicit.

Print uses a body-level copy of the same report and chart selection, with a scoped A4 stylesheet. The existing CSP nonce authorizes a print-only projection of the canonical light theme, including page margins; the screen theme restores automatically. No parallel palette is introduced.

## Verification

Passed:

- `npm run test:parent-band-report`: month/DST boundaries, partial and flagged overall suppression, review revision precedence, source labels, roster pagination, authorization/capability denial before trusted reads, historical attendance, and XLSX round-trip coverage.
- `npm run test:export` and `npm run test:ielts-lms-pilot`.
- `npm run audit:design-system`, `npm run test:design-system`, and `npm run typecheck -w @thinkfy/web`.
- `npm run ci:checks`, including no new Vercel function entrypoints.
- Targeted lint for B4's new files and modified action/export/source files.
- Ego Chromium rendering in EN/VI and light/dark, with no document overflow at 1280×720, 1440×900, 768×1024, and 390×844. The chart scrolls inside its panel on narrow screens.
- One A4 page for all four locale/theme PDFs, plus partial, empty, and long Vietnamese copy. White margins verified in PDF renders. Chart selection, session edits, print invocation, and actual XLSX download verified with synthetic fixtures.

`npm run lint` remains red: 25 pre-existing errors and 14 warnings in the B3 base. All listed failure files are unchanged except `gradebook-repository.ts`; its existing max-lines failure was independently reproduced from HEAD (1067 lines before B4). B4 adds no new lint diagnostic. This is not a green repository-wide release gate.

Not verified: authenticated production class data, live production RLS behaviour, or Safari/Firefox print rendering. No database writes, migrations, deployment, or merge were performed. The temporary fixture preview route was removed after QA.

[Rendered samples and verification artifacts](/Users/jacknguyen/.codex/visualizations/2026/09/04/01a06e08-aa31-79e2-b3a6-61b5fb223a45/b4/README.md)
