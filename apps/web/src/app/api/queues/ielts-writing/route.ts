import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";

import type { IeltsWritingQueueMessage } from "@/lib/ielts/writing-scorer/constants";
import { runIeltsWritingScoringJob } from "@/lib/ielts/writing-scorer/service";
import { launchIeltsWritingScoreWorkflow } from "@/lib/ai/workflow-launcher";

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
    const workflowRunId = await launchIeltsWritingScoreWorkflow({
      writingResponseId: message.writingResponseId,
    });
    if (workflowRunId) return;

    const outcome = await runIeltsWritingScoringJob(message, {
      deliveryCount: metadata.deliveryCount,
    });
    if (outcome === "lease_active") {
      throw new Error("IELTS_WRITING_SCORING_LEASE_ACTIVE");
    }
  },
  {
    visibilityTimeoutSeconds: 360,
    retry: (_error, metadata) => {
      if (metadata.deliveryCount >= 10) return { acknowledge: true };
      return { afterSeconds: Math.min(300, 2 ** metadata.deliveryCount * 5) };
    },
  },
);
