import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import { recordPerformanceAttemptForSession } from "@/lib/performance/club-performance-recorder";
import { awardXpEvent } from "@/lib/xp/server";
import { calculatePracticeXp, createXpIdempotencyKey } from "@/lib/xp/model";
import type { DebateSession, DebateTopic } from "@/types";
import type { DebateScore } from "@/types/feedback";
import type { PracticeAttemptRecord } from "./types";

function buildTopic(attempt: PracticeAttemptRecord): DebateTopic {
  return {
    id: attempt.practice_topic_key ?? attempt.topic_id ?? attempt.id,
    topicKey: attempt.practice_topic_key ?? attempt.topic_id ?? attempt.id,
    categoryKey: attempt.topic_category_key ?? undefined,
    title: attempt.topic_title,
    category: attempt.topic_category,
    difficulty: attempt.topic_difficulty,
  };
}

export function buildDebateSessionFromPracticeAttempt(
  attempt: PracticeAttemptRecord,
  feedback: DebateScore,
  modelName: string | null
): DebateSession {
  return {
    id: attempt.legacy_debate_session_id ?? attempt.id,
    date: attempt.completed_at ?? new Date().toISOString(),
    topic: buildTopic(attempt),
    side: attempt.side,
    practiceTrack: attempt.practice_track,
    practiceLanguage: attempt.practice_language,
    mode: attempt.mode,
    prepTime: attempt.prep_time,
    speechTime: attempt.speech_time,
    transcript: attempt.transcript,
    feedback,
    duration: attempt.duration_seconds,
    prepNotes: attempt.prep_notes ?? undefined,
    clubContext: attempt.attempt_snapshot.session.clubContext ?? undefined,
    modelName,
    aiDifficulty: attempt.ai_difficulty ?? undefined,
    rounds: attempt.rounds ?? undefined,
  };
}

function sessionToDebateSessionRow(session: DebateSession, userId: string) {
  return {
    id: session.id,
    user_id: userId,
    practice_topic_key: session.topic.topicKey ?? session.topic.id,
    topic_title: session.topic.title,
    topic_category: session.topic.category,
    topic_category_key: session.topic.categoryKey ?? null,
    topic_difficulty: session.topic.difficulty ?? "intermediate",
    side: session.side,
    practice_track: session.practiceTrack,
    practice_language: session.practiceLanguage,
    mode: session.mode,
    prep_time: session.prepTime,
    speech_time: session.speechTime,
    transcript: session.transcript,
    prep_notes: session.prepNotes ?? null,
    ai_difficulty: session.aiDifficulty ?? null,
    rounds: session.rounds ?? null,
    feedback: session.feedback as Record<string, unknown> | null,
    total_score: session.feedback?.totalScore ?? 0,
    overall_band: session.feedback?.overallBand ?? "Unrated",
    duration_seconds: session.duration,
    created_at: session.date,
  };
}

