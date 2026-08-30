import "server-only";

import {
  type IeltsWritingQueueMessage,
} from "@/lib/ielts/writing-scorer/constants";
import { publishAiGradingJob } from "@/lib/ai/grading/publisher";

/**
 * Enqueue a Writing-scoring job (WS-3.1). Reuses the same Vercel Queue infra as
 * the debate practice pipeline; the per-response idempotency key dedupes
 * redundant enqueues across redeliveries + resubmissions of the same bundle.
 */
export async function enqueueIeltsWritingScoring(
  message: IeltsWritingQueueMessage,
) {
  return publishAiGradingJob({
    userId: message.userId,
    source: {
      kind: "ielts_writing_score",
      writingResponseId: message.writingResponseId,
    },
  });
}
