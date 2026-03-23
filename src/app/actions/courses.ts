"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { generateSlug, ensureUniqueSlug } from "@/lib/utils/slug";
import type { CourseVisibility, ActivityType, ActivityPhase, ActivityContent } from "@/lib/types/admin";

async function verifyAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Forbidden");
  return user.id;
}

async function logAdminAction(supabase: Awaited<ReturnType<typeof createClient>>, adminId: string, action: string, entityType?: string, entityId?: string, changes?: Record<string, unknown>) {
  await supabase.from("admin_activity_log").insert({
    admin_user_id: adminId,
    action,
    entity_type: entityType ?? null,
    entity_id: entityId ?? null,
    changes: changes ?? {},
  });
}

// === COURSE ACTIONS ===

export async function createCourse(data: {
  title: string;
  description?: string;
  category: string;
  difficulty: string;
  visibility: CourseVisibility;
  thumbnail_url?: string;
}) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const slug = await ensureUniqueSlug(generateSlug(data.title), supabase);

  const { data: course, error } = await supabase.from("courses").insert({
    title: data.title,
    slug,
    description: data.description ?? null,
    category: data.category,
    difficulty: data.difficulty,
    visibility: data.visibility,
    thumbnail_url: data.thumbnail_url ?? null,
    is_published: false,
    is_free: true,
    is_archived: false,
    created_by: adminId,
    metadata: {},
  }).select().single();

  if (error) throw new Error(error.message);

  await logAdminAction(supabase, adminId, "create_course", "course", course.id, { title: data.title });
  revalidatePath("/dashboard/admin/courses");
  return course;
}

export async function updateCourse(courseId: string, data: Record<string, unknown>) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { data: course, error } = await supabase.from("courses")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", courseId).select().single();

  if (error) throw new Error(error.message);

  await logAdminAction(supabase, adminId, "update_course", "course", courseId, data);
  revalidatePath("/dashboard/admin/courses");
  return course;
}

export async function deleteCourse(courseId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { count } = await supabase.from("enrollments").select("*", { count: "exact", head: true }).eq("course_id", courseId);
  if (count && count > 0) throw new Error("Cannot delete course with enrollments. Archive instead.");

  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw new Error(error.message);

  await logAdminAction(supabase, adminId, "delete_course", "course", courseId);
  revalidatePath("/dashboard/admin/courses");
}

export async function archiveCourse(courseId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  await supabase.from("courses").update({ is_archived: true, is_published: false }).eq("id", courseId);
  await logAdminAction(supabase, adminId, "archive_course", "course", courseId);
  revalidatePath("/dashboard/admin/courses");
}

export async function duplicateCourse(courseId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { data: original } = await supabase.from("courses").select("*").eq("id", courseId).single();
  if (!original) throw new Error("Course not found");

  const slug = await ensureUniqueSlug(generateSlug(`${original.title} Copy`), supabase);

  const { data: newCourse } = await supabase.from("courses").insert({
    title: `(Copy) ${original.title}`,
    slug,
    description: original.description,
    category: original.category,
    difficulty: original.difficulty,
    visibility: original.visibility,
    thumbnail_url: original.thumbnail_url,
    is_published: false,
    is_free: original.is_free,
    is_archived: false,
    created_by: adminId,
    metadata: original.metadata ?? {},
  }).select().single();

  if (!newCourse) throw new Error("Failed to duplicate");

  // Copy modules and activities
  const { data: modules } = await supabase.from("course_modules").select("*").eq("course_id", courseId).order("sort_order");
  if (modules) {
    for (const mod of modules) {
      const { data: newMod } = await supabase.from("course_modules").insert({
        course_id: newCourse.id,
        title: mod.title,
        description: mod.description,
        sort_order: mod.sort_order,
        access_level: mod.access_level ?? "locked",
      }).select("id").single();

      if (newMod) {
        const { data: activities } = await supabase.from("activities").select("*").eq("module_id", mod.id).order("order_index");
        if (activities) {
          for (const act of activities) {
            await supabase.from("activities").insert({
              module_id: newMod.id,
              activity_type: act.activity_type,
              title: act.title,
              description: act.description,
              phase: act.phase,
              order_index: act.order_index,
              duration_minutes: act.duration_minutes,
              content: act.content,
              metadata: act.metadata ?? {},
            });
          }
        }
      }
    }
  }

  await logAdminAction(supabase, adminId, "duplicate_course", "course", newCourse.id, { original_id: courseId });
  revalidatePath("/dashboard/admin/courses");
  return newCourse;
}

