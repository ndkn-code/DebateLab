import type { AnalyticsPageData, AnalyticsRangePreset } from "@/types";
import {
  ANALYTICS_FEATURE_AREAS,
  getRangeWindow,
  type AnalyticsFeatureArea,
} from "@/lib/analytics/events";
import type { EntitlementSource, PlanType } from "@/lib/entitlements";

export interface AdminAnalyticsUser {
  id: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  role: "student" | "teacher" | "admin";
  level: number;
  xp: number;
  orbBalance: number;
  createdAt: string;
}

export interface AdminAnalyticsEntitlement {
  planType: PlanType;
  source: EntitlementSource;
  hasPremiumAccess: boolean;
  hasEnterpriseAccess: boolean;
  reason: string;
  betaAllAccess: boolean;
  activeSubscriptionId: string | null;
}

export interface AdminAnalyticsRawEvent {
  id: string;
  eventName: string;
  featureArea: AnalyticsFeatureArea;
  route: string | null;
  durationMs: number | null;
  occurredAt: string;
  source: string;
  metadata: Record<string, unknown>;
}

export interface AdminAnalyticsTrendPoint {
  date: string;
  label: string;
  events: number;
  activeMinutes: number;
  practiceMinutes: number;
  sessionsCompleted: number;
}

export interface AdminFeatureAdoption {
  featureArea: AnalyticsFeatureArea;
  totalEvents: number;
  activeDays: number;
  lastSeenAt: string | null;
}

export interface AdminCourseProgress {
  courseId: string;
  title: string;
  visibility: string | null;
  status: string;
  progressPercent: number;
  enrolledAt: string | null;
  completedAt: string | null;
  lastActivityAt: string | null;
}

export interface AdminClassMembershipSummary {
  classId: string;
  code: string;
  title: string;
  status: string;
  memberRole: string;
  attendanceRate30d: number | null;
}

export interface AdminModuleProgress {
  courseId: string;
  moduleId: string;
  title: string;
  accessLevel: string | null;
  sortOrder: number;
  totalActivities: number;
  completedActivities: number;
  lastCompletedAt: string | null;
}

export interface AdminAnalyticsKpis {
  activeDays: number;
  trackedEvents: number;
  practiceMinutes: number;
  sessionsCompleted: number;
  averageScore: number | null;
  aiFeedbackCalls: number;
  completionRate: number;
}

export interface AdminAiInsightCard {
  id: string;
  title: string;
  body: string;
  priority: "low" | "medium" | "high";
  tone: "blue" | "green" | "amber" | "slate";
}

export interface AdminAiInsights {
  cards: AdminAiInsightCard[];
  generatedAt: string;
  cached: boolean;
  model: string | null;
  fallback: boolean;
}

export interface AdminUserAnalyticsProfile {
  range: AnalyticsRangePreset;
  user: AdminAnalyticsUser;
  entitlement: AdminAnalyticsEntitlement;
  base: AnalyticsPageData;
  kpis: AdminAnalyticsKpis;
  trend: AdminAnalyticsTrendPoint[];
  featureAdoption: AdminFeatureAdoption[];
  classMemberships: AdminClassMembershipSummary[];
  courseProgress: AdminCourseProgress[];
  moduleProgress: AdminModuleProgress[];
  rawEvents: AdminAnalyticsRawEvent[];
  insights: AdminAiInsights;
  dormantModules: {
    revenue: boolean;
    acquisition: boolean;
    social: boolean;
  };
}

export interface DailyStatLike {
  date: string;
  minutes_studied?: number | null;
  practice_minutes?: number | null;
  sessions_completed?: number | null;
  average_score?: number | null;
}

export function normalizeAdminAnalyticsRange(value?: string | null): AnalyticsRangePreset {
  return value === "7d" || value === "90d" ? value : "30d";
}

export function buildAdminTrend(
  range: AnalyticsRangePreset,
  events: AdminAnalyticsRawEvent[],
  dailyStats: DailyStatLike[],
  now = new Date()
): AdminAnalyticsTrendPoint[] {
  const { days, start } = getRangeWindow(range, now);
  const byDate = new Map<string, AdminAnalyticsTrendPoint>();

  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    byDate.set(key, {
      date: key,
      label: new Intl.DateTimeFormat("en", {
        month: "short",
        day: "numeric",
      }).format(date),
      events: 0,
      activeMinutes: 0,
      practiceMinutes: 0,
      sessionsCompleted: 0,
    });
  }

  for (const stat of dailyStats) {
    const point = byDate.get(stat.date);
    if (!point) continue;
    point.practiceMinutes += stat.minutes_studied ?? stat.practice_minutes ?? 0;
    point.sessionsCompleted += stat.sessions_completed ?? 0;
  }

  for (const event of events) {
    const key = event.occurredAt.slice(0, 10);
    const point = byDate.get(key);
    if (!point) continue;
    point.events += 1;
    point.activeMinutes += Math.round((event.durationMs ?? 0) / 60000);
  }

  return Array.from(byDate.values());
}

