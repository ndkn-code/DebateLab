import { NextRequest, NextResponse } from "next/server";
import { getDebateDuelResult } from "@/lib/api/debate-duels";
import { canAccessDuels } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ shareCode: string }> }
) {
  try {
    const auth = await requireRequestAuth(req, { allowDevBypass: false });

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const { supabase, user } = auth;
    if (!(await canAccessDuels(supabase, user.id))) {
      return NextResponse.json(
        { error: "1v1 Debate is coming soon." },
        { status: 403 }
      );
    }

    const { shareCode } = await context.params;
    const room = await getDebateDuelResult(shareCode, user.id);

    if (!room) {
      return NextResponse.json({ error: "Duel result not found." }, { status: 404 });
    }

    return NextResponse.json(room);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load duel result.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
