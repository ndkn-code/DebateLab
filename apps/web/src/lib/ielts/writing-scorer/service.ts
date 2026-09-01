import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserEntitlement } from "@/lib/entitlements";
import { parseInput } from "@/lib/api/boundary";
import { CreateWritingResponseSchema } from "@/lib/api/ielts/schema";
import { createPaymentRepository } from "@/lib/api/payments-repository";
import { meterFeature } from "@/lib/payments/meter";
import { METERED_FEATURES } from "@/lib/payments/metering";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/supabase";
import {
  findIeltsBandExamples,
  getIeltsRubric,
  type KnowledgeResult,
} from "@/lib/ai/knowledge";
import { normalizeWritingScore } from "@/lib/scoring/ielts-writing/normalize";
import { loadWritingExemplars } from "@/lib/corpus/ielts-exemplars";
import { recomputeAttemptWritingBand } from "@/lib/api/ielts/band-scores-repository";
import { maybeReplanAfterEvidence } from "@/lib/api/ielts/replan-hook";
import { writingTaskNumberForQuestionType } from "@/lib/api/ielts/schema";
import {
  claimWritingResponseForScoring,
  createWritingResponse,
  getWritingResponseForSubmission,
  loadWritingScoringContext,
  markWritingScoringFailed,
  persistWritingScore,
} from "@/lib/api/ielts/writing-responses-repository";
import { enqueueIeltsWritingScoring } from "@/lib/queues/ielts-writing";
import { ensureAiWorkflowRun } from "@/lib/ai/workflow-runs";
import { isGcpAiGradingEnabled } from "@/lib/ai/grading/backend";
import type { IeltsWritingQueueMessage } from "./constants";
import { buildWritingScorerPrompt } from "./prompt";
import { adjudicateWritingModel, runWritingModel } from "./provider";
import {
  adjacentBands,
  buildWritingAdjudicationPrompt,
  createStagedGradingMetadata,
  IELTS_GRADING_VERSION,
  isIeltsEvidenceAdjudicationEnabled,
  writingBands,
} from "@/lib/ielts/scoring-adjudication";
import {
  buildWritingCriterionEvidence,
  IELTS_PROVISIONAL_EVIDENCE_VERSION,
} from "@/lib/ielts/criterion-evidence-contract";
import { IeltsSubmissionConflictError } from "@/lib/ielts/submission-replay";
import { getIeltsWritingGroqModelName } from "./provider-policy";
import {
  claimableWritingStatuses,
  decideWritingScoringAction,
  isTerminalWritingStatus,
} from "./status";

/** Raised (HTTP 402) when the learner is over their metered scoring cap. */
export class WritingScoreLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WritingScoreLimitError";
  }
}

export interface SubmitWritingResponseResult {
  writingResponseId: string;
  status: string;
  usage: { used: number; limit: number | null };
}

export interface EnqueueWritingResponseResult {
  writingResponseId: string;
  status: string;
}

function resultCorpusVersion(result: KnowledgeResult): string | null {
  if (
    !result.data ||
    typeof result.data !== "object" ||
    Array.isArray(result.data)
  ) {
    return null;
  }
  const version = (result.data as { collectionVersion?: unknown })
    .collectionVersion;
  return typeof version === "string" ? version : null;
}

