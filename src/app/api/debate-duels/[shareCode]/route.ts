import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDebateDuelRoom } from "@/lib/api/debate-duels";
import { isAdminUser } from "@/lib/auth/admin";

export async function GET(
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
    const room = await getDebateDuelRoom(shareCode, user.id);

    if (!room) {
      return NextResponse.json({ error: "Duel room not found." }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load duel room.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
