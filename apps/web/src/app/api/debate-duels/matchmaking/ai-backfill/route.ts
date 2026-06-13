import { NextRequest, NextResponse } from "next/server";
import { createDebateDuelAiBackfill } from "@/lib/api/debate-duels";
import { canAccessDuels } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  getEnum,
  getNumber,
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";

// Creating the AI opponent user (first call) + the duel; keep headroom.
export const maxDuration = 60;

/**
 * Backfill a matchmaking ticket with an AI duel. The client calls this after it
 * has waited in queue without a human match.
 */
export async function POST(req: NextRequest) {
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
      scope: "duel-ai-backfill",
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

    const body = await readJsonObject(req, { maxBytes: 8 * 1024 });
    const room = await createDebateDuelAiBackfill(user.id, {
      topicCategory: getString(body, "topicCategory", {
        required: true,
        maxLength: 120,
      })!,
      topicCategoryKey: getString(body, "topicCategoryKey", { maxLength: 120 }) ?? null,
      topicKey: getString(body, "topicKey", { maxLength: 200 }) ?? null,
      topicTitle: getString(body, "topicTitle", { required: true, maxLength: 300 })!,
      topicDescription: getString(body, "topicDescription", { maxLength: 2000 }) ?? null,
      topicDifficulty: getEnum(
        body,
        "topicDifficulty",
        ["beginner", "intermediate", "advanced"] as const,
        { defaultValue: "beginner" }
      )!,
      practiceLanguage: getEnum(body, "practiceLanguage", ["en", "vi"] as const, {
        defaultValue: "en",
      })!,
      prepTimeSeconds: Math.floor(
        getNumber(body, "prepTimeSeconds", { min: 30, max: 600, defaultValue: 120 }) ?? 120
      ),
      openingTimeSeconds: Math.floor(
        getNumber(body, "openingTimeSeconds", { min: 30, max: 600, defaultValue: 180 }) ?? 180
      ),
      rebuttalTimeSeconds: Math.floor(
        getNumber(body, "rebuttalTimeSeconds", { min: 30, max: 600, defaultValue: 120 }) ?? 120
      ),
    });

    return NextResponse.json(room);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const raw = error instanceof Error ? error.message : "Failed to start AI duel.";
    let message = raw;
    let status = 500;
    if (raw.includes("INSUFFICIENT_CREDITS")) {
      message = "You need at least 200 Credits to start a duel.";
      status = 400;
    } else if (raw.includes("FORBIDDEN")) {
      message = "You are not allowed to start this duel.";
      status = 403;
    } else if (raw.includes("ADMIN_CLIENT_UNAVAILABLE") || raw.includes("AI_OPPONENT_MISSING")) {
      message = "AI opponent is unavailable right now.";
      status = 503;
    }
    return NextResponse.json({ error: message }, { status });
  }
}
