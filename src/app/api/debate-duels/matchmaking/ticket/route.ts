import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  getEnum,
  getNumber,
  getString,
  readJsonObject,
  RequestValidationError,
  isUuid,
} from "@/lib/api/request-validation";
import {
  cancelDebateDuelMatchmaking,
  enterDebateDuelMatchmaking,
  getCurrentDebateDuelMatchmakingTicket,
} from "@/lib/api/debate-duels";
import {
  CATEGORY_CONFIG,
  getCategoryLabel,
  getTopicCategoryKey,
  getTopicStableKey,
  getLocalizedTopic,
  isCategoryKey,
  topics,
  type CategoryKey,
} from "@/lib/topics";
import {
  DUEL_OPENING_DURATION,
  DUEL_PREP_DURATION,
  DUEL_REBUTTAL_DURATION,
  clampDurationSeconds,
} from "@/lib/practice-durations";
import type { DebateDuelTopicDifficulty, PracticeLanguage } from "@/types";

type MatchmakingBody = {
  topicCategoryKey?: CategoryKey;
  topicDifficulty?: DebateDuelTopicDifficulty;
  practiceLanguage?: PracticeLanguage;
  prepTimeSeconds?: number;
  openingTimeSeconds?: number;
  rebuttalTimeSeconds?: number;
};

function normalizeDifficulty(
  difficulty: MatchmakingBody["topicDifficulty"]
): DebateDuelTopicDifficulty {
  if (difficulty === "intermediate" || difficulty === "advanced") {
    return difficulty;
  }
  return "beginner";
}

function normalizeCategoryKey(categoryKey: string | undefined): CategoryKey {
  return isCategoryKey(categoryKey) ? categoryKey : CATEGORY_CONFIG[0].key;
}

function pickTopic(
  categoryKey: CategoryKey,
  difficulty: DebateDuelTopicDifficulty
) {
  const exact = topics.filter(
    (topic) =>
      getTopicCategoryKey(topic) === categoryKey && topic.difficulty === difficulty
  );
  const categoryFallback = topics.filter(
    (topic) => getTopicCategoryKey(topic) === categoryKey
  );
  const candidates = exact.length > 0 ? exact : categoryFallback;
  const index = Math.floor(Math.random() * Math.max(1, candidates.length));
  return candidates[index] ?? topics[0];
}

async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  if (!(await isAdminUser(supabase, user.id))) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "1v1 Debate matchmaking is coming soon." },
        { status: 403 }
      ),
    };
  }

  return { user, error: null };
}

export async function GET() {
  try {
    const { user, error } = await getAdminUser();
    if (error || !user) return error;

    const ticket = await getCurrentDebateDuelMatchmakingTicket(user.id);
    return NextResponse.json({ ticket });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load matchmaking.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error } = await getAdminUser();
    if (error || !user) return error;

    const rateLimit = await consumeRateLimit(supabase, {
      scope: "duel-matchmaking",
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

    const rawBody = await readJsonObject(req, { maxBytes: 4 * 1024 });
    const body: MatchmakingBody = {
      topicCategoryKey: normalizeCategoryKey(
        getString(rawBody, "topicCategoryKey", {
          maxLength: 80,
        }) ?? undefined
      ),
      topicDifficulty: getEnum(
        rawBody,
        "topicDifficulty",
        ["beginner", "intermediate", "advanced"] as const,
        { defaultValue: "beginner" }
      ),
      practiceLanguage: getEnum(
        rawBody,
        "practiceLanguage",
        ["en", "vi"] as const,
        { defaultValue: "en" }
      ) as PracticeLanguage,
      prepTimeSeconds: getNumber(rawBody, "prepTimeSeconds"),
      openingTimeSeconds: getNumber(rawBody, "openingTimeSeconds"),
      rebuttalTimeSeconds: getNumber(rawBody, "rebuttalTimeSeconds"),
    };
    const practiceLanguage = body.practiceLanguage ?? "en";
    const topicCategoryKey = normalizeCategoryKey(body.topicCategoryKey);
    const topicDifficulty = normalizeDifficulty(body.topicDifficulty);
    const topic = getLocalizedTopic(
      pickTopic(topicCategoryKey, topicDifficulty),
      practiceLanguage
    );
    const ticket = await enterDebateDuelMatchmaking(user.id, {
      topicCategory: topic.category || getCategoryLabel(topicCategoryKey, practiceLanguage),
      topicCategoryKey,
      topicDifficulty,
      topicKey: getTopicStableKey(topic),
      topicTitle: topic.title,
      topicDescription: topic.context ?? "",
      practiceLanguage,
      prepTimeSeconds: clampDurationSeconds(
        body.prepTimeSeconds,
        DUEL_PREP_DURATION
      ),
      openingTimeSeconds: clampDurationSeconds(
        body.openingTimeSeconds,
        DUEL_OPENING_DURATION
      ),
      rebuttalTimeSeconds: clampDurationSeconds(
        body.rebuttalTimeSeconds,
        DUEL_REBUTTAL_DURATION
      ),
    });

    return NextResponse.json({ ticket });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Failed to enter matchmaking.";
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, error } = await getAdminUser();
    if (error || !user) return error;

    const rateLimit = await consumeRateLimit(supabase, {
      scope: "duel-matchmaking-cancel",
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

    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get("id");
    if (ticketId && !isUuid(ticketId)) {
      return NextResponse.json({ error: "Ticket id is invalid." }, { status: 400 });
    }
    const currentTicket = ticketId
      ? null
      : await getCurrentDebateDuelMatchmakingTicket(user.id);
    const resolvedTicketId = ticketId ?? currentTicket?.id;

    if (!resolvedTicketId) {
      return NextResponse.json({ ticket: null });
    }

    const ticket = await cancelDebateDuelMatchmaking(resolvedTicketId, user.id);
    return NextResponse.json({ ticket });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to cancel matchmaking.";
    const status = message.includes("TICKET_NOT_FOUND") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
