-- Align Club OS grants with the action-specific RLS policy surface.

revoke all on table
  public.clubs,
  public.club_memberships,
  public.club_assignments,
  public.club_assignment_submissions,
  public.performance_attempts,
  public.coach_reviews
from anon, authenticated;

grant select, insert, update on table
  public.clubs,
  public.club_assignment_submissions,
  public.performance_attempts
to authenticated;

grant select, insert, update, delete on table
  public.club_memberships,
  public.club_assignments,
  public.coach_reviews
to authenticated;
