export interface AssignableClass {
  id: string;
  title: string;
}

export interface AssignableClassRow extends AssignableClass {
  club_id: string;
  teacher_user_id: string | null;
}

/** Coaches are scoped to their assigned classes; owners/admins see the club's IELTS classes. */
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
  const isScopedCoach = !scope.isAdmin && scope.clubRole === "coach";
  return rows
    .filter((row) => row.club_id === scope.clubId)
    .filter(
      (row) =>
        !isScopedCoach ||
        row.teacher_user_id === scope.actorId ||
        scope.assignedClassIds?.has(row.id) === true,
    )
    .map(({ id, title }) => ({ id, title }));
}
