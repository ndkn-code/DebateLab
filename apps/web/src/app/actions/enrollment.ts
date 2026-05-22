"use server";

import { createClient } from "@/lib/supabase/server";
import { canAccessModuleRecord, getUserEntitlement } from "@/lib/entitlements";
import { canAccessCourse } from "@/lib/utils/courseAccess";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import { revalidatePath } from "next/cache";

function normalizeAnswerMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return new Map<string, string>();
  }

  return new Map(
    Object.entries(value as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

async function scoreQuizLesson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string,
  submittedAnswers: unknown
) {
  const answerMap = normalizeAnswerMap(submittedAnswers);
  const { data: questions, error } = await supabase
    .from("quiz_questions")
    .select("id, correct_answer")
    .eq("lesson_id", lessonId);

  if (error) throw new Error(error.message);
  if (!questions?.length) return null;

  const correct = questions.filter(
    (question) => answerMap.get(question.id) === question.correct_answer
  ).length;

  return Math.round((correct / questions.length) * 100);
}

// Used by course-detail-content.tsx (student-facing enroll button)
export async function enrollAction(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const hasAccess = await canAccessCourse(supabase, user.id, courseId);
  if (!hasAccess) throw new Error("This course is not available on your current plan.");

  // Upsert enrollment
  const { error } = await supabase
    .from("enrollments")
    .upsert(
      {
        user_id: user.id,
        course_id: courseId,
        status: "active",
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
  await recordAnalyticsEvent(supabase, user.id, {
    eventName: "course_started",
    featureArea: "courses",
    metadata: { course_id: courseId },
  });

  revalidatePath("/courses");
  revalidatePath("/dashboard");
}

// Used by admin panel's student course player
export async function enrollInCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const hasAccess = await canAccessCourse(supabase, user.id, courseId);
  if (!hasAccess) throw new Error("This course is not available on your current plan.");

  const { data: existing } = await supabase.from("enrollments")
    .select("id").eq("course_id", courseId).eq("user_id", user.id).limit(1);
  if (existing && existing.length > 0) return;

  await supabase.from("enrollments").insert({
    course_id: courseId,
    user_id: user.id,
    status: "active",
  });
  await recordAnalyticsEvent(supabase, user.id, {
    eventName: "course_started",
    featureArea: "courses",
    metadata: { course_id: courseId },
  });

  revalidatePath("/courses");
  revalidatePath("/dashboard/courses");
}

// Used by lesson renderers (article, video, quiz, practice)
export async function markLessonCompleteAction(
  lessonId: string,
  courseId: string,
  scoreOrAnswers?: number | Record<string, string>,
  timeSpentSeconds?: number,
  courseSlug?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: lesson } = await supabase
    .from("lessons")
    .select("module_id, type")
    .eq("id", lessonId)
    .single();

  if (!lesson) throw new Error("Lesson not found");

  const { data: moduleData } = await supabase
    .from("course_modules")
    .select("course_id, access_level")
    .eq("id", lesson.module_id)
    .single();

  if (!moduleData || moduleData.course_id !== courseId) {
    throw new Error("Lesson does not belong to this course");
  }

  if (profile?.role !== "admin") {
    const [courseAccess, entitlement] = await Promise.all([
      canAccessCourse(supabase, user.id, courseId),
      getUserEntitlement(supabase, user.id),
    ]);
    const moduleAccess = canAccessModuleRecord({
      role: profile?.role,
      accessLevel: moduleData.access_level,
      entitlement,
    });

    if (!courseAccess || !moduleAccess) {
      throw new Error("This lesson is not available on your current plan.");
    }
  }

  const score =
    lesson.type === "quiz"
      ? await scoreQuizLesson(supabase, lessonId, scoreOrAnswers)
      : null;
  const safeTimeSpentSeconds = Number.isFinite(timeSpentSeconds)
    ? Math.max(0, Math.min(24 * 60 * 60, Math.floor(timeSpentSeconds ?? 0)))
    : 0;

  // Upsert lesson progress
  await supabase
    .from("lesson_progress")
    .upsert(
      {
        user_id: user.id,
        lesson_id: lessonId,
        course_id: courseId,
        status: "completed",
        score,
        time_spent_seconds: safeTimeSpentSeconds,
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
    metadata: { score, time_spent_seconds: safeTimeSpentSeconds },
  });
  await recordAnalyticsEvent(supabase, user.id, {
    eventName: "activity_completed",
    featureArea: "activities",
    durationMs: safeTimeSpentSeconds ? safeTimeSpentSeconds * 1000 : null,
    metadata: {
      lesson_id: lessonId,
      course_id: courseId,
      score,
      xp_earned: xpEarned,
    },
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
  if (courseSlug) {
    revalidatePath(`/courses/${courseSlug}`);
  }

  return { xpEarned };
}

export async function unenrollFromCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase.from("enrollments").delete().eq("course_id", courseId).eq("user_id", user.id);
  revalidatePath("/dashboard/courses");
}
