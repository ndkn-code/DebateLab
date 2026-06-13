import { NextRequest, NextResponse } from "next/server";
import { joinDebateDuelRoom } from "@/lib/api/debate-duels";
import { canAccessDuels } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ shareCode: string }> }
) {
  try {
    const auth = await requireRequestAuth(req, { allowDevBypass: false });

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const { supabase, user } = auth;
    if (!(await canAccessDuels(supabase, user.id))) {
      return NextResponse.json(
        { error: "1v1 Debate is coming soon." },
        { status: 403 }
      );
    }

    const rateLimit = await consumeRateLimit(supabase, {
      scope: "duel-join",
      limit: 20,
      windowSeconds: 60,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment." },
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const { shareCode } = await context.params;
    const room = await joinDebateDuelRoom(shareCode, user.id);

    return NextResponse.json(room);
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Failed to join duel.";

    let message = rawMessage;
    let status = 400;

    if (rawMessage.includes("FORBIDDEN")) {
      message = "You are not allowed to join as another user.";
      status = 403;
    } else if (rawMessage.includes("DUEL_NOT_FOUND")) {
      message = "Duel room not found.";
      status = 404;
    } else if (rawMessage.includes("DUEL_ROOM_FULL")) {
      message = "This duel room is already full.";
      status = 409;
    } else if (rawMessage.includes("DUEL_ALREADY_STARTED")) {
      message = "This duel has already started.";
      status = 409;
    } else if (rawMessage.includes("DUEL_EXPIRED")) {
      message = "This duel room has expired.";
      status = 410;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
