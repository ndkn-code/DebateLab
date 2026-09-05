# Class invitation implementation

## Composition brief (before implementation)

Teacher invitation is a workbench dialog in the existing class students context.
Learner invitation confirmation is a momentum page with one explicit Join action.
Lumist's source provides the behavior base: code retained in a sign-in return URL,
preview before claim, explicit invitation lifecycle and atomic redemption.
Root observed Lumist's Invite students dialog without creating a real invitation.
This task independently authenticated at app.lumist.ai in Ego space 81.

Mobbin research: Todoist People screen (36e449a0-dc42-4077-a8c2-f5950735b1cc),
Slite Invite teammates (1c57f1f3-5e23-49b2-ad6a-c4cba92bd9c4), ManyChat Invite New
Member (b15d6226-6917-489c-a4f0-bc0a6bdd705e). Tool-returned screenshots inspected.
Adopt link-first hierarchy, adjacent visible Copy control, policy below credentials,
and separated lifecycle controls. Omit email sending, role dropdowns, contact import,
branding, illustrations and promotional content.

Reference screenshots were 768px-wide captures, not measurable native viewports.
Thinkfy geometry is deliberate: single-column native Dialog, 24px padding, 8/12/16/24px
spacing rhythm, native rounded-control corners, solid outline-variant border.
Teacher rows show label then selectable credential with Copy; expiry and use count
remain readable. On narrow screens controls wrap and long credentials scroll inside
read-only Input. Learner uses focused PageContainer; class title wraps naturally.
Use type-heading-md, type-title, type-body, type-body-sm and type-label hierarchy.
Canvas/surface/ink/muted roles map to background, surface-container-lowest,
on-surface and on-surface-variant; primary fills one dominant CTA.
Primitives: Button, Input, Dialog, PageContainer and existing icon facade.
No new design tokens or custom native controls are needed.

## Policy

Only existing active student organization members may self-enroll. Class invitations
do not create organization memberships or change roles. Removed learners must contact
their teacher. Creator authority is checked again at redemption. A code lasts seven
days and permits 100 new enrollments; capacity remains a separate check.
Replacement immediately invalidates the previous invitation, not existing memberships.
Anonymous visitors see no class metadata; sign-in returns to the localized code URL.

## Source provenance and deliberate adaptations

Behavioral adaptation, not a style copy. Lumist checkout inspected at
`/Users/jacknguyen/Developer/app-lumist-ai`:

- `app/join-class/page.tsx:20`: public entry and code query.
- `features/classroom-management/components/StudentClassJoinPage.tsx:26,52,87`:
  manual entry, code-preserving sign-in continuation.
- `features/classroom-management/components/ClassInviteLanding.tsx:51`:
  preview before explicit claim and failure recovery.
- `features/class-workspace/components/ClassCodeCard.tsx:120,203,307`:
  teacher invitation load, credential copy and revoke controls.
- `app/api/client/classes/join/route.ts:14`: authenticated student claim boundary.
- `features/classroom-management/services/server/classroom-join-server.service.ts:42,124,203,300,352,464,545`:
  invitation lifecycle, eligibility, transaction/locking, capacity, replay and audit.
- `app/api/org/classes/[id]/join-link/route.ts:32`: teacher management seam.

Only the previously reported Invite students dialog was inspected in the source task;
it did not create a code. This task independently verified authenticated Lumist access
at `/admin/dashboard` in its own Ego space 81, but did not mutate or generate any real
Lumist invitation. Server behavior is source evidence, not a claim of live mutation QA.

Thinkfy uses authenticated Supabase RPCs and the already approved
`app/actions/admin-classes.ts` entrypoint, not a new Vercel function or action module.
A narrow typed RPC adapter covers the pending migration until the approved DB release
can regenerate Supabase types. Credentials are stored in a manager-readable RLS table
to permit reopening/copying the existing code; unlike Lumist's token hash storage,
this uses protected recoverable credentials. Each code has 128 random bits. Failed
claims return stable statuses and never expose arbitrary SQL error messages.

