import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  PRACTICE_ANALYSIS_JOB_TYPE,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  PRACTICE_FEEDBACK_RUBRIC_VERSION,
  createPracticeAnalysisIdempotencyKey,
  getPracticeFeedbackModelProvider,
  getPracticeFeedbackModelName,
  getRubricKeyForPracticeTrack,
} from "./constants";
import { AI_GRADING_TOPIC } from "@/lib/ai/grading/contracts";
import { getPracticeFeedbackPromptManifest } from "./prompt-bundles";
import {
  buildPracticeAttemptSnapshot,
  createPracticeInputHash,
} from "./snapshot";
import type {
  AnalysisJobStatus,
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

async function canonicalizePracticeInput(
  supabase: SupabaseClient,
  userId: string,
  input: PracticeAnalysisInput,
): Promise<PracticeAnalysisInput> {
  let canonical = { ...input, actualDuration: 0 };

  if (input.draftId) {
    const { data: draft, error: draftError } = await supabase
      .from("practice_session_drafts")
      .select("id, user_id, topic_id, practice_topic_key, topic_title, topic_category, topic_category_key, topic_difficulty, side, practice_track, practice_language, mode, prep_time, speech_time, ai_difficulty, session_started_at")
      .eq("id", input.draftId)
      .eq("user_id", userId)
      .maybeSingle();
    requireNoSupabaseError(draftError, "resolve practice draft");
    if (!draft?.session_started_at) throw new Error("Practice draft is not available");
    const elapsedSeconds = Math.floor(
      (Date.now() - Date.parse(draft.session_started_at)) / 1000,
    );
    canonical = {
      ...canonical,
      topicId: draft.topic_id ?? undefined,
      practiceTopicKey: draft.practice_topic_key ?? draft.topic_id ?? undefined,
      topic: draft.topic_title,
      topicCategory: draft.topic_category,
      topicCategoryKey: draft.topic_category_key ?? undefined,
      topicDifficulty: draft.topic_difficulty,
      side: draft.side,
      practiceTrack: draft.practice_track,
      practiceLanguage: draft.practice_language,
      mode: draft.mode,
      prepTime: draft.prep_time,
      speechTime: draft.speech_time,
      aiDifficulty: draft.ai_difficulty ?? undefined,
      actualDuration: Math.max(0, Math.min(7200, elapsedSeconds)),
    };
  }

  if (input.practiceTopicKey) {
    const { data: topic, error: topicError } = await supabase
      .from("practice_topics")
      .select("topic_key, category_key, difficulty, is_active")
      .eq("topic_key", input.practiceTopicKey)
      .eq("is_active", true)
      .maybeSingle();
    requireNoSupabaseError(topicError, "resolve practice topic");
    if (!topic) throw new Error("Practice topic is not available");

    const { data: translation, error: translationError } = await supabase
      .from("practice_topic_translations")
      .select("title")
      .eq("topic_key", topic.topic_key)
      .eq("language", input.practiceLanguage)
      .maybeSingle();
    requireNoSupabaseError(translationError, "resolve practice topic translation");

    canonical = {
      ...canonical,
      topic: translation?.title ?? canonical.topic,
      topicCategoryKey: topic.category_key,
      topicDifficulty: topic.difficulty,
    };
  } else {
    // Custom motions do not have a trusted catalog difficulty. Keep them at a
    // neutral server-owned value so a request cannot inflate difficulty-based XP.
    canonical = { ...canonical, topicDifficulty: "intermediate" };
  }

  const context = input.clubContext;
  if (!context) return canonical;

  if (context.assignmentId) {
    const { data: assignment, error: assignmentError } = await supabase
      .from("club_assignments")
      .select("id, club_id, class_id, title, status")
      .eq("id", context.assignmentId)
      .eq("status", "active")
      .maybeSingle();
    requireNoSupabaseError(assignmentError, "resolve practice assignment");
    if (!assignment?.club_id || !assignment.class_id) {
      throw new Error("Practice assignment is not available");
    }
    if (
      (context.clubId && context.clubId !== assignment.club_id) ||
      (context.classId && context.classId !== assignment.class_id)
    ) {
      throw new Error("Practice assignment scope mismatch");
    }

    const [{ data: classMembership }, { data: clubMembership }] =
      await Promise.all([
        supabase
          .from("class_memberships")
          .select("id")
          .eq("class_id", assignment.class_id)
          .eq("user_id", userId)
          .eq("member_role", "student")
          .eq("status", "active")
          .maybeSingle(),
        supabase
          .from("club_memberships")
          .select("id")
          .eq("club_id", assignment.club_id)
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle(),
      ]);
    if (!classMembership || !clubMembership) {
      throw new Error("Practice assignment is not authorized");
    }
    return {
      ...canonical,
      clubContext: {
        clubId: assignment.club_id,
        classId: assignment.class_id,
        assignmentId: assignment.id,
        assignmentTitle: assignment.title ?? undefined,
      },
    };
  }

  if (context.classId) {
    const { data: classRow, error: classError } = await supabase
      .from("classes")
      .select("id, club_id")
      .eq("id", context.classId)
      .maybeSingle();
    requireNoSupabaseError(classError, "resolve practice class");
    if (!classRow?.club_id || (context.clubId && context.clubId !== classRow.club_id)) {
      throw new Error("Practice class scope mismatch");
    }
    const { data: membership } = await supabase
      .from("class_memberships")
      .select("id")
      .eq("class_id", classRow.id)
      .eq("user_id", userId)
      .eq("member_role", "student")
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("Practice class is not authorized");
    return {
      ...canonical,
      clubContext: { clubId: classRow.club_id, classId: classRow.id },
    };
  }

  if (context.clubId) {
    const { data: membership } = await supabase
      .from("club_memberships")
      .select("id")
      .eq("club_id", context.clubId)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!membership) throw new Error("Practice club is not authorized");
    return { ...canonical, clubContext: { clubId: context.clubId } };
  }

  return { ...canonical, clubContext: undefined };
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
  input: PracticeAnalysisInput,
  options: {
    debugId?: string | null;
    chargeCredits?: boolean;
  } = {}
) {
  const clientAttemptAlias = input.attemptId ?? null;
  const attemptId = crypto.randomUUID();
  const jobId = crypto.randomUUID();
  const now = new Date().toISOString();
  const canonicalInput = await canonicalizePracticeInput(supabase, userId, input);
  // The request may contain a client-produced repair artifact. It is retained
  // only as diagnostic input; the worker always judges the server transcript.
  const serverTranscription = canonicalInput.transcription
    ? { ...canonicalInput.transcription, judgeTranscript: undefined, repair: undefined }
    : undefined;
  const serverInput = {
    ...canonicalInput,
    attemptId: undefined,
    draftId: undefined,
    transcription: serverTranscription,
  };
  const inputHash = createPracticeInputHash(serverInput);
  const promptManifest = getPracticeFeedbackPromptManifest(serverInput);
  const idempotencyKey = createPracticeAnalysisIdempotencyKey(attemptId);
  const attemptRow = {
    id: attemptId,
    client_attempt_alias: clientAttemptAlias,
    user_id: userId,
    status: "submitted",
    practice_track: serverInput.practiceTrack,
    practice_language: serverInput.practiceLanguage,
    topic_id: serverInput.topicId ?? null,
    practice_topic_key: serverInput.practiceTopicKey ?? null,
    topic_title: serverInput.topic,
    topic_category: serverInput.topicCategory,
    topic_category_key: serverInput.topicCategoryKey ?? null,
    topic_difficulty: serverInput.topicDifficulty,
    side: serverInput.side,
    mode: serverInput.mode,
    prep_time: serverInput.prepTime,
    speech_time: serverInput.speechTime,
    duration_seconds: serverInput.actualDuration,
    transcript: serverInput.transcript,
    prep_notes: serverInput.prepNotes ?? null,
    ai_difficulty: serverInput.aiDifficulty ?? null,
    rounds: serverInput.rounds ?? null,
    audio_storage_path: serverInput.audioStoragePath ?? null,
    attempt_snapshot: buildPracticeAttemptSnapshot(serverInput, now),
    input_hash: inputHash,
    prompt_hash: promptManifest.promptHash,
    prompt_bundle_key: PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
    prompt_bundle_version: PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
    rubric_key: getRubricKeyForPracticeTrack(input.practiceTrack),
    rubric_version: PRACTICE_FEEDBACK_RUBRIC_VERSION,
    model_provider: getPracticeFeedbackModelProvider(input.practiceTrack),
    model_name: getPracticeFeedbackModelName(input.practiceTrack),
    submitted_at: now,
    created_at: now,
    updated_at: now,
  };

  const jobRow = {
    id: jobId,
    attempt_id: attemptId,
    user_id: userId,
    job_type: PRACTICE_ANALYSIS_JOB_TYPE,
    status: "queued",
    queue_topic: AI_GRADING_TOPIC,
    idempotency_key: idempotencyKey,
    input_hash: inputHash,
    prompt_hash: promptManifest.promptHash,
    model_provider: getPracticeFeedbackModelProvider(input.practiceTrack),
    model_name: getPracticeFeedbackModelName(input.practiceTrack),
    delivery_count: 0,
    max_attempts: 3,
    created_at: now,
    result: options.debugId ? { debugId: options.debugId } : null,
    updated_at: now,
  };

  if (options.chargeCredits) {
    const { data, error } = await supabase.rpc("begin_practice_analysis", {
      p_attempt_id: attemptId,
      p_job_id: jobId,
      p_user_id: userId,
      p_attempt: attemptRow,
      p_job: jobRow,
      p_cost: serverInput.practiceTrack === "speaking" ? 100 : 200,
      p_charge_type:
        serverInput.practiceTrack === "speaking" ? "practice_speaking" : "practice_debate",
    });
    requireNoSupabaseError(error, "begin practice analysis");
    const result = data as { attempt: PracticeAttemptRecord; job: AnalysisJobRecord };
    return {
      attempt: result.attempt,
      job: result.job,
      idempotencyKey,
      promptManifest,
    };
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("practice_attempts").insert(attemptRow).select("*").single();
  requireNoSupabaseError(attemptError, "create practice attempt");
  const { data: job, error: jobError } = await supabase
    .from("analysis_jobs").insert(jobRow).select("*").single();
  requireNoSupabaseError(jobError, "create analysis job");

  return {
    attempt: attempt as PracticeAttemptRecord,
    job: job as AnalysisJobRecord,
    idempotencyKey,
    promptManifest,
  };
}

export async function getRecentActivePracticeAnalysis(
  supabase: SupabaseClient,
  userId: string,
  input: PracticeAnalysisInput
): Promise<{
  attempt: PracticeAttemptRecord;
  job: AnalysisJobRecord;
  idempotencyKey: string;
} | null> {
  const inputHash = createPracticeInputHash(input);
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: jobs, error } = await supabase
    .from("analysis_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("input_hash", inputHash)
    .in("status", ["queued", "processing", "completed"])
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(5);

  requireNoSupabaseError(error, "load active practice analysis jobs");

  const activeJob = (jobs as AnalysisJobRecord[] | null | undefined)?.find(
    (job) => {
      if (job.status === "completed") return true;
      const deliveryCount = job.delivery_count ?? 0;
      const maxAttempts = job.max_attempts || 3;
      const startedAtMs = job.started_at ? Date.parse(job.started_at) : 0;
      const staleExhausted =
        job.status === "processing" &&
        startedAtMs > 0 &&
        Date.now() - startedAtMs > 10 * 60 * 1000 &&
        deliveryCount >= maxAttempts;
      return deliveryCount < maxAttempts && !staleExhausted;
    }
  );

  if (!activeJob) return null;

  const { data: attempt, error: attemptError } = await supabase
    .from("practice_attempts")
    .select("*")
    .eq("id", activeJob.attempt_id)
    .eq("user_id", userId)
    .in("status", ["submitted", "analyzing", "completed"])
    .single();

  if (attemptError || !attempt) return null;

  return {
    attempt: attempt as PracticeAttemptRecord,
    job: activeJob,
    idempotencyKey: activeJob.idempotency_key,
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
    allowedStatuses?: AnalysisJobStatus[];
    maxAttempts?: number;
  }
) {
  const now = new Date().toISOString();
  let jobQuery = supabase
    .from("analysis_jobs")
    .update({
      status: "processing",
      delivery_count: params.deliveryCount,
      started_at: now,
      updated_at: now,
      error_code: null,
      error_message: null,
    })
    .eq("id", params.jobId);

  if (params.allowedStatuses?.length) {
    jobQuery = jobQuery.in("status", params.allowedStatuses);
  }
  if (params.maxAttempts != null) {
    jobQuery = jobQuery.lt("delivery_count", params.maxAttempts);
  }

  const { data: claimedJob, error: jobError } = await jobQuery
    .select("id")
    .maybeSingle();
  requireNoSupabaseError(jobError, "mark analysis job processing");

  if (!claimedJob) {
    return false;
  }

  const { error: attemptError } = await supabase
    .from("practice_attempts")
    .update({
      status: "analyzing",
      updated_at: now,
      error_code: null,
      error_message: null,
    })
    .eq("id", params.attemptId);
  requireNoSupabaseError(attemptError, "mark practice attempt analyzing");
  return true;
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
