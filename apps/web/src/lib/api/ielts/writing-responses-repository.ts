import "server-only";

import { parseInput } from "@/lib/api/boundary";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json, Tables } from "@/types/supabase";
import {
  CreateWritingResponseSchema,
  toWritingResponseInsert,
  writingTaskNumberForQuestionType,
} from "./schema";
import {
  IELTS_WRITING_SCORER_BUNDLE_KEY,
  IELTS_WRITING_SCORER_BUNDLE_VERSION,
} from "@/lib/ielts/writing-scorer/constants";
import type { WritingResponseStatus } from "@/lib/ielts/writing-scorer/status";
import {
  buildCriteriaFeedback,
  type NormalizedWritingScore,
} from "@/lib/scoring/ielts-writing/normalize";
import { recordIeltsWritingScoreEvidence } from "./assess-score-evidence";
import { recordIeltsWritingCriterionEvidence } from "./criterion-evidence-repository";
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
 * Canonical data access for `writing_responses` (WS-3.1).
 *
 * `writing_responses`/`ielts_question_keys` are admin-write only under RLS, so
 * every write here uses the service-role admin client and enforces ownership in
 * code (the authed user must own the attempt). One canonical create path
 * (data-access §3/§8): an exact network replay reuses the immutable row at
 * `(attempt_id, question_id)`; a changed answer must use a new attempt.
 */
type TypedAdminClient = ReturnType<typeof createTypedAdminClient>;
export type WritingResponseRow = Tables<"writing_responses">;
export type IeltsQuestionRow = Tables<"ielts_questions">;

/** Raised when a learner submits against an attempt/question they don't own. */
export class WritingResponseAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WritingResponseAccessError";
  }
}

function canCreateWritingResponse(attempt: {
  assessment_mode: "practice" | "simulation";
  status: Tables<"ielts_attempts">["status"];
}): boolean {
  return attempt.assessment_mode === "simulation"
    ? attempt.status === "submitted" ||
        attempt.status === "scoring" ||
        attempt.status === "completed"
    : attempt.status === "in_progress";
}

function toJson(value: unknown): Json {
  return value as unknown as Json;
}

export async function createWritingResponse(
  raw: unknown,
  userId: string,
): Promise<WritingResponseRow> {
  const input = parseInput(CreateWritingResponseSchema, raw);
  const admin = createTypedAdminClient();

  const { data: attempt } = await admin
    .from("ielts_attempts")
    .select(
      "id, user_id, test_id, assessment_mode, status, blueprint_frozen_at",
    )
    .eq("id", input.attemptId)
    .maybeSingle();
  if (!attempt || attempt.user_id !== userId) {
    throw new WritingResponseAccessError("IELTS attempt not found.");
  }
  if (!canCreateWritingResponse(attempt)) {
    throw new WritingResponseAccessError(
      attempt.assessment_mode === "simulation"
        ? "Simulation writing is submitted only when the attempt is finalized."
        : "This practice attempt no longer accepts writing submissions.",
    );
  }

  const { data: existing, error: existingError } = await admin
    .from("writing_responses")
    .select("*")
    .eq("attempt_id", input.attemptId)
    .eq("question_id", input.questionId)
    .maybeSingle();
  if (existingError) {
    throw new Error(`load existing Writing response: ${existingError.message}`);
  }
  const replay = decideIeltsSubmissionReplay({
    hasExisting: Boolean(existing),
    samePayload:
      Boolean(existing) &&
      existing?.essay === input.essay &&
      existing?.feedback_language === input.feedbackLanguage,
    terminal:
      existing?.status === "scored" || existing?.status === "overridden",
  });
  if (replay === "conflict") throw new IeltsSubmissionConflictError();
  if (replay === "resume" || replay === "terminal") return existing!;

  const { data: blueprint } = await admin
    .from("ielts_attempt_question_blueprints")
    .select("question_id, test_id, skill, question_type")
    .eq("attempt_id", input.attemptId)
    .eq("question_id", input.questionId)
    .maybeSingle();

  let questionType: string;
  if (attempt.blueprint_frozen_at) {
    if (
      !blueprint ||
      blueprint.test_id !== attempt.test_id ||
      blueprint.skill !== "writing"
    ) {
      throw new WritingResponseAccessError(
        "Question is not in this frozen Writing attempt.",
      );
    }
    questionType = blueprint.question_type;
  } else {
    // Compatibility for pre-freeze attempts only. New attempts always use the
    // immutable blueprint branch above.
    const { data: question } = await admin
      .from("ielts_questions")
      .select("id, test_id, skill, question_type")
      .eq("id", input.questionId)
      .maybeSingle();
    if (
      !question ||
      question.test_id !== attempt.test_id ||
      question.skill !== "writing"
    ) {
      throw new WritingResponseAccessError("Question is not a writing task.");
    }
    questionType = question.question_type;
  }

  if (attempt.assessment_mode === "simulation") {
    // Finalization and queue delivery are retryable. Once captured, a
    // Simulation essay is immutable and repeated submissions reuse the row.
    if (existing) return existing;
    if (attempt.status === "completed") {
      throw new WritingResponseAccessError(
        "Completed simulations do not accept new writing responses.",
      );
    }
  }

  const { data, error } = await admin
    .from("writing_responses")
    .upsert(
      toWritingResponseInsert({
        input,
        userId,
        taskNumber: writingTaskNumberForQuestionType(questionType),
      }),
      { onConflict: "attempt_id,question_id" },
    )
    .select("*")
    .single();
  if (error || !data) {
    throw new Error(
      `createWritingResponse failed: ${error?.message ?? "no row returned"}`,
    );
  }
  return data;
}