The learner page initially reveals no class metadata to anonymous visitors. Once
signed in, only an eligible organization learner receives class title, organization
name and policy metadata. It never returns a roster. Removed learners cannot use a
code to reverse a removal. An already active membership is idempotent even when the
old invitation later expires, fills or is revoked; it creates no new grant/use.

The existing IELTS launch gate is retained in application preview/claim and the new
membership-checked destination. SQL enrollment alone cannot modify that gate, profile
roles, LMS pilot flags, course access checks or the IELTS page layout guard. No
organization/referral-code semantics or roster-import rollout flags changed.

There was no existing Debate learner class view to open. The new
`/dashboard/my-classes/[classId]` landing therefore reads back the user's active class
and organization memberships and the active organization, shows class context and
schedule, and offers the existing IELTS weekly workspace only when its gates allow.
It does not enable the disabled Debate course library or create a new LMS workspace.

## Verification (2026-09-05)

Parent reconciliation and checks, after worker output:

- `npm run audit:design-system`: pass.
- `npm run test:design-system`: pass.
- `npm run lint`: pass, 12 existing warnings outside this feature.
- `npm run typecheck -w @thinkfy/web`: pass.
- `npm run test:class-join`: pass (own-user binding, anonymous non-disclosure,
  IELTS denial, strict input, retries/statuses, localized auth redirects).
- `npm run verify:class-join:db`: pass on disposable PostgreSQL 15, port 55481.
  Harness loads the real new migration and extracts production authorization,
  organization-scope trigger and audit function bodies into a minimal local schema.
  Assertions exercise actual authenticated/anonymous privileges, manager denial,
  exact organization membership, nonlearner/removed eligibility, creator revocation,
  expiration/revocation/exhaustion, archived classes, capacity, replay and persisted
  membership/ledger/audit readback. Injected audit failure rolls back all three writes.
  Concurrent sessions verify max-uses=1, capacity=1, duplicate own claims and stale
  concurrent replacement. Each claim race leaves one membership, one claim and one use.
- Affected suites pass: admin-classes, admin-clubs, roster-identity, roster-import,
  ielts-lms-pilot, student-read-model-rpcs, middleware, and leaderboards (includes
  organization model coverage).
- No-new-Vercel-Functions check: pass, no baseline edits.
- Ego Lite server verified at `localhost:3081`, launched from this worktree. Fixture
  explicitly labels `e70e/class-join`; no main-checkout preview config used.
- EN/VI × light/dark × 1280×720, 1440×900, 768×1024, 390×844: all 16 combinations
  have document scrollWidth equal to clientWidth for both learner and teacher dialog.
  Long Vietnamese titles wrap. Dialog stays inside viewport; credentials scroll inside
  their selectable inputs. Screenshots were captured and visually inspected.
- Browser interactions: create/view/replace/revoke, replacement consequences,
  clipboard-denial/manual-copy feedback, Escape/focus restoration, recoverable preview
  failure, duplicate-click count of one, and correct class destination link.
  All 26 EN/VI error/replay status fixtures show a message and no erroneous Join
  control. Clipboard success was verified with a local adapter; manual fallback
  selects the complete 73-character fixture URL and has an associated input label.
  The real public join route navigates to `/en/auth/login` with the exact localized
  code URL in `next`. OAuth callback allowlist round-trip is unit-tested.

Local screenshot/measurement artifacts: `output/class-join-qa/` (untracked QA output).
The dev-only `/dev/class-join-qa` route uses explicit action adapters and cannot execute
production mutations. It is guarded by development mode and localhost.

## Release and remaining live coverage

No production migration, merge, deployment or learner message was performed. Database
behavior was tested in PostgreSQL with representative base tables and selected real
production functions, not the complete live Supabase schema. Browser mutation QA used
local adapters; a full OAuth-to-live-Supabase claim and the authenticated class landing
must still be smoke-tested against an isolated Supabase staging environment after the
migration is approved/applied. The code fails safely with a recoverable unavailable
state when the RPC migration is absent. The production IELTS gate remains unchanged.

This task did not enable Fast or change global speed/model settings. Standard speed
was inherited from the source task's user-confirmed configuration; this task did not
independently introspect a runtime service-tier field.
