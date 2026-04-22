import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { joinDebateDuelRoom } from "@/lib/api/debate-duels";

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

    const { shareCode } = await context.params;
    const room = await joinDebateDuelRoom(shareCode, user.id);

    return NextResponse.json(room);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to join duel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
