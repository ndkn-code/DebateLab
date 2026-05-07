import { NextRequest, NextResponse } from "next/server";
import { normalizeAnalyticsEventInput } from "@/lib/analytics/events";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let event;
  try {
    event = normalizeAnalyticsEventInput(await request.json(), { source: "web" });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid analytics event",
      },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("analytics_events").insert({
    user_id: user.id,
    session_id: event.sessionId,
    event_name: event.eventName,
    feature_area: event.featureArea,
    route: event.route,
    duration_ms: event.durationMs,
    occurred_at: event.occurredAt ?? new Date().toISOString(),
    metadata: event.metadata,
    source: event.source,
  });

  if (error) {
    return NextResponse.json({ error: "Unable to record analytics event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
