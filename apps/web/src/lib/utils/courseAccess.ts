import type { SupabaseClient } from "@supabase/supabase-js";
import type { CourseVisibility, ModuleAccessLevel } from "@/lib/types/admin";
import {
  canAccessCourseRecord,
  getUserEntitlement,
  isBetaAllAccessEnabled,
} from "@/lib/entitlements";

export async function canAccessCourse(supabase: SupabaseClient, userId: string, courseId: string): Promise<boolean> {
  const accessMap = await getCourseAccessMap(supabase, userId, [courseId]);
  return accessMap.get(courseId) ?? false;
}

export async function getCourseAccessMap(
  supabase: SupabaseClient,
  userId: string,
  courseIds: string[]
): Promise<Map<string, boolean>> {
  const uniqueCourseIds = [...new Set(courseIds)].filter(Boolean);
  const accessMap = new Map(uniqueCourseIds.map((id) => [id, false]));
  if (uniqueCourseIds.length === 0) return accessMap;

  const { data: courses } = await supabase
    .from("courses")
    .select("id, visibility")
    .in("id", uniqueCourseIds);

  return getCourseAccessMapFromRecords(supabase, userId, courses ?? []);
}

export async function getCourseAccessMapFromRecords(
  supabase: SupabaseClient,
  userId: string,
  courses: Array<{ id: string; visibility?: CourseVisibility | string | null }>
): Promise<Map<string, boolean>> {
  const accessMap = new Map(courses.map((course) => [course.id, false]));
  if (courses.length === 0) return accessMap;

  const [{ data: profile }, entitlement] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", userId).single(),
    getUserEntitlement(supabase, userId),
  ]);

  const restrictedCourseIds = (courses ?? [])
    .filter((course) => course.visibility === "class_restricted")
    .map((course) => course.id as string);

  let directAccessIds = new Set<string>();
  let classAccessIds = new Set<string>();

  if (restrictedCourseIds.length > 0) {
    const [rulesRes, membershipsRes] = await Promise.all([
      supabase
        .from("course_access_rules")
        .select("course_id")
        .in("course_id", restrictedCourseIds)
        .eq("target_id", userId),
      supabase
        .from("class_memberships")
        .select("class_id")
        .eq("user_id", userId)
        .eq("status", "active"),
    ]);

    directAccessIds = new Set(
      (rulesRes.data ?? []).map((rule) => rule.course_id as string)
    );

    const classIds = (membershipsRes.data ?? [])
      .map((membership) => membership.class_id as string)
      .filter(Boolean);

    if (classIds.length > 0) {
      const { data: assignments } = await supabase
        .from("class_course_assignments")
        .select("course_id")
        .in("class_id", classIds)
        .in("course_id", restrictedCourseIds);

      classAccessIds = new Set(
        (assignments ?? []).map((assignment) => assignment.course_id as string)
      );
    }
  }

  for (const course of courses ?? []) {
    const courseId = course.id as string;
    accessMap.set(
      courseId,
      canAccessCourseRecord({
        role: profile?.role,
        visibility: course.visibility,
        entitlement,
        hasAccessRule: directAccessIds.has(courseId),
        hasClassAccess: classAccessIds.has(courseId),
      })
    );
  }

  return accessMap;
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
