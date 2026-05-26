import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRACTICE_ANALYSIS_JOB_TYPE,
  PRACTICE_ANALYSIS_QUEUE_TOPIC,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  PRACTICE_FEEDBACK_RUBRIC_VERSION,
  createPracticeAnalysisIdempotencyKey,
  getPracticeFeedbackModelProvider,
  getPracticeFeedbackModelName,
  getRubricKeyForPracticeTrack,
} from "./constants";
import { getPracticeFeedbackPromptManifest } from "./prompt-bundles";
import {
  buildPracticeAttemptSnapshot,
  createPracticeInputHash,
} from "./snapshot";
import type {
  AnalysisJobRecord,
  CompletedPracticeAnalysis,
  PracticeAnalysisInput,
  PracticeAnalysisJobResponse,
  PracticeAttemptRecord,
} from "./types";
import type { DebateScore } from "@/types/feedback";

function requireNoSupabaseError(error: { message?: string } | null, action: string) {
  if (error) {
    throw new Error(`${action}: ${error.message ?? "Supabase request failed"}`);
  }
}

export function practiceAttemptRowToInput(
  attempt: PracticeAttemptRecord
): PracticeAnalysisInput {
  return {
    transcript: attempt.transcript,
    topic: attempt.topic_title,
    side: attempt.side,
    speechType: attempt.attempt_snapshot.analysisParams.speechType,
    timeLimit: attempt.attempt_snapshot.analysisParams.timeLimit,
    actualDuration: attempt.duration_seconds,
    practiceTrack: attempt.practice_track,
    practiceLanguage: attempt.practice_language,
    isFullRound: attempt.attempt_snapshot.analysisParams.isFullRound,
    rounds: attempt.rounds ?? undefined,
    motionBrief: attempt.attempt_snapshot.analysisParams.motionBrief,
    debateMemory: attempt.attempt_snapshot.analysisParams.debateMemory ?? undefined,
    transcription: attempt.attempt_snapshot.analysisParams.transcription,
    mode: attempt.mode,
    prepTime: attempt.prep_time,
    speechTime: attempt.speech_time,
    prepNotes: attempt.prep_notes ?? undefined,
    aiDifficulty: attempt.ai_difficulty ?? undefined,
    topicId: attempt.topic_id ?? undefined,
    practiceTopicKey: attempt.practice_topic_key ?? undefined,
    topicCategory: attempt.topic_category,
    topicCategoryKey: attempt.topic_category_key ?? undefined,
    topicDifficulty: attempt.topic_difficulty,
    audioStoragePath: attempt.audio_storage_path ?? undefined,
    clubContext: attempt.attempt_snapshot.session.clubContext ?? undefined,
  };
}

export async function createPracticeAnalysisRecords(
  supabase: SupabaseClient,
  userId: string,
  input: PracticeAnalysisInput
) {
  const attemptId = input.attemptId ?? crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const snapshot = buildPracticeAttemptSnapshot(input, now);
  const inputHash = createPracticeInputHash(input);
  const promptManifest = getPracticeFeedbackPromptManifest(input);
  const idempotencyKey = createPracticeAnalysisIdempotencyKey(attemptId);

  const attemptRow = {
    id: attemptId,
    user_id: userId,
    status: "submitted",
    practice_track: input.practiceTrack,
    practice_language: input.practiceLanguage,
    topic_id: input.topicId ?? null,
    practice_topic_key: input.practiceTopicKey ?? null,
    topic_title: input.topic,
    topic_category: input.topicCategory,
    topic_category_key: input.topicCategoryKey ?? null,
    topic_difficulty: input.topicDifficulty,
    side: input.side,
    mode: input.mode,
    prep_time: input.prepTime,
    speech_time: input.speechTime,
    duration_seconds: input.actualDuration,
    transcript: input.transcript,
    prep_notes: input.prepNotes ?? null,
    ai_difficulty: input.aiDifficulty ?? null,
    rounds: input.rounds ?? null,
    audio_storage_path: input.audioStoragePath ?? null,
    attempt_snapshot: snapshot,
    input_hash: inputHash,
    prompt_hash: promptManifest.promptHash,
    prompt_bundle_key: PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
    prompt_bundle_version: PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
    rubric_key: getRubricKeyForPracticeTrack(input.practiceTrack),
    rubric_version: PRACTICE_FEEDBACK_RUBRIC_VERSION,
    model_provider: getPracticeFeedbackModelProvider(input.practiceTrack),
    model_name: getPracticeFeedbackModelName(input.practiceTrack),
    submitted_at: now,
    updated_at: now,
  };

  const { data: attempt, error: attemptError } = await supabase
    .from("practice_attempts")
    .insert(attemptRow)
    .select("*")
    .single();
  requireNoSupabaseError(attemptError, "create practice attempt");

  const jobRow = {
    id: jobId,
    attempt_id: attemptId,
    user_id: userId,
    job_type: PRACTICE_ANALYSIS_JOB_TYPE,
    status: "queued",
    queue_topic: PRACTICE_ANALYSIS_QUEUE_TOPIC,
    idempotency_key: idempotencyKey,
    input_hash: inputHash,
    prompt_hash: promptManifest.promptHash,
    model_provider: getPracticeFeedbackModelProvider(input.practiceTrack),
    model_name: getPracticeFeedbackModelName(input.practiceTrack),
    updated_at: now,
  };

  const { data: job, error: jobError } = await supabase
    .from("analysis_jobs")
    .insert(jobRow)
    .select("*")
    .single();
  requireNoSupabaseError(jobError, "create analysis job");

  return {
    attempt: attempt as PracticeAttemptRecord,
    job: job as AnalysisJobRecord,
    idempotencyKey,
    promptManifest,
  };
}

