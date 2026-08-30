import "server-only";

import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";
import type { NotificationDeliveryJob } from "@/lib/notifications/contracts";

export const NOTIFICATION_DELIVERY_TOPIC = "notification-delivery-v1";

export type NotificationDeliveryQueueMessage = {
  job: NotificationDeliveryJob;
};

let client: QueueClient | null = null;
let clientKey = "";

function queueSend() {
  const token = process.env.VERCEL_QUEUE_API_TOKEN;
  const region = (process.env.VERCEL_REGION || "sin1") as VercelRegion;
  const nextKey = `${region}:${token ?? ""}`;
  if (!client || clientKey !== nextKey) {
    client = new QueueClient({
      region,
      ...(token ? { deploymentId: null, token } : {}),
    });
    clientKey = nextKey;
  }
  return client.send;
}

export async function publishNotificationDeliveryJob(
  job: NotificationDeliveryJob,
) {
  if (!job.leaseToken)
    throw new Error("Notification delivery job has no lease token.");
  return queueSend()(
    NOTIFICATION_DELIVERY_TOPIC,
    { job },
    {
      idempotencyKey: `${job.id}:${job.attempts}`,
      retentionSeconds: 24 * 60 * 60,
      headers: {
        "x-notification-job-id": job.id,
        "x-notification-channel": job.channel,
      },
    },
  );
}
