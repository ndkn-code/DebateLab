"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Used by course-detail-content.tsx (student-facing enroll button)
export async function enrollAction(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Upsert enrollment
  const { error } = await supabase
    .from("enrollments")
    .upsert(
      {
        user_id: user.id,
        course_id: courseId,
        status: "active",
        progress_pct: 0,
      },
      { onConflict: "user_id,course_id" }
    );

  if (error) throw new Error(error.message);

  // Log activity
  await supabase.from("activity_log").insert({
    user_id: user.id,
    activity_type: "course_started",
    reference_id: courseId,
    reference_type: "course",
    xp_earned: 0,
    metadata: {},
  });

  revalidatePath("/courses");
  revalidatePath("/dashboard");
}

// Used by admin panel's student course player
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

// Used by lesson renderers (article, video, quiz, practice)
export async function markLessonCompleteAction(
  lessonId: string,
  courseId: string,
  score?: number,
  timeSpentSeconds?: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Upsert lesson progress
  await supabase
    .from("lesson_progress")
    .upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        course_id: courseId,
        status: "completed",
        score: score ?? null,
        time_spent_seconds: timeSpentSeconds ?? 0,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" }
    );

  const xpEarned = score != null ? 25 + Math.round((score / 100) * 25) : 25;

  // Log activity + award XP
  await supabase.from("activity_log").insert({
    user_id: user.id,
    activity_type: "lesson_completed",
    reference_id: lessonId,
    reference_type: "lesson",
    xp_earned: xpEarned,
    metadata: { score, time_spent_seconds: timeSpentSeconds },
  });

  await supabase.rpc("increment_xp", { user_id: user.id, amount: xpEarned });
  await supabase.rpc("upsert_daily_stats", {
    p_user_id: user.id,
    p_sessions: 0,
    p_minutes: 0,
    p_xp: xpEarned,
  });

  revalidatePath("/courses");
  revalidatePath("/dashboard");

  return { xpEarned };
}

export async function unenrollFromCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase.from("enrollments").delete().eq("course_id", courseId).eq("user_id", user.id);
  revalidatePath("/dashboard/courses");
}
