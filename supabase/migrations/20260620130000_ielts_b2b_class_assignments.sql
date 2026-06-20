-- WS-5.3 — B2B: assign IELTS mocks to classes (LMS surfacing).
--
-- Additive only; debate stays byte-identical:
--   * the new column defaults NULL (no debate row references it),
--   * the CHECK widenings only ADMIT new values (existing rows already conform),
--   * the new RLS policies are PERMISSIVE SELECT additions layered alongside the
--     existing owner/admin policies — a learner still sees only their own rows.
--
-- The "assignment" reuses the existing Club OS model: `ielts_attempts` already
-- FKs assignment_id -> club_assignments(id). We add a typed pointer to the
-- published IELTS mock, plus org-scoped visibility so a teacher (club owner/coach
-- or platform admin) can see their class's attempts + bands, and enrolled
-- learners can see what was assigned to their class.
--
-- Idempotent (drop-if-exists guards) so it is safe to re-run.

begin;

-- 1) Typed reference from a club assignment to the IELTS mock it surfaces.
alter table public.club_assignments
  add column if not exists ielts_test_id uuid
    references public.ielts_tests (id) on delete restrict;

comment on column public.club_assignments.ielts_test_id is
  'When set, this assignment surfaces a published IELTS mock (assignment_type = ''ielts_mock''). NULL for debate/speaking/MUN assignments.';

-- 2) Admit the IELTS taxonomy (additive widening; existing rows already conform).
alter table public.club_assignments
  drop constraint if exists club_assignments_assignment_type_check;
alter table public.club_assignments
  add constraint club_assignments_assignment_type_check
  check (assignment_type = any (array[
    'practice', 'case', 'speech', 'quiz', 'attendance', 'ielts_mock'
  ]::text[]));

alter table public.club_assignments
  drop constraint if exists club_assignments_assigned_track_check;
alter table public.club_assignments
  add constraint club_assignments_assigned_track_check
  check (assigned_track = any (array[
    'debate', 'speaking', 'mun', 'ielts'
  ]::text[]));

-- 3) Integrity: an IELTS-mock assignment must target both a test and a class.
alter table public.club_assignments
  drop constraint if exists club_assignments_ielts_mock_requires_test;
alter table public.club_assignments
  add constraint club_assignments_ielts_mock_requires_test
  check (
    assignment_type <> 'ielts_mock'
    or (ielts_test_id is not null and class_id is not null)
  );

-- 4) Lookup index for "IELTS assignments for this test".
create index if not exists club_assignments_ielts_test_id_idx
  on public.club_assignments (ielts_test_id)
  where ielts_test_id is not null;

-- 5) Org-scoped teacher visibility into class IELTS attempts.
--    PERMISSIVE SELECT addition; the owner/admin policy is untouched.
drop policy if exists "Class managers view IELTS assignment attempts" on public.ielts_attempts;
create policy "Class managers view IELTS assignment attempts"
  on public.ielts_attempts
  for select
  using (
    (club_id is not null and private.can_manage_club(club_id, (select auth.uid())))
    or (class_id is not null and private.can_manage_class(class_id, (select auth.uid())))
  );

-- 6) Org-scoped teacher visibility into the band scores of those attempts.
drop policy if exists "Class managers view IELTS assignment band scores" on public.attempt_band_scores;
create policy "Class managers view IELTS assignment band scores"
  on public.attempt_band_scores
  for select
  using (
    exists (
      select 1
      from public.ielts_attempts a
      where a.id = attempt_band_scores.attempt_id
        and (
          (a.club_id is not null and private.can_manage_club(a.club_id, (select auth.uid())))
          or (a.class_id is not null and private.can_manage_class(a.class_id, (select auth.uid())))
        )
    )
  );

-- 7) Enrolled learners can see the IELTS mocks assigned to their class.
--    Scoped to IELTS rows so debate-assignment visibility is unchanged.
drop policy if exists "Class members view IELTS mock assignments" on public.club_assignments;
create policy "Class members view IELTS mock assignments"
  on public.club_assignments
  for select
  using (
    assignment_type = 'ielts_mock'
    and class_id is not null
    and private.can_view_class(class_id, (select auth.uid()))
  );

commit;