export function buildFeatureAdoption(events: AdminAnalyticsRawEvent[]): AdminFeatureAdoption[] {
  const byFeature = new Map<
    AnalyticsFeatureArea,
    { totalEvents: number; days: Set<string>; lastSeenAt: string | null }
  >();

  for (const featureArea of ANALYTICS_FEATURE_AREAS) {
    byFeature.set(featureArea, {
      totalEvents: 0,
      days: new Set<string>(),
      lastSeenAt: null,
    });
  }

  for (const event of events) {
    const entry = byFeature.get(event.featureArea);
    if (!entry) continue;
    entry.totalEvents += 1;
    entry.days.add(event.occurredAt.slice(0, 10));
    if (!entry.lastSeenAt || event.occurredAt > entry.lastSeenAt) {
      entry.lastSeenAt = event.occurredAt;
    }
  }

  return Array.from(byFeature.entries())
    .map(([featureArea, entry]) => ({
      featureArea,
      totalEvents: entry.totalEvents,
      activeDays: entry.days.size,
      lastSeenAt: entry.lastSeenAt,
    }))
    .sort((left, right) => right.totalEvents - left.totalEvents);
}

export function buildAdminKpis(params: {
  events: AdminAnalyticsRawEvent[];
  dailyStats: DailyStatLike[];
  courseProgress: AdminCourseProgress[];
  aiUsageCount: number;
}): AdminAnalyticsKpis {
  const activeDays = new Set([
    ...params.events.map((event) => event.occurredAt.slice(0, 10)),
    ...params.dailyStats
      .filter((stat) => (stat.sessions_completed ?? 0) > 0 || (stat.minutes_studied ?? stat.practice_minutes ?? 0) > 0)
      .map((stat) => stat.date),
  ]).size;
  const practiceMinutes = params.dailyStats.reduce(
    (total, stat) => total + (stat.minutes_studied ?? stat.practice_minutes ?? 0),
    0
  );
  const sessionsCompleted = params.dailyStats.reduce(
    (total, stat) => total + (stat.sessions_completed ?? 0),
    0
  );
  const scoreRows = params.dailyStats.filter((stat) => stat.average_score != null);
  const averageScore =
    scoreRows.length > 0
      ? Math.round(
          (scoreRows.reduce((total, stat) => total + (stat.average_score ?? 0), 0) /
            scoreRows.length) *
            10
        ) / 10
      : null;
  const completionRate =
    params.courseProgress.length > 0
      ? Math.round(
          params.courseProgress.reduce(
            (total, course) => total + course.progressPercent,
            0
          ) / params.courseProgress.length
        )
      : 0;

  return {
    activeDays,
    trackedEvents: params.events.length,
    practiceMinutes,
    sessionsCompleted,
    averageScore,
    aiFeedbackCalls:
      params.aiUsageCount +
      params.events.filter((event) => event.featureArea === "ai_feedback").length,
    completionRate,
  };
}

export function parseAdminInsightJson(value: string): AdminAiInsightCard[] {
  const parsed = JSON.parse(value) as unknown;
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("insights" in parsed) ||
    !Array.isArray((parsed as { insights?: unknown }).insights)
  ) {
    throw new Error("Invalid insight JSON");
  }

  return (parsed as { insights: unknown[] }).insights.slice(0, 3).map((item, index) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("Invalid insight item");
    }
    const candidate = item as Partial<AdminAiInsightCard>;
    const priority =
      candidate.priority === "high" || candidate.priority === "low"
        ? candidate.priority
        : "medium";
    const tone =
      candidate.tone === "green" ||
      candidate.tone === "amber" ||
      candidate.tone === "slate"
        ? candidate.tone
        : "blue";

    return {
      id: candidate.id || `insight-${index + 1}`,
      title: String(candidate.title || "User insight").slice(0, 90),
      body: String(candidate.body || "No insight body was returned.").slice(0, 320),
      priority,
      tone,
    };
  });
}

export function buildFallbackInsights(params: {
  displayName: string;
  kpis: AdminAnalyticsKpis;
  featureAdoption: AdminFeatureAdoption[];
}): AdminAiInsightCard[] {
  const topFeature = params.featureAdoption.find((feature) => feature.totalEvents > 0);
  const name = params.displayName || "This user";

  return [
    {
      id: "fallback-engagement",
      title: params.kpis.activeDays > 0 ? "Engagement is measurable" : "No tracked activity yet",
      body:
        params.kpis.activeDays > 0
          ? `${name} was active on ${params.kpis.activeDays} day(s) in this range, with ${params.kpis.trackedEvents} tracked event(s).`
          : `${name} has no Supabase analytics events in this range yet, so product-table progress is the best current signal.`,
      priority: params.kpis.activeDays > 0 ? "medium" : "high",
      tone: params.kpis.activeDays > 0 ? "green" : "amber",
    },
    {
      id: "fallback-feature",
      title: topFeature ? "Top feature area" : "Feature adoption is still empty",
      body: topFeature
        ? `${topFeature.featureArea.replace(/_/g, " ")} is currently the most-used feature area with ${topFeature.totalEvents} event(s).`
        : "Feature adoption charts will populate as page views and product events are recorded.",
      priority: "medium",
      tone: "blue",
    },
    {
      id: "fallback-course",
      title: "Course completion signal",
      body: `Average course progress is ${params.kpis.completionRate}%, with ${params.kpis.sessionsCompleted} completed practice session(s) in the selected range.`,
      priority: params.kpis.completionRate < 30 ? "high" : "low",
      tone: params.kpis.completionRate < 30 ? "amber" : "slate",
    },
  ];
}
