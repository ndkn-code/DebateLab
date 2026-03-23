"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { enrollInCourse as enrollInCourseApi, markLessonComplete } from "@/lib/api/courses";

// Used by the existing course-detail-content.tsx (student-facing)
export async function enrollAction(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await enrollInCourseApi(user.id, courseId);
  revalidatePath("/courses");
  revalidatePath("/dashboard");
}

// Used by the admin panel's student course player
export async function enrollInCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: existing } = await supabase.from("enrollments")
    .select("id").eq("course_id", courseId).eq("user_id", user.id).limit(1);
  if (existing && existing.length > 0) return;

  await supabase.from("enrollments").insert({
    course_id: courseId,
    user_id: user.id,
    status: "active",
    progress_pct: 0,
  });

  revalidatePath("/courses");
  revalidatePath("/dashboard/courses");
}

export async function markLessonCompleteAction(
  lessonId: string,
  courseId: string,
  score?: number,
  timeSpentSeconds?: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const result = await markLessonComplete(user.id, lessonId, courseId, score, timeSpentSeconds);
  revalidatePath("/courses");
  revalidatePath("/dashboard");
  return result;
}

export async function unenrollFromCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase.from("enrollments").delete().eq("course_id", courseId).eq("user_id", user.id);
  revalidatePath("/dashboard/courses");
}
