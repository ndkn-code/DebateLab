import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSkillSnapshot } from "@/lib/analytics/skill-snapshot";
import type { DebateSession, PracticeTrack } from "@/types";

export type PerformanceSourceType =
  | "debate_session"
  | "activity_attempt"
  | "duel_speech"
  | "manual";

export interface PerformanceAttemptDraft {
  user_id: string;
  club_id: string | null;
  class_id: string | null;
  assignment_id: string | null;
  source_type: PerformanceSourceType;
  source_id: string;
  practice_track: PracticeTrack | "mun";
  format: string | null;
  topic_title: string | null;
  topic_category: string | null;
  topic_difficulty: string | null;
  duration_seconds: number | null;
  word_count: number;
  overall_score: number | null;
  overall_band: string | null;
  rubric_key: string;
  rubric_version: number;
  skill_scores: Record<string, number>;
  evidence: Record<string, unknown>;
  model_name: string | null;
  occurred_at: string;
}

export interface RecordPerformanceAttemptResult {
  ok: boolean;
  attemptId?: string;
  submissionId?: string | null;
  reason?: string;
  error?: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function countWords(transcript: string) {
  return transcript.trim().split(/\s+/).filter(Boolean).length;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeScore(value: unknown) {
  const score = finiteNumber(value);
  if (score == null) return null;
  return Math.max(0, Math.min(100, Math.round(score * 100) / 100));
}

function normalizeDuration(value: unknown) {
  const duration = finiteNumber(value);
  if (duration == null) return null;
  return Math.max(0, Math.round(duration));
}

function rubricKeyForTrack(track: PracticeTrack | "mun") {
  if (track === "speaking") return "speaking_v1";
  if (track === "mun") return "mun_v1";
  return "debate_v1";
}

function compactEvidence(session: DebateSession, confidence: number) {
  return {
    summary: session.feedback?.summary ?? null,
    strengths: session.feedback?.strengths?.slice(0, 5) ?? [],
    improvements: session.feedback?.improvements?.slice(0, 5) ?? [],
    confidence,
    side: session.side,
    aiDifficulty: session.aiDifficulty ?? null,
    roundCount: session.rounds?.length ?? 0,
    sourceReference: {
      type: "debate_session",
      id: session.id,
    },
  };
}

export function buildPerformanceAttemptFromSession(
  session: DebateSession,
  userId: string
): PerformanceAttemptDraft {
  const feedback = session.feedback;
  const practiceTrack = feedback?.practiceTrack ?? session.practiceTrack ?? "debate";
  const snapshot = computeSkillSnapshot([
    {
      feedback,
      totalScore: feedback?.totalScore ?? null,
      createdAt: session.date,
      mode: session.mode,
      durationSeconds: session.duration,
      topicDifficulty: session.topic.difficulty,
      aiDifficulty: session.aiDifficulty,
    },
  ]);
  const skillScores = Object.fromEntries(
    snapshot.metrics
      .filter((metric) => metric.coverage > 0 || metric.value > 0)
      .map((metric) => [metric.key, metric.value])
  );

  return {
    user_id: userId,
    club_id: session.clubContext?.clubId ?? null,
    class_id: session.clubContext?.classId ?? null,
    assignment_id: session.clubContext?.assignmentId ?? null,
    source_type: "debate_session",
    source_id: session.id,
    practice_track: practiceTrack,
    format: session.mode,
    topic_title: session.topic.title,
    topic_category: session.topic.category,
    topic_difficulty: session.topic.difficulty,
    duration_seconds: normalizeDuration(session.duration),
    word_count: countWords(session.transcript),
    overall_score: normalizeScore(feedback?.totalScore),
    overall_band: feedback?.overallBand ?? null,
    rubric_key: rubricKeyForTrack(practiceTrack),
    rubric_version: 1,
    skill_scores: skillScores,
    evidence: compactEvidence(session, snapshot.confidence),
    model_name: session.modelName ?? null,
    occurred_at: Number.isNaN(new Date(session.date).getTime())
      ? new Date().toISOString()
      : new Date(session.date).toISOString(),
  };
}

export function validatePerformanceAttemptDraft(draft: PerformanceAttemptDraft) {
  if (!UUID_PATTERN.test(draft.user_id)) return { ok: false as const, reason: "invalid_user_id" };
  if (!UUID_PATTERN.test(draft.source_id)) return { ok: false as const, reason: "invalid_source_id" };
  if (draft.club_id && !UUID_PATTERN.test(draft.club_id)) return { ok: false as const, reason: "invalid_club_id" };
  if (draft.class_id && !UUID_PATTERN.test(draft.class_id)) return { ok: false as const, reason: "invalid_class_id" };
  if (draft.assignment_id && !UUID_PATTERN.test(draft.assignment_id)) {
    return { ok: false as const, reason: "invalid_assignment_id" };
  }
  if (draft.assignment_id && !draft.club_id) return { ok: false as const, reason: "assignment_without_club" };
  if (draft.word_count < 0) return { ok: false as const, reason: "invalid_word_count" };
  return { ok: true as const };
}

export async function recordPerformanceAttemptForSession(
  supabase: SupabaseClient,
  session: DebateSession,
  userId: string
): Promise<RecordPerformanceAttemptResult> {
  const draft = buildPerformanceAttemptFromSession(session, userId);
  const validation = validatePerformanceAttemptDraft(draft);
  if (!validation.ok) {
    return { ok: false, reason: validation.reason };
  }

  let submissionId: string | null = null;
  if (draft.assignment_id && draft.club_id) {
    const { data, error } = await supabase
      .from("club_assignment_submissions")
      .upsert(
        {
          assignment_id: draft.assignment_id,
          club_id: draft.club_id,
          class_id: draft.class_id,
          user_id: draft.user_id,
          source_type: draft.source_type,
          source_id: draft.source_id,
          status: "submitted",
          submitted_at: draft.occurred_at,
        },
        { onConflict: "assignment_id,user_id,source_type,source_id" }
      )
      .select("id")
      .single();

    if (error) {
      return { ok: false, error: error.message };
    }
    submissionId = (data?.id as string | undefined) ?? null;
  }

  const { data, error } = await supabase
    .from("performance_attempts")
    .upsert(
      {
        ...draft,
        submission_id: submissionId,
      },
      { onConflict: "user_id,source_type,source_id" }
    )
    .select("id")
    .single();

  if (error) {
    return { ok: false, error: error.message, submissionId };
  }

  return {
    ok: true,
    attemptId: (data?.id as string | undefined) ?? undefined,
    submissionId,
  };
}
