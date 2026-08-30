import "server-only";

import { createTypedServerClient } from "@/lib/supabase/server";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";
import { resolveClassManagerRole, type ClassManagerRole } from "./class-manager-model";

export type ClassManagerClient = Awaited<ReturnType<typeof createTypedServerClient>>;

export type ClassManagerContext = {
  userId: string;
  classId: string;
  clubId: string | null;
  role: ClassManagerRole;
};

async function devBypassUserId() {
  if (isDevAdminBypassEnabled() || (await getDevAuthBypassUserFromServerContext())) {
    return DEV_ADMIN_PROFILE.id;
  }
  return null;
}

async function currentUserId(supabase: ClassManagerClient) {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return user.id;
  const bypass = await devBypassUserId();
  if (bypass) return bypass;
  throw new Error("Unauthorized");
}

/** Require platform-admin access. Kept here so class actions share one auth surface. */
export async function requirePlatformAdmin(supabase: ClassManagerClient) {
  const userId = await currentUserId(supabase);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "admin" || isDevAdminBypassEnabled()) return userId;
  throw new Error("Forbidden");
}

/** Organization owner/admin access used to create a class before a class membership exists. */
export async function requireClubOwner(supabase: ClassManagerClient, clubId: string) {
  const userId = await currentUserId(supabase);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "admin" || isDevAdminBypassEnabled()) return userId;

  const { data: membership, error } = await supabase
    .from("club_memberships")
    .select("id")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .eq("status", "active")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!membership) throw new Error("Forbidden");
  return userId;
}

/**
 * Require platform/org admin, owner, or a teacher explicitly assigned to this class via an
 * active teacher membership. The database helper in the class-manager migration
 * mirrors this rule for direct PostgREST writes.
 */
export async function requireClassManager(
  supabase: ClassManagerClient,
  classId: string,
): Promise<ClassManagerContext> {
  const userId = await currentUserId(supabase);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, club_id")
    .eq("id", classId)
    .maybeSingle();
  if (classError) throw new Error(classError.message);
  if (!classRow) throw new Error("Class not found");

  if (profile?.role === "admin" || isDevAdminBypassEnabled()) {
    return { userId, classId, clubId: classRow.club_id, role: "admin" };
  }
  if (!classRow.club_id) throw new Error("Forbidden");

  const { data: memberships, error: membershipError } = await supabase
    .from("club_memberships")
    .select("role")
    .eq("club_id", classRow.club_id)
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "teacher", "coach"]);
  if (membershipError) throw new Error(membershipError.message);
  const membership = memberships
    ?.map((row) => ({ ...row, role: normalizeOrganizationRole(row.role) }))
    .filter((row): row is { role: "owner" | "admin" | "teacher" } => row.role !== null)
    .sort((left, right) => {
      const rank = { owner: 0, admin: 1, teacher: 2 } as const;
      return rank[left.role] - rank[right.role];
    })
    .at(0);
  if (!membership) throw new Error("Forbidden");
  if (membership.role === "owner" || membership.role === "admin") {
    return { userId, classId, clubId: classRow.club_id, role: membership.role };
  }
  // A class membership is an authorization grant, but it must not outlive the
  // user's teacher profile. Demoting a teacher therefore revokes access
  // immediately even if cleanup of the membership row happens later.
  if (profile?.role !== "teacher") throw new Error("Forbidden");

  const { data: teacherMembership, error: teacherError } = await supabase
    .from("class_memberships")
    .select("id")
    .eq("class_id", classId)
    .eq("user_id", userId)
    .eq("member_role", "teacher")
    .eq("status", "active")
    .maybeSingle();
  if (teacherError) throw new Error(teacherError.message);
  const role = resolveClassManagerRole({
    isAdmin: false,
    clubRole: membership.role,
    hasActiveTeacherMembership: Boolean(teacherMembership),
    profileRole: profile?.role ?? null,
  });
  if (role !== "teacher") throw new Error("Forbidden");
  return { userId, classId, clubId: classRow.club_id, role };
}

export async function requireClassOwner(
  supabase: ClassManagerClient,
  classId: string,
) {
  const context = await requireClassManager(supabase, classId);
  if (context.role !== "admin" && context.role !== "owner") throw new Error("Forbidden");
  return context;
}

/** Gate the aggregate admin classes/schedules loaders without exposing them to learners. */
export async function requireClassManagerDashboard(supabase: ClassManagerClient) {
  const userId = await currentUserId(supabase);
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
  if (profile?.role === "admin" || isDevAdminBypassEnabled()) return userId;

  const { data: memberships, error } = await supabase
    .from("club_memberships")
    .select("club_id, role")
    .eq("user_id", userId)
    .eq("status", "active")
    .in("role", ["owner", "admin", "teacher", "coach"]);
  if (error) throw new Error(error.message);
  if ((memberships ?? []).some((membership) => {
    const role = normalizeOrganizationRole(membership.role);
    return role === "owner" || role === "admin";
  })) return userId;

  const clubIds = (memberships ?? []).map((membership) => membership.club_id);
  const isTeacherProfile = profile?.role === "teacher";
  if (clubIds.length > 0) {
    const { data: teacherRows, error: teacherError } = await supabase
      .from("class_memberships")
      .select("class_id")
      .eq("user_id", userId)
      .eq("member_role", "teacher")
      .eq("status", "active");
    if (teacherError) throw new Error(teacherError.message);
    const classIds = (teacherRows ?? []).map((row) => row.class_id);
    if (classIds.length > 0) {
      const { data: classes, error: classError } = await supabase
        .from("classes")
        .select("id")
        .in("id", classIds)
        .in("club_id", clubIds);
      if (classError) throw new Error(classError.message);
      if (isTeacherProfile && classes?.length) return userId;
    }
  }
  throw new Error("Forbidden");
}
