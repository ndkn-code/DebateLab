import "server-only";

import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";
import {
  IELTS_SPEAKING_ANALYSIS_QUEUE_TOPIC,
  createIeltsSpeakingIdempotencyKey,
  type IeltsSpeakingQueueMessage,
} from "@/lib/ielts/speaking-scorer/constants";

/**
 * Enqueue a Speaking-scoring job (WS-3.2). Reuses the same Vercel Queue infra as
 * the debate practice pipeline; the per-response idempotency key dedupes
 * redundant enqueues across redeliveries + resubmissions of the same bundle.
 * Mirrors the Writing queue.
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

export async function enqueueIeltsSpeakingScoring(
  message: IeltsSpeakingQueueMessage,
) {
  const send = getQueueSend();
  return send(IELTS_SPEAKING_ANALYSIS_QUEUE_TOPIC, message, {
    idempotencyKey: createIeltsSpeakingIdempotencyKey(
      message.speakingResponseId,
    ),
    retentionSeconds: 24 * 60 * 60,
    headers: {
      "x-ielts-speaking-response-id": message.speakingResponseId,
    },
  });
}
