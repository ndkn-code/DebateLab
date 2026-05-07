import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleAccessLevel } from "@/lib/types/admin";
import {
  canAccessCourseRecord,
  getUserEntitlement,
  isBetaAllAccessEnabled,
} from "@/lib/entitlements";

export async function canAccessCourse(supabase: SupabaseClient, userId: string, courseId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", userId).single();

  const { data: course } = await supabase
    .from("courses").select("visibility").eq("id", courseId).single();
  if (!course) return false;

  const [entitlement, accessRule] = await Promise.all([
    getUserEntitlement(supabase, userId),
    course.visibility === "class_restricted"
      ? supabase
          .from("course_access_rules")
          .select("id")
          .eq("course_id", courseId)
          .eq("target_id", userId)
          .limit(1)
      : Promise.resolve({ data: [] }),
  ]);

  return canAccessCourseRecord({
    role: profile?.role,
    visibility: course.visibility,
    entitlement,
    hasAccessRule: Boolean(accessRule.data?.length),
  });
}

export function getModuleLockStatus(
  accessLevel: ModuleAccessLevel,
  userRole: string,
  hasPremiumAccess = isBetaAllAccessEnabled()
): "accessible" | "locked" | "premium_required" {
  if (userRole === "admin") return "accessible";
  if (accessLevel === "free") return "accessible";
  if (hasPremiumAccess) return "accessible";
  return accessLevel === "premium" ? "premium_required" : "locked";
}