export async function getWritingResponseForUser(
  writingResponseId: string,
  userId: string,
): Promise<WritingResponseRow | null> {
  const admin = createTypedAdminClient();
  const { data } = await admin
    .from("writing_responses")
    .select("*")
    .eq("id", writingResponseId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function getWritingResponseForSubmission(params: {
  attemptId: string;
  questionId: string;
  userId: string;
}): Promise<WritingResponseRow | null> {
  const { data, error } = await createTypedAdminClient()
    .from("writing_responses")
    .select("*")
    .eq("attempt_id", params.attemptId)
    .eq("question_id", params.questionId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (error) {
    throw new Error(`load Writing submission replay: ${error.message}`);
  }
  return data ?? null;
}

export async function loadWritingScoringContext(
  admin: TypedAdminClient,
  writingResponseId: string,
): Promise<{
  response: WritingResponseRow;
  question: IeltsQuestionRow;
} | null> {
  const { data: response } = await admin
    .from("writing_responses")
    .select("*")
    .eq("id", writingResponseId)
    .maybeSingle();
  if (!response) return null;
  const { data: attempt } = await admin
    .from("ielts_attempts")
    .select("id, blueprint_frozen_at")
    .eq("id", response.attempt_id)
    .maybeSingle();
  if (attempt?.blueprint_frozen_at) {
    const { data: blueprint } = await admin
      .from("ielts_attempt_question_blueprints")
      .select(
        "question_id, question_type, skill, prompt, group_instructions, word_limit, max_points, options, visual, metadata, passage_id, listening_section_id, question_order",
      )
      .eq("attempt_id", response.attempt_id)
      .eq("question_id", response.question_id)
      .maybeSingle();
    if (!blueprint) return null;

    // Keep the full question row for compatibility with downstream corpus
    // lookups, but replace every scoring-relevant field with the immutable
    // attempt snapshot. The FK means the live row normally still exists; the
    // fallback cast keeps this boundary resilient to legacy schema drift.
    const { data: liveQuestion } = await admin
      .from("ielts_questions")
      .select("*")
      .eq("id", response.question_id)
      .maybeSingle();
    if (!liveQuestion) return null;
    return {
      response,
      question: {
        ...liveQuestion,
        question_type: blueprint.question_type,
        skill: blueprint.skill,
        prompt: blueprint.prompt,
        group_instructions: blueprint.group_instructions,
        word_limit: blueprint.word_limit,
        max_points: blueprint.max_points,
        options: blueprint.options,
        visual: blueprint.visual,
        metadata: blueprint.metadata,
        passage_id: blueprint.passage_id,
        listening_section_id: blueprint.listening_section_id,
        order_index: blueprint.question_order,
      },
    };
  }
  const { data: question } = await admin
    .from("ielts_questions")
    .select("*")
    .eq("id", response.question_id)
    .maybeSingle();
  if (!question) return null;
  return { response, question };
}

export async function claimWritingResponseForScoring(
  admin: TypedAdminClient,
  params: {
    writingResponseId: string;
    allowedStatuses: WritingResponseStatus[];
    providerLabel: string;
    modelName: string;
  },
): Promise<boolean> {
  if (params.allowedStatuses.length === 0) return false;
  const now = new Date().toISOString();
  const { data } = await admin
    .from("writing_responses")
    .update({
      status: "scoring",
      model_provider: params.providerLabel,
      model_name: params.modelName,
      prompt_bundle_key: IELTS_WRITING_SCORER_BUNDLE_KEY,
      prompt_bundle_version: IELTS_WRITING_SCORER_BUNDLE_VERSION,
      updated_at: now,
    })
    .eq("id", params.writingResponseId)
    .in("status", params.allowedStatuses)
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

export async function persistWritingScore(
  admin: TypedAdminClient,
  params: {
    writingResponseId: string;
    score: NormalizedWritingScore;
    providerLabel: string;
    modelName: string;
    gradingMetadata?: Json;
    criterionEvidence?: IeltsCriterionEvidenceContract[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  const { score } = params;
  const { error } = await admin
    .from("writing_responses")
    .update({
      status: "scored",
      task_response_band: score.criteriaBands.taskResponse,
      coherence_cohesion_band: score.criteriaBands.coherenceCohesion,
      lexical_resource_band: score.criteriaBands.lexicalResource,
      grammar_band: score.criteriaBands.grammaticalRangeAccuracy,
      task_band: score.taskBand,
      inline_corrections: toJson(score.inlineCorrections),
      paragraph_feedback: toJson(score.paragraphFeedback),
      criteria_feedback: toJson(buildCriteriaFeedback(score)),
      model_answer: score.modelAnswer,
      model_provider: params.providerLabel,
      model_name: params.modelName,
      ...(params.gradingMetadata !== undefined
        ? { grading_metadata: params.gradingMetadata }
        : {}),
      prompt_bundle_key: IELTS_WRITING_SCORER_BUNDLE_KEY,
      prompt_bundle_version: IELTS_WRITING_SCORER_BUNDLE_VERSION,
      scored_at: now,
      updated_at: now,
    })
    .eq("id", params.writingResponseId);
  if (error) {
    throw new Error(`persistWritingScore failed: ${error.message}`);
  }
  await recordIeltsWritingScoreEvidence({
    client: admin,
    writingResponseId: params.writingResponseId,
  });
  if (params.criterionEvidence?.length) {
    await recordIeltsWritingCriterionEvidence({
      client: admin,
      writingResponseId: params.writingResponseId,
      evidence: params.criterionEvidence,
    });
  }
}

export async function markWritingScoringFailed(
  admin: TypedAdminClient,
  params: { writingResponseId: string; retryable: boolean },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await admin
    .from("writing_responses")
    .update({
      status: params.retryable ? "pending" : "failed",
      updated_at: now,
    })
    .eq("id", params.writingResponseId);
  if (error) {
    throw new Error(`markWritingScoringFailed failed: ${error.message}`);
  }
}

export interface WritingResponseView {
  id: string;
  attemptId: string;
  questionId: string;
  taskNumber: number;
  wordCount: number;
  status: WritingResponseStatus;
  feedbackLanguage: string;
  bands: {
    taskResponse: number | null;
    coherenceCohesion: number | null;
    lexicalResource: number | null;
    grammaticalRangeAccuracy: number | null;
    task: number | null;
  };
  criteriaFeedback: Json;
  inlineCorrections: Json;
  paragraphFeedback: Json;
  modelAnswer: string | null;
  /** Versioned scorer provenance and limitations; never contains answer keys. */
  gradingMetadata: LearnerGradingMetadata | null;
  scoredAt: string | null;
}

/** Learner-facing projection of a scored Writing response (the poll payload). */
export function toWritingResponseView(
  row: WritingResponseRow,
): WritingResponseView {
  return {
    id: row.id,
    attemptId: row.attempt_id,
    questionId: row.question_id,
    taskNumber: row.task_number,
    wordCount: row.word_count,
    status: row.status,
    feedbackLanguage: row.feedback_language,
    bands: {
      taskResponse: row.task_response_band,
      coherenceCohesion: row.coherence_cohesion_band,
      lexicalResource: row.lexical_resource_band,
      grammaticalRangeAccuracy: row.grammar_band,
      task: row.task_band,
    },
    criteriaFeedback: row.criteria_feedback,
    inlineCorrections: row.inline_corrections,
    paragraphFeedback: row.paragraph_feedback,
    modelAnswer: row.model_answer,
    gradingMetadata: sanitizeLearnerGradingMetadata(row.grading_metadata),
    scoredAt: row.scored_at,
  };
}