export async function togglePublish(courseId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { data: course } = await supabase.from("courses").select("is_published").eq("id", courseId).single();
  if (!course) throw new Error("Not found");

  if (!course.is_published) {
    // Validate: at least 1 module with 1 activity
    const { data: modules } = await supabase.from("course_modules").select("id").eq("course_id", courseId).limit(1);
    if (!modules || modules.length === 0) throw new Error("Need at least 1 module to publish");
    const { data: activities } = await supabase.from("activities").select("id").eq("module_id", modules[0].id).limit(1);
    if (!activities || activities.length === 0) throw new Error("Need at least 1 activity to publish");
  }

  await supabase.from("courses").update({ is_published: !course.is_published }).eq("id", courseId);
  await logAdminAction(supabase, adminId, course.is_published ? "unpublish_course" : "publish_course", "course", courseId);
  revalidatePath("/dashboard/admin/courses");
}

// === MODULE ACTIONS ===

export async function createModule(courseId: string, title: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { data: maxRow } = await supabase.from("course_modules").select("sort_order").eq("course_id", courseId).order("sort_order", { ascending: false }).limit(1);
  const nextOrder = (maxRow && maxRow[0] ? maxRow[0].sort_order : -1) + 1;

  const { data: mod, error } = await supabase.from("course_modules").insert({
    course_id: courseId,
    title,
    sort_order: nextOrder,
    access_level: nextOrder === 0 ? "free" : "locked",
  }).select().single();

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "create_module", "course_module", mod.id, { course_id: courseId, title });
  revalidatePath("/dashboard/admin/courses");
  return mod;
}

export async function updateModule(moduleId: string, data: { title?: string; description?: string; access_level?: string }) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { data: mod, error } = await supabase.from("course_modules")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", moduleId).select().single();

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "update_module", "course_module", moduleId, data);
  revalidatePath("/dashboard/admin/courses");
  return mod;
}

export async function deleteModule(moduleId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { data: mod } = await supabase.from("course_modules").select("course_id, sort_order").eq("id", moduleId).single();
  const { error } = await supabase.from("course_modules").delete().eq("id", moduleId);
  if (error) throw new Error(error.message);

  // Reindex
  if (mod) {
    const { data: remaining } = await supabase.from("course_modules")
      .select("id").eq("course_id", mod.course_id).order("sort_order");
    if (remaining) {
      for (let i = 0; i < remaining.length; i++) {
        await supabase.from("course_modules").update({ sort_order: i }).eq("id", remaining[i].id);
      }
    }
  }

  await logAdminAction(supabase, adminId, "delete_module", "course_module", moduleId);
  revalidatePath("/dashboard/admin/courses");
}

export async function reorderModules(courseId: string, moduleIds: string[]) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  for (let i = 0; i < moduleIds.length; i++) {
    await supabase.from("course_modules").update({ sort_order: i }).eq("id", moduleIds[i]);
  }

  await logAdminAction(supabase, adminId, "reorder_modules", "course", courseId, { order: moduleIds });
  revalidatePath("/dashboard/admin/courses");
}

// === ACTIVITY ACTIONS ===

export async function createActivity(moduleId: string, data: {
  activity_type: ActivityType;
  title: string;
  phase: ActivityPhase;
  content: ActivityContent;
  duration_minutes?: number;
}) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { data: maxRow } = await supabase.from("activities").select("order_index").eq("module_id", moduleId).order("order_index", { ascending: false }).limit(1);
  const nextOrder = (maxRow && maxRow[0] ? maxRow[0].order_index : -1) + 1;

  const { data: activity, error } = await supabase.from("activities").insert({
    module_id: moduleId,
    activity_type: data.activity_type,
    title: data.title,
    phase: data.phase,
    order_index: nextOrder,
    duration_minutes: data.duration_minutes ?? 5,
    content: data.content,
    metadata: {},
  }).select().single();

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "create_activity", "activity", activity.id, { module_id: moduleId, type: data.activity_type });
  revalidatePath("/dashboard/admin/courses");
  return activity;
}

