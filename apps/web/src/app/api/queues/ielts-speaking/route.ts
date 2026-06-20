import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";

import type { IeltsSpeakingQueueMessage } from "@/lib/ielts/speaking-scorer/constants";
import { runIeltsSpeakingScoringJob } from "@/lib/ielts/speaking-scorer/service";

/**
 * Async worker for IELTS Speaking scoring (WS-3.2). Reuses the same Vercel Queue
 * callback machinery as the debate practice pipeline; returning acks, throwing
 * redelivers (the retry-guard inside the job caps + fails terminally). STT +
 * scoring can run longer than Writing, hence the wider duration budget.
 */
export const maxDuration = 120;

const queue = new QueueClient({
  region: (process.env.VERCEL_REGION || "sin1") as VercelRegion,
  ...(process.env.VERCEL_QUEUE_API_TOKEN
    ? { deploymentId: null, token: process.env.VERCEL_QUEUE_API_TOKEN }
    : {}),
});

export const POST = queue.handleCallback<IeltsSpeakingQueueMessage>(
  async (message, metadata) => {
    await runIeltsSpeakingScoringJob(message, {
      deliveryCount: metadata.deliveryCount,
    });
  },
);
