-- A learner's identity match is necessary but not sufficient for reading a
-- roster snapshot.  The parent occurrence must also be visible so a known
-- occurrence UUID cannot reveal unpublished, cancelled, future-historical, or
-- cross-class snapshot metadata.  Managers retain roster-wide visibility.

drop policy if exists "LMS occurrence roster scoped reads"
  on public.lms_occurrence_roster_snapshots;

create policy "LMS occurrence roster scoped reads"
on public.lms_occurrence_roster_snapshots for select to authenticated
using (
  (
    user_id = (select auth.uid())
    and private.can_view_lms_occurrence(occurrence_id, (select auth.uid()))
  )
  or private.can_manage_lms_occurrence(occurrence_id, (select auth.uid()))
);
