import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModuleAccessLevel } from "@/lib/types/admin";

export async function canAccessCourse(supabase: SupabaseClient, userId: string, courseId: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", userId).single();
  if (profile?.role === "admin") return true;

  const { data: course } = await supabase
    .from("courses").select("visibility").eq("id", courseId).single();
  if (!course) return false;

  if (course.visibility === "public") return true;
  if (course.visibility === "premium") return true; // TODO: check premium subscription

  // class_restricted — check access rules
  const { data: rule } = await supabase
    .from("course_access_rules")
    .select("id")
    .eq("course_id", courseId)
    .eq("target_id", userId)
    .limit(1);
  return (rule && rule.length > 0) ?? false;
}

export function getModuleLockStatus(
  accessLevel: ModuleAccessLevel,
  userRole: string
): "accessible" | "locked" | "premium_required" {
  if (userRole === "admin") return "accessible";
  if (accessLevel === "free") return "accessible";
  // TODO: Enforce when monetization is enabled
  // For now, everything accessible
  return "accessible";
}
