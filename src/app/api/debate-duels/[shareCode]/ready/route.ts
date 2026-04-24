import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { setDebateDuelReady } from "@/lib/api/debate-duels";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ shareCode: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { ready?: boolean };
    const { shareCode } = await context.params;
    const room = await setDebateDuelReady(
      shareCode,
      user.id,
      body.ready ?? true
    );

    return NextResponse.json(room);
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Failed to update ready state.";

    let message = rawMessage;
    let status = 400;

    if (rawMessage.includes("FORBIDDEN")) {
      message = "You are not allowed to update ready state as another user.";
      status = 403;
    } else if (rawMessage.includes("DUEL_NOT_FOUND")) {
      message = "Duel room not found.";
      status = 404;
    } else if (rawMessage.includes("DUEL_ALREADY_STARTED")) {
      message = "This duel has already started.";
      status = 409;
    } else if (rawMessage.includes("DUEL_EXPIRED")) {
      message = "This duel room has expired.";
      status = 410;
    } else if (rawMessage.includes("DUEL_JOIN_REQUIRED")) {
      message = "Join the duel before marking ready.";
      status = 403;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
