export type ClassManagerRole = "admin" | "owner" | "coach";

export function resolveClassManagerRole(input: {
  isAdmin: boolean;
  clubRole: "owner" | "coach" | null;
  hasActiveTeacherMembership: boolean;
  profileRole?: "student" | "teacher" | "admin" | null;
}): ClassManagerRole | null {
  if (input.isAdmin) return "admin";
  if (input.clubRole === "owner") return "owner";
  if (
    input.clubRole === "coach" &&
    input.profileRole === "teacher" &&
    input.hasActiveTeacherMembership
  ) return "coach";
  return null;
}

export function isEligibleIeltsClass(
  programType: string | null | undefined,
  status: string | null | undefined,
) {
  return programType === "ielts" && status !== "archived";
}
