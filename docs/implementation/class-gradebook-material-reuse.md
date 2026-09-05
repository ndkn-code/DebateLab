# Class grading and material reuse

Both surfaces use Thinkfy's workbench mode. This change owns the gradebook and
material sections of TeacherWorkspaceScreen, their components, and narrow data
adapters. Class creation, analytics, sidebar and question import are unchanged.

## Reference extraction and adoption

Lumist source checkout: `73875b1267cb3a6e36a82af2cd1469285a57e9e1`.

- `features/class-workspace/components/ClassroomGradebook.tsx`: class-scoped
  learner/assignment matrix and targeted submission actions.
- `features/class-workspace/components/ClassroomSubmissionGradeDialog.tsx:72`:
  evidence-first form, score bounds, optional feedback, pending-close guard,
  retained failed input, and refreshed readback.
- `features/class-workspace/services/client/classroom-workspace.service.ts:137`:
  separate submission detail with response, files and revision timestamp.
- The same service at lines 1193–1229: optimistic update and idempotent save.
- `features/class-workspace/components/ClassMaterialList.tsx:61`: readable material
  rows and explicit open actions. The brief's classroom-management/server/class-lms
  path was absent in this checkout; Thinkfy's existing shared-material contracts
  supply placement and publishing behavior.

Independent Mobbin reference: ClassDojo screen
https://mobbin.com/screens/f3a4673b-ac61-4ca2-a9f7-bccc4acfa521 . Inspected its
768×521 reference image in Ego Lite space 80. The reference places learner work
in the dominant left region and response/feedback in a narrow right region,
with persistent learner/assignment context and a visible response control.
Lumist's source dialog similarly orders identity, response, files, score and
feedback. No authenticated Lumist save was exercised; app.lumist.ai loaded an
empty shell in this task's isolated space.

Adaptation specification:

- Matrix: sticky learner column and assignment columns, horizontal scroll inside
  the panel. Learner name stays visible; a cell's label carries state or score.
- Evidence: one right sheet, full width on mobile, scrollable evidence, score and
  feedback, then a persistent save/cancel footer. Response gets the most space.
- Material library: searchable rows plus a destination dropdown, followed by an
  explicit all-class audience confirmation and one publish action. The current
  class is the default. Existing restricted placements cannot be silently changed.
- Spacing uses the existing 8/12/16/20 scale; borders use outline-variant; controls
  use rounded-control. Typography maps to type-label/body/caption/heading-md.
- Existing Button, Input, Select, Sheet, PageContainer, and LearnerMaterials cover
  the components. New components compose these primitives; no new UI library,
  token, brand palette, or external component dependency was introduced.
- Deliberately omitted the reference's media-dominant overlay and social reaction
  controls. Text homework and explicit grading/publishing are the actual tasks.

## Persistence and permissions

The new class reader calls requireClassManager before class-scoped assignments,
submitted homework and roster queries. Identity reads use the admin client only
for learner IDs from the authorized class. Evidence reads scope assignment,
submission, class and organization together. Response and updated_at come from
one row read. Only verified attachment paths read from that submission are signed.

Grading uses teacher_workspace_grade_homework through the existing class-lms
Server Action module: ownership, score validation, stale-update rejection,
idempotency receipt and learner review state remain in the existing engine.
IELTS skill review remains linked to its existing class workbench.

The reuse library first calls the existing manager RPC. Only authorized material
and version IDs can enter the admin metadata/preview readiness checks; the response
is filtered to the destination center and program. Material tables intentionally
deny direct authenticated SELECT. No storage paths are returned by this adapter.
Placement and publish use existing teacher operation wrappers. A failed publish
leaves a resumable draft. Existing published placement is a no-op; the database's
unique target constraint also protects concurrent insertion. Selected audiences,
release/expiry windows, unlock rules, withdrawn/scheduled placements and version
mismatches are not overwritten. Success requires persisted placement readback.

The class material list and success link lead to `/dashboard/materials?classId=…`,
a workbench page using the existing learner material projection and viewer.
The projection enforces class membership, release, audience and unlock rules.
IELTS classes retain their existing launch/admin gate. Shared materials retain
SHARED_LMS_MATERIALS_V1; production flag activation is outside this change.

No migration, API route, backend-only Server Action module, deployment, or merge
is introduced. Standard speed/Fast OFF was user-confirmed at dispatch; runtime
service tier was not independently inspectable or changed by this task.

## Verification

All checks ran in the d300 worktree on 2026-09-05. The Next dev process on
port 3107 was verified with lsof to serve this worktree's apps/web directory.
Ego Lite space 80 was isolated from the audit browser space. Local Supabase was
not reset; the fixture script creates unique QA users, organization and classes
and refuses any endpoint other than http://127.0.0.1:54321. Credentials remain
in mode-600 temporary files and the ignored local environment file.

Passed commands:

- `npm run audit:design-system`
- `npm run test:design-system`
- `npm run lint` (zero errors; 12 existing warnings)
- `npm run typecheck -w @thinkfy/web`
- `npm run test:teacher-workspace` (including eight new behavioral tests)
- `npm run test:lms-material-pipeline`
- `npm run test:ielts-lms-pilot`
- `npx tsx --conditions=react-server --tsconfig apps/web/tsconfig.json apps/web/src/lib/api/class-lms/materials-repository.test.ts`
- `npx tsx scripts/ci/checks/no-new-vercel-functions.ts`
- `git diff --check`

Local persistence and browser acceptance:

- Seed smoke saved a grade through the existing RPC, verified persistence and
  duplicate idempotency receipt, and rejected an unrelated user's grade attempt.
- The class page’s Grade submissions link opened the persisted gradebook.
- Class gradebook opened the real response and verified attachment. Blank and
  above-maximum scores were rejected. Saving score and feedback updated the
  matrix and review state; hard reload retained the persisted score.
- A second authorized grading client changed the submission after evidence had
  loaded. The browser rejected the stale save, retained score 8.5 and feedback,
  retained both after Reload evidence, and saved successfully on retry.
- Publishing initially failed on an incomplete local material fixture. It showed
  failure and retained the existing draft. After correcting the fixture's rights
  metadata, retry published that same placement. Selecting the second class and
  confirming published one placement there. Database readback found exactly one
  published placement per class; reopening showed the already-published state.
- The synthetic learner opened the destination class material and its native
  document text, with the learner/class watermark. The local HTTP storage URL is
  intentionally rejected by the existing HTTPS-only media viewer, so binary
  material preview rendering was not verified end-to-end; native content was.
- EN/VI × light/dark × 1280×720, 1440×900, 768×1024 and 390×844: opened evidence
  and edited score in every combination; opened material reuse and filtered its
  library in every combination. All 32 interaction cases had document scrollWidth
  equal to clientWidth. Screenshot samples were inspected for readable forms,
  wrapped Vietnamese text, destination confirmation and internal matrix scrolling.

Representative browser captures and the two interaction matrices are checked in
under [class-workbench-evidence](class-workbench-evidence/). They contain only
synthetic QA data and are not required at runtime. The complete capture set is
retained in this task’s local visualization directory. The source extraction above and local fixtures are the
behavioral evidence; no authenticated Lumist save, production deployment, live
student mutation, cross-center copy or feature-flag activation is claimed.
