import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDebateDuelRoom, getDebateDuelRoom } from "@/lib/api/debate-duels";
import { isAdminUser } from "@/lib/auth/admin";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  getEnum,
  getNumber,
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import {
  DUEL_OPENING_DURATION,
  DUEL_PREP_DURATION,
  DUEL_REBUTTAL_DURATION,
  clampDurationSeconds,
} from "@/lib/practice-durations";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json(
        { error: "1v1 Debate is coming soon." },
        { status: 403 }
      );
    }

    const rateLimit = await consumeRateLimit(supabase, {
      scope: "duel-create",
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
    const topicTitle = getString(body, "topicTitle", {
      required: true,
      minLength: 2,
      maxLength: 240,
    })!;
    const topicCategory = getString(body, "topicCategory", {
      maxLength: 80,
      defaultValue: "Open",
    })!;
    const topicKey = getString(body, "topicKey", {
      maxLength: 80,
    });
    const topicCategoryKey = getString(body, "topicCategoryKey", {
      maxLength: 80,
    });
    const topicDescription = getString(body, "topicDescription", {
      maxLength: 2000,
    });

    const topicDifficulty =
      getEnum(
        body,
        "topicDifficulty",
        ["beginner", "intermediate", "advanced"] as const,
        { defaultValue: "beginner" }
      ) ?? "beginner";
    const practiceLanguage = getEnum(
      body,
      "practiceLanguage",
      ["en", "vi"] as const,
      { defaultValue: "en" }
    );
    const sideAssignmentMode = getEnum(
      body,
      "sideAssignmentMode",
      ["random", "choose"] as const,
      { defaultValue: "random" }
    )!;
    const creatorSidePreference =
      getEnum(
        body,
        "creatorSidePreference",
        ["proposition", "opposition"] as const,
        { defaultValue: "proposition" }
      ) ?? "proposition";

    const shareCode = await createDebateDuelRoom(user.id, {
      topicKey: topicKey || undefined,
      topicTitle,
      topicCategory,
      topicCategoryKey: topicCategoryKey || undefined,
      topicDifficulty,
      practiceLanguage,
      topicDescription: topicDescription || undefined,
      prepTimeSeconds: clampDurationSeconds(
        getNumber(body, "prepTimeSeconds"),
        DUEL_PREP_DURATION
      ),
      openingTimeSeconds: clampDurationSeconds(
        getNumber(body, "openingTimeSeconds"),
        DUEL_OPENING_DURATION
      ),
      rebuttalTimeSeconds: clampDurationSeconds(
        getNumber(body, "rebuttalTimeSeconds"),
        DUEL_REBUTTAL_DURATION
      ),
      sideAssignmentMode,
      creatorSidePreference:
        sideAssignmentMode === "choose" ? creatorSidePreference : null,
    });

    const room = await getDebateDuelRoom(shareCode, user.id);

    return NextResponse.json({ shareCode, room });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to create duel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
