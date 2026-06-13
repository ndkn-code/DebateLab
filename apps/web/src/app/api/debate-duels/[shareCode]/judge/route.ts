import { NextRequest, NextResponse } from "next/server";
import {
  judgeDebateDuelRoom,
  judgeDebateDuelRoomInternal,
} from "@/lib/api/debate-duels";
import { canAccessDuels } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";

// Judging calls the LLM; allow headroom like the speech route.
export const maxDuration = 60;

/**
 * Idempotently finalize a duel that is in the `judging` phase. Two callers:
 *   1. A live client that observes `status: "judging"` with no judgment yet
 *      (the speech-submit request that should have judged it died).
 *   2. The pg_net watchdog (`dispatch_overdue_duel_judging`) when BOTH players
 *      have disconnected, authenticated with the shared DUEL_WATCHDOG_SECRET so
 *      no cookie/session is required.
 * Safe to call repeatedly — it no-ops once a judgment exists.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ shareCode: string }> }
) {
  try {
    // Server-to-server watchdog handoff: a Bearer secret stands in for a user
    // session and finalizes via the service-role client (no participant gate).
    const watchdogSecret =
      process.env.DUEL_WATCHDOG_SECRET ?? process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    if (watchdogSecret && authHeader === `Bearer ${watchdogSecret}`) {
      const { shareCode } = await context.params;
      const result = await judgeDebateDuelRoomInternal(shareCode);
      return NextResponse.json(result);
    }

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
      scope: "duel-judge",
      limit: 6,
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
    const room = await judgeDebateDuelRoom(shareCode, user.id);

    return NextResponse.json(room);
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Failed to finalize judging.";

    let message = rawMessage;
    let status = 500;

    if (rawMessage.includes("DUEL_PARTICIPANT_REQUIRED")) {
      message = "You are not a participant in this duel.";
      status = 403;
    } else if (rawMessage.includes("DUEL_NOT_READY_FOR_JUDGING")) {
      message = "This duel is not ready to be judged yet.";
      status = 409;
    } else if (rawMessage.includes("DUEL_NOT_FOUND")) {
      message = "Duel not found.";
      status = 404;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
