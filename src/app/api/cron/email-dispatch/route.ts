import { NextRequest, NextResponse } from "next/server";
import { dispatchUserEmails } from "@/lib/email/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";

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
    const admin = createAdminClient();
    const result = await dispatchUserEmails({ supabase: admin, limit });
    return NextResponse.json({ ok: true, ...result });
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
