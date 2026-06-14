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
import {
  getThankYouCopy,
  localizeSurveyQuestions,
  normalizeSurveyQuestions,
  validateSurveyAnswers,
  type SmartPopupSurveyAnswer,
} from "@/lib/smart-popups/survey";
import type {
  SmartPopupCampaign,
  SmartPopupCampaignState,
  SmartPopupCopy,
  SmartPopupEventType,
  SmartPopupImpressionCounts,
  SmartPopupLocale,
  SmartPopupPayload,
  SmartPopupRules,
  SmartPopupSurveyPayload,
  SmartPopupSegment,
  SmartPopupSurface,
  SmartPopupUserTraits,
} from "@/lib/smart-popups/types";
import {
  computeEffectiveStreakState,
  type StreakActivityEvent,
} from "@/lib/streaks/model";
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
  streak_last_active_date?: string | null;
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
  id?: string;
  campaign_key: string;
  event_type: string;
  occurred_at: string;
};

type SurveyVersionRow = {
  id: string;
  campaign_key: string;
  version: number;
  questions: unknown;
  thank_you_copy: unknown;
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
    preferredLocales: Array.isArray(source.preferredLocales)
      ? source.preferredLocales.filter(
          (item): item is "en" | "vi" => item === "en" || item === "vi"
        )
      : undefined,
    routeIncludes: Array.isArray(source.routeIncludes)
      ? source.routeIncludes.filter((item): item is string => typeof item === "string")
      : undefined,
    repeatIntervalDays: asNullableNumber(source.repeatIntervalDays),
    maxSubmissionsPerUser: asNullableNumber(source.maxSubmissionsPerUser),
    requiresReminderEmailOptIn:
      typeof source.requiresReminderEmailOptIn === "boolean"
        ? source.requiresReminderEmailOptIn
        : undefined,
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
    campaign_type:
      row.campaign_type === "feedback_survey"
        ? "feedback_survey"
        : "feature_nudge",
    delivery_mode:
      row.delivery_mode === "send_now" || row.delivery_mode === "scheduled"
        ? row.delivery_mode
        : "targeted",
    priority: asNumber(row.priority, 100),
    starts_at: asNullableString(row.starts_at),
    ends_at: asNullableString(row.ends_at),
    cooldown_hours: asNumber(row.cooldown_hours, 168),
    max_impressions_per_user: asNumber(row.max_impressions_per_user, 3),
    daily_cap_per_user: asNumber(row.daily_cap_per_user, 1),
    weekly_cap_per_user: asNumber(row.weekly_cap_per_user, 3),
    reward_credits: asNumber(row.reward_credits, 0),
    response_goal:
      typeof row.response_goal === "number" && Number.isFinite(row.response_goal)
        ? row.response_goal
        : null,
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
        surveyStartedAt: asNullableString(entry.surveyStartedAt),
        submittedAt: asNullableString(entry.submittedAt),
        submissions: asNullableNumber(entry.submissions),
        abandonedAt: asNullableString(entry.abandonedAt),
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

function getBooleanPreference(
  preferences: Record<string, unknown>,
  key: string,
  fallback = true
) {
  const value = preferences[key];
  return typeof value === "boolean" ? value : fallback;
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
  now: Date,
  timezone?: string | null
): Promise<SmartPopupUserTraits> {
  const [profileRes, sessionsRes, enrollmentsRes, analyticsRes, activityRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, role, created_at, onboarding_completed, total_sessions_completed, streak_current, streak_last_active_date, preferences"
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
      supabase
        .from("activity_log")
        .select("activity_type, reference_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  if (profileRes.error) throw new Error(profileRes.error.message);
  if (sessionsRes.error) throw new Error(sessionsRes.error.message);
  if (enrollmentsRes.error) throw new Error(enrollmentsRes.error.message);
  if (analyticsRes.error) throw new Error(analyticsRes.error.message);
  if (activityRes.error) throw new Error(activityRes.error.message);

  const profile = profileRes.data as ProfileRow;
  const sessions = ((sessionsRes.data ?? []) as SessionRow[]).map((session) => ({
    ...session,
    feedback: isRecord(session.feedback)
      ? (session.feedback as unknown as DebateScore)
      : null,
  }));
  const enrollments = (enrollmentsRes.data ?? []) as EnrollmentRow[];
  const analyticsEvents = (analyticsRes.data ?? []) as AnalyticsRow[];
  const streakState = computeEffectiveStreakState({
    profile,
    activities: (activityRes.data ?? []) as StreakActivityEvent[],
    timezone,
    now,
  });
  const preferences = isRecord(profile.preferences) ? profile.preferences : {};
  const snapshot = computeSkillSnapshot(sessions);
  const lastPracticeAt = sessions[0]?.created_at ?? null;
  const lastScoredSession = sessions.find((session) =>
    typeof session.total_score === "number" && Number.isFinite(session.total_score)
  );
  const lastPracticeMinutes =
    typeof sessions[0]?.duration_seconds === "number" &&
    Number.isFinite(sessions[0].duration_seconds)
      ? Math.max(1, Math.round(sessions[0].duration_seconds / 60))
      : null;
  const totalSessionsCompleted = Math.max(
    asNumber(profile.total_sessions_completed, 0),
    sessions.length
  );
  const baseTraits = {
    userId,
    role: profile.role ?? "student",
    onboardingCompleted: profile.onboarding_completed === true,
    smartFeaturePopupsEnabled: preferences.smart_feature_popups !== false,
    emailNotificationsEnabled: getBooleanPreference(
      preferences,
      "email_notifications",
      true
    ),
    practiceRemindersEnabled: getBooleanPreference(
      preferences,
      "practice_reminders",
      true
    ),
    streakRemindersEnabled: getBooleanPreference(
      preferences,
      "streak_reminders",
      true
    ),
    emailOptInScope:
      typeof preferences.email_opt_in_scope === "string"
        ? preferences.email_opt_in_scope
        : null,
    firstDashboardVisit: preferences.first_dashboard_visit === true,
    totalSessionsCompleted,
    daysSinceSignup: getDaysBetween(profile.created_at, now) ?? 0,
    daysSinceLastPractice: getDaysBetween(lastPracticeAt, now),
    currentStreak: streakState.current,
    courseProgressCount: getCourseProgressCount(enrollments),
    coachEventCount: getCoachEventCount(analyticsEvents),
    weakestSkill: snapshot.weakestSkill,
    lastScoredSessionScore:
      typeof lastScoredSession?.total_score === "number"
        ? Math.round(lastScoredSession.total_score)
        : null,
    lastPracticeMinutes,
  };

  return {
    ...baseTraits,
    segments: buildPopupSegments(baseTraits),
  };
}

async function fetchProfilePreferences(
  supabase: SupabaseClient,
  userId: string
) {
  const { data, error } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", userId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const preferences = (data as { preferences?: unknown } | null)?.preferences;
  return isRecord(preferences) ? preferences : {};
}

export async function optInSmartPopupReminderEmails(input: {
  supabase: SupabaseClient;
  userId: string;
  campaignKey: string;
  locale?: string | null;
  surface?: string | null;
  route?: string | null;
  metadata?: Record<string, unknown>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const surface = normalizeSurface(input.surface);
  const preferences = await fetchProfilePreferences(input.supabase, input.userId);
  const nextPreferences = {
    ...preferences,
    email_notifications: true,
    practice_reminders: true,
    streak_reminders: true,
    email_opt_in_scope: "reminders_only",
    reminder_email_opted_in_at: now.toISOString(),
  };

  const { error } = await input.supabase
    .from("profiles")
    .update({ preferences: nextPreferences })
    .eq("id", input.userId);

  if (error) {
    throw new Error(error.message);
  }

  await recordAnalyticsEvent(
    input.supabase,
    input.userId,
    {
      eventName: "popup_reminder_opt_in",
      featureArea: "notifications",
      route: input.route ?? null,
      metadata: {
        campaignKey: input.campaignKey,
        popupKind: "reminder_opt_in",
        surface,
        locale: normalizeLocale(input.locale),
        actionSource: "smart_popup",
        ctaOutcome: "reminder_email_opt_in",
        emailOptInScope: "reminders_only",
        ...(input.metadata ?? {}),
      },
    },
    "server"
  );

  return {
    ok: true,
    preferences: {
      emailNotifications: true,
      practiceReminders: true,
      streakReminders: true,
      emailOptInScope: "reminders_only",
    },
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

async function fetchCurrentSurveyVersion(
  supabase: SupabaseClient,
  campaignKey: string
): Promise<SurveyVersionRow | null> {
  const { data, error } = await supabase
    .from("smart_popup_survey_versions")
    .select("id, campaign_key, version, questions, thank_you_copy")
    .eq("campaign_key", campaignKey)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SurveyVersionRow | null) ?? null;
}

async function fetchSurveyVersionById(
  supabase: SupabaseClient,
  surveyVersionId: string
): Promise<SurveyVersionRow | null> {
  const { data, error } = await supabase
    .from("smart_popup_survey_versions")
    .select("id, campaign_key, version, questions, thank_you_copy")
    .eq("id", surveyVersionId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as SurveyVersionRow | null) ?? null;
}

function createSurveyPayload(input: {
  version: SurveyVersionRow | null;
  campaign: SmartPopupCampaign;
  locale: SmartPopupLocale;
}): SmartPopupSurveyPayload | undefined {
  if (!input.version || input.campaign.campaign_type !== "feedback_survey") {
    return undefined;
  }

  const questions = normalizeSurveyQuestions(input.version.questions);
  if (questions.length === 0) return undefined;

  return {
    versionId: input.version.id,
    version: asNumber(input.version.version, 1),
    rewardCredits: input.campaign.reward_credits,
    questions: localizeSurveyQuestions(questions, input.locale),
    thankYou: getThankYouCopy(
      input.version.thank_you_copy,
      input.locale,
      input.campaign.reward_credits
    ),
  };
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
  const { data, error } = await input.supabase
    .from("smart_popup_events")
    .insert({
      user_id: input.userId,
      campaign_key: input.campaignKey,
      event_type: input.eventType,
      surface: input.surface,
      route: input.route ?? null,
      metadata: input.metadata ?? {},
      occurred_at: input.occurredAt,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (data as { id: string } | null)?.id ?? null;
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
    survey_started: "popup_survey_started",
    survey_submitted: "popup_survey_submitted",
    survey_abandoned: "popup_survey_abandoned",
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
  timezone?: string | null;
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
    fetchUserTraits(input.supabase, input.userId, now, input.timezone),
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
    route: input.route,
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

  const surveyVersion =
    campaign.campaign_type === "feedback_survey"
      ? await fetchCurrentSurveyVersion(input.supabase, campaign.key)
      : null;
  const survey = createSurveyPayload({
    version: surveyVersion,
    campaign,
    locale,
  });

  if (campaign.campaign_type === "feedback_survey" && !survey) {
    return { popup: null, segment: getPrimarySegment(traits.segments) };
  }

  let popup = {
    ...createSmartPopupPayload({ campaign, traits, locale }),
    survey,
  };

  if (input.commit) {
    const occurredAt = now.toISOString();
    const nextState = updateCampaignStateForEvent({
      campaignState,
      campaignKey: campaign.key,
      eventType: "impression",
      occurredAt,
    });

    const impressionEventId = await insertPopupEvent({
      supabase: input.supabase,
      userId: input.userId,
      campaignKey: campaign.key,
      eventType: "impression",
      surface,
      route: input.route,
      metadata: popup.metadata,
      occurredAt,
    });
    popup = {
      ...popup,
      metadata: {
        ...popup.metadata,
        impressionEventId,
      },
    };
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

async function fetchCampaignByKey(
  supabase: SupabaseClient,
  campaignKey: string
) {
  const { data, error } = await supabase
    .from("smart_popup_campaigns")
    .select("*")
    .eq("key", campaignKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? normalizeCampaign(data as Record<string, unknown>) : null;
}

function normalizeSubmissionKey(input: {
  userId: string;
  campaignKey: string;
  surveyVersionId: string;
  impressionEventId?: string | null;
}) {
  return [
    input.userId,
    input.campaignKey,
    input.surveyVersionId,
    input.impressionEventId ?? "manual",
  ].join(":");
}

async function findExistingSurveyResponse(input: {
  supabase: SupabaseClient;
  submissionKey: string;
}) {
  const { data, error } = await input.supabase
    .from("smart_popup_survey_responses")
    .select("id, reward_credits_awarded, rewarded_at")
    .eq("submission_key", input.submissionKey)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as
    | { id: string; reward_credits_awarded: number; rewarded_at: string | null }
    | null;
}

export async function submitSmartPopupSurveyResponse(input: {
  supabase: SupabaseClient;
  userId: string;
  campaignKey: string;
  surveyVersionId: string;
  answers: unknown;
  locale?: string | null;
  surface?: string | null;
  route?: string | null;
  impressionEventId?: string | null;
  context?: Record<string, unknown>;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const locale = normalizeLocale(input.locale);
  const surface = normalizeSurface(input.surface);
  const [campaign, version] = await Promise.all([
    fetchCampaignByKey(input.supabase, input.campaignKey),
    fetchSurveyVersionById(input.supabase, input.surveyVersionId),
  ]);

  if (!campaign || campaign.campaign_type !== "feedback_survey") {
    throw new Error("Feedback campaign not found.");
  }

  if (!version || version.campaign_key !== campaign.key) {
    throw new Error("Feedback survey version not found.");
  }

  const questions = normalizeSurveyQuestions(version.questions);
  const normalizedAnswers = validateSurveyAnswers(
    questions,
    input.answers
  ) as SmartPopupSurveyAnswer[];
  const submissionKey = normalizeSubmissionKey({
    userId: input.userId,
    campaignKey: campaign.key,
    surveyVersionId: version.id,
    impressionEventId: input.impressionEventId,
  });
  const existing = await findExistingSurveyResponse({
    supabase: input.supabase,
    submissionKey,
  });

  if (existing) {
    return {
      ok: true,
      duplicate: true,
      responseId: existing.id,
      rewardCredits: existing.reward_credits_awarded,
      rewardedAt: existing.rewarded_at,
    };
  }

  const { data, error } = await input.supabase
    .from("smart_popup_survey_responses")
    .insert({
      user_id: input.userId,
      campaign_key: campaign.key,
      survey_version_id: version.id,
      impression_event_id: input.impressionEventId ?? null,
      submission_key: submissionKey,
      locale,
      answers: normalizedAnswers,
      context: {
        route: input.route ?? null,
        surface,
        submittedAt: now.toISOString(),
        ...(input.context ?? {}),
      },
      reward_credits_awarded: 0,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const duplicate = await findExistingSurveyResponse({
        supabase: input.supabase,
        submissionKey,
      });
      if (duplicate) {
        return {
          ok: true,
          duplicate: true,
          responseId: duplicate.id,
          rewardCredits: duplicate.reward_credits_awarded,
          rewardedAt: duplicate.rewarded_at,
        };
      }
    }
    throw new Error(error.message);
  }

  const responseId = (data as { id: string }).id;
  let newBalance: number | null = null;
  if (campaign.reward_credits > 0) {
    const { data: rewardData, error: rewardError } = await input.supabase.rpc(
      "grant_feedback_popup_reward",
      {
        p_user_id: input.userId,
        p_response_id: responseId,
        p_amount: campaign.reward_credits,
      }
    );

    if (rewardError) {
      throw new Error(rewardError.message);
    }

    newBalance =
      typeof rewardData === "number" && Number.isFinite(rewardData)
        ? rewardData
        : null;
  }

  await recordSmartPopupEvent({
    supabase: input.supabase,
    userId: input.userId,
    campaignKey: campaign.key,
    eventType: "survey_submitted",
    surface,
    route: input.route,
    metadata: {
      campaignKey: campaign.key,
      surveyVersionId: version.id,
      responseId,
      rewardCredits: campaign.reward_credits,
      answerCount: normalizedAnswers.length,
    },
    now,
  });

  return {
    ok: true,
    duplicate: false,
    responseId,
    rewardCredits: campaign.reward_credits,
    newBalance,
    thankYou: getThankYouCopy(version.thank_you_copy, locale, campaign.reward_credits),
  };
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
