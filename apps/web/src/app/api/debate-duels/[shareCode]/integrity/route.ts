import { NextRequest, NextResponse } from "next/server";
import { canAccessDuels } from "@/lib/auth/admin";
import { recordDebateDuelIntegrityEvent } from "@/lib/api/debate-duels";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  getJsonRecord,
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";

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
      scope: "duel-integrity",
      limit: 60,
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

    const body = await readJsonObject(req, { maxBytes: 8 * 1024 });
    const actionType = getString(body, "actionType", {
      required: true,
      minLength: 1,
      maxLength: 80,
    })!;

    const { shareCode } = await context.params;
    const result = await recordDebateDuelIntegrityEvent({
      shareCode,
      userId: user.id,
      actionType,
      metadata: getJsonRecord(body, "metadata", { maxBytes: 4096 }),
      source: "client",
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to log integrity event.";
    const status = message.includes("participant required") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
