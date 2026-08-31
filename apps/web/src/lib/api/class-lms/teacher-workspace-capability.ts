import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";
import type { OrganizationRole } from "@/lib/organizations/contracts";
import { createTypedServerClient } from "@/lib/supabase/server";

/** The database migration intentionally lands before generated Supabase types. */
type TeacherWorkspaceDb = SupabaseClient;
type Row = Record<string, unknown>;

export const TEACHER_WORKSPACE_FEATURE_KEY = "teacher_workspace_v2" as const;
export const TEACHER_WORKSPACE_PROGRAMS = ["ielts", "debate", "public_speaking"] as const;
export type TeacherWorkspaceProgram = (typeof TEACHER_WORKSPACE_PROGRAMS)[number];

export type TeacherWorkspaceClass = {
  id: string;
  organizationId: string;
  title: string;
  programType: TeacherWorkspaceProgram;
  isAssigned: boolean;
  isLeadTeacher: boolean;
  featureEnabled: boolean;
};

export type TeacherWorkspaceOrganization = {
  id: string;
  role: OrganizationRole;
  featureEnabled: boolean;
  hasIeltsEntitlement: boolean;
};

export type TeacherWorkspaceCapability = {
  userId: string;
  profileRole: string | null;
  isPlatformAdmin: boolean;
  canAccess: boolean;
  hasIeltsEntitlement: boolean;
  organizations: TeacherWorkspaceOrganization[];
  classes: TeacherWorkspaceClass[];
};

function asDb(client: Awaited<ReturnType<typeof createTypedServerClient>>): TeacherWorkspaceDb {
  return client as unknown as TeacherWorkspaceDb;
}

function text(row: Row, key: string): string | null {
  return typeof row[key] === "string" ? row[key] as string : null;
}

function role(value: unknown): OrganizationRole {
  return normalizeOrganizationRole(typeof value === "string" ? value : null) ?? "student";
}

function program(value: unknown): TeacherWorkspaceProgram | null {
  return TEACHER_WORKSPACE_PROGRAMS.includes(value as TeacherWorkspaceProgram)
    ? value as TeacherWorkspaceProgram
    : null;
}

function firstFlag(
  flags: Row[],
  organizationId: string,
  classId: string | null,
) {
  return flags.find((flag) =>
    text(flag, "club_id") === organizationId
      && text(flag, "feature_key") === TEACHER_WORKSPACE_FEATURE_KEY
      && text(flag, "class_id") === classId,
  );
}

/**
 * Loads the authorization projection used by every teacher-mode surface.
 * Supabase RLS remains the final boundary; this projection keeps UI code from
 * inferring access from the public IELTS visibility flag or querying tables.
 */
