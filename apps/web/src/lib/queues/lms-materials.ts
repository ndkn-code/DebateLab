import "server-only";

import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";
import { MATERIAL_PIPELINE_TOPIC, type MaterialQueueMessage } from "@/lib/api/class-lms/material-pipeline/contracts";

let client: QueueClient | null = null;
let key = "";

function queueSend() {
  const token = process.env.VERCEL_QUEUE_API_TOKEN;
  const region = (process.env.VERCEL_REGION || "sin1") as VercelRegion;
  const nextKey = `${region}:${token ?? ""}`;
  if (!client || key !== nextKey) {
    client = new QueueClient({ region, ...(token ? { deploymentId: null, token } : {}) });
    key = nextKey;
  }
  return client.send;
}

export async function enqueueMaterialProcessing(message: MaterialQueueMessage) {
  return queueSend()(MATERIAL_PIPELINE_TOPIC, message, {
    idempotencyKey: message.idempotencyKey,
    retentionSeconds: 24 * 60 * 60,
    headers: { "x-material-id": message.materialId, "x-material-version-id": message.versionId },
  });
}
