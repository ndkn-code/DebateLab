import "server-only";

import { parseInput } from "@/lib/api/boundary";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/types/supabase";
import {
  CreateSpeakingResponseSchema,
  speakingPartNumberForQuestionType,
  toSpeakingResponseInsert,
} from "./schema";
import {
  IELTS_SPEAKING_SCORER_BUNDLE_KEY,
  IELTS_SPEAKING_SCORER_BUNDLE_VERSION,
} from "@/lib/ielts/speaking-scorer/constants";
import type { SpeakingResponseStatus } from "@/lib/ielts/speaking-scorer/status";
import {
  buildSpeakingFeedback,
  type NormalizedSpeakingScore,
} from "@/lib/scoring/ielts-speaking/normalize";
import { recordIeltsSpeakingScoreEvidence } from "./assess-score-evidence";
import { recordIeltsSpeakingCriterionEvidence } from "./criterion-evidence-repository";
import type { IeltsCriterionEvidenceContract } from "@/lib/ielts/criterion-evidence-contract";
import {
  sanitizeLearnerGradingMetadata,
  type LearnerGradingMetadata,
} from "@/lib/ielts/scoring-adjudication";
import {
  decideIeltsSubmissionReplay,
  IeltsSubmissionConflictError,
} from "@/lib/ielts/submission-replay";

/**
 * Canonical data access for `speaking_responses` (WS-3.2).
 *
 * `speaking_responses`/`ielts_question_keys` are admin-write only under RLS, so
 * every write here uses the service-role admin client and enforces ownership in
 * code (the authed user must own the attempt). One canonical create path
 * (data-access §3/§8): an exact network replay reuses the immutable row at
 * `(attempt_id, question_id)`; a changed recording must use a new attempt.
 * Mirrors the Writing responses repository.
 */
type TypedAdminClient = ReturnType<typeof createTypedAdminClient>;
export type SpeakingResponseRow = Tables<"speaking_responses">;
export type IeltsQuestionRow = Tables<"ielts_questions">;

/** Raised when a learner submits against an attempt/question they don't own. */
export class SpeakingResponseAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpeakingResponseAccessError";
  }
}

function toJson(value: unknown): Json {
  return value as unknown as Json;
}

export async function createSpeakingResponse(
  raw: unknown,
  userId: string,
): Promise<SpeakingResponseRow> {
  const input = parseInput(CreateSpeakingResponseSchema, raw);
  const admin = createTypedAdminClient();

  const { data: attempt } = await admin
    .from("ielts_attempts")
    .select("id, user_id, test_id, status, blueprint_frozen_at")
    .eq("id", input.attemptId)
    .maybeSingle();
  if (!attempt || attempt.user_id !== userId) {
    throw new SpeakingResponseAccessError("IELTS attempt not found.");
  }
  if (attempt.status !== "in_progress") {
    throw new SpeakingResponseAccessError(
      "IELTS attempt is no longer accepting responses.",
    );
  }

  const { data: existing, error: existingError } = await admin
    .from("speaking_responses")
    .select("*")
    .eq("attempt_id", input.attemptId)
    .eq("question_id", input.questionId)
    .maybeSingle();
  if (existingError) {
    throw new Error(
      `load existing Speaking response: ${existingError.message}`,
    );
  }
  const replay = decideIeltsSubmissionReplay({
    hasExisting: Boolean(existing),
    samePayload:
      Boolean(existing) &&
      existing?.audio_storage_path === input.audioStoragePath &&
      existing?.feedback_language === input.feedbackLanguage,
    terminal:
      existing?.status === "scored" || existing?.status === "overridden",
  });
  if (replay === "conflict") throw new IeltsSubmissionConflictError();
  if (replay === "resume" || replay === "terminal") return existing!;

  const { data: question } = await admin
    .from("ielts_questions")
    .select("id, test_id, skill, question_type")
    .eq("id", input.questionId)
    .maybeSingle();
  if (
    !question ||
    question.test_id !== attempt.test_id ||
    question.skill !== "speaking"
  ) {
    throw new SpeakingResponseAccessError("Question is not a speaking task.");
  }

  if (attempt.blueprint_frozen_at) {
    const expectedPath = `${userId}/${input.attemptId}/speaking-${input.questionId}.wav`;
    if (input.audioStoragePath !== expectedPath) {
      throw new SpeakingResponseAccessError(
        "Audio path is not bound to this IELTS task.",
      );
    }
    const { data: blueprint } = await admin
      .from("ielts_attempt_question_blueprints")
      .select("question_id")
      .eq("attempt_id", input.attemptId)
      .eq("question_id", input.questionId)
      .eq("skill", "speaking")
      .maybeSingle();
    if (!blueprint) {
      throw new SpeakingResponseAccessError(
        "Speaking task is not part of this attempt.",
      );
    }
  } else if (!input.audioStoragePath.startsWith(`${userId}/`)) {
    // Compatibility for legacy attempts: preserve their broader path format,
    // but never permit a path outside the authenticated user's folder.
    throw new SpeakingResponseAccessError(
      "Audio path is not owned by this user.",
    );
  }

  const { data, error } = await admin
    .from("speaking_responses")
    .upsert(
      toSpeakingResponseInsert({
        input,
        userId,
        partNumber: speakingPartNumberForQuestionType(question.question_type),
      }),
      { onConflict: "attempt_id,question_id" },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `createSpeakingResponse failed: ${error?.message ?? "no row returned"}`,
    );
  }
  return data;
}

