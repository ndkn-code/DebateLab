"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { canAccessCourse } from "@/lib/utils/courseAccess";

export async function enrollInCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Check if already enrolled
  const { data: existing } = await supabase.from("enrollments")
    .select("id").eq("course_id", courseId).eq("user_id", user.id).limit(1);
  if (existing && existing.length > 0) return;

  // Check access
  const hasAccess = await canAccessCourse(supabase, user.id, courseId);
  if (!hasAccess) throw new Error("You don't have access to this course");

  await supabase.from("enrollments").insert({
    course_id: courseId,
    user_id: user.id,
    status: "active",
    progress_pct: 0,
  });

  revalidatePath("/dashboard/courses");
}

export async function unenrollFromCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase.from("enrollments").delete().eq("course_id", courseId).eq("user_id", user.id);
  revalidatePath("/dashboard/courses");
}
