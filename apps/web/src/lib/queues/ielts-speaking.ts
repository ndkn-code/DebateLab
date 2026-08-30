import "server-only";

import {
  type IeltsSpeakingQueueMessage,
} from "@/lib/ielts/speaking-scorer/constants";
import { publishAiGradingJob } from "@/lib/ai/grading/publisher";

/**
 * Enqueue a Speaking-scoring job (WS-3.2). Reuses the same Vercel Queue infra as
 * the debate practice pipeline; the per-response idempotency key dedupes
 * redundant enqueues across redeliveries + resubmissions of the same bundle.
 * Mirrors the Writing queue.
 */
export async function enqueueIeltsSpeakingScoring(
  message: IeltsSpeakingQueueMessage,
) {
  return publishAiGradingJob({
    userId: message.userId,
    source: {
      kind: "ielts_speaking_score",
      speakingResponseId: message.speakingResponseId,
    },
  });
}