export async function loadTeacherWorkspaceCapability(): Promise<TeacherWorkspaceCapability> {
  const db = asDb(await createTypedServerClient());
  const { data: authData, error: authError } = await db.auth.getUser();
  if (authError) throw new Error(`teacher workspace auth: ${authError.message}`);
  const userId = authData.user?.id;
  if (!userId) throw new Error("Unauthorized");

  const [{ data: profile, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
    db.from("profiles").select("role").eq("id", userId).maybeSingle(),
    db.from("club_memberships").select("club_id, role").eq("user_id", userId).eq("status", "active"),
  ]);
  if (profileError) throw new Error(`teacher workspace profile: ${profileError.message}`);
  if (membershipError) throw new Error(`teacher workspace organizations: ${membershipError.message}`);

  const profileRole = text((profile ?? {}) as Row, "role");
  const isPlatformAdmin = profileRole === "admin";
  const organizationRows = (memberships ?? []) as Row[];
  const organizationIds = [...new Set(organizationRows.map((row) => text(row, "club_id")).filter((value): value is string => Boolean(value)))];
  const organizationRoles = new Map(organizationRows.map((row) => [text(row, "club_id"), role(row.role)]));
  const managerOrganizationIds = new Set(
    organizationRows
      .filter((row) => ["owner", "admin"].includes(role(row.role)))
      .map((row) => text(row, "club_id"))
      .filter((value): value is string => Boolean(value)),
  );

  const flagsQuery = db
    .from("lms_pilot_flags")
    .select("club_id, class_id, feature_key, enabled")
    .eq("feature_key", TEACHER_WORKSPACE_FEATURE_KEY);
  if (!isPlatformAdmin && organizationIds.length) flagsQuery.in("club_id", organizationIds);
  const [{ data: classes, error: classError }, { data: teacherMemberships, error: teacherError }, { data: flags, error: flagError }] = await Promise.all([
    organizationIds.length || isPlatformAdmin
      ? db.from("classes").select("id, club_id, title, program_type, teacher_user_id").eq("status", "active")
      : Promise.resolve({ data: [], error: null }),
    db.from("class_memberships").select("class_id").eq("user_id", userId).eq("member_role", "teacher").eq("status", "active"),
    isPlatformAdmin || organizationIds.length ? flagsQuery : Promise.resolve({ data: [], error: null }),
  ]);
  if (classError) throw new Error(`teacher workspace classes: ${classError.message}`);
  if (teacherError) throw new Error(`teacher workspace assignments: ${teacherError.message}`);
  if (flagError) throw new Error(`teacher workspace feature flags: ${flagError.message}`);

  const assignedClassIds = new Set(((teacherMemberships ?? []) as Row[]).map((row) => text(row, "class_id")).filter((value): value is string => Boolean(value)));
  const flagRows = (flags ?? []) as Row[];
  const candidateClasses = (classes ?? []) as Row[];
  const workspaceClasses: TeacherWorkspaceClass[] = [];

  for (const row of candidateClasses) {
    const id = text(row, "id");
    const organizationId = text(row, "club_id");
    const programType = program(row.program_type);
    if (!id || !organizationId || !programType) continue;
    if (!isPlatformAdmin && !organizationIds.includes(organizationId)) continue;
    const specific = firstFlag(flagRows, organizationId, id);
    const organization = firstFlag(flagRows, organizationId, null);
    const featureEnabled = Boolean(specific ? specific.enabled : organization?.enabled);
    const isAssigned = assignedClassIds.has(id);
    const isManager = isPlatformAdmin || managerOrganizationIds.has(organizationId);
    if (featureEnabled && (isManager || isAssigned)) {
      workspaceClasses.push({
        id,
        organizationId,
        title: text(row, "title") ?? "Class",
        programType,
        isAssigned,
        isLeadTeacher: text(row, "teacher_user_id") === userId,
        featureEnabled: true,
      });
    }
  }

  workspaceClasses.sort((left, right) => left.title.localeCompare(right.title) || left.id.localeCompare(right.id));
  const outputOrganizationIds = isPlatformAdmin
    ? [...new Set([...organizationIds, ...workspaceClasses.map((item) => item.organizationId)])]
    : organizationIds;
  const organizations = outputOrganizationIds.map((id) => {
    const organizationFlag = firstFlag(flagRows, id, null);
    const organizationClasses = workspaceClasses.filter((item) => item.organizationId === id);
    return {
      id,
      role: isPlatformAdmin ? "admin" : organizationRoles.get(id) ?? "student",
      featureEnabled: Boolean(organizationFlag?.enabled) || organizationClasses.length > 0,
      hasIeltsEntitlement: organizationClasses.some((item) => item.programType === "ielts"),
    } satisfies TeacherWorkspaceOrganization;
  });
  const hasIeltsEntitlement = workspaceClasses.some((item) => item.programType === "ielts");
  return {
    userId,
    profileRole,
    isPlatformAdmin,
    canAccess: isPlatformAdmin || workspaceClasses.length > 0,
    hasIeltsEntitlement,
    organizations,
    classes: workspaceClasses,
  };
}
