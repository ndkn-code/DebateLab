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

/**
 * Canonical data access for `writing_responses` (WS-3.1).
 *
 * `writing_responses`/`ielts_question_keys` are admin-write only under RLS, so
 * every write here uses the service-role admin client and enforces ownership in
 * code (the authed user must own the attempt). One canonical create path
 * (data-access §3/§8): a (re)submission upserts on `(attempt_id, question_id)`.
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
    .select("id, user_id")
    .eq("id", input.attemptId)
    .maybeSingle();
  if (!attempt || attempt.user_id !== userId) {
    throw new WritingResponseAccessError("IELTS attempt not found.");
  }

  const { data: question } = await admin
    .from("ielts_questions")
    .select("id, skill, question_type")
    .eq("id", input.questionId)
    .maybeSingle();
  if (!question || question.skill !== "writing") {
    throw new WritingResponseAccessError("Question is not a writing task.");
  }

  const { data, error } = await admin
    .from("writing_responses")
    .upsert(
      toWritingResponseInsert({
        input,
        userId,
        taskNumber: writingTaskNumberForQuestionType(question.question_type),
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

export async function loadWritingScoringContext(
  admin: TypedAdminClient,
  writingResponseId: string,
): Promise<{ response: WritingResponseRow; question: IeltsQuestionRow } | null> {
  const { data: response } = await admin
    .from("writing_responses")
    .select("*")
    .eq("id", writingResponseId)
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
      prompt_bundle_key: IELTS_WRITING_SCORER_BUNDLE_KEY,
      prompt_bundle_version: IELTS_WRITING_SCORER_BUNDLE_VERSION,
      scored_at: now,
      updated_at: now,
    })
    .eq("id", params.writingResponseId);
  if (error) {
    throw new Error(`persistWritingScore failed: ${error.message}`);
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
    scoredAt: row.scored_at,
  };
}
