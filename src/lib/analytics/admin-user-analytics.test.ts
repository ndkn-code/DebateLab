import assert from "node:assert/strict";
import {
  inferFeatureAreaFromRoute,
  normalizeAnalyticsEventInput,
} from "@/lib/analytics/events";
import {
  buildAdminKpis,
  buildAdminTrend,
  buildFallbackInsights,
  buildFeatureAdoption,
  normalizeAdminAnalyticsRange,
  parseAdminInsightJson,
  type AdminAnalyticsRawEvent,
  type DailyStatLike,
} from "@/lib/analytics/admin-user-analytics-model";

const now = new Date("2026-05-06T12:00:00.000Z");

const events: AdminAnalyticsRawEvent[] = [
  {
    id: "event-1",
    eventName: "page_view",
    featureArea: "courses",
    route: "/dashboard/courses/abc",
    durationMs: 60000,
    occurredAt: "2026-05-06T10:00:00.000Z",
    source: "web",
    metadata: {},
  },
  {
    id: "event-2",
    eventName: "ai_feedback_completed",
    featureArea: "ai_feedback",
    route: "/practice/feedback",
    durationMs: null,
    occurredAt: "2026-05-05T10:00:00.000Z",
    source: "server",
    metadata: {},
  },
];

const dailyStats: DailyStatLike[] = [
  {
    date: "2026-05-05",
    minutes_studied: 24,
    sessions_completed: 1,
    average_score: 82,
  },
  {
    date: "2026-05-06",
    minutes_studied: 36,
    sessions_completed: 2,
    average_score: 88,
  },
];

assert.equal(normalizeAdminAnalyticsRange("7d"), "7d");
assert.equal(normalizeAdminAnalyticsRange("bogus"), "30d");
assert.equal(inferFeatureAreaFromRoute("/dashboard/courses/1/activity/2"), "activities");
assert.equal(inferFeatureAreaFromRoute("/dashboard/admin/users"), "admin");

const normalized = normalizeAnalyticsEventInput({
  eventName: "page_leave",
  route: "/dashboard/courses",
  durationMs: 1200.4,
  sessionId: "00000000-0000-4000-8000-000000000001",
  metadata: { ok: true },
});
assert.equal(normalized.eventName, "page_leave");
assert.equal(normalized.featureArea, "courses");
assert.equal(normalized.durationMs, 1200);

assert.throws(
  () => normalizeAnalyticsEventInput({ eventName: "freeform", featureArea: "courses" }),
  /Invalid analytics event name/
);

const trend = buildAdminTrend("7d", events, dailyStats, now);
assert.equal(trend.length, 7);
assert.equal(trend.at(-1)?.events, 1);
assert.equal(trend.at(-1)?.practiceMinutes, 36);

const features = buildFeatureAdoption(events);
assert.equal(features[0].featureArea, "courses");
assert.equal(features[0].totalEvents, 1);
assert.ok(features.some((feature) => feature.featureArea === "admin"));

const kpis = buildAdminKpis({
  events,
  dailyStats,
  courseProgress: [
    {
      courseId: "course-1",
      title: "Foundations",
      visibility: "premium",
      status: "active",
      progressPercent: 80,
      enrolledAt: null,
      completedAt: null,
      lastActivityAt: null,
    },
  ],
  aiUsageCount: 1,
});
assert.equal(kpis.activeDays, 2);
assert.equal(kpis.practiceMinutes, 60);
assert.equal(kpis.sessionsCompleted, 3);
assert.equal(kpis.averageScore, 85);
assert.equal(kpis.aiFeedbackCalls, 2);
assert.equal(kpis.completionRate, 80);

const parsedInsights = parseAdminInsightJson(
  JSON.stringify({
    insights: [
      {
        title: "Momentum",
        body: "The user is progressing.",
        priority: "high",
        tone: "green",
      },
    ],
  })
);
assert.equal(parsedInsights[0].title, "Momentum");
assert.equal(parsedInsights[0].priority, "high");

const fallback = buildFallbackInsights({
  displayName: "Ava",
  kpis,
  featureAdoption: features,
});
assert.equal(fallback.length, 3);
assert.match(fallback[0].body, /Ava/);

console.log("admin analytics tests passed");
