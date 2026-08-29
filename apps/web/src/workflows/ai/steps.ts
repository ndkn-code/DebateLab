import "server-only";

import type { z } from "zod";
import { FatalError } from "workflow";
import { generateStructured } from "@/lib/ai/core";
import {
  claimAiWorkflowRun,
  updateAiWorkflowRun,
} from "@/lib/ai/workflow-runs";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import {
  claimSpeakingResponseForScoring,
  loadSpeakingScoringContext,
  markSpeakingScoringFailed,
  persistSpeakingScore,
} from "@/lib/api/ielts/speaking-responses-repository";
import {
  claimWritingResponseForScoring,
  loadWritingScoringContext,
  markWritingScoringFailed,
  persistWritingScore,
} from "@/lib/api/ielts/writing-responses-repository";
import { speakingPartNumberForQuestionType, writingTaskNumberForQuestionType } from "@/lib/api/ielts/schema";
import { transcribePracticeAudio } from "@/lib/stt/transcription";
import {
  assessPronunciation,
  azurePronunciationContentType,
} from "@/lib/ielts/pronunciation";
import { loadSpeakingExemplars } from "@/lib/corpus/ielts-speaking-exemplars";
import { loadWritingExemplars } from "@/lib/corpus/ielts-exemplars";
import { extractPronunciationSignal } from "@/lib/ielts/speaking-scorer/phoneme-contract";
import { buildSpeakingScorerPrompt } from "@/lib/ielts/speaking-scorer/prompt";
import { buildWritingScorerPrompt } from "@/lib/ielts/writing-scorer/prompt";
import { normalizeSpeakingScore } from "@/lib/scoring/ielts-speaking/normalize";
import { normalizeWritingScore } from "@/lib/scoring/ielts-writing/normalize";
import { ieltsSpeakingModelOutputSchema } from "@/lib/scoring/ielts-speaking/result-schema";
import { ieltsWritingModelOutputSchema } from "@/lib/scoring/ielts-writing/result-schema";
import { recomputeAttemptSpeakingBand, recomputeAttemptWritingBand } from "@/lib/api/ielts/band-scores-repository";
import { maybeReplanAfterEvidence } from "@/lib/api/ielts/replan-hook";
import { claimableSpeakingStatuses, decideSpeakingScoringAction, isTerminalSpeakingStatus } from "@/lib/ielts/speaking-scorer/status";
import { claimableWritingStatuses, decideWritingScoringAction, isTerminalWritingStatus } from "@/lib/ielts/writing-scorer/status";
import { IELTS_SPEAKING_AUDIO_BUCKET } from "@/lib/ielts/speaking-scorer/constants";
import {
  claimDurablePracticeAnalysis,
  failDurablePracticeAnalysis,
  generateDurablePracticeFeedback,
  persistDurablePracticeAnalysis,
  prepareDurablePracticeAnalysis,
} from "@/lib/practice-analysis/durable-runner";
import {
  getIeltsWritingModelName,
  getIeltsWritingProviderLabel,
  getIeltsWritingScoreProvider,
} from "@/lib/ielts/writing-scorer/provider-policy";
import type { Json } from "@/types/supabase";

type IeltsSpeakingModelOutput = z.infer<typeof ieltsSpeakingModelOutputSchema>;
type IeltsWritingModelOutput = z.infer<typeof ieltsWritingModelOutputSchema>;

function inferAudioContentType(path: string): string {
  if (/\.(m4a|mp4)$/i.test(path)) return "audio/mp4";
  if (/\.mp3$/i.test(path)) return "audio/mpeg";
  if (/\.wav$/i.test(path)) return "audio/wav";
  return "audio/webm";
}

function extractCueCardBullets(metadata: Json): string[] | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return undefined;
  }
  const record = metadata as Record<string, Json>;
  const raw = record.cueCardBullets ?? record.bullets;
  if (!Array.isArray(raw)) return undefined;
  const bullets = raw
    .filter((item): item is string => typeof item === "string" && item.trim() !== "")
    .map((item) => item.trim());
  return bullets.length > 0 ? bullets : undefined;
}

export async function claimWorkflowCore(
  runId: string,
  phase: string,
  launchToken: string
) {
  "use step";
  return claimAiWorkflowRun({ id: runId, phase, leaseSeconds: 900, launchToken });
}

