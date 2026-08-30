import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";
import { processMaterialVersion } from "@/lib/api/class-lms/material-pipeline/service";
import type { MaterialQueueMessage } from "@/lib/api/class-lms/material-pipeline/contracts";
import { SHARED_LMS_MATERIALS_V1 } from "@/lib/features";

export const maxDuration = 60;

const queue = new QueueClient({
  region: (process.env.VERCEL_REGION || "sin1") as VercelRegion,
  ...(process.env.VERCEL_QUEUE_API_TOKEN
    ? { deploymentId: null, token: process.env.VERCEL_QUEUE_API_TOKEN }
    : {}),
});

export const POST = queue.handleCallback<MaterialQueueMessage>(
  async (message) => {
    if (!SHARED_LMS_MATERIALS_V1) throw new Error("LMS_MATERIALS_DISABLED");
    const result = await processMaterialVersion(message.versionId);
    if (result === "lease_active") throw new Error("LMS_MATERIAL_LEASE_ACTIVE");
  },
  {
    visibilityTimeoutSeconds: 900,
    retry: (_error, metadata) =>
      metadata.deliveryCount >= 5
        ? { acknowledge: true }
        : { afterSeconds: Math.min(300, 2 ** metadata.deliveryCount * 5) },
  },
);
