import type { SupabaseClient } from "@supabase/supabase-js";
import { computeSkillSnapshot } from "@/lib/analytics/skill-snapshot";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import {
  buildPopupSegments,
  createSmartPopupPayload,
  getDaysBetween,
  rankSmartPopupCandidates,
  updateCampaignStateForEvent,
} from "@/lib/smart-popups/rules";
import type {
  SmartPopupCampaign,
  SmartPopupCampaignState,
  SmartPopupCopy,
  SmartPopupEventType,
  SmartPopupImpressionCounts,
  SmartPopupLocale,
  SmartPopupPayload,
  SmartPopupRules,
  SmartPopupSegment,
  SmartPopupSurface,
  SmartPopupUserTraits,
} from "@/lib/smart-popups/types";
import type { DebateScore } from "@/types/feedback";

const DEFAULT_SURFACE: SmartPopupSurface = "dashboard";
const DEFAULT_LOCALE: SmartPopupLocale = "en";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type ProfileRow = {
  id: string;
  role?: string | null;
  created_at?: string | null;
  onboarding_completed?: boolean | null;
  total_sessions_completed?: number | null;
  streak_current?: number | null;
  preferences?: unknown;
};

type SessionRow = {
  id: string;
  created_at: string | null;
  total_score: number | null;
  feedback: DebateScore | null;
  mode: string | null;
  duration_seconds: number | null;
  topic_difficulty: string | null;
  ai_difficulty: string | null;
};

type EnrollmentRow = {
  id: string;
  status?: string | null;
  progress_percent?: number | null;
};

type AnalyticsRow = {
  event_name?: string | null;
  feature_area?: string | null;
  route?: string | null;
  occurred_at?: string | null;
};

type PopupEventRow = {
  campaign_key: string;
  event_type: string;
  occurred_at: string;
};

