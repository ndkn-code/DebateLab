import { NextRequest, NextResponse } from "next/server";
import { dispatchUserEmails } from "@/lib/email/dispatch";
import { processDueEmailCampaigns } from "@/lib/api/email-campaigns";
import { createTypedAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawLimit = request.nextUrl.searchParams.get("limit");
  const parsedLimit = rawLimit ? Number(rawLimit) : undefined;
  const limit =
    parsedLimit && Number.isFinite(parsedLimit)
      ? Math.max(1, Math.min(1000, Math.floor(parsedLimit)))
      : undefined;

  try {
    const admin = createTypedAdminClient();
    let dueSoonEventsEnqueued: number | null = null;
    let dueSoonEventsWarning: string | null = null;
    const dueSoon = await admin.rpc("enqueue_lms_due_soon_events", {
      p_horizon: "24 hours",
    });
    if (dueSoon.error) {
      // The email cron may deploy before the additive LMS migration. Keep the
      // existing email job healthy until the migration has reached production.
      if (dueSoon.error.code === "PGRST202" || dueSoon.error.code === "42883") {
        dueSoonEventsWarning = "LMS due-soon migration is not available yet.";
      } else {
        throw new Error(dueSoon.error.message);
      }
    } else {
      dueSoonEventsEnqueued = typeof dueSoon.data === "number" ? dueSoon.data : 0;
    }
    const campaigns = await processDueEmailCampaigns(admin);
    const result = await dispatchUserEmails({ supabase: admin, limit });
    return NextResponse.json({
      ok: true,
      dueSoonEventsEnqueued,
      ...(dueSoonEventsWarning ? { dueSoonEventsWarning } : {}),
      ...result,
      campaigns,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Email dispatch failed.",
      },
      { status: 500 }
    );
  }
}