export async function getSpeakingResponseForUser(
  speakingResponseId: string,
  userId: string,
): Promise<SpeakingResponseRow | null> {
  const admin = createTypedAdminClient();
  const { data } = await admin
    .from("speaking_responses")
    .select("*")
    .eq("id", speakingResponseId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function getSpeakingResponseForSubmission(params: {
  attemptId: string;
  questionId: string;
  userId: string;
}): Promise<SpeakingResponseRow | null> {
  const { data, error } = await createTypedAdminClient()
    .from("speaking_responses")
    .select("*")
    .eq("attempt_id", params.attemptId)
    .eq("question_id", params.questionId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error) {
    throw new Error(`load Speaking submission replay: ${error.message}`);
  }
  return data ?? null;
}

export async function loadSpeakingScoringContext(
  admin: TypedAdminClient,
  speakingResponseId: string,
): Promise<{
  response: SpeakingResponseRow;
  question: IeltsQuestionRow;
} | null> {
  const { data: response } = await admin
    .from("speaking_responses")
    .select("*")
    .eq("id", speakingResponseId)
    .maybeSingle();
  if (!response) return null;
  const { data: question } = await admin
    .from("ielts_questions")
    .select("*")
    .eq("id", response.question_id)
    .maybeSingle();
  if (!question) return null;
  return { response, question };
}

export async function claimSpeakingResponseForScoring(
  admin: TypedAdminClient,
  params: {
    speakingResponseId: string;
    allowedStatuses: SpeakingResponseStatus[];
  },
): Promise<boolean> {
  if (params.allowedStatuses.length === 0) return false;
  const now = new Date().toISOString();
  const { data } = await admin
    .from("speaking_responses")
    .update({
      status: "scoring",
      prompt_bundle_key: IELTS_SPEAKING_SCORER_BUNDLE_KEY,
      prompt_bundle_version: IELTS_SPEAKING_SCORER_BUNDLE_VERSION,
      updated_at: now,
    })
    .eq("id", params.speakingResponseId)
    .in("status", params.allowedStatuses)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

export async function persistSpeakingScore(
  admin: TypedAdminClient,
  params: {
    speakingResponseId: string;
    transcript: string;
    sttProvider: string;
    score: NormalizedSpeakingScore;
    providerLabel: string;
    modelName: string;
    /** WS-3.3 phoneme report (jsonb). Augments Pronunciation; never the band itself. */
    phonemeReport?: Json;
    gradingMetadata?: Json;
    criterionEvidence?: IeltsCriterionEvidenceContract[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { score } = params;
  const { error } = await admin
    .from("speaking_responses")
    .update({
      status: "scored",
      transcript: params.transcript,
      stt_provider: params.sttProvider,
      fluency_coherence_band: score.criteriaBands.fluencyCoherence,
      lexical_resource_band: score.criteriaBands.lexicalResource,
      grammar_band: score.criteriaBands.grammaticalRangeAccuracy,
      pronunciation_band: score.criteriaBands.pronunciation,
      speaking_band: score.speakingBand,
      feedback: toJson(buildSpeakingFeedback(score)),
      ...(params.phonemeReport !== undefined
        ? { phoneme_report: params.phonemeReport }
        : {}),
      ...(params.gradingMetadata !== undefined
        ? { grading_metadata: params.gradingMetadata }
        : {}),
      model_provider: params.providerLabel,
      model_name: params.modelName,
      prompt_bundle_key: IELTS_SPEAKING_SCORER_BUNDLE_KEY,
      prompt_bundle_version: IELTS_SPEAKING_SCORER_BUNDLE_VERSION,
      scored_at: now,
      updated_at: now,
    })
    .eq("id", params.speakingResponseId);
  if (error) {
    throw new Error(`persistSpeakingScore failed: ${error.message}`);
  }
  await recordIeltsSpeakingScoreEvidence({
    client: admin,
    speakingResponseId: params.speakingResponseId,
  });
  if (params.criterionEvidence?.length) {
    await recordIeltsSpeakingCriterionEvidence({
      client: admin,
      speakingResponseId: params.speakingResponseId,
      evidence: params.criterionEvidence,
    });
  }
}

export async function markSpeakingScoringFailed(
  admin: TypedAdminClient,
  params: { speakingResponseId: string; retryable: boolean },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("speaking_responses")
    .update({
      status: params.retryable ? "pending" : "failed",
      updated_at: now,
    })
    .eq("id", params.speakingResponseId);
  if (error) {
    throw new Error(`markSpeakingScoringFailed failed: ${error.message}`);
  }
}

export interface SpeakingResponseView {
  id: string;
  attemptId: string;
  questionId: string;
  partNumber: number | null;
  status: SpeakingResponseStatus;
  feedbackLanguage: string;
  transcript: string;
  bands: {
    fluencyCoherence: number | null;
    lexicalResource: number | null;
    grammaticalRangeAccuracy: number | null;
    pronunciation: number | null;
    speaking: number | null;
  };
  feedback: Json;
  phonemeReport: Json;
  /** Versioned scorer provenance and limitations; never contains answer keys. */
  gradingMetadata: LearnerGradingMetadata | null;
  sttProvider: string | null;
  scoredAt: string | null;
}

/** Learner-facing projection of a scored Speaking response (the poll payload). */
export function toSpeakingResponseView(
  row: SpeakingResponseRow,
): SpeakingResponseView {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    partNumber: row.part_number,
    status: row.status,
    feedbackLanguage: row.feedback_language,
    transcript: row.transcript,
    bands: {
      fluencyCoherence: row.fluency_coherence_band,
      lexicalResource: row.lexical_resource_band,
      grammaticalRangeAccuracy: row.grammar_band,
      pronunciation: row.pronunciation_band,
      speaking: row.speaking_band,
    },
    feedback: row.feedback,
    phonemeReport: row.phoneme_report,
    gradingMetadata: sanitizeLearnerGradingMetadata(row.grading_metadata),
    sttProvider: row.stt_provider,
    scoredAt: row.scored_at,
  };
}
