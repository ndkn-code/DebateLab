import {
  getDashboardUrl,
  resolveEmailLocale,
} from "@/lib/email/config";
import { EMAIL_TEMPLATE_META, buildTemplateVariables } from "@/lib/email/templates";
import {
  applyEmailTemplateCopyOverrides,
  getOverrideForTemplate,
  type EmailTemplateOverrideMap,
} from "@/lib/email/template-overrides";
import { buildUnsubscribeLinks } from "@/lib/email/unsubscribe";
import { vietnamDateKey, vietnamWeekday } from "@/lib/email/time";
import type {
  EmailActivitySummary,
  EmailCandidate,
  EmailProfile,
  EmailTemplateKey,
} from "@/lib/email/types";

export interface EmailMessageHistory {
  template_key: string;
  send_key: string;
  status: string;
  created_at: string;
}

export interface CandidateEvaluation {
  candidates: EmailCandidate[];
  skippedReasons: string[];
}

const ONCE_PER_USER_TEMPLATES = new Set<EmailTemplateKey>(["welcome"]);

function getBooleanPreference(
  preferences: Record<string, unknown> | null,
  key: string,
  fallback = true
) {
  const value = preferences?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function isGloballyOptedIn(preferences: Record<string, unknown> | null) {
  return getBooleanPreference(preferences, "email_notifications", true);
}

function isTemplatePreferenceEnabled(
  templateKey: EmailTemplateKey,
  preferences: Record<string, unknown> | null
) {
  const preference = EMAIL_TEMPLATE_META[templateKey].preference;
  if (preference === "global") return true;
  if (preference === "practice") return getBooleanPreference(preferences, "practice_reminders", true);
  if (preference === "streak") return getBooleanPreference(preferences, "streak_reminders", true);
  return getBooleanPreference(preferences, "achievement_updates", true);
}

function hoursSince(value: string | null, now: Date) {
  if (!value) return Number.POSITIVE_INFINITY;
  return (now.getTime() - new Date(value).getTime()) / 3_600_000;
}

function hasTemplateHistory(history: EmailMessageHistory[], templateKey: EmailTemplateKey) {
  return history.some((entry) => entry.template_key === templateKey && entry.status !== "skipped");
}

function sentWithinHours(
  history: EmailMessageHistory[],
  templateKey: EmailTemplateKey,
  hours: number,
  now: Date
) {
  return history.some(
    (entry) =>
      entry.template_key === templateKey &&
      entry.status !== "skipped" &&
      hoursSince(entry.created_at, now) < hours
  );
}

function hasSendKey(history: EmailMessageHistory[], sendKey: string) {
  return history.some((entry) => entry.send_key === sendKey);
}

function getUserName(profile: EmailProfile) {
  return (profile.display_name || profile.email?.split("@")[0] || "debater").trim();
}

function createCandidate(input: {
  profile: EmailProfile;
  summary: EmailActivitySummary;
  templateKey: EmailTemplateKey;
  sendKey: string;
  now: Date;
  templateOverrides?: EmailTemplateOverrideMap;
}): EmailCandidate {
  const { profile, summary, templateKey, sendKey } = input;
  const locale = resolveEmailLocale(profile.preferences);
  const category = EMAIL_TEMPLATE_META[templateKey].category;
  const streakState = summary.streakState ?? null;
  const unsubscribeLinks = buildUnsubscribeLinks({
    email: profile.email ?? "",
    userId: profile.id,
    category,
    templateKey,
  });
  const activeOverride = getOverrideForTemplate(input.templateOverrides, locale, templateKey);
  const template = applyEmailTemplateCopyOverrides(buildTemplateVariables(templateKey, {
    userName: getUserName(profile),
    locale,
    sessionsLast7Days: summary.sessionsLast7Days,
    minutesLast7Days: summary.minutesLast7Days,
    xpLast7Days: summary.xpLast7Days,
    bestScoreLast7Days: summary.bestScoreLast7Days,
    streakCurrent: streakState?.current ?? profile.streak_current,
    streakDots: streakState?.dots,
    level: profile.level,
    totalSessions: profile.total_sessions_completed,
    latestCourseTitle: summary.latestCourseTitle,
    latestAchievementLabel: summary.latestAchievementLabel,
  }), activeOverride?.fields);
  template.unsubscribeUrl = unsubscribeLinks.unsubscribeUrl;
  template.oneClickUnsubscribeUrl = unsubscribeLinks.oneClickUnsubscribeUrl;

  return {
    userId: profile.id,
    toEmail: profile.email ?? "",
    templateKey,
    category,
    locale,
    sendKey,
    subject: template.subject,
    variables: template,
    metadata: {
      generatedAt: input.now.toISOString(),
      dashboardUrl: getDashboardUrl(locale),
      streakComputedCurrent: streakState?.current ?? null,
      streakProfileCurrent: streakState?.profileCurrent ?? profile.streak_current,
      streakLastActiveDate: streakState?.lastActiveDate ?? null,
      streakProfileLastActiveDate:
        streakState?.profileLastActiveDate ?? profile.streak_last_active_date,
      streakMismatch: Boolean(streakState?.mismatch),
      streakTimezone: streakState?.timezone ?? "Asia/Ho_Chi_Minh",
      templateOverrideId: activeOverride?.id ?? null,
      templateOverrideVersion: activeOverride?.version ?? null,
      templateCopyOverridden: Boolean(activeOverride),
    },
  };
}

function addCandidate(
  output: EmailCandidate[],
  history: EmailMessageHistory[],
  candidate: EmailCandidate
) {
  if (hasSendKey(history, candidate.sendKey)) return;
  output.push(candidate);
}

export function evaluateEmailCandidatesForProfile(input: {
  profile: EmailProfile;
  summary: EmailActivitySummary;
  history: EmailMessageHistory[];
  now?: Date;
  templateOverrides?: EmailTemplateOverrideMap;
}): CandidateEvaluation {
  const { profile, summary, history } = input;
  const now = input.now ?? new Date();
  const today = vietnamDateKey(now);
  const streakState = summary.streakState ?? null;
  const output: EmailCandidate[] = [];
  const skippedReasons: string[] = [];

  if (!profile.email) {
    return { candidates: [], skippedReasons: ["missing_email"] };
  }

  if (!isGloballyOptedIn(profile.preferences)) {
    return { candidates: [], skippedReasons: ["email_notifications_disabled"] };
  }

  const maybeAdd = (templateKey: EmailTemplateKey, sendKey: string, blocked: boolean) => {
    if (blocked) return;
    if (!isTemplatePreferenceEnabled(templateKey, profile.preferences)) {
      skippedReasons.push(`${templateKey}_preference_disabled`);
      return;
    }
    if (ONCE_PER_USER_TEMPLATES.has(templateKey) && hasTemplateHistory(history, templateKey)) return;
    addCandidate(
      output,
      history,
      createCandidate({
        profile,
        summary,
        templateKey,
        sendKey,
        now,
        templateOverrides: input.templateOverrides,
      })
    );
  };

  maybeAdd("welcome", `welcome:${profile.id}:v1`, hasTemplateHistory(history, "welcome"));

  maybeAdd(
    "onboarding_nudge",
    `onboarding_nudge:${profile.id}:${today}`,
    profile.onboarding_completed ||
      hoursSince(profile.created_at, now) < 20 ||
      sentWithinHours(history, "onboarding_nudge", 72, now)
  );

  const inactiveHours = hoursSince(summary.lastPracticeAt ?? summary.lastActivityAt, now);
  maybeAdd(
    "practice_reminder",
    `practice_reminder:${profile.id}:${today}`,
    inactiveHours < 42 ||
      inactiveHours >= 48 ||
      sentWithinHours(history, "practice_reminder", 72, now)
  );

  maybeAdd(
    "streak_rescue",
    `streak_rescue:${profile.id}:${today}`,
    !streakState?.atRiskToday || sentWithinHours(history, "streak_rescue", 20, now)
  );

  maybeAdd(
    "winback",
    `winback:${profile.id}:${today}`,
    inactiveHours < 48 || sentWithinHours(history, "winback", 24 * 14, now)
  );

  const weekKey = today.slice(0, 7) + `:${Math.ceil(Number(today.slice(8, 10)) / 7)}`;
  maybeAdd(
    "weekly_progress",
    `weekly_progress:${profile.id}:${weekKey}`,
    vietnamWeekday(now) !== "Mon" ||
      (summary.sessionsLast7Days === 0 && summary.minutesLast7Days === 0 && summary.xpLast7Days === 0)
  );

  maybeAdd(
    "achievement",
    `achievement:${profile.id}:${summary.latestAchievementKey ?? "progress"}`,
    !summary.latestAchievementKey ||
      sentWithinHours(history, "achievement", 20, now)
  );

  maybeAdd(
    "course_nudge",
    `course_nudge:${profile.id}:${today}`,
    !summary.lastCourseStartedAt ||
      hoursSince(summary.lastCourseStartedAt, now) < 42 ||
      hoursSince(summary.lastLessonAt, now) < hoursSince(summary.lastCourseStartedAt, now) ||
      sentWithinHours(history, "course_nudge", 120, now)
  );

  return { candidates: output, skippedReasons };
}
