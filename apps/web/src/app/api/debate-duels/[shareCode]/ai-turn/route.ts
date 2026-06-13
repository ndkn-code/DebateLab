import { NextRequest, NextResponse } from "next/server";
import { aiTurnDebateDuel } from "@/lib/api/debate-duels";
import { canAccessDuels } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";

// Generates the AI opponent's speech via the LLM; keep headroom.
export const maxDuration = 60;

/**
 * Generate + submit the AI opponent's speech for the current round. The human's
 * client calls this when it observes the AI's turn (opposition phase). Safe to
 * call repeatedly — it no-ops if it isn't the AI's turn or the speech exists.
 */
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
      scope: "duel-ai-turn",
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
    const room = await aiTurnDebateDuel(shareCode, user.id);

    return NextResponse.json(room);
  } catch (error) {
    const raw = error instanceof Error ? error.message : "Failed to play the AI turn.";
    let message = raw;
    let status = 500;
    if (raw.includes("DUEL_PARTICIPANT_REQUIRED")) {
      message = "You are not a participant in this duel.";
      status = 403;
    } else if (raw.includes("NOT_AI_DUEL")) {
      message = "This is not an AI duel.";
      status = 400;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
