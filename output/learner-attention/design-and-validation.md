# Learner attention follow-up — workbench

## Reference extraction before implementation

Lumist source (local checkout, ClassroomAssignmentDetail.tsx:150–190 and ClassroomAssignmentStudentList.tsx:150–223) supplies the adapted behavior: selected student + assignment stay together, status/due/submission evidence remains visible for empty work, and review actions depend on concrete work and write capability. This is behavioral adaptation into existing Thinkfy components, not a copied visual skin. No external source code is vendored; source licensing is not assumed. Lumist authentication independently confirmed in dedicated Ego Lite space 79; grading actions have not been live-tested.

Mobbin SchoolAI desktop reference: https://mobbin.com/screens/fcb8ba0f-a935-4abf-8d0c-25a5a466bb28. Screenshot is a curated 768×523 rendition, not a measured live viewport. Adopt identity-first rows and colocated evidence; omit mastery gauges, AI-generated diagnoses, tiny icon-only actions and the extra insights rail. The target is a single learner, so one full-width evidence column is clearer than the reference's class table + side rail.

## Native composition

Use existing PageContainer focused width, Button, AnalyticsSection and report controls. Neutral surface, semantic ink/border/status roles, existing type-heading-md/body/label/caption steps. No new tokens. 12px control corners, spacing 8/12/16/24px. Each evidence row contains assignment title; labelled status + due/submission dates; visible review/assignment action. Wrap into a vertical stack at 390px; never truncate learner or assignment names. Follow-up goes before monthly export/report controls. Return link stays at the top. One primary review action at most; remaining row actions outlined.

Context in URL is class, learner, locale, attention period and known reason codes. Reasons from query are navigation context only; server evidence determines observed signals. Monthly report controls preserve context; selecting another learner clears the original reason context. Return URL opens the analytics tab and original period, anchored at the learner row. This requires a narrow tab/period prop addition to the existing class route and ClassDetailDashboard; no workbench mutations or TeacherWorkspaceScreen edits.

## Delivery constraints

Standard speed / Fast OFF was user-confirmed at dispatch. No speed settings changed; runtime service tier is not independently exposed here. No deployment, merge, learner contact or production fixture writes.

Validation results will be appended after implementation. Synthetic UI fixtures and live acceptance are recorded separately.

## Final implementation and evidence

- ClassAnalyticsPanel now exposes a labelled learner-report control per attention row, including class/learner/locale, known reason codes and 7/30/90-day context.
- Parent report keeps that context across month/language changes. Selecting a different student opens that student's evidence and clears the previous student's reason codes. URL reason codes never determine server claims.
- Existing class analytics snapshot supplies current reasons, selected-learner assignments, review response IDs, dated attendance and learner-wide study-plan evidence. Missing mandatory reads fail to an explicit retry state; unavailable optional subskills are not interpreted as resolution. Media URLs and raw DB errors are not sent by this adapter.
- Class-manager, IELTS capability and active learner membership checks precede trusted evidence reads. Current response/revision ownership follows the existing gradebook pipeline. No schema or mutation changes.
- Review links retain the established `workbenchTab=reviews&responseId=...` contract. Assignment links use the existing authorized club assignment page. Optional future integration: homework assignment pages could support a learner/submission filter and return URL, but those contracts do not exist today and were not invented here. Browser Back returns from those existing destinations; the report itself provides an explicit return to class attention.
- ClassDetailDashboard and the teacher class page have only the narrow analytics-tab/period navigation props needed for the return path. TeacherWorkspaceScreen and prohibited mutation/assistant/import surfaces are untouched.

## Checks (2026-09-05)

Passed all four required gates on the final application changes: design audit, design token tests, lint (0 errors; 12 existing warnings outside this change), web typecheck. `git diff --check` passed.

Passed `test:class-analytics` (33 tests, including the new navigation/state/projection/authorization cases), `test:parent-band-report`, `test:teacher-workspace`, and `test:ielts-lms-pilot`. Tests use local objects/mocked PostgREST, never production writes.

Ego Lite space 79, local loopback server 4318, explicitly bundled from the assigned worktree `/Users/jacknguyen/.codex/worktrees/4238/DebateLab`. Production components and globals.css/semantic theme variables + Inter are rendered by a standalone synthetic harness; Next navigation and server read actions are simulated. The authenticated production shell and backend roundtrip are **not live acceptance tested**. The harness's assignment/review destinations verify URLs only; it does not render or execute those grading destinations.

32/32 rendered checks passed: attention list and full report, EN/VI × light/dark × 1280×720, 1440×900, 768×1024, 390×844. All had `scrollWidth <= clientWidth` and Inter loaded. Screenshots inspected at desktop EN/light and phone VI/dark; long synthetic Vietnamese names and assignment titles wrap without clipping. Existing user-authored content can be in either language; interface labels are localized.

Synthetic interactions passed: attention row → exact learner/period/reasons; direct report URL/reload; locale switch; learner switch clears prior reasons; month switch preserves learner/locale/period; return URL and period restoration; English unavailable/retry recovery, forbidden, optional-source unavailable and empty evidence; equivalent Vietnamese states at 390px with no overflow; keyboard Enter on return link; concrete review-response and assignment-ID destination URLs. Loading is visibly rendered while asynchronous fixture reads are pending. See `browser/matrix.json` and `browser/interactions.json`.

The first harness render lacked font variables; it was corrected before the final 32-check matrix and screenshots. No claims rely on that initial render. Lumist authentication was observed independently; its per-learner grading flow was inspected in source only. Mobbin screenshot provenance is recorded above.

No merge, deployment, real learner contact or production data mutation was performed.
