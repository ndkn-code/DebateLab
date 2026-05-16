-- Harden Club OS V1 grants for projects with legacy auto-exposed public objects.

revoke all on function private.can_view_club(uuid, uuid) from public;
revoke all on function private.can_manage_club(uuid, uuid) from public;

grant execute on function private.can_view_club(uuid, uuid) to authenticated;
grant execute on function private.can_manage_club(uuid, uuid) to authenticated;

revoke all on table
  public.admin_class_list_rows,
  public.admin_club_list_rows,
  public.admin_club_assignment_rows
from anon, authenticated;

grant select on table
  public.admin_class_list_rows,
  public.admin_club_list_rows,
  public.admin_club_assignment_rows
to authenticated;

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
