import { NextRequest, NextResponse } from "next/server";
import { submitDebateDuelSpeech } from "@/lib/api/debate-duels";
import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  getJsonRecord,
  getNumber,
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ shareCode: string; roundNumber: string }> }
) {
  try {
    const auth = await requireRequestAuth(req, { allowDevBypass: false });

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const { supabase, user } = auth;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json(
        { error: "1v1 Debate is coming soon." },
        { status: 403 }
      );
    }

    const rateLimit = await consumeRateLimit(supabase, {
      scope: "duel-speech",
      limit: 8,
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

    const body = await readJsonObject(req, { maxBytes: 48 * 1024 });
    const { shareCode, roundNumber } = await context.params;
    const parsedRoundNumber = Number(roundNumber);
    if (!Number.isInteger(parsedRoundNumber) || parsedRoundNumber < 1 || parsedRoundNumber > 8) {
      return NextResponse.json({ error: "Round number is invalid." }, { status: 400 });
    }

    const room = await submitDebateDuelSpeech({
      shareCode,
      userId: user.id,
      roundNumber: parsedRoundNumber,
      transcript:
        getString(body, "transcript", { maxLength: 35000 }) ||
        "[No transcript captured]",
      durationSeconds: Math.floor(
        getNumber(body, "durationSeconds", { min: 0, max: 7200, defaultValue: 0 }) ?? 0
      ),
      audioStoragePath: getString(body, "audioStoragePath", { maxLength: 512 }) ?? null,
      metadata: getJsonRecord(body, "metadata", { maxBytes: 4096 }),
    });

    return NextResponse.json(room);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to submit speech.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
