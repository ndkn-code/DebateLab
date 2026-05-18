import "server-only";

import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { getAnalyticsPageData } from "@/lib/api/analytics-page";
import {
  buildAdminKpis,
  buildAdminTrend,
  buildFallbackInsights,
  buildFeatureAdoption,
  normalizeAdminAnalyticsRange,
  parseAdminInsightJson,
  type AdminAiInsights,
  type AdminAnalyticsRawEvent,
  type AdminClassMembershipSummary,
  type AdminCourseProgress,
  type AdminModuleProgress,
  type AdminUserAnalyticsProfile,
  type DailyStatLike,
} from "@/lib/analytics/admin-user-analytics-model";
import { getRangeWindow, type AnalyticsFeatureArea } from "@/lib/analytics/events";
import {
  isBetaAllAccessEnabled,
  resolveEntitlementFromSubscriptions,
  type SubscriptionRecord,
} from "@/lib/entitlements";
import { DEV_ADMIN_PROFILE, getDevAdminUsers, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import type { AnalyticsPageData, AnalyticsRangePreset, Profile } from "@/types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ProfileRow = Pick<
  Profile,
  | "id"
  | "email"
  | "display_name"
  | "avatar_url"
  | "role"
  | "level"
  | "xp"
  | "orb_balance"
  | "created_at"
>;

type RawEventRow = {
  id: string;
  event_name: string;
  feature_area: AnalyticsFeatureArea;
  route: string | null;
  duration_ms: number | null;
  occurred_at: string;
  source: string;
  metadata: Record<string, unknown> | null;
};

type CourseProgressRow = {
  course_id: string;
  course_title: string | null;
  visibility: string | null;
  status: string | null;
  progress_percent: number | null;
  enrolled_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
};

type ModuleProgressRow = {
  course_id: string;
  module_id: string;
  module_title: string | null;
  access_level: string | null;
  sort_order: number | null;
  total_activities: number | null;
  completed_activities: number | null;
  last_completed_at: string | null;
};

function emptyAnalyticsPageData(profile: ProfileRow, range: AnalyticsRangePreset): AnalyticsPageData {
  return {
    range,
    practiceLanguage: "en",
    hero: {
      displayName: profile.display_name || profile.email?.split("@")[0] || "Debater",
      avatarUrl: profile.avatar_url,
      title: null,
      level: profile.level ?? 1,
      xp: profile.xp ?? 0,
      xpInLevel: (profile.xp ?? 0) % 500,
      xpToNextLevel: 500,
      xpProgressPercent: Math.round((((profile.xp ?? 0) % 500) / 500) * 100),
      statusLine: "No practice analytics are available for this range yet.",
      streak: 0,
      totalSessions: 0,
      totalPracticeMinutes: 0,
    },
    skillSnapshot: {
      metrics: [],
      overallScore: null,
      strongestSkill: null,
      weakestSkill: null,
      sourceSessions: 0,
      confidence: 0,
      trackBreakdown: { debate: 0, speaking: 0 },
      difficultyBreakdown: {
        topic: { beginner: 0, intermediate: 0, advanced: 0 },
        ai: { easy: 0, medium: 0, hard: 0, none: 0 },
      },
      note: "Complete scored rounds to build a skill profile.",
    },
    insights: [
      { key: "practice-minutes", totalMinutes: 0, deltaPercent: null, series: [] },
      {
        key: "speaking-vs-debate",
        speakingCount: 0,
        debateCount: 0,
        speakingPercent: 0,
        debatePercent: 0,
      },
      {
        key: "recent-average-score",
        averageScore: null,
        deltaPoints: null,
        sessionsAnalyzed: 0,
        series: [],
      },
      {
        key: "strongest-focus",
        strongestSkill: null,
        strongestScore: null,
        focusSkill: null,
        focusScore: null,
      },
    ],
    recentSessions: [],
  };
}

async function verifyAdminAccess(supabase: SupabaseServerClient, adminId: string | null) {
  if (!adminId) {
    if (isDevAdminBypassEnabled()) return DEV_ADMIN_PROFILE.id;
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminId)
    .single();

  if (profile?.role === "admin" || isDevAdminBypassEnabled()) return adminId;
  throw new Error("Forbidden");
}

function isDevMockUserId(userId: string) {
  return isDevAdminBypassEnabled() && userId.startsWith("00000000-0000-4000-8000-");
}

function mapRawEvents(rows: RawEventRow[]): AdminAnalyticsRawEvent[] {
  return rows.map((row) => ({
    id: row.id,
    eventName: row.event_name,
    featureArea: row.feature_area,
    route: row.route,
    durationMs: row.duration_ms,
    occurredAt: row.occurred_at,
    source: row.source,
    metadata: row.metadata ?? {},
  }));
}

function mapCourseProgress(rows: CourseProgressRow[]): AdminCourseProgress[] {
  return rows.map((row) => ({
    courseId: row.course_id,
    title: row.course_title || "Untitled course",
    visibility: row.visibility,
    status: row.status || "active",
    progressPercent: row.progress_percent ?? 0,
    enrolledAt: row.enrolled_at,
    completedAt: row.completed_at,
    lastActivityAt: row.last_activity_at ?? row.completed_at ?? row.enrolled_at,
  }));
}

function mapModuleProgress(rows: ModuleProgressRow[]): AdminModuleProgress[] {
  return rows.map((row) => ({
    courseId: row.course_id,
    moduleId: row.module_id,
    title: row.module_title || "Untitled module",
    accessLevel: row.access_level,
    sortOrder: row.sort_order ?? 0,
    totalActivities: row.total_activities ?? 0,
    completedActivities: row.completed_activities ?? 0,
    lastCompletedAt: row.last_completed_at,
  }));
}

async function getUserClassMemberships(
  supabase: SupabaseServerClient,
  userId: string
): Promise<AdminClassMembershipSummary[]> {
  const { data: memberships, error } = await supabase
    .from("class_memberships")
    .select("class_id, member_role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error || !memberships?.length) return [];

  const classIds = memberships.map((membership) => membership.class_id as string);
  const { data: classRows, error: classError } = await supabase
    .from("admin_class_list_rows")
    .select("id, code, title, status, attendance_rate_30d")
    .in("id", classIds);

  if (classError || !classRows?.length) return [];

  const membershipByClassId = new Map(
    memberships.map((membership) => [
      membership.class_id as string,
      membership,
    ])
  );

  return classRows.map((row) => {
    const membership = membershipByClassId.get(row.id as string);
    return {
      classId: row.id as string,
      code: row.code as string,
      title: row.title as string,
      status: row.status as string,
      memberRole: String(membership?.member_role ?? "student"),
      attendanceRate30d: (row.attendance_rate_30d as number | null | undefined) ?? null,
    };
  });
}

function hashPayload(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

async function getCachedOrGeneratedInsights(params: {
  supabase: SupabaseServerClient;
  adminId: string;
  targetUserId: string;
  range: AnalyticsRangePreset;
  displayName: string;
  kpis: AdminUserAnalyticsProfile["kpis"];
  featureAdoption: AdminUserAnalyticsProfile["featureAdoption"];
  courseProgress: AdminUserAnalyticsProfile["courseProgress"];
  rawEvents: AdminUserAnalyticsProfile["rawEvents"];
}): Promise<AdminAiInsights> {
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const promptInput = {
    user: { displayName: params.displayName },
    range: params.range,
    kpis: params.kpis,
    featureAdoption: params.featureAdoption.slice(0, 7),
    courseProgress: params.courseProgress.slice(0, 6),
    recentEvents: params.rawEvents.slice(0, 12).map((event) => ({
      eventName: event.eventName,
      featureArea: event.featureArea,
      route: event.route,
      occurredAt: event.occurredAt,
    })),
  };
  const promptHash = hashPayload(promptInput);
  const cacheKey = `admin-user:${params.targetUserId}:${params.range}:${promptHash.slice(0, 24)}`;
  const now = new Date();

  const { data: cached } = await params.supabase
    .from("ai_insights_cache")
    .select("insights, model, created_at")
    .eq("cache_key", cacheKey)
    .gt("expires_at", now.toISOString())
    .maybeSingle();

  if (cached?.insights) {
    try {
      return {
        cards: parseAdminInsightJson(JSON.stringify(cached.insights)),
        generatedAt: cached.created_at ?? now.toISOString(),
        cached: true,
        model: cached.model ?? model,
        fallback: false,
      };
    } catch {
      // Fall through to fresh generation or fallback.
    }
  }

  const fallbackCards = buildFallbackInsights({
    displayName: params.displayName,
    kpis: params.kpis,
    featureAdoption: params.featureAdoption,
  });

  if (!process.env.GEMINI_API_KEY) {
    return {
      cards: fallbackCards,
      generatedAt: now.toISOString(),
      cached: false,
      model: null,
      fallback: true,
    };
  }

  const prompt = `You are DebateLab's admin analytics assistant. Return strict JSON only with this shape: {"insights":[{"id":"short-id","title":"short title","body":"one concise operational observation","priority":"low|medium|high","tone":"blue|green|amber|slate"}]}. Use at most 3 insights. Focus on coaching/admin action, risk, and progress. Data: ${JSON.stringify(promptInput)}`;
  const startedAt = Date.now();

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const geminiModel = genAI.getGenerativeModel({ model });
    const result = await geminiModel.generateContent(prompt);
    const text = result.response.text().trim();
    const normalizedText = text
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");
    const cards = parseAdminInsightJson(normalizedText);
    const outputTokens = estimateTokens(normalizedText);
    const inputTokens = estimateTokens(prompt);

    await params.supabase.from("api_usage").insert({
      user_id: params.targetUserId,
      service: "gemini_admin_insights",
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      duration_ms: Date.now() - startedAt,
      estimated_cost_usd: 0,
      metadata: {
        admin_id: params.adminId,
        range: params.range,
        cache_key: cacheKey,
      },
    });

    await params.supabase.from("ai_insights_cache").upsert(
      {
        cache_key: cacheKey,
        scope: "admin_user_analytics",
        target_user_id: params.targetUserId,
        range_key: params.range,
        model,
        prompt_hash: promptHash,
        insights: { insights: cards },
        expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        created_by: params.adminId,
        updated_at: now.toISOString(),
      },
      { onConflict: "cache_key" }
    );

    return {
      cards,
      generatedAt: now.toISOString(),
      cached: false,
      model,
      fallback: false,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Admin analytics Gemini insights fell back:",
        error instanceof Error ? error.message : error
      );
    }

    return {
      cards: fallbackCards,
      generatedAt: now.toISOString(),
      cached: false,
      model,
      fallback: true,
    };
  }
}

function buildMockProfile(targetUserId: string, range: AnalyticsRangePreset): AdminUserAnalyticsProfile {
  const user = getDevAdminUsers().find((item) => item.id === targetUserId) ?? getDevAdminUsers()[0];
  const profile: ProfileRow = {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    avatar_url: user.avatarUrl,
    role: user.role,
    level: user.level,
    xp: user.xp,
    orb_balance: user.orbBalance,
    created_at: user.createdAt,
  };
  const now = new Date("2026-05-06T12:00:00.000Z");
  const eventSeed: Array<{
    eventName: string;
    featureArea: AnalyticsFeatureArea;
    route: string;
    daysAgo: number;
    durationMs?: number;
  }> = [
    { eventName: "practice_completed", featureArea: "practice", route: "/practice/complete", daysAgo: 0, durationMs: 1914000 },
    { eventName: "ai_feedback_completed", featureArea: "ai_feedback", route: "/practice/rebuttal", daysAgo: 0 },
    { eventName: "module_viewed", featureArea: "courses", route: "/dashboard/courses/argument-building", daysAgo: 1, durationMs: 420000 },
    { eventName: "activity_completed", featureArea: "activities", route: "/dashboard/courses/argument-building/activity/claim", daysAgo: 1 },
    { eventName: "course_started", featureArea: "courses", route: "/dashboard/courses/advanced-rebuttals", daysAgo: 2 },
    { eventName: "duel_completed", featureArea: "duels", route: "/duels/weekend-cup", daysAgo: 3, durationMs: 2280000 },
    { eventName: "page_view", featureArea: "courses", route: "/dashboard/courses", daysAgo: 4, durationMs: 84000 },
    { eventName: "ai_feedback_requested", featureArea: "ai_feedback", route: "/practice/rebuttal", daysAgo: 4 },
    { eventName: "module_viewed", featureArea: "courses", route: "/dashboard/courses/fallacy-guide", daysAgo: 5 },
    { eventName: "practice_completed", featureArea: "practice", route: "/practice/topic", daysAgo: 5, durationMs: 1740000 },
    { eventName: "activity_started", featureArea: "activities", route: "/dashboard/courses/fallacy-guide/activity/sources", daysAgo: 7 },
    { eventName: "page_leave", featureArea: "courses", route: "/dashboard/courses/fallacy-guide", daysAgo: 8, durationMs: 320000 },
    { eventName: "ai_feedback_completed", featureArea: "ai_feedback", route: "/practice/speech", daysAgo: 9 },
    { eventName: "module_viewed", featureArea: "courses", route: "/dashboard/courses/persuasive-speaking", daysAgo: 10 },
    { eventName: "practice_completed", featureArea: "practice", route: "/practice/speaking", daysAgo: 11, durationMs: 1560000 },
    { eventName: "activity_completed", featureArea: "activities", route: "/dashboard/courses/foundations/activity/evidence", daysAgo: 12 },
    { eventName: "duel_completed", featureArea: "duels", route: "/duels/open-challenge", daysAgo: 13, durationMs: 2040000 },
    { eventName: "ai_feedback_requested", featureArea: "ai_feedback", route: "/practice/rebuttal", daysAgo: 14 },
    { eventName: "module_viewed", featureArea: "courses", route: "/dashboard/courses/advanced-rebuttals", daysAgo: 15 },
    { eventName: "course_started", featureArea: "courses", route: "/dashboard/courses/evidence-research", daysAgo: 17 },
    { eventName: "page_view", featureArea: "profile", route: "/profile", daysAgo: 18, durationMs: 54000 },
    { eventName: "ai_feedback_completed", featureArea: "ai_feedback", route: "/practice/rebuttal", daysAgo: 20 },
    { eventName: "practice_completed", featureArea: "practice", route: "/practice/topic", daysAgo: 22, durationMs: 1860000 },
    { eventName: "module_viewed", featureArea: "courses", route: "/dashboard/courses/foundations", daysAgo: 24 },
    { eventName: "page_view", featureArea: "courses", route: "/dashboard/courses", daysAgo: 27, durationMs: 91000 },
  ];
  const rawEvents: AdminAnalyticsRawEvent[] = eventSeed.map((event, index) => ({
    id: `mock-event-${index + 1}`,
    eventName: event.eventName,
    featureArea: event.featureArea,
    route: event.route,
    durationMs: event.durationMs ?? null,
    occurredAt: new Date(now.getTime() - event.daysAgo * 86400000 - index * 1800000).toISOString(),
    source: index % 3 === 0 ? "web" : "server",
    metadata: {
      object_id: `mock-${index + 1}`,
      route: event.route,
    },
  }));
  const dailyMinutes = [28, 18, 36, 34, 86, 64, 31, 22, 38, 33, 45, 52, 18, 29, 82, 55, 21, 44, 46, 39, 51, 12, 18, 31, 24, 63, 36, 22, 14, 36];
  const scoreSeries = [69, 70, 72, 71, 73, 74, 70, 68, 72, 73, 75, 76, 71, 72, 78, 80, 74, 73, 77, 76, 79, 70, 71, 74, 73, 82, 78, 76, 72, 80];
  const dailyStats: DailyStatLike[] = dailyMinutes.map((minutes, index) => {
    const date = new Date("2026-04-07T00:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + index);
    return {
      date: date.toISOString().slice(0, 10),
      minutes_studied: minutes,
      sessions_completed: index % 5 === 0 ? 2 : index % 3 === 0 ? 0 : 1,
      average_score: scoreSeries[index],
    };
  });
  const courseProgress: AdminCourseProgress[] = [
    {
      courseId: "mock-course-1",
      title: "Fundamentals of Debate",
      visibility: "premium",
      status: "completed",
      progressPercent: 100,
      enrolledAt: "2026-04-28T00:00:00.000Z",
      completedAt: "2026-05-05T00:00:00.000Z",
      lastActivityAt: "2026-05-06T10:30:00.000Z",
    },
    {
      courseId: "mock-course-2",
      title: "Advanced Argumentation",
      visibility: "public",
      status: "active",
      progressPercent: 67,
      enrolledAt: "2026-05-01T00:00:00.000Z",
      completedAt: null,
      lastActivityAt: "2026-05-04T14:20:00.000Z",
    },
    {
      courseId: "mock-course-3",
      title: "Rebuttal Mastery",
      visibility: "premium",
      status: "active",
      progressPercent: 43,
      enrolledAt: "2026-05-02T00:00:00.000Z",
      completedAt: null,
      lastActivityAt: "2026-05-03T12:15:00.000Z",
    },
    {
      courseId: "mock-course-4",
      title: "Persuasion & Impact",
      visibility: "public",
      status: "active",
      progressPercent: 20,
      enrolledAt: "2026-05-04T00:00:00.000Z",
      completedAt: null,
      lastActivityAt: "2026-05-01T16:45:00.000Z",
    },
    {
      courseId: "mock-course-5",
      title: "Evidence & Research",
      visibility: "premium",
      status: "active",
      progressPercent: 0,
      enrolledAt: "2026-05-06T00:00:00.000Z",
      completedAt: null,
      lastActivityAt: null,
    },
  ];
  const featureAdoption = buildFeatureAdoption(rawEvents);
  const kpis = buildAdminKpis({
    events: rawEvents,
    dailyStats,
    courseProgress,
    aiUsageCount: 1,
  });
  const base = emptyAnalyticsPageData(profile, range);
  base.hero = {
    ...base.hero,
    streak: 12,
    totalSessions: kpis.sessionsCompleted,
    totalPracticeMinutes: kpis.practiceMinutes,
    statusLine: "Active this week with consistent course and feedback usage.",
  };
  base.skillSnapshot = {
    metrics: [
      { key: "clarity", rawValue: 78, challengeAdjustedValue: 78, value: 78, effectiveSessions: 8, coverage: 100 },
      { key: "logic", rawValue: 72, challengeAdjustedValue: 72, value: 72, effectiveSessions: 8, coverage: 92 },
      { key: "rebuttal", rawValue: 58, challengeAdjustedValue: 58, value: 58, effectiveSessions: 6, coverage: 84 },
      { key: "evidence", rawValue: 65, challengeAdjustedValue: 65, value: 65, effectiveSessions: 7, coverage: 90 },
      { key: "delivery", rawValue: 75, challengeAdjustedValue: 75, value: 75, effectiveSessions: 5, coverage: 86 },
    ],
    overallScore: 70,
    strongestSkill: "clarity",
    weakestSkill: "rebuttal",
    sourceSessions: 8,
    confidence: 82,
    trackBreakdown: { debate: 6, speaking: 2 },
    difficultyBreakdown: {
      topic: { beginner: 1, intermediate: 5, advanced: 2 },
      ai: { easy: 1, medium: 4, hard: 2, none: 1 },
    },
    note: "Skill profile is based on recent scored rounds.",
  };
  base.recentSessions = [
    {
      id: "mock-session-1",
      kind: "practice",
      topicTitle: "Should AI replace human jobs?",
      topicCategory: "Technology",
      practiceTrack: "debate",
      mode: "topic",
      side: null,
      score: 82,
      resultLabel: null,
      confidencePercent: 84,
      durationMinutes: 32,
      createdAt: "2026-05-06T10:15:00.000Z",
      href: "/practice/history/mock-session-1",
    },
  ];

  return {
    range,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      level: user.level,
      xp: user.xp,
      orbBalance: user.orbBalance,
      createdAt: user.createdAt,
    },
    entitlement: {
      planType: user.entitlement.planType,
      source: user.entitlement.source,
      hasPremiumAccess: user.entitlement.hasPremiumAccess,
      hasEnterpriseAccess: user.entitlement.hasEnterpriseAccess,
      reason: user.entitlement.reason,
      betaAllAccess: isBetaAllAccessEnabled(),
      activeSubscriptionId: user.latestSubscription?.id ?? null,
    },
    base,
    kpis,
    trend: buildAdminTrend(range, rawEvents, dailyStats, now),
    featureAdoption,
    classMemberships: [
      {
        classId: "00000000-0000-4500-8000-000000000101",
        code: "IDC-2026-S1",
        title: "Intro Debate Cohort",
        status: "active",
        memberRole: "student",
        attendanceRate30d: 92,
      },
    ],
    courseProgress,
    moduleProgress: [
      {
        courseId: "mock-course-1",
        moduleId: "mock-module-1",
        title: "Argument Structure",
        accessLevel: "premium",
        sortOrder: 1,
        totalActivities: 6,
        completedActivities: 5,
        lastCompletedAt: "2026-05-06T10:30:00.000Z",
      },
      {
        courseId: "mock-course-2",
        moduleId: "mock-module-2",
        title: "Fast Rebuttals",
        accessLevel: "free",
        sortOrder: 2,
        totalActivities: 5,
        completedActivities: 3,
        lastCompletedAt: "2026-05-04T14:20:00.000Z",
      },
      {
        courseId: "mock-course-3",
        moduleId: "mock-module-3",
        title: "Fallacy Guide",
        accessLevel: "premium",
        sortOrder: 3,
        totalActivities: 5,
        completedActivities: 5,
        lastCompletedAt: "2026-05-03T12:15:00.000Z",
      },
      {
        courseId: "mock-course-4",
        moduleId: "mock-module-4",
        title: "Persuasive Speaking",
        accessLevel: "free",
        sortOrder: 4,
        totalActivities: 5,
        completedActivities: 2,
        lastCompletedAt: "2026-05-01T16:45:00.000Z",
      },
    ],
    rawEvents,
    insights: {
      cards: buildFallbackInsights({
        displayName: user.displayName,
        kpis,
        featureAdoption,
      }),
      generatedAt: now.toISOString(),
      cached: false,
      model: null,
      fallback: true,
    },
    dormantModules: { revenue: false, acquisition: false, social: false },
  };
}

export async function getAdminUserAnalyticsProfile(
  adminId: string | null,
  targetUserId: string,
  rangeInput?: string | null
): Promise<AdminUserAnalyticsProfile> {
  const range = normalizeAdminAnalyticsRange(rangeInput);
  const supabase = await createClient();
  const resolvedAdminId = await verifyAdminAccess(supabase, adminId);

  if (isDevMockUserId(targetUserId)) {
    return buildMockProfile(targetUserId, range);
  }

  const { startIso, previousStartDate } = getRangeWindow(range);
  const betaAllAccess = isBetaAllAccessEnabled();

  const [profileRes, subscriptionsRes, eventsRes, dailyStatsRes, courseProgressRes, moduleProgressRes, apiUsageRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, email, display_name, avatar_url, role, level, xp, orb_balance, created_at")
        .eq("id", targetUserId)
        .single(),
      supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", targetUserId)
        .order("created_at", { ascending: false }),
      supabase
        .from("analytics_events")
        .select("id, event_name, feature_area, route, duration_ms, occurred_at, source, metadata")
        .eq("user_id", targetUserId)
        .gte("occurred_at", startIso)
        .order("occurred_at", { ascending: false })
        .limit(300),
      supabase
        .from("daily_stats")
        .select("date, minutes_studied, practice_minutes, sessions_completed, average_score")
        .eq("user_id", targetUserId)
        .gte("date", previousStartDate)
        .order("date", { ascending: true }),
      supabase
        .from("analytics_user_course_progress")
        .select("course_id, course_title, visibility, status, progress_percent, enrolled_at, completed_at, last_activity_at")
        .eq("user_id", targetUserId)
        .order("last_activity_at", { ascending: false }),
      supabase
        .from("analytics_user_module_progress")
        .select("course_id, module_id, module_title, access_level, sort_order, total_activities, completed_activities, last_completed_at")
        .eq("user_id", targetUserId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("api_usage")
        .select("id")
        .eq("user_id", targetUserId)
        .gte("created_at", startIso)
        .ilike("service", "%gemini%"),
    ]);

  if (profileRes.error || !profileRes.data) {
    throw new Error(profileRes.error?.message ?? "User not found");
  }

  const profile = profileRes.data as ProfileRow;
  const subscriptions = (subscriptionsRes.data ?? []) as SubscriptionRecord[];
  const entitlement = resolveEntitlementFromSubscriptions(subscriptions, {
    betaAllAccess,
  });
  const rawEvents = mapRawEvents((eventsRes.data ?? []) as RawEventRow[]);
  const dailyStats = (dailyStatsRes.data ?? []) as DailyStatLike[];
  const courseProgress = mapCourseProgress((courseProgressRes.data ?? []) as CourseProgressRow[]);
  const moduleProgress = mapModuleProgress((moduleProgressRes.data ?? []) as ModuleProgressRow[]);
  const featureAdoption = buildFeatureAdoption(rawEvents);
  const classMemberships = await getUserClassMemberships(supabase, targetUserId);
  const kpis = buildAdminKpis({
    events: rawEvents,
    dailyStats,
    courseProgress,
    aiUsageCount: apiUsageRes.data?.length ?? 0,
  });

  let base: AnalyticsPageData;
  try {
    base = await getAnalyticsPageData(targetUserId, range);
  } catch {
    base = emptyAnalyticsPageData(profile, range);
  }

  const insights = await getCachedOrGeneratedInsights({
    supabase,
    adminId: resolvedAdminId,
    targetUserId,
    range,
    displayName: profile.display_name || profile.email?.split("@")[0] || "Debater",
    kpis,
    featureAdoption,
    courseProgress,
    rawEvents,
  });

  return {
    range,
    user: {
      id: profile.id,
      email: profile.email,
      displayName: profile.display_name || profile.email?.split("@")[0] || "Unnamed user",
      avatarUrl: profile.avatar_url,
      role: profile.role,
      level: profile.level ?? 1,
      xp: profile.xp ?? 0,
      orbBalance: profile.orb_balance ?? 0,
      createdAt: profile.created_at,
    },
    entitlement: {
      planType: entitlement.planType,
      source: entitlement.source,
      hasPremiumAccess: entitlement.hasPremiumAccess,
      hasEnterpriseAccess: entitlement.hasEnterpriseAccess,
      reason: entitlement.reason,
      betaAllAccess,
      activeSubscriptionId: entitlement.activeSubscription?.id ?? null,
    },
    base,
    kpis,
    trend: buildAdminTrend(range, rawEvents, dailyStats),
    featureAdoption,
    classMemberships,
    courseProgress,
    moduleProgress,
    rawEvents,
    insights,
    dormantModules: { revenue: false, acquisition: false, social: false },
  };
}
