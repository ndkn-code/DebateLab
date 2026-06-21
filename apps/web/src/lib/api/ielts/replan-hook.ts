import "server-only";

import { IELTS_ENABLED } from "@/lib/features";
import {
  replanIeltsStudyPlanForUser,
  type ReplanOutcome,
} from "./study-plan-replan";
import type { IeltsDbClient } from "./client";
import type { ReplanTriggerEvent } from "@/lib/ielts/study-plan";

/**
 * WS-6.2.4 — best-effort replan seam.
 *
 * The WS-6.1.5 evidence hooks live inside the grading/scoring transactions
 * (grade-attempt, the Writing/Speaking scorer workers). Those paths `throw` to
 * trigger queue redelivery, so a replan failure there must NEVER bubble up and
 * cause re-grading/re-scoring. This wrapper swallows any error (logging it) and
 * is gated on `IELTS_ENABLED` so it is inert until the track launches.
 *
 * Add ONE call next to each evidence hook — the orchestration + idempotency
 * live in `replanIeltsStudyPlanForUser`.
 */
export async function maybeReplanAfterEvidence(params: {
  userId: string;
  trigger: ReplanTriggerEvent;
  source?: { type: string; id: string | null };
  client?: IeltsDbClient;
}): Promise<ReplanOutcome | null> {
  if (!IELTS_ENABLED) return null;
  try {
    return await replanIeltsStudyPlanForUser({
      userId: params.userId,
      trigger: params.trigger,
      source: params.source,
      client: params.client,
    });
  } catch (error) {
    console.error(
      `[ielts-replan] ${params.trigger} replan failed for user ${params.userId}:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
