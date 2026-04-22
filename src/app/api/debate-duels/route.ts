import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createDebateDuelRoom } from "@/lib/api/debate-duels";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      topicTitle?: string;
      topicCategory?: string;
      topicDescription?: string;
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

    const shareCode = await createDebateDuelRoom(user.id, {
      topicTitle: body.topicTitle.trim(),
      topicCategory: body.topicCategory?.trim() || "Open",
      topicDescription: body.topicDescription?.trim() || undefined,
      prepTimeSeconds: body.prepTimeSeconds ?? 120,
      openingTimeSeconds: body.openingTimeSeconds ?? 180,
      rebuttalTimeSeconds: body.rebuttalTimeSeconds ?? 120,
      sideAssignmentMode: body.sideAssignmentMode ?? "random",
      creatorSidePreference: body.creatorSidePreference ?? null,
    });

    return NextResponse.json({ shareCode });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create duel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
