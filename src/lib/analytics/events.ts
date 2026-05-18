export const ANALYTICS_EVENT_NAMES = [
  "page_view",
  "page_leave",
  "course_started",
  "module_viewed",
  "activity_started",
  "activity_completed",
  "practice_completed",
  "duel_completed",
  "ai_feedback_requested",
  "ai_feedback_completed",
  "web_vital_recorded",
  "admin_grant_created",
  "admin_grant_cancelled",
  "club_assignment_created",
  "club_assignment_started",
  "club_assignment_submitted",
  "club_review_created",
  "popup_impression",
  "popup_dismissed",
  "popup_cta_clicked",
  "popup_dont_show_again",
  "popup_survey_started",
  "popup_survey_submitted",
  "popup_survey_abandoned",
] as const;

export const ANALYTICS_FEATURE_AREAS = [
  "courses",
  "activities",
  "practice",
  "duels",
  "ai_feedback",
  "admin",
  "clubs",
  "profile",
  "notifications",
] as const;

export const ANALYTICS_SOURCES = ["web", "server", "admin", "system"] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENT_NAMES)[number];
export type AnalyticsFeatureArea = (typeof ANALYTICS_FEATURE_AREAS)[number];
export type AnalyticsEventSource = (typeof ANALYTICS_SOURCES)[number];

export interface AnalyticsEventInput {
  eventName?: string;
  event_name?: string;
  featureArea?: string;
  feature_area?: string;
  route?: string | null;
  durationMs?: number | null;
  duration_ms?: number | null;
  sessionId?: string | null;
  session_id?: string | null;
  occurredAt?: string | null;
  occurred_at?: string | null;
  metadata?: unknown;
  source?: string;
}

export interface NormalizedAnalyticsEvent {
  eventName: AnalyticsEventName;
  featureArea: AnalyticsFeatureArea;
  route: string | null;
  durationMs: number | null;
  sessionId: string | null;
  occurredAt: string | null;
  metadata: Record<string, unknown>;
  source: AnalyticsEventSource;
}

const EVENT_NAME_SET = new Set<string>(ANALYTICS_EVENT_NAMES);
const FEATURE_AREA_SET = new Set<string>(ANALYTICS_FEATURE_AREAS);
const SOURCE_SET = new Set<string>(ANALYTICS_SOURCES);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimRoute(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

function normalizeDuration(value: number | null | undefined) {
  if (value == null) return null;
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

function normalizeSessionId(value: string | null | undefined) {
  if (!value) return null;
  return UUID_PATTERN.test(value) ? value : null;
}

function normalizeOccurredAt(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

export function inferFeatureAreaFromRoute(route: string | null | undefined): AnalyticsFeatureArea {
  const pathname = (route ?? "").toLowerCase();

  if (pathname.includes("/dashboard/admin/clubs")) return "clubs";
  if (pathname.includes("/dashboard/admin")) return "admin";
  if (pathname.includes("/notifications") || pathname.includes("/smart-popups")) return "notifications";
  if (pathname.includes("/activity/")) return "activities";
  if (pathname.includes("/courses")) return "courses";
  if (pathname.endsWith("/dashboard") || pathname.includes("/dashboard?")) return "profile";
  if (pathname.includes("/practice") || pathname.includes("/history")) return "practice";
  if (pathname.includes("/debates") || pathname.includes("/duel")) return "duels";
  if (pathname.includes("/profile") || pathname.includes("/settings")) return "profile";
  return "practice";
}

export function normalizeAnalyticsEventInput(
  input: AnalyticsEventInput,
  defaults: Partial<Pick<NormalizedAnalyticsEvent, "source" | "featureArea">> = {}
): NormalizedAnalyticsEvent {
  const rawEventName = input.eventName ?? input.event_name;
  if (!rawEventName || !EVENT_NAME_SET.has(rawEventName)) {
    throw new Error("Invalid analytics event name");
  }

  const route = trimRoute(input.route);
  const rawFeatureArea =
    input.featureArea ?? input.feature_area ?? defaults.featureArea ?? inferFeatureAreaFromRoute(route);
  if (!FEATURE_AREA_SET.has(rawFeatureArea)) {
    throw new Error("Invalid analytics feature area");
  }

  const rawSource = input.source ?? defaults.source ?? "web";
  if (!SOURCE_SET.has(rawSource)) {
    throw new Error("Invalid analytics event source");
  }

  const metadata = isObjectRecord(input.metadata) ? input.metadata : {};

  return {
    eventName: rawEventName as AnalyticsEventName,
    featureArea: rawFeatureArea as AnalyticsFeatureArea,
    route,
    durationMs: normalizeDuration(input.durationMs ?? input.duration_ms),
    sessionId: normalizeSessionId(input.sessionId ?? input.session_id),
    occurredAt: normalizeOccurredAt(input.occurredAt ?? input.occurred_at),
    metadata,
    source: rawSource as AnalyticsEventSource,
  };
}

export function getRangeDays(range: "7d" | "30d" | "90d") {
  if (range === "7d") return 7;
  if (range === "90d") return 90;
  return 30;
}

export function getRangeWindow(range: "7d" | "30d" | "90d", now = new Date()) {
  const days = getRangeDays(range);
  const start = new Date(now);
  start.setDate(now.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const previousStart = new Date(start);
  previousStart.setDate(start.getDate() - days);

  return {
    days,
    start,
    previousStart,
    startIso: start.toISOString(),
    previousStartIso: previousStart.toISOString(),
    startDate: start.toISOString().slice(0, 10),
    previousStartDate: previousStart.toISOString().slice(0, 10),
  };
}
