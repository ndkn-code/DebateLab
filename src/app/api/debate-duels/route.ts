import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDebateDuelRoom, getDebateDuelRoom } from "@/lib/api/debate-duels";
import { isAdminUser } from "@/lib/auth/admin";

function boundedSeconds(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

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

    const body = (await req.json()) as {
      topicTitle?: string;
      topicCategory?: string;
      topicDescription?: string;
      topicDifficulty?: "beginner" | "intermediate" | "advanced";
      prepTimeSeconds?: number;
      openingTimeSeconds?: number;
      rebuttalTimeSeconds?: number;
      sideAssignmentMode?: "random" | "choose";
      creatorSidePreference?: "proposition" | "opposition" | null;
    };

    if (!body.topicTitle?.trim()) {
      return NextResponse.json(
        { error: "Topic title is required." },
        { status: 400 }
      );
    }

    const topicDifficulty =
      body.topicDifficulty === "intermediate" ||
      body.topicDifficulty === "advanced"
        ? body.topicDifficulty
        : "beginner";
    const sideAssignmentMode =
      body.sideAssignmentMode === "choose" ? "choose" : "random";
    const creatorSidePreference =
      body.creatorSidePreference === "opposition"
        ? "opposition"
        : "proposition";

    const shareCode = await createDebateDuelRoom(user.id, {
      topicTitle: body.topicTitle.trim(),
      topicCategory: body.topicCategory?.trim() || "Open",
      topicDifficulty,
      topicDescription: body.topicDescription?.trim() || undefined,
      prepTimeSeconds: boundedSeconds(body.prepTimeSeconds, 120, 60, 180),
      openingTimeSeconds: boundedSeconds(body.openingTimeSeconds, 180, 120, 240),
      rebuttalTimeSeconds: boundedSeconds(body.rebuttalTimeSeconds, 120, 60, 120),
      sideAssignmentMode,
      creatorSidePreference:
        sideAssignmentMode === "choose" ? creatorSidePreference : null,
    });

    const room = await getDebateDuelRoom(shareCode, user.id);

    return NextResponse.json({ shareCode, room });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create duel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
