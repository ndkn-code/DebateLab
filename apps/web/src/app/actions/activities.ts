"use server";

import { createClient } from "@/lib/supabase/server";
import { canAccessModuleRecord, getUserEntitlement } from "@/lib/entitlements";
import { canAccessCourse } from "@/lib/utils/courseAccess";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import {
  calculateLessonXp,
  createXpIdempotencyKey,
} from "@/lib/xp/model";
import { awardXpEvent } from "@/lib/xp/server";
import { revalidatePath } from "next/cache";
import type {
  ActivityContent,
  ActivityType,
  DragOrderContent,
  FillBlankContent,
  FlashcardContent,
  MatchingContent,
  QuizContent,
} from "@/lib/types/admin";

type ScoreResult = {
  score: number;
  maxScore: number;
};

function clampTimeSpent(value: number) {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(24 * 60 * 60, Math.floor(value)))
    : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringRecord(value: unknown): Record<string, string> {
  const record = asRecord(value);
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
}

function scoreQuiz(content: QuizContent, responses: Record<string, unknown>): ScoreResult {
  const questions = content.questions ?? [];
  const answers = Array.isArray(responses.answers) ? responses.answers : [];
  const answerByQuestion = new Map<string, string>();

  for (const answer of answers) {
    const item = asRecord(answer);
    if (typeof item.questionId === "string" && typeof item.selectedOptionId === "string") {
      answerByQuestion.set(item.questionId, item.selectedOptionId);
    }
  }

  return {
    score: questions.filter(
      (question) => answerByQuestion.get(question.id) === question.correctAnswer
    ).length,
    maxScore: questions.length,
  };
}

function scoreMatching(
  content: MatchingContent,
  responses: Record<string, unknown>
): ScoreResult {
  const pairs = content.pairs ?? [];
  const matches = asStringRecord(responses.matches);
  return {
    score: pairs.filter((pair) => matches[pair.id] === pair.id).length,
    maxScore: pairs.length,
  };
}

function scoreFillBlank(
  content: FillBlankContent,
  responses: Record<string, unknown>
): ScoreResult {
  const answers = asStringRecord(responses.answers);
  const blanks = (content.passages ?? []).flatMap((passage) => passage.blanks ?? []);
  const score = blanks.filter((blank) => {
    const answer = (answers[blank.id] ?? "").trim();
    if (!answer) return false;
    const equals = (left: string, right: string) =>
      blank.caseSensitive
        ? left === right
        : left.toLowerCase() === right.toLowerCase();
    return (
      equals(answer, blank.answer) ||
      (blank.acceptedAnswers ?? []).some((candidate) => equals(answer, candidate))
    );
  }).length;

  return { score, maxScore: blanks.length };
}

function scoreDragOrder(
  content: DragOrderContent,
  responses: Record<string, unknown>
): ScoreResult {
  const items = content.items ?? [];
  const order = Array.isArray(responses.order)
    ? responses.order.filter((item): item is string => typeof item === "string")
    : [];
  const itemById = new Map(items.map((item) => [item.id, item]));

  return {
    score: order.filter((id, index) => itemById.get(id)?.correctOrder === index + 1).length,
    maxScore: items.length,
  };
}

function scoreFlashcard(
  content: FlashcardContent,
  responses: Record<string, unknown>
): ScoreResult {
  const cards = content.cards ?? [];
  const gotOnFirst =
    typeof responses.gotOnFirst === "number" && Number.isFinite(responses.gotOnFirst)
      ? Math.floor(responses.gotOnFirst)
      : 0;

  return {
    score: Math.max(0, Math.min(cards.length, gotOnFirst)),
    maxScore: cards.length,
  };
}

function scoreActivityFromContent(
  activityType: ActivityType,
  content: ActivityContent,
  responses: Record<string, unknown>
): ScoreResult {
  if (activityType === "lesson") return { score: 1, maxScore: 1 };
  if (activityType === "quiz") return scoreQuiz(content as QuizContent, responses);
  if (activityType === "matching") return scoreMatching(content as MatchingContent, responses);
  if (activityType === "fill_blank") return scoreFillBlank(content as FillBlankContent, responses);
  if (activityType === "drag_order") return scoreDragOrder(content as DragOrderContent, responses);
  if (activityType === "flashcard") return scoreFlashcard(content as FlashcardContent, responses);
  return { score: 0, maxScore: 0 };
}