export async function markWorkflowCoreCompleted(runId: string, phase: string) {
  "use step";
  await updateAiWorkflowRun({
    id: runId,
    status: "core_completed",
    phase,
    coreCompleted: true,
    expectedStatuses: ["running"],
  });
}

export async function markWorkflowCompleted(runId: string) {
  "use step";
  await updateAiWorkflowRun({
    id: runId,
    status: "completed",
    phase: "completed",
    completed: true,
    expectedStatuses: ["running", "core_completed"],
  });
}

export async function markWorkflowFailed(
  runId: string,
  message: string,
  retryable: boolean
) {
  "use step";
  await updateAiWorkflowRun({
    id: runId,
    status: "failed",
    phase: "failed",
    errorCode: retryable ? "RETRYABLE_WORKFLOW_FAILED" : "FATAL_WORKFLOW_FAILED",
    errorMessage: message,
    failed: true,
    expectedStatuses: ["starting", "running", "core_completed"],
  });
}

export async function preparePracticeAnalysis(params: {
  workflowRunId: string;
  analysisJobId: string;
  practiceAttemptId: string;
}) {
  "use step";
  return prepareDurablePracticeAnalysis({
    workflowRunId: params.workflowRunId,
    jobId: params.analysisJobId,
    attemptId: params.practiceAttemptId,
  });
}

export async function generatePracticeAnalysis(
  params: Parameters<typeof generateDurablePracticeFeedback>[0]
) {
  "use step";
  return generateDurablePracticeFeedback(params);
}

export async function persistPracticeAnalysis(
  params: Parameters<typeof persistDurablePracticeAnalysis>[0]
) {
  "use step";
  return persistDurablePracticeAnalysis(params);
}

export async function claimPracticeAnalysis(params: {
  analysisJobId: string;
  practiceAttemptId: string;
}) {
  "use step";
  return claimDurablePracticeAnalysis({
    jobId: params.analysisJobId,
    attemptId: params.practiceAttemptId,
  });
}

export async function markPracticeWorkflowFailure(params: {
  analysisJobId: string;
  practiceAttemptId: string;
  errorMessage: string;
}) {
  "use step";
  await failDurablePracticeAnalysis({
    jobId: params.analysisJobId,
    attemptId: params.practiceAttemptId,
    errorMessage: params.errorMessage,
  });
}

/**
 * This deliberately has its own durable checkpoint. Workflow's default step
 * policy retries a failed step up to three times; if transcription or
 * grounding fails later, those retries do not try to acquire the response's
 * short-lived scoring lease a second time.
 */
export async function claimIeltsSpeakingScore(params: {
  speakingResponseId: string;
}) {
  "use step";
  const admin = createTypedAdminClient();
  const context = await loadSpeakingScoringContext(admin, params.speakingResponseId);
  if (!context) throw new FatalError("Speaking response no longer exists");
  const { response } = context;
  if (isTerminalSpeakingStatus(response.status)) {
    return { status: "already_scored" as const, attemptId: response.attempt_id, userId: response.user_id };
  }
  const decision = decideSpeakingScoringAction({
    status: response.status,
    updatedAt: response.updated_at,
    queueDeliveryCount: 1,
  });
  if (decision.action === "fail") {
    await markSpeakingScoringFailed(admin, {
      speakingResponseId: response.id,
      retryable: false,
    });
    throw new FatalError("Speaking score retry limit exceeded");
  }
  if (decision.action === "skip") {
    throw new Error("Speaking response is held by an active scoring lease");
  }
  const claimed = await claimSpeakingResponseForScoring(admin, {
    speakingResponseId: response.id,
    allowedStatuses: claimableSpeakingStatuses(decision.allowedStatuses),
  });
  if (!claimed) throw new Error("Speaking scoring claim was not acquired");
  return { status: "claimed" as const };
}

