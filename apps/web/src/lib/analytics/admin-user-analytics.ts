import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { generateStructured } from "@/lib/ai/core";
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
import {
  getRangeWindow,
  type AnalyticsFeatureArea,
} from "@/lib/analytics/events";
import {
  isBetaAllAccessEnabled,
  resolveEntitlementFromSubscriptions,
  type SubscriptionRecord,
} from "@/lib/entitlements";
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

function emptyAnalyticsPageData(
  profile: ProfileRow,
  range: AnalyticsRangePreset,
): AnalyticsPageData {
  return {
    range,
    practiceLanguage: "en",
    hero: {
      displayName:
        profile.display_name || profile.email?.split("@")[0] || "Debater",
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
      {
        key: "practice-minutes",
        totalMinutes: 0,
        deltaPercent: null,
        series: [],
      },
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

async function verifyAdminAccess(
  supabase: SupabaseServerClient,
  adminId: string | null,
) {
  if (!adminId) {
    throw new Error("Unauthorized");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", adminId)
    .single();

  if (profile?.role === "admin") return adminId;
  throw new Error("Forbidden");
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
  userId: string,
): Promise<AdminClassMembershipSummary[]> {
  const { data: memberships, error } = await supabase
    .from("class_memberships")
    .select("class_id, member_role, status")
    .eq("user_id", userId)
    .eq("status", "active");

  if (error || !memberships?.length) return [];

  const classIds = memberships.map(
    (membership) => membership.class_id as string,
  );
  const { data: classRows, error: classError } = await supabase
    .from("admin_class_list_rows")
    .select("id, code, title, status, attendance_rate_30d")
    .in("id", classIds);

  if (classError || !classRows?.length) return [];

  const membershipByClassId = new Map(
    memberships.map((membership) => [
      membership.class_id as string,
      membership,
    ]),
  );

  return classRows.map((row) => {
    const membership = membershipByClassId.get(row.id as string);
    return {
      classId: row.id as string,
      code: row.code as string,
      title: row.title as string,
      status: row.status as string,
      memberRole: String(membership?.member_role ?? "student"),
      attendanceRate30d:
        (row.attendance_rate_30d as number | null | undefined) ?? null,
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

  if (!process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEYS) {
    return {
      cards: fallbackCards,
      generatedAt: now.toISOString(),
      cached: false,
      model: null,
      fallback: true,
    };
  }

  const prompt = `You are Thinkfy's admin analytics assistant. Return strict JSON only with this shape: {"insights":[{"id":"short-id","title":"short title","body":"one concise operational observation","priority":"low|medium|high","tone":"blue|green|amber|slate"}]}. Use at most 3 insights. Focus on coaching/admin action, risk, and progress. Data: ${JSON.stringify(promptInput)}`;
  const startedAt = Date.now();

  try {
    const result = await generateStructured({
      task: "onboarding_feedback",
      prompt,
      schema: z.record(z.string(), z.unknown()),
      context: {
        task: "onboarding_feedback",
        sourceRoute: "admin-user-analytics",
        outputType: "admin_ai_insights",
        userId: params.targetUserId,
        deadlineAt: Date.now() + 10_000,
        idempotencyKey: cacheKey,
        metadata: { adminId: params.adminId, range: params.range },
      },
      policy: {
        candidates: [{ provider: "gemini", model }],
        temperature: 0.2,
        maxOutputTokens: 700,
      },
    });
    const normalizedText = JSON.stringify(result.output);
    const cards = parseAdminInsightJson(normalizedText);
    const outputTokens =
      result.usage.outputTokens ?? estimateTokens(normalizedText);
    const inputTokens = estimateTokens(prompt);

    await params.supabase.from("api_usage").insert({
      user_id: params.targetUserId,
      service: "gemini_admin_insights",
      model: result.model,
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
        model: result.model,
        prompt_hash: promptHash,
        insights: { insights: cards },
        expires_at: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        created_by: params.adminId,
        updated_at: now.toISOString(),
      },
      { onConflict: "cache_key" },
    );

    return {
      cards,
      generatedAt: now.toISOString(),
      cached: false,
      model: result.model,
      fallback: false,
    };
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "Admin analytics Gemini insights fell back:",
        error instanceof Error ? error.message : error,
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

export async function getAdminUserAnalyticsProfile(
  adminId: string | null,
  targetUserId: string,
  rangeInput?: string | null,
): Promise<AdminUserAnalyticsProfile> {
  const range = normalizeAdminAnalyticsRange(rangeInput);
  const supabase = await createClient();
  const resolvedAdminId = await verifyAdminAccess(supabase, adminId);

  const { startIso, previousStartDate } = getRangeWindow(range);
  const betaAllAccess = isBetaAllAccessEnabled();

  const [
    profileRes,
    subscriptionsRes,
    eventsRes,
    dailyStatsRes,
    courseProgressRes,
    moduleProgressRes,
    apiUsageRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, display_name, avatar_url, role, level, xp, orb_balance, created_at",
      )
      .eq("id", targetUserId)
      .single(),
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false }),
    supabase
      .from("analytics_events")
      .select(
        "id, event_name, feature_area, route, duration_ms, occurred_at, source, metadata",
      )
      .eq("user_id", targetUserId)
      .gte("occurred_at", startIso)
      .order("occurred_at", { ascending: false })
      .limit(300),
    supabase
      .from("daily_stats")
      .select(
        "date, minutes_studied, practice_minutes, sessions_completed, average_score",
      )
      .eq("user_id", targetUserId)
      .gte("date", previousStartDate)
      .order("date", { ascending: true }),
    supabase
      .from("analytics_user_course_progress")
      .select(
        "course_id, course_title, visibility, status, progress_percent, enrolled_at, completed_at, last_activity_at",
      )
      .eq("user_id", targetUserId)
      .order("last_activity_at", { ascending: false }),
    supabase
      .from("analytics_user_module_progress")
      .select(
        "course_id, module_id, module_title, access_level, sort_order, total_activities, completed_activities, last_completed_at",
      )
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
  const courseProgress = mapCourseProgress(
    (courseProgressRes.data ?? []) as CourseProgressRow[],
  );
  const moduleProgress = mapModuleProgress(
    (moduleProgressRes.data ?? []) as ModuleProgressRow[],
  );
  const featureAdoption = buildFeatureAdoption(rawEvents);
  const classMemberships = await getUserClassMemberships(
    supabase,
    targetUserId,
  );
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
    displayName:
      profile.display_name || profile.email?.split("@")[0] || "Debater",
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
      displayName:
        profile.display_name || profile.email?.split("@")[0] || "Unnamed user",
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
