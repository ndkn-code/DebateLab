import "server-only";

import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";
import {
  PRACTICE_ANALYSIS_QUEUE_TOPIC,
  createPracticeAnalysisIdempotencyKey,
} from "@/lib/practice-analysis/constants";
import type { PracticeAnalysisQueueMessage } from "@/lib/practice-analysis/types";

let queueClient: QueueClient | null = null;
let queueClientKey: string | null = null;

function getQueueSend() {
  const token = process.env.VERCEL_QUEUE_API_TOKEN;
  const region = (process.env.VERCEL_REGION || "iad1") as VercelRegion;
  const clientKey = `${region}:${token ?? ""}`;

  if (!queueClient || queueClientKey !== clientKey) {
    queueClient = new QueueClient({
      region,
      ...(token ? { token } : {}),
    });
    queueClientKey = clientKey;
  }

  return queueClient.send;
}

export async function enqueuePracticeAnalysis(
  message: PracticeAnalysisQueueMessage
) {
  const send = getQueueSend();

  return send(PRACTICE_ANALYSIS_QUEUE_TOPIC, message, {
    idempotencyKey: createPracticeAnalysisIdempotencyKey(message.attemptId),
    retentionSeconds: 24 * 60 * 60,
    headers: {
      "x-practice-attempt-id": message.attemptId,
      "x-analysis-job-id": message.jobId,
    },
  });
}
