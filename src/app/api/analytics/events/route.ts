import { NextRequest, NextResponse } from "next/server";
import { normalizeAnalyticsEventInput } from "@/lib/analytics/events";
import { createClient } from "@/lib/supabase/server";
import { consumeRateLimit } from "@/lib/rate-limit";
import { RequestValidationError, readJsonObject } from "@/lib/api/request-validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit(supabase, {
    scope: "analytics-events",
    limit: 120,
    windowSeconds: 60,
  });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  let event;
  try {
    const body = await readJsonObject(request, { maxBytes: 12 * 1024 });
    event = normalizeAnalyticsEventInput(
      { ...body, source: "web" },
      { source: "web" }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Invalid analytics event",
      },
      { status: error instanceof RequestValidationError ? error.status : 400 }
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
