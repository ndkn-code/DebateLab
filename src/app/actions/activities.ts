"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function startActivity(activityId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check for existing incomplete attempt
  const { data: existing } = await supabase
    .from("activity_attempts")
    .select("*")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) return existing[0];

  // Get next attempt number
  const { count } = await supabase
    .from("activity_attempts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("activity_id", activityId);

  const { data: attempt, error } = await supabase
    .from("activity_attempts")
    .insert({
      user_id: user.id,
      activity_id: activityId,
      attempt_number: (count ?? 0) + 1,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return attempt;
}

export async function completeActivity(
  activityId: string,
  courseId: string,
  score: number,
  maxScore: number,
  responses: Record<string, unknown>,
  xpEarned: number,
  timeSpentSeconds: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Find in-progress attempt
  const { data: attempts } = await supabase
    .from("activity_attempts")
    .select("id")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  const attemptId = attempts?.[0]?.id;

  if (attemptId) {
    await supabase
      .from("activity_attempts")
      .update({
        completed_at: new Date().toISOString(),
        score,
        max_score: maxScore,
        is_passed: score >= maxScore * 0.6,
        responses,
        time_spent_seconds: timeSpentSeconds,
      })
      .eq("id", attemptId);
  } else {
    // Create a completed attempt directly
    await supabase.from("activity_attempts").insert({
      user_id: user.id,
      activity_id: activityId,
      completed_at: new Date().toISOString(),
      score,
      max_score: maxScore,
      is_passed: score >= maxScore * 0.6,
      attempt_number: 1,
      responses,
      time_spent_seconds: timeSpentSeconds,
    });
  }

  // Award XP
  if (xpEarned > 0) {
    await supabase.rpc("increment_xp", { user_id: user.id, amount: xpEarned });
    await supabase.rpc("upsert_daily_stats", {
      p_user_id: user.id,
      p_sessions: 0,
      p_minutes: Math.round(timeSpentSeconds / 60),
      p_xp: xpEarned,
    });
  }

  // Log activity
  await supabase.from("activity_log").insert({
    user_id: user.id,
    activity_type: "lesson_completed",
    reference_id: activityId,
    reference_type: "activity",
    xp_earned: xpEarned,
    metadata: { score, maxScore, timeSpentSeconds },
  });

  // Update enrollment progress
  const { data: activity } = await supabase
    .from("activities")
    .select("module_id")
    .eq("id", activityId)
    .single();

  if (activity) {
    const { data: mod } = await supabase
      .from("course_modules")
      .select("course_id")
      .eq("id", activity.module_id)
      .single();

    if (mod) {
      // Count total and completed activities for this course
      const { data: allModules } = await supabase
        .from("course_modules")
        .select("id")
        .eq("course_id", mod.course_id)
        .eq("is_archived", false);

      const moduleIds = (allModules ?? []).map((m) => m.id);

      if (moduleIds.length > 0) {
        const { count: totalActivities } = await supabase
          .from("activities")
          .select("*", { count: "exact", head: true })
          .in("module_id", moduleIds)
          .eq("is_archived", false);

        const { data: allActivityIds } = await supabase
          .from("activities")
          .select("id")
          .in("module_id", moduleIds)
          .eq("is_archived", false);

        const ids = (allActivityIds ?? []).map((a) => a.id);

        const { count: completedActivities } = ids.length > 0
          ? await supabase
              .from("activity_attempts")
              .select("activity_id", { count: "exact", head: true })
              .eq("user_id", user.id)
              .not("completed_at", "is", null)
              .in("activity_id", ids)
          : { count: 0 };

        const progressPct = totalActivities && totalActivities > 0
          ? Math.round(((completedActivities ?? 0) / totalActivities) * 100)
          : 0;

        await supabase
          .from("enrollments")
          .update({ progress_pct: progressPct })
          .eq("user_id", user.id)
          .eq("course_id", mod.course_id);
      }
    }
  }

  revalidatePath("/courses");
  revalidatePath("/dashboard");

  return { success: true, xpEarned };
}

export async function getModuleProgress(moduleId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: activities } = await supabase
    .from("activities")
    .select("id, title, order_index")
    .eq("module_id", moduleId)
    .eq("is_archived", false)
    .order("order_index");

  const activityIds = (activities ?? []).map((a) => a.id);

  const { data: completedAttempts } = activityIds.length > 0
    ? await supabase
        .from("activity_attempts")
        .select("activity_id, score, max_score")
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .in("activity_id", activityIds)
    : { data: [] };

  const completedSet = new Set((completedAttempts ?? []).map((a) => a.activity_id));

  return {
    activities: (activities ?? []).map((a) => ({
      id: a.id,
      title: a.title,
      isCompleted: completedSet.has(a.id),
    })),
    completedCount: completedSet.size,
    totalCount: (activities ?? []).length,
  };
}
