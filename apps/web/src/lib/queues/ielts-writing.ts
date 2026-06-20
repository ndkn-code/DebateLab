import "server-only";

import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";
import {
  IELTS_WRITING_ANALYSIS_QUEUE_TOPIC,
  createIeltsWritingIdempotencyKey,
  type IeltsWritingQueueMessage,
} from "@/lib/ielts/writing-scorer/constants";

/**
 * Enqueue a Writing-scoring job (WS-3.1). Reuses the same Vercel Queue infra as
 * the debate practice pipeline; the per-response idempotency key dedupes
 * redundant enqueues across redeliveries + resubmissions of the same bundle.
 */
let queueClient: QueueClient | null = null;
let queueClientKey: string | null = null;

function getQueueSend() {
  const token = process.env.VERCEL_QUEUE_API_TOKEN;
  const region = (process.env.VERCEL_REGION || "sin1") as VercelRegion;
  const clientKey = `${region}:${token ?? ""}`;

  if (!queueClient || queueClientKey !== clientKey) {
    queueClient = new QueueClient({
      region,
      ...(token ? { deploymentId: null, token } : {}),
    });
    queueClientKey = clientKey;
  }

  return queueClient.send;
}

export async function enqueueIeltsWritingScoring(
  message: IeltsWritingQueueMessage,
) {
  const send = getQueueSend();
  return send(IELTS_WRITING_ANALYSIS_QUEUE_TOPIC, message, {
    idempotencyKey: createIeltsWritingIdempotencyKey(message.writingResponseId),
    retentionSeconds: 24 * 60 * 60,
    headers: {
      "x-ielts-writing-response-id": message.writingResponseId,
    },
  });
}
