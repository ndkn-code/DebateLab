import { NextRequest, NextResponse } from "next/server";
import { forfeitDebateDuelRoom } from "@/lib/api/debate-duels";
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
      scope: "duel-forfeit",
      limit: 12,
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
    const room = await forfeitDebateDuelRoom(shareCode, user.id);

    return NextResponse.json(room);
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Failed to forfeit duel.";

    let message = rawMessage;
    let status = 500;

    if (rawMessage.includes("FORBIDDEN")) {
      message = "You are not allowed to forfeit as another user.";
      status = 403;
    } else if (rawMessage.includes("DUEL_NOT_FOUND")) {
      message = "This duel no longer exists.";
      status = 404;
    } else if (rawMessage.includes("DUEL_JOIN_REQUIRED")) {
      message = "You are not a participant in this duel.";
      status = 403;
    } else if (rawMessage.includes("DUEL_NOT_FORFEITABLE")) {
      message = "This duel can no longer be forfeited.";
      status = 409;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