function normalizeResponses(value: Record<string, unknown>) {
  if (JSON.stringify(value).length > 64 * 1024) {
    throw new Error("Activity response is too large");
  }
  return value;
}

async function assertActivityAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  activityId: string,
  expectedCourseId?: string
) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  const { data: activity } = await supabase
    .from("activities")
    .select("module_id")
    .eq("id", activityId)
    .single();

  if (!activity) throw new Error("Activity not found");

  const { data: moduleData } = await supabase
    .from("course_modules")
    .select("course_id, access_level")
    .eq("id", activity.module_id)
    .single();

  if (!moduleData) throw new Error("Module not found");
  if (expectedCourseId && moduleData.course_id !== expectedCourseId) {
    throw new Error("Activity does not belong to this course");
  }

  if (profile?.role === "admin") return moduleData.course_id as string;

  const [courseAccess, entitlement] = await Promise.all([
    canAccessCourse(supabase, userId, moduleData.course_id as string),
    getUserEntitlement(supabase, userId),
  ]);

  const moduleAccess = canAccessModuleRecord({
    role: profile?.role,
    accessLevel: moduleData.access_level,
    entitlement,
  });

  if (!courseAccess || !moduleAccess) {
    throw new Error("This activity is not available on your current plan.");
  }

  return moduleData.course_id as string;
}

export async function startActivity(activityId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const courseId = await assertActivityAccess(supabase, user.id, activityId);

  // Check for existing incomplete attempt
  const { data: existing } = await supabase
    .from("activity_attempts")
    .select("*")
    .eq("user_id", user.id)
    .eq("activity_id", activityId)
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    await recordAnalyticsEvent(supabase, user.id, {
      eventName: "activity_started",
      featureArea: "activities",
      metadata: { activity_id: activityId, course_id: courseId, resumed: true },
    });
    return existing[0];
  }

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
  await recordAnalyticsEvent(supabase, user.id, {
    eventName: "activity_started",
    featureArea: "activities",
    metadata: { activity_id: activityId, course_id: courseId, attempt_id: attempt.id },
  });
  return attempt;
}

export async function completeActivity(
  activityId: string,
  courseId: string,
  _clientScore: number,
  _clientMaxScore: number,
  responses: Record<string, unknown>,
  _clientXpEarned: number,
  timeSpentSeconds: number
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await assertActivityAccess(supabase, user.id, activityId, courseId);
  const safeResponses = normalizeResponses(responses ?? {});
  const safeTimeSpentSeconds = clampTimeSpent(timeSpentSeconds);

  const { data: scoringActivity } = await supabase
    .from("activities")
    .select("activity_type, content")
    .eq("id", activityId)
    .single();

  if (!scoringActivity) throw new Error("Activity not found");

  const { score, maxScore } = scoreActivityFromContent(
    scoringActivity.activity_type as ActivityType,
    scoringActivity.content as ActivityContent,
    safeResponses
  );
  const xpBreakdown = calculateLessonXp({
    activityType: scoringActivity.activity_type as ActivityType,
    score,
    maxScore,
  });

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
        is_passed: maxScore > 0 ? score >= maxScore * 0.6 : false,
        responses: safeResponses,
        time_spent_seconds: safeTimeSpentSeconds,
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
      is_passed: maxScore > 0 ? score >= maxScore * 0.6 : false,
      attempt_number: 1,
      responses: safeResponses,
      time_spent_seconds: safeTimeSpentSeconds,
    });
  }

  const award = await awardXpEvent({
    userId: user.id,
    sourceType: "activity",
    sourceId: activityId,
    activityType: "lesson_completed",
    referenceType: "activity",
    category: "lesson",
    idempotencyKey: createXpIdempotencyKey(["activity", user.id, activityId]),
    lifetimeXp: xpBreakdown.total,
    seasonXp: xpBreakdown.total,
    minutes: Math.round(safeTimeSpentSeconds / 60),
    metadata: {
      score,
      maxScore,
      timeSpentSeconds: safeTimeSpentSeconds,
      xp_breakdown: xpBreakdown,
    },
  });
  const xpEarned = award.lifetimeXpAwarded;

  await recordAnalyticsEvent(supabase, user.id, {
    eventName: "activity_completed",
    featureArea: "activities",
    durationMs: safeTimeSpentSeconds * 1000,
    metadata: {
      activity_id: activityId,
      course_id: courseId,
      score,
      max_score: maxScore,
      xp_earned: xpEarned,
    },
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
          .update({ progress_percent: progressPct })
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
