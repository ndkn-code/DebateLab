import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";

export interface AssignableClass {
  id: string;
  title: string;
}

export interface AssignableClassRow extends AssignableClass {
  club_id: string;
  teacher_user_id: string | null;
}

/** Teachers are scoped to their assigned classes; owners/admins see the organization's IELTS classes. */
export function filterAssignableIeltsClasses(
  rows: AssignableClassRow[],
  scope: {
    actorId: string;
    clubId: string;
    isAdmin: boolean;
    clubRole: string | null;
    assignedClassIds?: ReadonlySet<string>;
  },
): AssignableClass[] {
  const role = normalizeOrganizationRole(scope.clubRole);
  const isScopedTeacher = !scope.isAdmin && role !== "owner" && role !== "admin";
  return rows
    .filter((row) => row.club_id === scope.clubId)
    .filter(
      (row) =>
        !isScopedTeacher ||
        row.teacher_user_id === scope.actorId ||
        scope.assignedClassIds?.has(row.id) === true,
    )
    .map(({ id, title }) => ({ id, title }));
}
