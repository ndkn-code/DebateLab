import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDebateDuelHistory } from "@/lib/api/debate-duels";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const history = await getDebateDuelHistory(user.id);
    return NextResponse.json(history);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load duel history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
