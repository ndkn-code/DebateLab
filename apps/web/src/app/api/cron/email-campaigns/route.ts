import { NextRequest, NextResponse } from "next/server";
import { processDueEmailCampaigns } from "@/lib/api/email-campaigns";
import { createTypedAdminClient } from "@/lib/supabase/admin";

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
    const outcomes = await processDueEmailCampaigns(createTypedAdminClient());
    return NextResponse.json({
      ok: true,
      processed: outcomes.length,
      outcomes,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Campaign dispatch failed.",
      },
      { status: 500 },
    );
  }
}