export async function attachQueueMessageId(
  supabase: SupabaseClient,
  jobId: string,
  messageId: string | null
) {
  const { error } = await supabase
    .from("analysis_jobs")
    .update({
      queue_message_id: messageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  requireNoSupabaseError(error, "update queue message id");
}

export async function getAnalysisJobForUser(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<PracticeAnalysisJobResponse | null> {
  const { data: job, error: jobError } = await supabase
    .from("analysis_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .single();

  if (jobError || !job) return null;

  const jobRecord = job as AnalysisJobRecord;
  const { data: attempt, error: attemptError } = await supabase
    .from("practice_attempts")
    .select("*")
    .eq("id", jobRecord.attempt_id)
    .eq("user_id", userId)
    .single();

  if (attemptError || !attempt) return null;
  const attemptRecord = attempt as PracticeAttemptRecord;

  return {
    id: jobRecord.id,
    attemptId: jobRecord.attempt_id,
    status: jobRecord.status,
    attemptStatus: attemptRecord.status,
    feedback: attemptRecord.feedback,
    modelName: attemptRecord.model_name,
    legacySessionId: attemptRecord.legacy_debate_session_id ?? attemptRecord.id,
    aiQualityRunId:
      typeof jobRecord.result?.aiQualityRunId === "string"
        ? jobRecord.result.aiQualityRunId
        : null,
    error: jobRecord.error_message ?? attemptRecord.error_message,
  };
}

export async function getAnalysisJobForProcessing(
  supabase: SupabaseClient,
  jobId: string,
  attemptId: string
) {
  const { data: job, error: jobError } = await supabase
    .from("analysis_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("attempt_id", attemptId)
    .single();
  requireNoSupabaseError(jobError, "load analysis job");

  const { data: attempt, error: attemptError } = await supabase
    .from("practice_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();
  requireNoSupabaseError(attemptError, "load practice attempt");

  return {
    job: job as AnalysisJobRecord,
    attempt: attempt as PracticeAttemptRecord,
  };
}

export async function markPracticeAnalysisProcessing(
  supabase: SupabaseClient,
  params: {
    jobId: string;
    attemptId: string;
    deliveryCount: number;
  }
) {
  const now = new Date().toISOString();
  const [{ error: jobError }, { error: attemptError }] = await Promise.all([
    supabase
      .from("analysis_jobs")
      .update({
        status: "processing",
        delivery_count: params.deliveryCount,
        started_at: now,
        updated_at: now,
        error_code: null,
        error_message: null,
      })
      .eq("id", params.jobId),
    supabase
      .from("practice_attempts")
      .update({
        status: "analyzing",
        updated_at: now,
        error_code: null,
        error_message: null,
      })
      .eq("id", params.attemptId),
  ]);
  requireNoSupabaseError(jobError, "mark analysis job processing");
  requireNoSupabaseError(attemptError, "mark practice attempt analyzing");
}

export async function markPracticeAnalysisCompleted(
  supabase: SupabaseClient,
  result: CompletedPracticeAnalysis
) {
  const now = new Date().toISOString();
  const feedback = result.feedback as DebateScore;
  const feedbackTrack = feedback.practiceTrack ?? "debate";
  const modelProvider =
    result.modelProvider ?? getPracticeFeedbackModelProvider(feedbackTrack);
  const [{ error: attemptError }, { error: jobError }] = await Promise.all([
    supabase
      .from("practice_attempts")
      .update({
        status: "completed",
        feedback,
        total_score: feedback.totalScore,
        overall_band: feedback.overallBand,
        model_provider: modelProvider,
        model_name: result.modelName,
        legacy_debate_session_id: result.legacySessionId,
        completed_at: now,
        updated_at: now,
        error_code: null,
        error_message: null,
      })
      .eq("id", result.attemptId),
    supabase
      .from("analysis_jobs")
      .update({
        status: "completed",
        model_provider: modelProvider,
        model_name: result.modelName,
        finished_at: now,
        updated_at: now,
        result: {
          ...(result.resultMetadata ?? {}),
          attemptId: result.attemptId,
          legacySessionId: result.legacySessionId,
          aiQualityRunId: result.aiQualityRunId ?? null,
          totalScore: feedback.totalScore,
          overallBand: feedback.overallBand,
        },
        error_code: null,
        error_message: null,
      })
      .eq("id", result.jobId),
  ]);
  requireNoSupabaseError(attemptError, "mark practice attempt completed");
  requireNoSupabaseError(jobError, "mark analysis job completed");
}

export async function markPracticeAnalysisFailed(
  supabase: SupabaseClient,
  params: {
    jobId: string;
    attemptId: string;
    errorCode: string;
    errorMessage: string;
    retryAfterSeconds?: number;
  }
) {
  const now = new Date().toISOString();
  const nextRetryAt = params.retryAfterSeconds
    ? new Date(Date.now() + params.retryAfterSeconds * 1000).toISOString()
    : null;
  const willRetry = Boolean(params.retryAfterSeconds);

  const [{ error: attemptError }, { error: jobError }] = await Promise.all([
    supabase
      .from("practice_attempts")
      .update({
        status: willRetry ? "submitted" : "failed",
        error_code: params.errorCode,
        error_message: params.errorMessage,
        updated_at: now,
      })
      .eq("id", params.attemptId),
    supabase
      .from("analysis_jobs")
      .update({
        status: willRetry ? "queued" : "failed",
        error_code: params.errorCode,
        error_message: params.errorMessage,
        next_retry_at: nextRetryAt,
        finished_at: willRetry ? null : now,
        updated_at: now,
      })
      .eq("id", params.jobId),
  ]);
  requireNoSupabaseError(attemptError, "mark practice attempt failed");
  requireNoSupabaseError(jobError, "mark analysis job failed");
}
