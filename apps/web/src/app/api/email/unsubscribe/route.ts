import { NextRequest, NextResponse } from "next/server";
import { applyEmailUnsubscribe, verifyUnsubscribeToken } from "@/lib/email/unsubscribe";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing unsubscribe token" }, { status: 400 });
  }

  try {
    const payload = verifyUnsubscribeToken(token);
    await applyEmailUnsubscribe({
      supabase: createAdminClient(),
      payload,
      source: "one_click",
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Invalid unsubscribe token",
      },
      { status: 400 }
    );
  }
}