export async function prepareIeltsSpeakingScore(params: {
  workflowRunId: string;
  speakingResponseId: string;
  durationSeconds?: number;
}) {
  "use step";
  const admin = createTypedAdminClient();
  const context = await loadSpeakingScoringContext(admin, params.speakingResponseId);
  if (!context) throw new FatalError("Speaking response no longer exists");
  const { response, question } = context;

  if (!response.audio_storage_path) {
    throw new FatalError("Speaking response has no audio storage path");
  }
  const { data, error } = await admin.storage
    .from(IELTS_SPEAKING_AUDIO_BUCKET)
    .download(response.audio_storage_path);
  if (error || !data) throw new Error(`download speaking audio: ${error?.message ?? "no data"}`);
  const audioBuffer = await data.arrayBuffer();
  const contentType = data.type || inferAudioContentType(response.audio_storage_path);
  const durationSeconds = params.durationSeconds ?? 0;
  const transcription = await transcribePracticeAudio({
    audioBuffer,
    contentType,
    practiceLanguage: "en",
    audioBucket: IELTS_SPEAKING_AUDIO_BUCKET,
    audioStoragePath: response.audio_storage_path,
    durationSeconds,
    practiceTrack: "speaking",
  });
  const [pronunciation, grounding] = await Promise.all([
    assessPronunciation({
      audio: audioBuffer,
      audioContentType: azurePronunciationContentType(contentType),
      referenceText: transcription.transcript,
      userId: response.user_id,
      speakingResponseId: response.id,
      practiceAttemptId: response.attempt_id,
    }),
    loadSpeakingExemplars(admin, {
      questionId: question.id,
      questionType: question.question_type,
    }),
  ]);
  return {
    status: "prepared" as const,
    attemptId: response.attempt_id,
    userId: response.user_id,
    speakingResponseId: response.id,
    transcript: transcription.transcript,
    sttProvider: transcription.provider,
    phonemeReport: pronunciation.report as unknown as Json,
    prompt: buildSpeakingScorerPrompt({
      partNumber: speakingPartNumberForQuestionType(question.question_type),
      questionType: question.question_type,
      questionPrompt: question.prompt,
      cueCardBullets: extractCueCardBullets(question.metadata),
      transcript: transcription.transcript,
      wordCount: transcription.wordCount,
      durationSeconds: durationSeconds > 0 ? durationSeconds : null,
      sttWarnings: transcription.warnings,
      feedbackLanguage: response.feedback_language === "vi" ? "vi" : "en",
      grounding,
      pronunciation: extractPronunciationSignal(pronunciation.report),
    }),
  };
}

export async function generateIeltsSpeakingScore(params: {
  workflowRunId: string;
  speakingResponseId: string;
  userId: string;
  prompt: string;
}) {
  "use step";
  return generateStructured({
    task: "ielts_speaking_score",
    prompt: params.prompt,
    schema: ieltsSpeakingModelOutputSchema,
    context: {
      task: "ielts_speaking_score",
      sourceRoute: "/workflows/ai/ielts-speaking-score",
      outputType: "ielts_speaking_score",
      userId: params.userId,
      idempotencyKey: params.workflowRunId,
      entity: { speakingResponseId: params.speakingResponseId },
      metadata: { workflowRunId: params.workflowRunId },
    },
  });
}

export async function persistIeltsSpeakingScore(params: {
  speakingResponseId: string;
  attemptId: string;
  userId: string;
  transcript: string;
  sttProvider: string;
  phonemeReport: Json;
  output: IeltsSpeakingModelOutput;
  provider: string;
  model: string;
}) {
  "use step";
  await persistSpeakingScore(createTypedAdminClient(), {
    speakingResponseId: params.speakingResponseId,
    transcript: params.transcript,
    sttProvider: params.sttProvider,
    score: normalizeSpeakingScore(params.output),
    providerLabel: params.provider,
    modelName: params.model,
    phonemeReport: params.phonemeReport,
  });
  return { status: "scored" as const, attemptId: params.attemptId, userId: params.userId };
}

/** Same checkpointing rule as speaking: acquire once, then do slow work. */
export async function claimIeltsWritingScore(params: {
  writingResponseId: string;
}) {
  "use step";
  const admin = createTypedAdminClient();
  const context = await loadWritingScoringContext(admin, params.writingResponseId);
  if (!context) throw new FatalError("Writing response no longer exists");
  const { response } = context;
  if (isTerminalWritingStatus(response.status)) {
    return { status: "already_scored" as const, attemptId: response.attempt_id, userId: response.user_id };
  }
  const decision = decideWritingScoringAction({
    status: response.status,
    updatedAt: response.updated_at,
    queueDeliveryCount: 1,
  });
  if (decision.action === "fail") {
    await markWritingScoringFailed(admin, { writingResponseId: response.id, retryable: false });
    throw new FatalError("Writing score retry limit exceeded");
  }
  if (decision.action === "skip") {
    throw new Error("Writing response is held by an active scoring lease");
  }
  const claimed = await claimWritingResponseForScoring(admin, {
    writingResponseId: response.id,
    allowedStatuses: claimableWritingStatuses(decision.allowedStatuses),
    providerLabel: getIeltsWritingProviderLabel(getIeltsWritingScoreProvider()),
    modelName: getIeltsWritingModelName(getIeltsWritingScoreProvider()),
  });
  if (!claimed) throw new Error("Writing scoring claim was not acquired");
  return { status: "claimed" as const };
}

