import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDebateDuelHistory } from "@/lib/api/debate-duels";

function buildFileName() {
  const date = new Date().toISOString().slice(0, 10);
  return `debatelab-history-${date}.json`;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [sessionsResult, duelHistory] = await Promise.all([
    supabase
      .from("debate_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    getDebateDuelHistory(user.id),
  ]);

  if (sessionsResult.error) {
    return NextResponse.json(
      { error: sessionsResult.error.message },
      { status: 500 }
    );
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    userId: user.id,
    email: user.email ?? null,
    soloPracticeSessions: sessionsResult.data ?? [],
    duelHistory,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${buildFileName()}"`,
      "Cache-Control": "no-store",
    },
  });
}