export async function updateActivity(activityId: string, data: {
  title?: string;
  description?: string;
  phase?: ActivityPhase;
  duration_minutes?: number;
  content?: ActivityContent;
}) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { data: activity, error } = await supabase.from("activities")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", activityId).select().single();

  if (error) throw new Error(error.message);
  await logAdminAction(supabase, adminId, "update_activity", "activity", activityId, data as Record<string, unknown>);
  revalidatePath("/dashboard/admin/courses");
  return activity;
}

export async function deleteActivity(activityId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  const { data: act } = await supabase.from("activities").select("module_id").eq("id", activityId).single();
  await supabase.from("activities").delete().eq("id", activityId);

  // Reindex
  if (act) {
    const { data: remaining } = await supabase.from("activities")
      .select("id").eq("module_id", act.module_id).order("order_index");
    if (remaining) {
      for (let i = 0; i < remaining.length; i++) {
        await supabase.from("activities").update({ order_index: i }).eq("id", remaining[i].id);
      }
    }
  }

  await logAdminAction(supabase, adminId, "delete_activity", "activity", activityId);
  revalidatePath("/dashboard/admin/courses");
}

export async function reorderActivities(moduleId: string, activityIds: string[]) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  for (let i = 0; i < activityIds.length; i++) {
    await supabase.from("activities").update({ order_index: i }).eq("id", activityIds[i]);
  }

  await logAdminAction(supabase, adminId, "reorder_activities", "course_module", moduleId, { order: activityIds });
  revalidatePath("/dashboard/admin/courses");
}

// === VISIBILITY & ACCESS ACTIONS ===

export async function updateCourseVisibility(courseId: string, visibility: CourseVisibility) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  await supabase.from("courses").update({ visibility }).eq("id", courseId);
  await logAdminAction(supabase, adminId, "update_visibility", "course", courseId, { visibility });
  revalidatePath("/dashboard/admin/courses");
}

export async function updateModuleAccessLevel(moduleId: string, accessLevel: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);
  await supabase.from("course_modules").update({ access_level: accessLevel }).eq("id", moduleId);
  await logAdminAction(supabase, adminId, "update_module_access", "course_module", moduleId, { access_level: accessLevel });
  revalidatePath("/dashboard/admin/courses");
}

export async function addStudentToCourse(courseId: string, userId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  await supabase.from("course_access_rules").upsert({
    course_id: courseId,
    rule_type: "individual_user",
    target_id: userId,
    created_by: adminId,
  }, { onConflict: "course_id,rule_type,target_id" });

  // Also create enrollment
  const { data: existing } = await supabase.from("enrollments").select("id").eq("course_id", courseId).eq("user_id", userId).limit(1);
  if (!existing || existing.length === 0) {
    await supabase.from("enrollments").insert({ course_id: courseId, user_id: userId });
  }

  await logAdminAction(supabase, adminId, "add_student", "course", courseId, { user_id: userId });
  revalidatePath("/dashboard/admin/courses");
}

export async function removeStudentFromCourse(courseId: string, userId: string) {
  const supabase = await createClient();
  const adminId = await verifyAdmin(supabase);

  await supabase.from("course_access_rules").delete()
    .eq("course_id", courseId).eq("target_id", userId);

  await logAdminAction(supabase, adminId, "remove_student", "course", courseId, { user_id: userId });
  revalidatePath("/dashboard/admin/courses");
}

export async function searchStudents(query: string, excludeCourseId?: string) {
  const supabase = await createClient();
  await verifyAdmin(supabase);

  let q = supabase.from("profiles").select("id, display_name, avatar_url, email").or(`display_name.ilike.%${query}%,email.ilike.%${query}%`).limit(10);

  const { data } = await q;
  if (!data || !excludeCourseId) return data ?? [];

  // Filter out already assigned
  const { data: existing } = await supabase.from("course_access_rules").select("target_id").eq("course_id", excludeCourseId);
  const assignedIds = new Set((existing ?? []).map((r) => r.target_id));
  return data.filter((p) => !assignedIds.has(p.id));
}
