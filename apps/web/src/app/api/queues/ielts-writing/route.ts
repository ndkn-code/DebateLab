import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";

import type { IeltsWritingQueueMessage } from "@/lib/ielts/writing-scorer/constants";
import { runIeltsWritingScoringJob } from "@/lib/ielts/writing-scorer/service";

/**
 * Async worker for IELTS Writing scoring (WS-3.1). Reuses the same Vercel Queue
 * callback machinery as the debate practice pipeline; returning acks, throwing
 * redelivers (the retry-guard inside the job caps + fails terminally).
 */
export const maxDuration = 60;

const queue = new QueueClient({
  region: (process.env.VERCEL_REGION || "sin1") as VercelRegion,
  ...(process.env.VERCEL_QUEUE_API_TOKEN
    ? { deploymentId: null, token: process.env.VERCEL_QUEUE_API_TOKEN }
    : {}),
});

export const POST = queue.handleCallback<IeltsWritingQueueMessage>(
  async (message, metadata) => {
    await runIeltsWritingScoringJob(message, {
      deliveryCount: metadata.deliveryCount,
    });
  },
);
