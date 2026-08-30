import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { processNotificationDeliveryJob } from "@/lib/notifications/delivery-service";
import {
  completeNotificationDeliveryJob,
  type NotificationDbClient,
} from "@/lib/notifications/repository";
import type { NotificationDeliveryQueueMessage } from "@/lib/queues/notification-delivery";

export const maxDuration = 60;

const queue = new QueueClient({
  region: (process.env.VERCEL_REGION || "sin1") as VercelRegion,
  ...(process.env.VERCEL_QUEUE_API_TOKEN
    ? { deploymentId: null, token: process.env.VERCEL_QUEUE_API_TOKEN }
    : {}),
});

export const POST = queue.handleCallback<NotificationDeliveryQueueMessage>(
  async ({ job }) => {
    if (!job.leaseToken) throw new Error("NOTIFICATION_DELIVERY_LEASE_MISSING");
    const admin = createAdminClient();
    try {
      const result = await processNotificationDeliveryJob(admin, job);
      await completeNotificationDeliveryJob(
        admin as unknown as NotificationDbClient,
        {
          jobId: job.id,
          leaseToken: job.leaseToken,
          success: true,
          providerMessageId: result.providerMessageId,
        },
      );
    } catch (error) {
      await completeNotificationDeliveryJob(
        admin as unknown as NotificationDbClient,
        {
          jobId: job.id,
          leaseToken: job.leaseToken,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Notification delivery failed.",
        },
      );
      throw error;
    }
  },
  {
    visibilityTimeoutSeconds: 300,
    retry: () => ({ acknowledge: true }),
  },
);
