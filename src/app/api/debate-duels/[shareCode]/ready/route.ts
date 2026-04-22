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
    const message =
      error instanceof Error ? error.message : "Failed to update ready state.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
