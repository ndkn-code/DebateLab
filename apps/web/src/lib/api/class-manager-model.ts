import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";
import type { OrganizationRole } from "@/lib/organizations/contracts";

/**
 * A class manager is either a platform/org administrator, the organization
 * owner, or a teacher assigned to the class. `coach` is accepted only as a
 * legacy input value and is never returned from this module.
 */
export type ClassManagerRole = "admin" | "owner" | "head_teacher" | "teacher";

export function resolveClassManagerRole(input: {
  isAdmin: boolean;
  clubRole: OrganizationRole | "coach" | null;
  hasActiveTeacherMembership: boolean;
  profileRole?: OrganizationRole | null;
}): ClassManagerRole | null {
  if (input.isAdmin) return "admin";
  const role = normalizeOrganizationRole(input.clubRole);
  if (role === "owner" || role === "admin") return role === "owner" ? "owner" : "admin";
  if (role === "head_teacher") return "head_teacher";
  if (
    role === "teacher" &&
    input.profileRole === "teacher" &&
    input.hasActiveTeacherMembership
  ) return "teacher";
  return null;
}

export function isEligibleIeltsClass(
  programType: string | null | undefined,
  status: string | null | undefined,
) {
  return programType === "ielts" && status !== "archived";
}