type UserStateRow = {
  user_id: string;
  segment?: string | null;
  traits?: unknown;
  campaign_state?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCopy(value: unknown): SmartPopupCopy {
  const source = isRecord(value) ? value : {};
  return {
    eyebrow: asNullableString(source.eyebrow) ?? undefined,
    title: asNullableString(source.title) ?? undefined,
    body: asNullableString(source.body) ?? undefined,
    ctaLabel: asNullableString(source.ctaLabel) ?? undefined,
    dismissLabel: asNullableString(source.dismissLabel) ?? undefined,
    dontShowLabel: asNullableString(source.dontShowLabel) ?? undefined,
    alt: asNullableString(source.alt) ?? undefined,
  };
}

function normalizeRules(value: unknown): SmartPopupRules {
  const source = isRecord(value) ? value : {};
  return {
    segments: Array.isArray(source.segments)
      ? source.segments.filter((item): item is string => typeof item === "string")
      : undefined,
    roles: Array.isArray(source.roles)
      ? source.roles.filter((item): item is string => typeof item === "string")
      : undefined,
    minSessions: asNullableNumber(source.minSessions),
    maxSessions: asNullableNumber(source.maxSessions),
    minDaysSinceLastPractice: asNullableNumber(source.minDaysSinceLastPractice),
    requiresWeakestSkill:
      typeof source.requiresWeakestSkill === "boolean"
        ? source.requiresWeakestSkill
        : undefined,
    maxCourseProgressCount: asNullableNumber(source.maxCourseProgressCount),
    maxCoachEventCount: asNullableNumber(source.maxCoachEventCount),
  };
}

function asNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeCampaign(row: Record<string, unknown>): SmartPopupCampaign {
  return {
    id: asString(row.id),
    key: asString(row.key),
    surface:
      row.surface === "global" || row.surface === "dashboard"
        ? row.surface
        : DEFAULT_SURFACE,
    status:
      row.status === "paused" || row.status === "archived"
        ? row.status
        : "active",
    priority: asNumber(row.priority, 100),
    starts_at: asNullableString(row.starts_at),
    ends_at: asNullableString(row.ends_at),
    cooldown_hours: asNumber(row.cooldown_hours, 168),
    max_impressions_per_user: asNumber(row.max_impressions_per_user, 3),
    daily_cap_per_user: asNumber(row.daily_cap_per_user, 1),
    weekly_cap_per_user: asNumber(row.weekly_cap_per_user, 3),
    cta_href: asString(row.cta_href, "/dashboard"),
    image_path: asString(row.image_path, "/images/smart-popups/first-practice.webp"),
    copy_en: normalizeCopy(row.copy_en),
    copy_vi: normalizeCopy(row.copy_vi),
    rules: normalizeRules(row.rules),
    metadata: isRecord(row.metadata) ? row.metadata : {},
  };
}

function normalizeCampaignState(value: unknown): SmartPopupCampaignState {
  if (!isRecord(value)) return {};

  return Object.entries(value).reduce<SmartPopupCampaignState>(
    (state, [key, entry]) => {
      if (!isRecord(entry)) return state;
      state[key] = {
        impressions: asNullableNumber(entry.impressions),
        lastShownAt: asNullableString(entry.lastShownAt),
        dismissedAt: asNullableString(entry.dismissedAt),
        clickedAt: asNullableString(entry.clickedAt),
        hidden: entry.hidden === true,
      };
      return state;
    },
    {}
  );
}

function normalizeLocale(locale: string | null | undefined): SmartPopupLocale {
  return locale === "vi" ? "vi" : DEFAULT_LOCALE;
}

function normalizeSurface(surface: string | null | undefined): SmartPopupSurface {
  return surface === "global" ? "global" : DEFAULT_SURFACE;
}

function getPrimarySegment(segments: SmartPopupSegment[]) {
  return segments[0] ?? "active_user";
}

function isSmartPopupEnabled() {
  return process.env.SMART_POPUPS_ENABLED !== "false";
}

function getCourseProgressCount(enrollments: EnrollmentRow[]) {
  return enrollments.filter((enrollment) => {
    if (enrollment.status === "completed") return true;
    return asNumber(enrollment.progress_percent, 0) > 0;
  }).length;
}

function getCoachEventCount(events: AnalyticsRow[]) {
  return events.filter((event) => {
    const route = event.route?.toLowerCase() ?? "";
    return (
      event.feature_area === "ai_feedback" ||
      event.event_name?.startsWith("ai_feedback") ||
      route.includes("/chat")
    );
  }).length;
}

function countImpressionsByCampaign(
  events: PopupEventRow[],
  campaignKey: string,
  now: Date
): SmartPopupImpressionCounts {
  const nowTime = now.getTime();
  const impressions = events.filter((event) => event.event_type === "impression");
  const daily = impressions.filter(
    (event) => nowTime - new Date(event.occurred_at).getTime() < DAY_MS
  );
  const weekly = impressions.filter(
    (event) => nowTime - new Date(event.occurred_at).getTime() < WEEK_MS
  );

  return {
    userDaily: daily.length,
    userWeekly: weekly.length,
    campaignDaily: daily.filter((event) => event.campaign_key === campaignKey).length,
    campaignWeekly: weekly.filter((event) => event.campaign_key === campaignKey).length,
  };
}

async function fetchCampaigns(
  supabase: SupabaseClient,
  surface: SmartPopupSurface
) {
  const { data, error } = await supabase
    .from("smart_popup_campaigns")
    .select("*")
    .in("surface", [surface, "global"])
    .eq("status", "active")
    .order("priority", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeCampaign);
}

async function fetchUserState(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("smart_popup_user_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as UserStateRow | null) ?? null;
}

async function fetchUserTraits(
  supabase: SupabaseClient,
  userId: string,
  now: Date
): Promise<SmartPopupUserTraits> {
  const [profileRes, sessionsRes, enrollmentsRes, analyticsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, role, created_at, onboarding_completed, total_sessions_completed, streak_current, preferences"
        )
        .eq("id", userId)
        .single(),
      supabase
        .from("debate_sessions")
        .select(
          "id, created_at, total_score, feedback, mode, duration_seconds, topic_difficulty, ai_difficulty"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("enrollments")
        .select("id, status, progress_percent")
        .eq("user_id", userId),
      supabase
        .from("analytics_events")
        .select("event_name, feature_area, route, occurred_at")
        .eq("user_id", userId)
        .order("occurred_at", { ascending: false })
        .limit(100),
    ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (enrollmentsRes.error) throw new Error(enrollmentsRes.error.message);
  if (analyticsRes.error) throw new Error(analyticsRes.error.message);

  const profile = profileRes.data as ProfileRow;
  const sessions = ((sessionsRes.data ?? []) as SessionRow[]).map((session) => ({
    ...session,
    feedback: isRecord(session.feedback)
      ? (session.feedback as unknown as DebateScore)
      : null,
  }));
  const enrollments = (enrollmentsRes.data ?? []) as EnrollmentRow[];
  const analyticsEvents = (analyticsRes.data ?? []) as AnalyticsRow[];
  const preferences = isRecord(profile.preferences) ? profile.preferences : {};
  const snapshot = computeSkillSnapshot(sessions);
  const lastPracticeAt = sessions[0]?.created_at ?? null;
  const totalSessionsCompleted = Math.max(
    asNumber(profile.total_sessions_completed, 0),
    sessions.length
  );
  const baseTraits = {
    userId,
    role: profile.role ?? "student",
    onboardingCompleted: profile.onboarding_completed === true,
    smartFeaturePopupsEnabled: preferences.smart_feature_popups !== false,
    firstDashboardVisit: preferences.first_dashboard_visit === true,
    totalSessionsCompleted,
    daysSinceSignup: getDaysBetween(profile.created_at, now) ?? 0,
    daysSinceLastPractice: getDaysBetween(lastPracticeAt, now),
    currentStreak: asNumber(profile.streak_current, 0),
    courseProgressCount: getCourseProgressCount(enrollments),
    coachEventCount: getCoachEventCount(analyticsEvents),
    weakestSkill: snapshot.weakestSkill,
  };

  return {
    ...baseTraits,
    segments: buildPopupSegments(baseTraits),
  };
}

async function fetchPopupEvents(
  supabase: SupabaseClient,
  userId: string,
  now: Date
) {
  const since = new Date(now.getTime() - WEEK_MS).toISOString();
  const { data, error } = await supabase
    .from("smart_popup_events")
    .select("campaign_key, event_type, occurred_at")
    .eq("user_id", userId)
    .gte("occurred_at", since);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as PopupEventRow[];
}

async function saveUserState(input: {
  supabase: SupabaseClient;
  userId: string;
  traits: SmartPopupUserTraits;
  campaignState: SmartPopupCampaignState;
  now: Date;
}) {
  const { error } = await input.supabase
    .from("smart_popup_user_state")
    .upsert(
      {
        user_id: input.userId,
        segment: getPrimarySegment(input.traits.segments),
        traits: input.traits,
        campaign_state: input.campaignState,
        last_refreshed_at: input.now.toISOString(),
        updated_at: input.now.toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

async function insertPopupEvent(input: {
  supabase: SupabaseClient;
  userId: string;
  campaignKey: string;
  eventType: SmartPopupEventType;
  surface: SmartPopupSurface;
  route?: string | null;
  metadata?: Record<string, unknown>;
  occurredAt: string;
}) {
  const { error } = await input.supabase.from("smart_popup_events").insert({
    user_id: input.userId,
    campaign_key: input.campaignKey,
    event_type: input.eventType,
    surface: input.surface,
    route: input.route ?? null,
    metadata: input.metadata ?? {},
    occurred_at: input.occurredAt,
  });

  if (error) {
    throw new Error(error.message);
  }
}

async function recordPopupAnalytics(input: {
  supabase: SupabaseClient;
  userId: string;
  eventType: SmartPopupEventType;
  campaignKey: string;
  route?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const eventNameByType = {
    impression: "popup_impression",
    dismissed: "popup_dismissed",
    cta_clicked: "popup_cta_clicked",
    dont_show_again: "popup_dont_show_again",
  } as const;

  await recordAnalyticsEvent(
    input.supabase,
    input.userId,
    {
      eventName: eventNameByType[input.eventType],
      featureArea: "notifications",
      route: input.route ?? null,
      metadata: {
        campaignKey: input.campaignKey,
        ...(input.metadata ?? {}),
      },
    },
    "server"
  );
}

export async function getNextSmartPopup(input: {
  supabase: SupabaseClient;
  userId: string;
  locale?: string | null;
  surface?: string | null;
  route?: string | null;
  commit?: boolean;
  now?: Date;
}): Promise<{ popup: SmartPopupPayload | null; segment: SmartPopupSegment | null }> {
  if (!isSmartPopupEnabled()) {
    return { popup: null, segment: null };
  }

  const now = input.now ?? new Date();
  const surface = normalizeSurface(input.surface);
  const locale = normalizeLocale(input.locale);
  const [campaigns, userState, traits, popupEvents] = await Promise.all([
    fetchCampaigns(input.supabase, surface),
    fetchUserState(input.supabase, input.userId),
    fetchUserTraits(input.supabase, input.userId, now),
    fetchPopupEvents(input.supabase, input.userId, now),
  ]);
  const campaignState = normalizeCampaignState(userState?.campaign_state);
  const impressionCountsByCampaign = campaigns.reduce<
    Record<string, SmartPopupImpressionCounts>
  >((counts, campaign) => {
    counts[campaign.key] = countImpressionsByCampaign(
      popupEvents,
      campaign.key,
      now
    );
    return counts;
  }, {});
  const [campaign] = rankSmartPopupCandidates({
    campaigns,
    traits,
    campaignState,
    impressionCountsByCampaign,
    surface,
    now,
  });

  await saveUserState({
    supabase: input.supabase,
    userId: input.userId,
    traits,
    campaignState,
    now,
  });

  if (!campaign) {
    return { popup: null, segment: getPrimarySegment(traits.segments) };
  }

  const popup = createSmartPopupPayload({ campaign, traits, locale });

  if (input.commit) {
    const occurredAt = now.toISOString();
    const nextState = updateCampaignStateForEvent({
      campaignState,
      campaignKey: campaign.key,
      eventType: "impression",
      occurredAt,
    });

    await insertPopupEvent({
      supabase: input.supabase,
      userId: input.userId,
      campaignKey: campaign.key,
      eventType: "impression",
      surface,
      route: input.route,
      metadata: popup.metadata,
      occurredAt,
    });
    await saveUserState({
      supabase: input.supabase,
      userId: input.userId,
      traits,
      campaignState: nextState,
      now,
    });
    await recordPopupAnalytics({
      supabase: input.supabase,
      userId: input.userId,
      eventType: "impression",
      campaignKey: campaign.key,
      route: input.route,
      metadata: popup.metadata,
    });
  }

  return { popup, segment: popup.segment };
}

export async function recordSmartPopupEvent(input: {
  supabase: SupabaseClient;
  userId: string;
  campaignKey: string;
  eventType: SmartPopupEventType;
  surface?: string | null;
  route?: string | null;
  metadata?: Record<string, unknown>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const surface = normalizeSurface(input.surface);
  const [userState, traits] = await Promise.all([
    fetchUserState(input.supabase, input.userId),
    fetchUserTraits(input.supabase, input.userId, now),
  ]);
  const campaignState = normalizeCampaignState(userState?.campaign_state);
  const nextState = updateCampaignStateForEvent({
    campaignState,
    campaignKey: input.campaignKey,
    eventType: input.eventType,
    occurredAt: now.toISOString(),
  });

  await insertPopupEvent({
    supabase: input.supabase,
    userId: input.userId,
    campaignKey: input.campaignKey,
    eventType: input.eventType,
    surface,
    route: input.route,
    metadata: input.metadata,
    occurredAt: now.toISOString(),
  });
  await saveUserState({
    supabase: input.supabase,
    userId: input.userId,
    traits,
    campaignState: nextState,
    now,
  });
  await recordPopupAnalytics({
    supabase: input.supabase,
    userId: input.userId,
    eventType: input.eventType,
    campaignKey: input.campaignKey,
    route: input.route,
    metadata: input.metadata,
  });

  return { ok: true };
}

export async function refreshSmartPopupUserStates(input: {
  supabase: SupabaseClient;
  limit?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const startedAt = now.toISOString();
  const { data: run, error: runError } = await input.supabase
    .from("smart_popup_cron_runs")
    .insert({
      job_key: "smart-popups",
      status: "started",
      started_at: startedAt,
      metadata: { reason: "daily-segment-refresh" },
    })
    .select("id")
    .single();

  if (runError) {
    throw new Error(runError.message);
  }

  try {
    const { data, error } = await input.supabase
      .from("profiles")
      .select("id")
      .eq("onboarding_completed", true)
      .order("updated_at", { ascending: false })
      .limit(input.limit ?? 1000);

    if (error) {
      throw new Error(error.message);
    }

    const profiles = (data ?? []) as Array<{ id: string }>;
    const campaigns = await fetchCampaigns(input.supabase, DEFAULT_SURFACE);
    let generatedOpportunities = 0;

    for (const profile of profiles) {
      const traits = await fetchUserTraits(input.supabase, profile.id, now);
      const state = await fetchUserState(input.supabase, profile.id);
      const campaignState = normalizeCampaignState(state?.campaign_state);
      const events = await fetchPopupEvents(input.supabase, profile.id, now);
      const impressionCountsByCampaign = campaigns.reduce<
        Record<string, SmartPopupImpressionCounts>
      >((counts, campaign) => {
        counts[campaign.key] = countImpressionsByCampaign(
          events,
          campaign.key,
          now
        );
        return counts;
      }, {});

      generatedOpportunities += rankSmartPopupCandidates({
        campaigns,
        traits,
        campaignState,
        impressionCountsByCampaign,
        surface: DEFAULT_SURFACE,
        now,
      }).length;

      await saveUserState({
        supabase: input.supabase,
        userId: profile.id,
        traits,
        campaignState,
        now,
      });
    }

    const finishedAt = new Date().toISOString();
    const { error: updateError } = await input.supabase
      .from("smart_popup_cron_runs")
      .update({
        status: "success",
        finished_at: finishedAt,
        processed_users: profiles.length,
        generated_opportunities: generatedOpportunities,
      })
      .eq("id", (run as { id: string }).id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return {
      processedUsers: profiles.length,
      generatedOpportunities,
      startedAt,
      finishedAt,
    };
  } catch (error) {
    await input.supabase
      .from("smart_popup_cron_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message:
          error instanceof Error ? error.message.slice(0, 1000) : "Unknown error",
      })
      .eq("id", (run as { id: string }).id);

    throw error;
  }
}

export const smartPopupInternals = {
  normalizeCampaignState,
  normalizeCampaign,
  countImpressionsByCampaign,
};
