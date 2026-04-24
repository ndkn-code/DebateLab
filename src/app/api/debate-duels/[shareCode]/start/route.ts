import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startDebateDuelRoom } from "@/lib/api/debate-duels";
import { isAdminUser } from "@/lib/auth/admin";

export async function POST(
  _req: NextRequest,
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

    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json(
        { error: "1v1 Debate is coming soon." },
        { status: 403 }
      );
    }

    const { shareCode } = await context.params;
    const room = await startDebateDuelRoom(shareCode, user.id);

    return NextResponse.json(room);
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : "Failed to start duel.";

    let message = rawMessage;
    let status = 500;

    if (rawMessage.includes("INSUFFICIENT_CREDITS")) {
      message = "Both debaters need at least 200 Credits to start this duel.";
      status = 400;
    } else if (rawMessage.includes("FORBIDDEN")) {
      message = "You are not allowed to start as another user.";
      status = 403;
    } else if (rawMessage.includes("DUEL_CREATOR_REQUIRED")) {
      message = "Only the room creator can start this duel.";
      status = 403;
    } else if (rawMessage.includes("DUEL_NOT_READY")) {
      message = "Both debaters need to mark ready before the duel can start.";
      status = 400;
    } else if (rawMessage.includes("DUEL_REQUIRES_TWO_PARTICIPANTS")) {
      message = "A second debater needs to join before the duel can start.";
      status = 400;
    } else if (rawMessage.includes("DUEL_EXPIRED")) {
      message = "This duel room has expired.";
      status = 410;
    } else if (rawMessage.includes("DUEL_ALREADY_STARTED")) {
      message = "This duel has already started.";
      status = 409;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
