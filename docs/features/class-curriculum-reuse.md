# Create a class from existing curriculum

Workbench workflow: authorized academic managers choose an existing class, name the fresh cohort, select whole courses/material placements/standalone assignments, and review content and dates before creating a draft. The destination center is inherited from the source, avoiding repeated destination selection.

## Integration and persistence

- Platform admin class list: entry next to the existing New class action.
- Teacher classes route: a separate route-wrapper entry for actors with eligible source classes. `TeacherWorkspaceScreen.tsx` is untouched; no sidebar or center-onboarding redesign.
- Success opens `/dashboard/teacher/classes/{classId}`. Review explains remaining setup: teacher, timetable, learners, and publishing.
- Existing `admin-classes.ts` action entrypoint calls a narrowly typed repository and three database RPCs. No new Vercel function entrypoints.
- One atomic create operation includes class, course references, draft material placements, draft assignment rows, audit and idempotency receipt. The actor/key lock precedes receipt lookup. Direct RPC calls enforce authorization and input constraints too.
- A source fingerprint makes changes between selection and commit explicit. Retries return the existing class rather than repeating inserts.
- Selected courses retain their shared module/lesson structure. This is cohort reuse, not whole-course duplication: course edits affect the original shared curriculum. Selectivity is at the course boundary because Thinkfy has no class/module inclusion table.
- Material reuse is restricted to approved, ready, organization-scoped versions with class placements for all learners; new placements are drafts. Class-scoped, selected-audience, withdrawn, rights-pending, and linked items are explained as ineligible. Legacy resources are not copied.
- Eligible standalone assignment configuration is copied using explicit fields. Assignments linked to IELTS tests, occurrence/material placements, or metadata contracts are excluded. Copied work stays draft.
- No learner/staff memberships, enrollment, attendance, submissions, grades, private feedback, announcements, progress, invitations, schedules or notification outbox writes.

## Dates

New class dates are calendar dates. Clear is the default for copied assignment/material timestamps. Shift requires source and new start dates; PostgreSQL applies their calendar-day difference while preserving local wall-clock time in the selected IANA zone. Null dates stay null. Preview and create share the same database projection, including DST gap and destination date-boundary checks. No timetable or occurrence dates are fabricated.

## Permissions and rollout

Existing organization academic-admin and source class-manager predicates are both required. This includes eligible owner/admin/head-teacher roles; ordinary assigned teachers do not acquire new-class authority. Cross-center reuse is unavailable even to managers of multiple centers: each operation inherits exactly one source center. The existing application IELTS launch check remains; database IELTS reuse conservatively requires platform admin while prelaunch.

The additive migration `20260905200000_class_curriculum_reuse.sql` must be reviewed and applied through the normal release process before enabling these RPC-backed flows. It has not been applied to production. No merge or deploy is part of this change.

## Reference provenance and design decisions

Behavior adapted from local Lumist source (not its ordinary New Class form):

- `features/classroom-management/services/server/classroom-create-server.service.ts`, lines 174–211: source organization/course/module eligibility; lines 268–347 and 475–505: transactional class creation and complete selection.
- `features/classroom-management/services/server/classroom-module-clone-server.service.ts`, lines 54–70: calendar-day shifts retaining local time; lines 181–260: draft assignment copies and deterministic retry identity; lines 263–367: organization/course boundaries.
- `features/manager-ai-agent/components/AgentStarterSuggestions.tsx`, lines 79–142: reuse only when start-class capability and a source exist.

These files were inspected in `/Users/jacknguyen/Developer/app-lumist-ai`; SQL adapts the behavior to Thinkfy's existing PostgreSQL/RLS/organization receipt contracts. No Lumist branding or styling was copied. A dedicated authenticated Ego Lite space (78) reached Lumist's manager assistant on 2026-09-05; it did not demonstrate a live clone UI. Ordinary class creation is not claimed as clone evidence.

Design research used actual Mobbin screenshots:

- [Asana duplicate task](https://mobbin.com/screens/04474e27-c6e2-451b-b1ce-4ae7cc909734): editable name followed by explicit inclusion choices and one final action.
- [TheyDo content duplication](https://mobbin.com/screens/e0d88387-339f-4069-bff8-54a2da91e2da): grouped selectable content rows and counts.
- [Shopify duplicate product](https://mobbin.com/screens/c3ac2c6d-ac33-46e7-ade9-aee43fca4ef8): draft status visible before copying.

Composition specified before implementation: desktop modal up to 640px, mobile viewport gutters, one column with paired dates at wider widths, internal vertical scroll, stable action footer, 16–24px spacing, 14px body/13px labels/20px title. Thinkfy Dialog/Select/Input/Button provide controls; existing semantic roles and control radii supply the skin. Unlike the references, the review must show each actual date change and excluded learner data; course/module selection follows Thinkfy's reference model rather than recreating Lumist collections.

## Verification

See the accompanying verification record for exact completed checks and limits. The local browser harness lives outside application entrypoints and is explicitly isolated to PostgreSQL database `thinkfy_reuse_571d`; it is not a substitute for deployed Supabase/session verification.
