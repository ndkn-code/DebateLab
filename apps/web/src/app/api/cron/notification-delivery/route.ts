import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimNotificationDeliveryJobs,
  reclaimNotificationDeliveryJobs,
  type NotificationDbClient,
} from "@/lib/notifications/repository";
import { publishNotificationDeliveryJob } from "@/lib/queues/notification-delivery";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (
    !process.env.CRON_SECRET ||
    request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = createAdminClient() as unknown as NotificationDbClient;
    const reclaimed = await reclaimNotificationDeliveryJobs(db, {
      maxAttempts: 5,
    });
    const jobs = await claimNotificationDeliveryJobs(db, {
      limit: 50,
      leaseSeconds: 300,
    });
    const published = await Promise.allSettled(
      jobs.map(publishNotificationDeliveryJob),
    );
    const failed = published.filter(
      (result) => result.status === "rejected",
    ).length;
    return NextResponse.json(
      {
        ok: failed === 0,
        reclaimed,
        claimed: jobs.length,
        published: jobs.length - failed,
        failed,
      },
      { status: failed === 0 ? 200 : 503 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Notification reconciliation failed.",
      },
      { status: 500 },
    );
  }
}
