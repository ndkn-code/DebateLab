import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import {
  cancelDebateDuelMatchmaking,
  enterDebateDuelMatchmaking,
  getCurrentDebateDuelMatchmakingTicket,
} from "@/lib/api/debate-duels";
import { CATEGORIES, topics, type Category } from "@/lib/topics";
import {
  DUEL_OPENING_DURATION,
  DUEL_PREP_DURATION,
  DUEL_REBUTTAL_DURATION,
  clampDurationSeconds,
} from "@/lib/practice-durations";
import type { DebateDuelTopicDifficulty } from "@/types";

type MatchmakingBody = {
  topicCategory?: string;
  topicDifficulty?: DebateDuelTopicDifficulty;
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

function normalizeCategory(category: string | undefined): Category {
  if (CATEGORIES.includes(category as Category)) {
    return category as Category;
  }
  return CATEGORIES[0];
}

function pickTopic(category: Category, difficulty: DebateDuelTopicDifficulty) {
  const exact = topics.filter(
    (topic) => topic.category === category && topic.difficulty === difficulty
  );
  const categoryFallback = topics.filter((topic) => topic.category === category);
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
    const { user, error } = await getAdminUser();
    if (error || !user) return error;

    const body = (await req.json()) as MatchmakingBody;
    const topicCategory = normalizeCategory(body.topicCategory);
    const topicDifficulty = normalizeDifficulty(body.topicDifficulty);
    const topic = pickTopic(topicCategory, topicDifficulty);
    const ticket = await enterDebateDuelMatchmaking(user.id, {
      topicCategory,
      topicDifficulty,
      topicTitle: topic.title,
      topicDescription: topic.context ?? "",
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
    const message =
      error instanceof Error ? error.message : "Failed to enter matchmaking.";
    const status = message.includes("FORBIDDEN") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, error } = await getAdminUser();
    if (error || !user) return error;

    const { searchParams } = new URL(req.url);
    const ticketId = searchParams.get("id");
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