export async function prepareIeltsWritingScore(params: {
  workflowRunId: string;
  writingResponseId: string;
}) {
  "use step";
  const admin = createTypedAdminClient();
  const context = await loadWritingScoringContext(admin, params.writingResponseId);
  if (!context) throw new FatalError("Writing response no longer exists");
  const { response, question } = context;

  const grounding = await loadWritingExemplars(admin, {
    questionId: question.id,
    questionType: question.question_type,
  });
  return {
    status: "prepared" as const,
    attemptId: response.attempt_id,
    userId: response.user_id,
    writingResponseId: response.id,
    prompt: buildWritingScorerPrompt({
      taskNumber: writingTaskNumberForQuestionType(question.question_type),
      taskType: question.question_type,
      questionPrompt: question.prompt,
      essay: response.essay,
      wordCount: response.word_count,
      feedbackLanguage: response.feedback_language === "vi" ? "vi" : "en",
      grounding,
    }),
  };
}

export async function generateIeltsWritingScore(params: {
  workflowRunId: string;
  writingResponseId: string;
  userId: string;
  prompt: string;
}) {
  "use step";
  return generateStructured({
    task: "ielts_writing_score",
    prompt: params.prompt,
    schema: ieltsWritingModelOutputSchema,
    context: {
      task: "ielts_writing_score",
      sourceRoute: "/workflows/ai/ielts-writing-score",
      outputType: "ielts_writing_score",
      userId: params.userId,
      idempotencyKey: params.workflowRunId,
      entity: { speakingResponseId: undefined },
      metadata: { workflowRunId: params.workflowRunId, writingResponseId: params.writingResponseId },
    },
  });
}

export async function persistIeltsWritingScore(params: {
  writingResponseId: string;
  attemptId: string;
  userId: string;
  output: IeltsWritingModelOutput;
  provider: string;
  model: string;
}) {
  "use step";
  await persistWritingScore(createTypedAdminClient(), {
    writingResponseId: params.writingResponseId,
    score: normalizeWritingScore(params.output),
    providerLabel: params.provider,
    modelName: params.model,
  });
  return { status: "scored" as const, attemptId: params.attemptId, userId: params.userId };
}

export async function markSpeakingWorkflowFailure(params: {
  speakingResponseId: string;
  retryable: boolean;
}) {
  "use step";
  await markSpeakingScoringFailed(createTypedAdminClient(), {
    speakingResponseId: params.speakingResponseId,
    retryable: params.retryable,
  });
}

export async function markWritingWorkflowFailure(params: {
  writingResponseId: string;
  retryable: boolean;
}) {
  "use step";
  await markWritingScoringFailed(createTypedAdminClient(), {
    writingResponseId: params.writingResponseId,
    retryable: params.retryable,
  });
}

export async function recomputeSpeakingAttempt(attemptId: string, userId: string) {
  "use step";
  await recomputeAttemptSpeakingBand(createTypedAdminClient(), attemptId, userId);
}

export async function recomputeWritingAttempt(attemptId: string, userId: string) {
  "use step";
  await recomputeAttemptWritingBand(createTypedAdminClient(), attemptId, userId);
}

export async function replanSpeakingAttempt(params: { userId: string; speakingResponseId: string }) {
  "use step";
  await maybeReplanAfterEvidence({
    client: createTypedAdminClient(),
    userId: params.userId,
    trigger: "speaking_scored",
    source: { type: "speaking_response", id: params.speakingResponseId },
  });
}

export async function replanWritingAttempt(params: { userId: string; writingResponseId: string }) {
  "use step";
  await maybeReplanAfterEvidence({
    client: createTypedAdminClient(),
    userId: params.userId,
    trigger: "writing_scored",
    source: { type: "writing_response", id: params.writingResponseId },
  });
}
