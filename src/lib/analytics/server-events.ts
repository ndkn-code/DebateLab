import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeAnalyticsEventInput,
  type AnalyticsEventInput,
  type AnalyticsEventSource,
} from "@/lib/analytics/events";

export async function recordAnalyticsEvent(
  supabase: SupabaseClient,
  userId: string,
  input: AnalyticsEventInput,
  source: AnalyticsEventSource = "server"
) {
  try {
    const event = normalizeAnalyticsEventInput({ ...input, source }, { source });
    const { error } = await supabase.from("analytics_events").insert({
      user_id: userId,
      session_id: event.sessionId,
      event_name: event.eventName,
      feature_area: event.featureArea,
      route: event.route,
      duration_ms: event.durationMs,
      occurred_at: event.occurredAt ?? new Date().toISOString(),
      metadata: event.metadata,
      source: event.source,
    });

    if (error && process.env.NODE_ENV === "development") {
      console.warn("Analytics event insert failed:", error.message);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Analytics event skipped:",
        error instanceof Error ? error.message : error
      );
    }
  }
}