function joinKnowledgeContext(...results: KnowledgeResult[]): string {
  return results
    .map((result) => result.context)
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Submit an essay for async scoring: meter the request (one unit per scoring
 * request, so over-cap users never queue work), persist the response via the
 * canonical create path, then enqueue the job.
 */
export async function submitWritingResponseForScoring(params: {
  raw: unknown;
  userId: string;
  supabase: SupabaseClient;
}): Promise<SubmitWritingResponseResult> {
  // Reject a malformed body before consuming a metered unit (the canonical
  // create path re-validates + owns the authoritative parse + insert).
  const input = parseInput(CreateWritingResponseSchema, params.raw);
  const existing = await getWritingResponseForSubmission({
    attemptId: input.attemptId,
    questionId: input.questionId,
    userId: params.userId,
  });
  const samePayload =
    Boolean(existing) &&
    existing?.essay === input.essay &&
    existing?.feedback_language === input.feedbackLanguage;
  if (existing && !samePayload) {
    throw new IeltsSubmissionConflictError();
  }

  const entitlement = await getUserEntitlement(params.supabase, params.userId);
  const usage = await meterFeature(
    createPaymentRepository(),
    params.userId,
    entitlement.planType,
    METERED_FEATURES.aiWritingScore,
    new Date(),
    existing ? 0 : 1,
  );
  if (!usage.allowed) {
    throw new WritingScoreLimitError(
      `Monthly AI writing-score limit reached (${usage.usedCount}/${usage.limitCount ?? "unlimited"}).`,
    );
  }

  if (existing && isTerminalWritingStatus(existing.status)) {
    return {
      writingResponseId: existing.id,
      status: existing.status,
      usage: { used: usage.usedCount, limit: usage.limitCount },
    };
  }

  const queued = await enqueueWritingResponseForScoring({
    raw: params.raw,
    userId: params.userId,
  });

  return {
    ...queued,
    usage: { used: usage.usedCount, limit: usage.limitCount },
  };
}

/**
 * Persist and durably enqueue a Writing response without applying a second
 * interactive usage charge. Simulation finalization uses this after the server
 * has locked the attempt; learner-triggered Practice scoring meters first in
 * `submitWritingResponseForScoring` above.
 */
export async function enqueueWritingResponseForScoring(params: {
  raw: unknown;
  userId: string;
}): Promise<EnqueueWritingResponseResult> {
  const response = await createWritingResponse(params.raw, params.userId);
  if (isTerminalWritingStatus(response.status)) {
    return { writingResponseId: response.id, status: response.status };
  }
  const message = {
    writingResponseId: response.id,
    userId: params.userId,
  };
  if (isGcpAiGradingEnabled()) {
    await ensureAiWorkflowRun({
      userId: response.user_id,
      source: { kind: "ielts_writing_score", writingResponseId: response.id },
    });
  }
  try {
    await enqueueIeltsWritingScoring(message);
  } catch (error) {
    console.error("IELTS writing queue enqueue failed", {
      writingResponseId: response.id,
      error,
    });
  }

  return {
    writingResponseId: response.id,
    status: response.status,
  };
}

/**
 * Score one Writing response (async worker body). Reuses the practice-analysis
 * retry-guard for stale-reclaim + delivery caps via the typed `status` lifecycle
 * — throwing lets the queue redeliver; a terminal cap fails the response.
 */
export async function runIeltsWritingScoringJob(
  message: IeltsWritingQueueMessage,
  metadata: { deliveryCount: number },
): Promise<"completed" | "ignored" | "lease_active"> {
  const admin = createTypedAdminClient();
  const context = await loadWritingScoringContext(
    admin,
    message.writingResponseId,
  );
  if (!context) return "ignored"; // response gone → ack
  const { response, question } = context;
  if (isTerminalWritingStatus(response.status)) return "ignored"; // already final

  const decision = decideWritingScoringAction({
    status: response.status,
    updatedAt: response.updated_at,
    queueDeliveryCount: metadata.deliveryCount,
  });
  if (decision.action === "fail") {
    await markWritingScoringFailed(admin, {
      writingResponseId: response.id,
      retryable: false,
    });
    return "ignored";
  }
  if (decision.action === "skip") return "lease_active";

  const claimed = await claimWritingResponseForScoring(admin, {
    writingResponseId: response.id,
    allowedStatuses: claimableWritingStatuses(decision.allowedStatuses),
    providerLabel: "groq",
    modelName: getIeltsWritingGroqModelName(),
  });
  if (!claimed) return "lease_active"; // another worker won the claim

  try {
    const [grounding, rubric, broadExamples] = await Promise.all([
      loadWritingExemplars(admin, {
        questionId: question.id,
        questionType: question.question_type,
      }),
      getIeltsRubric({
        purpose: "grading",
        skill: "writing",
        language: "en",
        query: `Official IELTS Writing descriptors for ${question.question_type}`,
        sourceRoute: "ielts_writing_score",
        userId: response.user_id,
        supabase: admin,
        limit: 8,
      }),
      findIeltsBandExamples({
        purpose: "grading",
        skill: "writing",
        taskType: question.question_type,
        criteria: [
          "taskResponse",
          "coherenceCohesion",
          "lexicalResource",
          "grammaticalRangeAccuracy",
        ],
        query: `${question.prompt}\n${response.essay}`,
        questionId: question.id,
        questionType: question.question_type,
        language: "en",
        sourceRoute: "ielts_writing_score",
        userId: response.user_id,
        supabase: admin,
        limit: 8,
      }),
    ]);
    const prompt = buildWritingScorerPrompt({
      taskNumber: writingTaskNumberForQuestionType(question.question_type),
      taskType: question.question_type,
      questionPrompt: question.prompt,
      essay: response.essay,
      wordCount: response.word_count,
      feedbackLanguage: response.feedback_language === "vi" ? "vi" : "en",
      grounding,
      evidenceContext: joinKnowledgeContext(rubric, broadExamples),
    });
    const provisional = await runWritingModel({
      prompt,
      audit: { userId: response.user_id, writingResponseId: response.id },
    });
    const provisionalScore = normalizeWritingScore(provisional.output);
    let result = provisional;
    let gradingMetadata: Json | undefined;
    if (isIeltsEvidenceAdjudicationEnabled()) {
      const adjacentExamples = await findIeltsBandExamples({
        purpose: "grading",
        skill: "writing",
        taskType: question.question_type,
        criteria: [
          "taskResponse",
          "coherenceCohesion",
          "lexicalResource",
          "grammaticalRangeAccuracy",
        ],
        targetBands: adjacentBands(writingBands(provisional.output)),
        query: `${question.prompt}\n${response.essay}`,
        questionId: question.id,
        questionType: question.question_type,
        language: "en",
        sourceRoute: "ielts_writing_score_adjudication",
        userId: response.user_id,
        supabase: admin,
        limit: 12,
      });
      result = await adjudicateWritingModel({
        prompt: buildWritingAdjudicationPrompt({
          originalPrompt: prompt,
          provisionalOutput: provisional.output,
          evidenceContext: adjacentExamples.context,
        }),
        audit: { userId: response.user_id, writingResponseId: response.id },
      });
      const evidence = [
        ...rubric.evidence,
        ...broadExamples.evidence,
        ...adjacentExamples.evidence,
      ]
        .filter(
          (item, index, all) =>
            all.findIndex(
              (candidate) => candidate.sourceId === item.sourceId,
            ) === index,
        )
        .map((item) => ({
          sourceId: item.sourceId,
          version: item.version,
          itemType: item.itemType,
          score: item.score,
          reviewStatus: item.reviewStatus,
          sourceLocator: item.sourceLocator,
          authorityTier: item.authorityTier,
          rightsStatus: item.rightsStatus,
        }));
      gradingMetadata = createStagedGradingMetadata({
        evidence,
        runId: response.id,
        corpusVersion:
          resultCorpusVersion(adjacentExamples) ??
          resultCorpusVersion(broadExamples),
        provisionalTraceId: provisional.traceId,
        adjudicationTraceId: result.traceId,
        retrievalSkippedReason: adjacentExamples.skippedReason,
      }) as unknown as Json;
    }
    const score = normalizeWritingScore(result.output);
    const criterionEvidence = buildWritingCriterionEvidence({
      score: provisionalScore,
      context: {
        stage: "provisional",
        gradingVersion: IELTS_PROVISIONAL_EVIDENCE_VERSION,
        traceId: provisional.traceId,
        runId: provisional.traceId,
        provider: provisional.providerLabel,
        model: provisional.modelName,
        rubricVersion: "ielts-writing-rubric-v1",
        promptVersion: "ielts_writing_scorer@1",
        confidence: 0.5,
        validatedOutputSnapshot: provisional.output as unknown as Json,
      },
    });
    if (result !== provisional)
      criterionEvidence.push(
        ...buildWritingCriterionEvidence({
          score,
          context: {
            stage: "adjudicated",
            gradingVersion: IELTS_GRADING_VERSION,
            traceId: result.traceId,
            runId: provisional.traceId,
            provider: result.providerLabel,
            model: result.modelName,
            rubricVersion: "ielts-writing-rubric-v1",
            promptVersion: "ielts_writing_adjudication@1",
            confidence: 0.7,
            validatedOutputSnapshot: result.output as unknown as Json,
          },
        }),
      );
    await persistWritingScore(admin, {
      writingResponseId: response.id,
      score,
      providerLabel: result.providerLabel,
      modelName: result.modelName,
      gradingMetadata,
      criterionEvidence,
    });
    await recomputeAttemptWritingBand(
      admin,
      response.attempt_id,
      response.user_id,
    );
    // WS-6.2.4: adapt the learner's future plan to the new Writing band
    // (best-effort; never throws, so scoring/redelivery is unaffected).
    await maybeReplanAfterEvidence({
      client: admin,
      userId: response.user_id,
      trigger: "writing_scored",
      source: { type: "writing_response", id: response.id },
    });
    return "completed";
  } catch (error) {
    await markWritingScoringFailed(admin, {
      writingResponseId: response.id,
      retryable: true,
    }).catch(() => {});
    throw error; // queue redelivers; retry-guard caps + fails terminally
  }
}
