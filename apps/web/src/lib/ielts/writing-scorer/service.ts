import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserEntitlement } from "@/lib/entitlements";
import { parseInput } from "@/lib/api/boundary";
import { CreateWritingResponseSchema } from "@/lib/api/ielts/schema";
import { createPaymentRepository } from "@/lib/api/payments-repository";
import { meterFeature } from "@/lib/payments/meter";
import { METERED_FEATURES } from "@/lib/payments/metering";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { normalizeWritingScore } from "@/lib/scoring/ielts-writing/normalize";
import { loadWritingExemplars } from "@/lib/corpus/ielts-exemplars";
import { recomputeAttemptWritingBand } from "@/lib/api/ielts/band-scores-repository";
import { maybeReplanAfterEvidence } from "@/lib/api/ielts/replan-hook";
import { writingTaskNumberForQuestionType } from "@/lib/api/ielts/schema";
import {
  claimWritingResponseForScoring,
  createWritingResponse,
  loadWritingScoringContext,
  markWritingScoringFailed,
  persistWritingScore,
} from "@/lib/api/ielts/writing-responses-repository";
import { enqueueIeltsWritingScoring } from "@/lib/queues/ielts-writing";
import type { IeltsWritingQueueMessage } from "./constants";
import { buildWritingScorerPrompt } from "./prompt";
import { runWritingModel } from "./provider";
import {
  getIeltsWritingModelName,
  getIeltsWritingProviderLabel,
  getIeltsWritingScoreProvider,
} from "./provider-policy";
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

export function scheduleIeltsWritingScoringFallback(
  message: IeltsWritingQueueMessage,
  reason: "submit" | "poll",
): void {
  try {
    after(async () => {
      try {
        await runIeltsWritingScoringJob(message, { deliveryCount: 1 });
      } catch (error) {
        console.error("IELTS writing fallback scoring failed", {
          writingResponseId: message.writingResponseId,
          reason,
          error,
        });
      }
    });
  } catch (error) {
    console.warn("IELTS writing fallback could not be scheduled", {
      writingResponseId: message.writingResponseId,
      reason,
      error,
    });
  }
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
  parseInput(CreateWritingResponseSchema, params.raw);

  const entitlement = await getUserEntitlement(params.supabase, params.userId);
  const usage = await meterFeature(
    createPaymentRepository(),
    params.userId,
    entitlement.planType,
    METERED_FEATURES.aiWritingScore,
    new Date(),
  );
  if (!usage.allowed) {
    throw new WritingScoreLimitError(
      `Monthly AI writing-score limit reached (${usage.usedCount}/${usage.limitCount ?? "unlimited"}).`,
    );
  }

  const response = await createWritingResponse(params.raw, params.userId);
  const message = {
    writingResponseId: response.id,
    userId: params.userId,
  };
  scheduleIeltsWritingScoringFallback(message, "submit");
  try {
    await enqueueIeltsWritingScoring(message);
  } catch (error) {
    console.error("IELTS writing queue enqueue failed; fallback scheduled", {
      writingResponseId: response.id,
      error,
    });
  }

  return {
    writingResponseId: response.id,
    status: response.status,
    usage: { used: usage.usedCount, limit: usage.limitCount },
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
): Promise<void> {
  const admin = createTypedAdminClient();
  const context = await loadWritingScoringContext(
    admin,
    message.writingResponseId,
  );
  if (!context) return; // response gone → ack
  const { response, question } = context;
  if (isTerminalWritingStatus(response.status)) return; // already final

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
    return;
  }
  if (decision.action === "skip") return;

  const provider = getIeltsWritingScoreProvider();
  const claimed = await claimWritingResponseForScoring(admin, {
    writingResponseId: response.id,
    allowedStatuses: claimableWritingStatuses(decision.allowedStatuses),
    providerLabel: getIeltsWritingProviderLabel(provider),
    modelName: getIeltsWritingModelName(provider),
  });
  if (!claimed) return; // another worker won the claim

  try {
    const grounding = await loadWritingExemplars(admin, {
      questionId: question.id,
      questionType: question.question_type,
    });
    const prompt = buildWritingScorerPrompt({
      taskNumber: writingTaskNumberForQuestionType(question.question_type),
      taskType: question.question_type,
      questionPrompt: question.prompt,
      essay: response.essay,
      wordCount: response.word_count,
      feedbackLanguage: response.feedback_language === "vi" ? "vi" : "en",
      grounding,
    });
    const result = await runWritingModel({
      prompt,
      audit: { userId: response.user_id, writingResponseId: response.id },
    });
    await persistWritingScore(admin, {
      writingResponseId: response.id,
      score: normalizeWritingScore(result.output),
      providerLabel: result.providerLabel,
      modelName: result.modelName,
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
  } catch (error) {
    await markWritingScoringFailed(admin, {
      writingResponseId: response.id,
      retryable: true,
    }).catch(() => {});
    throw error; // queue redelivers; retry-guard caps + fails terminally
  }
}