async function debateSessionExists(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string
) {
  const { data } = await supabase
    .from("debate_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  return Boolean(data?.id);
}

async function getPreviousBestPracticeScore(
  supabase: SupabaseClient,
  session: DebateSession,
  userId: string
) {
  const { data } = await supabase
    .from("debate_sessions")
    .select("total_score")
    .eq("user_id", userId)
    .eq("practice_track", session.practiceTrack)
    .eq("practice_language", session.practiceLanguage)
    .neq("id", session.id)
    .not("total_score", "is", null)
    .order("total_score", { ascending: false })
    .limit(1)
    .maybeSingle();

  const score = (data as { total_score?: unknown } | null)?.total_score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

export async function saveCompletedPracticeAttempt(
  supabase: SupabaseClient,
  params: {
    attempt: PracticeAttemptRecord;
    feedback: DebateScore;
    modelName: string;
  }
) {
  const sessionId = params.attempt.legacy_debate_session_id ?? params.attempt.id;
  const session = buildDebateSessionFromPracticeAttempt(
    {
      ...params.attempt,
      legacy_debate_session_id: sessionId,
      completed_at: params.attempt.completed_at ?? new Date().toISOString(),
    },
    params.feedback,
    params.modelName
  );
  const alreadySaved = await debateSessionExists(
    supabase,
    session.id,
    params.attempt.user_id
  );

  if (!alreadySaved) {
    const { error } = await supabase
      .from("debate_sessions")
      .insert(sessionToDebateSessionRow(session, params.attempt.user_id));
    if (error) {
      throw new Error(`save debate session: ${error.message}`);
    }
  }

  const performanceResult = await recordPerformanceAttemptForSession(
    supabase,
    session,
    params.attempt.user_id
  );
  if (!performanceResult.ok && performanceResult.error) {
    console.warn("Failed to record performance attempt", performanceResult.error);
  }

  if (alreadySaved) {
    return { sessionId: session.id, didCreateSession: false };
  }

  const durationMinutes = Math.round(session.duration / 60);
  const previousBestScore = await getPreviousBestPracticeScore(
    supabase,
    session,
    params.attempt.user_id
  );
  const xpBreakdown = calculatePracticeXp({
    mode: session.mode,
    durationSeconds: session.duration,
    totalScore: session.feedback?.totalScore ?? null,
    topicDifficulty: session.topic.difficulty,
    aiDifficulty: session.aiDifficulty ?? null,
    previousBestScore,
  });
  const award = await awardXpEvent(
    {
      userId: params.attempt.user_id,
      sourceType: "debate_session",
      sourceId: session.id,
      activityType: "debate_completed",
      referenceType: "debate_session",
      category: "practice",
      idempotencyKey: createXpIdempotencyKey([
        "practice",
        params.attempt.id,
        params.attempt.prompt_bundle_version,
      ]),
      lifetimeXp: xpBreakdown.total,
      seasonXp: xpBreakdown.total,
      occurredAt: session.date,
      sessions: 1,
      minutes: durationMinutes,
      score: session.feedback?.totalScore ?? null,
      clubId: session.clubContext?.clubId ?? null,
      classId: session.clubContext?.classId ?? null,
      metadata: {
        topic: session.topic.title,
        practice_track: session.practiceTrack,
        practice_language: session.practiceLanguage,
        mode: session.mode,
        score: session.feedback?.totalScore ?? null,
        band: session.feedback?.overallBand ?? null,
        source: "analysis_job",
        practice_attempt_id: params.attempt.id,
        xp_breakdown: xpBreakdown,
        previous_best_score: previousBestScore,
      },
    },
    supabase
  );
  const xpEarned = award.lifetimeXpAwarded;
  const today = new Date().toISOString().split("T")[0];

  await recordAnalyticsEvent(supabase, params.attempt.user_id, {
    eventName: "practice_completed",
    featureArea: "practice",
    route: "/practice/feedback",
    durationMs: session.duration * 1000,
    metadata: {
      debate_session_id: session.id,
      practice_attempt_id: params.attempt.id,
      topic: session.topic.title,
      practice_track: session.practiceTrack,
      practice_language: session.practiceLanguage,
      mode: session.mode,
      score: session.feedback?.totalScore ?? null,
      xp_earned: xpEarned,
    },
  });

  const { data: profileData } = await supabase
    .from("profiles")
    .select("total_sessions_completed, total_practice_minutes, streak_current, streak_longest, streak_last_active_date")
    .eq("id", params.attempt.user_id)
    .single();

  if (profileData) {
    let newStreak = profileData.streak_current ?? 0;
    const lastActive = profileData.streak_last_active_date;
    if (lastActive !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];
      newStreak = lastActive === yesterdayStr ? newStreak + 1 : 1;
    }
    const newLongest = Math.max(newStreak, profileData.streak_longest ?? 0);

    await supabase
      .from("profiles")
      .update({
        total_sessions_completed:
          (profileData.total_sessions_completed ?? 0) + 1,
        total_practice_minutes:
          (profileData.total_practice_minutes ?? 0) + durationMinutes,
        streak_current: newStreak,
        streak_longest: newLongest,
        streak_last_active_date: today,
      })
      .eq("id", params.attempt.user_id);
  }

  return { sessionId: session.id, didCreateSession: true };
}
