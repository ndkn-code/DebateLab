"use server";

import { createClient } from "@/lib/supabase/server";
import { canAccessModuleRecord, getUserEntitlement } from "@/lib/entitlements";
import { canAccessCourse } from "@/lib/utils/courseAccess";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import { calculateLessonXp, createXpIdempotencyKey } from "@/lib/xp/model";
import { awardXpEvent } from "@/lib/xp/server";
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

type CurriculumQuizGradeResult = {
  question_id: string;
  is_correct: boolean;
  points: number;
  max_points: number;
};

async function scoreQuizLesson(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string,
  submittedAnswers: unknown
) {
  const answerMap = normalizeAnswerMap(submittedAnswers);
  const { data: results, error } = await supabase.rpc(
    "grade_curriculum_quiz_submission",
    {
      p_lesson_id: lessonId,
      p_answers: Object.fromEntries(answerMap),
    },
  );

  if (error) throw new Error(error.message);
  if (!results?.length) return null;

  const typedResults = results as CurriculumQuizGradeResult[];
  const correct = typedResults.reduce(
    (total: number, result: CurriculumQuizGradeResult) =>
      total + (result.is_correct ? result.points : 0),
    0,
  );
  const maxPoints = typedResults.reduce(
    (total: number, result: CurriculumQuizGradeResult) => total + result.max_points,
    0,
  );

  return {
    score: maxPoints > 0 ? Math.round((correct / maxPoints) * 100) : null,
    results: typedResults,
  };
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

  const grading =
    lesson.type === "quiz"
      ? await scoreQuizLesson(supabase, lessonId, scoreOrAnswers)
      : null;
  const score = grading?.score ?? null;
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

  const xpBreakdown = calculateLessonXp({
    activityType: score == null ? "lesson" : "quiz",
    score,
    maxScore: 100,
  });
  const award = await awardXpEvent({
    userId: user.id,
    sourceType: "lesson",
    sourceId: lessonId,
    activityType: "lesson_completed",
    referenceType: "lesson",
    category: "lesson",
    idempotencyKey: createXpIdempotencyKey(["lesson", user.id, lessonId]),
    lifetimeXp: xpBreakdown.total,
    seasonXp: xpBreakdown.total,
    metadata: {
      score,
      time_spent_seconds: safeTimeSpentSeconds,
      xp_breakdown: xpBreakdown,
    },
  });
  const xpEarned = award.lifetimeXpAwarded;

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

  revalidatePath("/courses");
  revalidatePath("/dashboard");
  if (courseSlug) {
    revalidatePath(`/courses/${courseSlug}`);
  }

  return { xpEarned, score, grading: grading?.results ?? null };
}

export async function unenrollFromCourse(courseId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await supabase.from("enrollments").delete().eq("course_id", courseId).eq("user_id", user.id);
  revalidatePath("/dashboard/courses");
}
