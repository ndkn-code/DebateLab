import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { submitDebateDuelSpeech } from "@/lib/api/debate-duels";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ shareCode: string; roundNumber: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as {
      transcript?: string;
      durationSeconds?: number;
      audioStoragePath?: string | null;
      metadata?: Record<string, unknown>;
    };
    const { shareCode, roundNumber } = await context.params;

    const room = await submitDebateDuelSpeech({
      shareCode,
      userId: user.id,
      roundNumber: Number(roundNumber),
      transcript: body.transcript?.trim() || "[No transcript captured]",
      durationSeconds: body.durationSeconds ?? 0,
      audioStoragePath: body.audioStoragePath ?? null,
      metadata: body.metadata,
    });

    return NextResponse.json(room);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit speech.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
