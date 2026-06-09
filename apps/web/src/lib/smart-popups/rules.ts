import type { SkillMetricKey } from "@/lib/analytics/skill-snapshot";
import type {
  SmartPopupCampaign,
  SmartPopupCampaignState,
  SmartPopupCampaignStateEntry,
  SmartPopupFact,
  SmartPopupFactIcon,
  SmartPopupImpressionCounts,
  SmartPopupLocale,
  SmartPopupKind,
  SmartPopupPayload,
  SmartPopupSegment,
  SmartPopupUserTraits,
} from "@/lib/smart-popups/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const SKILL_LABELS: Record<SmartPopupLocale, Record<SkillMetricKey, string>> = {
  en: {
    clarity: "claim clarity",
    logic: "logic",
    rebuttal: "rebuttals",
    evidence: "evidence",
    delivery: "delivery",
  },
  vi: {
    clarity: "độ rõ của luận điểm",
    logic: "logic",
    rebuttal: "phản biện",
    evidence: "dẫn chứng",
    delivery: "trình bày",
  },
};

const SKILL_FOCUS_LABELS: Record<SmartPopupLocale, Record<SkillMetricKey, string>> = {
  en: {
    clarity: "clarity",
    logic: "logic",
    rebuttal: "rebuttal",
    evidence: "evidence",
    delivery: "delivery",
  },
  vi: {
    clarity: "độ rõ",
    logic: "logic",
    rebuttal: "phản biện",
    evidence: "dẫn chứng",
    delivery: "trình bày",
  },
};

const VALID_FACT_ICONS: SmartPopupFactIcon[] = [
  "target",
  "chart",
  "clock",
  "gift",
  "book",
  "chat",
  "flame",
];

function asFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function getPopupKind(campaign: SmartPopupCampaign): SmartPopupKind {
  if (campaign.campaign_type === "feedback_survey") return "feedback_survey";

  const metadataKind = campaign.metadata?.popupKind;
  if (
    metadataKind === "feature_announcement" ||
    metadataKind === "practice_suggestion" ||
    metadataKind === "reminder_opt_in"
  ) {
    return metadataKind;
  }

  return "practice_suggestion";
}

function hasAnySegment(
  campaignSegments: string[] | undefined,
  userSegments: SmartPopupSegment[]
) {
  if (!campaignSegments || campaignSegments.length === 0) return true;
  return campaignSegments.some((segment) => userSegments.includes(segment as SmartPopupSegment));
}

function isInWindow(
  campaign: Pick<SmartPopupCampaign, "starts_at" | "ends_at">,
  now: Date
) {
  const nowTime = now.getTime();
  if (campaign.starts_at && new Date(campaign.starts_at).getTime() > nowTime) {
    return false;
  }

  if (campaign.ends_at && new Date(campaign.ends_at).getTime() <= nowTime) {
    return false;
  }

  return true;
}

function isCooldownClear(
  state: SmartPopupCampaignStateEntry | undefined,
  cooldownHours: number,
  now: Date
) {
  if (!state?.lastShownAt || cooldownHours <= 0) return true;
  const lastShown = new Date(state.lastShownAt).getTime();
  if (!Number.isFinite(lastShown)) return true;
  return now.getTime() - lastShown >= cooldownHours * 60 * 60 * 1000;
}

function routeMatches(routeIncludes: string[] | undefined, route?: string) {
  if (!routeIncludes || routeIncludes.length === 0) return true;
  const normalized = (route ?? "").toLowerCase();
  return routeIncludes.some((needle) =>
    normalized.includes(needle.toLowerCase())
  );
}

function isRepeatWindowClear(
  campaign: SmartPopupCampaign,
  state: SmartPopupCampaignStateEntry | undefined,
  now: Date
) {
  if (campaign.campaign_type !== "feedback_survey") return true;

  const submissions = asFiniteNumber(state?.submissions, 0);
  const maxSubmissions = asFiniteNumber(
    campaign.rules?.maxSubmissionsPerUser,
    1
  );

  if (submissions >= maxSubmissions) return false;
  if (!state?.submittedAt) return true;

  const repeatDays = campaign.rules?.repeatIntervalDays;
  if (typeof repeatDays !== "number" || repeatDays <= 0) return false;

  const lastSubmitted = new Date(state.submittedAt).getTime();
  if (!Number.isFinite(lastSubmitted)) return true;

  return now.getTime() - lastSubmitted >= repeatDays * DAY_MS;
}

export function buildPopupSegments(
  traits: Omit<SmartPopupUserTraits, "segments">
): SmartPopupSegment[] {
  if (
    !traits.smartFeaturePopupsEnabled ||
    !traits.onboardingCompleted ||
    traits.firstDashboardVisit
  ) {
    return [];
  }

  const segments: SmartPopupSegment[] = [];

  if (traits.totalSessionsCompleted > 0) {
    segments.push("active_user");
  }

  if (traits.totalSessionsCompleted <= 0) {
    segments.push("first_time_user");
  }

  if (
    traits.totalSessionsCompleted > 0 &&
    traits.daysSinceLastPractice != null &&
    traits.daysSinceLastPractice >= 3
  ) {
    segments.push("returning_user");
  }

  if (traits.totalSessionsCompleted >= 2 && traits.weakestSkill) {
    segments.push("skill_focus");
  }

  if (traits.totalSessionsCompleted >= 1 && traits.courseProgressCount <= 0) {
    segments.push("course_discovery");
  }

  if (traits.totalSessionsCompleted >= 2 && traits.coachEventCount <= 0) {
    segments.push("coach_candidate");
  }

  return segments.length > 0 ? segments : ["active_user"];
}

export function isCampaignEligible(input: {
  campaign: SmartPopupCampaign;
  traits: SmartPopupUserTraits;
  campaignState?: SmartPopupCampaignState;
  impressionCounts?: SmartPopupImpressionCounts;
  surface?: string;
  route?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const { campaign, traits } = input;
  const state = input.campaignState?.[campaign.key];
  const rules = campaign.rules ?? {};
  const counts = input.impressionCounts ?? {
    userDaily: 0,
    userWeekly: 0,
    campaignDaily: 0,
    campaignWeekly: 0,
  };

  if (
    !traits.smartFeaturePopupsEnabled ||
    !traits.onboardingCompleted ||
    traits.firstDashboardVisit
  ) {
    return false;
  }

  const hasExplicitReminderEmailScope =
    traits.emailOptInScope === "reminders_only" || traits.emailOptInScope === "all";
  if (
    rules.requiresReminderEmailOptIn &&
    hasExplicitReminderEmailScope &&
    traits.emailNotificationsEnabled &&
    traits.practiceRemindersEnabled &&
    traits.streakRemindersEnabled
  ) {
    return false;
  }

  if (campaign.status !== "active" || !isInWindow(campaign, now)) {
    return false;
  }

  if (
    input.surface &&
    campaign.surface !== input.surface &&
    campaign.surface !== "global"
  ) {
    return false;
  }

  if (state?.hidden) {
    return false;
  }

  if (!isRepeatWindowClear(campaign, state, now)) {
    return false;
  }

  if (
    asFiniteNumber(state?.impressions, 0) >=
    asFiniteNumber(campaign.max_impressions_per_user, 1)
  ) {
    return false;
  }

  if (!isCooldownClear(state, asFiniteNumber(campaign.cooldown_hours, 168), now)) {
    return false;
  }

  if (counts.userDaily >= 1 || counts.userWeekly >= 3) {
    return false;
  }

  if (
    counts.campaignDaily >= asFiniteNumber(campaign.daily_cap_per_user, 1) ||
    counts.campaignWeekly >= asFiniteNumber(campaign.weekly_cap_per_user, 3)
  ) {
    return false;
  }

  if (!hasAnySegment(rules.segments, traits.segments)) {
    return false;
  }

  if (!routeMatches(rules.routeIncludes, input.route ?? undefined)) {
    return false;
  }

  if (rules.roles?.length && !rules.roles.includes(traits.role)) {
    return false;
  }

  if (
    typeof rules.minSessions === "number" &&
    traits.totalSessionsCompleted < rules.minSessions
  ) {
    return false;
  }

  if (
    typeof rules.maxSessions === "number" &&
    traits.totalSessionsCompleted > rules.maxSessions
  ) {
    return false;
  }

  if (typeof rules.minDaysSinceLastPractice === "number") {
    if (
      traits.daysSinceLastPractice == null ||
      traits.daysSinceLastPractice < rules.minDaysSinceLastPractice
    ) {
      return false;
    }
  }

  if (rules.requiresWeakestSkill && !traits.weakestSkill) {
    return false;
  }

  if (
    typeof rules.maxCourseProgressCount === "number" &&
    traits.courseProgressCount > rules.maxCourseProgressCount
  ) {
    return false;
  }

  if (
    typeof rules.maxCoachEventCount === "number" &&
    traits.coachEventCount > rules.maxCoachEventCount
  ) {
    return false;
  }

  return true;
}

export function rankSmartPopupCandidates(input: {
  campaigns: SmartPopupCampaign[];
  traits: SmartPopupUserTraits;
  campaignState?: SmartPopupCampaignState;
  impressionCountsByCampaign?: Record<string, SmartPopupImpressionCounts>;
  surface?: string;
  route?: string | null;
  now?: Date;
}) {
  return input.campaigns
    .filter((campaign) =>
      isCampaignEligible({
        campaign,
        traits: input.traits,
        campaignState: input.campaignState,
        impressionCounts: input.impressionCountsByCampaign?.[campaign.key],
        surface: input.surface,
        route: input.route,
        now: input.now,
      })
    )
    .sort((left, right) => {
      if (left.delivery_mode !== right.delivery_mode) {
        if (left.delivery_mode === "send_now") return -1;
        if (right.delivery_mode === "send_now") return 1;
      }
      if (left.priority !== right.priority) return left.priority - right.priority;
      return left.key.localeCompare(right.key);
    });
}

function getTemplateValue(input: {
  key: string;
  traits: SmartPopupUserTraits;
  locale: SmartPopupLocale;
  metadata: Record<string, unknown>;
  rewardCredits: number;
}) {
  const weakestSkill = input.traits.weakestSkill
    ? SKILL_LABELS[input.locale][input.traits.weakestSkill]
    : SKILL_LABELS[input.locale].logic;
  const skillFocus = input.traits.weakestSkill
    ? SKILL_FOCUS_LABELS[input.locale][input.traits.weakestSkill]
    : SKILL_FOCUS_LABELS[input.locale].logic;
  const metadataDuration = asFiniteNumber(input.metadata.durationMinutes, 10);
  const durationMinutes =
    input.traits.lastPracticeMinutes != null
      ? String(input.traits.lastPracticeMinutes)
      : String(metadataDuration);
  const lastScore =
    input.traits.lastScoredSessionScore != null
      ? String(input.traits.lastScoredSessionScore)
      : asText(input.metadata.fallbackScore) || "-";

  switch (input.key) {
    case "weakestSkill":
      return weakestSkill;
    case "skillFocus":
      return skillFocus;
    case "lastScore":
      return lastScore;
    case "durationMinutes":
      return durationMinutes;
    case "rewardCredits":
      return String(input.rewardCredits);
    default:
      return "";
  }
}

function applyTemplate(
  value: string | undefined,
  traits: SmartPopupUserTraits,
  locale: SmartPopupLocale,
  metadata: Record<string, unknown> = {},
  rewardCredits = 0
) {
  return (value ?? "").replace(
    /\{(weakestSkill|skillFocus|lastScore|durationMinutes|rewardCredits)\}/g,
    (_match, key: string) =>
      getTemplateValue({ key, traits, locale, metadata, rewardCredits })
  );
}

function normalizeFactIcon(value: unknown): SmartPopupFactIcon {
  return VALID_FACT_ICONS.includes(value as SmartPopupFactIcon)
    ? (value as SmartPopupFactIcon)
    : "target";
}

function getMetadataFacts(
  metadata: Record<string, unknown>,
  locale: SmartPopupLocale
) {
  const source = metadata.facts;
  if (isRecord(source)) {
    const localized = source[locale] ?? source.en;
    return Array.isArray(localized) ? localized : null;
  }
  return Array.isArray(source) ? source : null;
}

function buildDefaultFacts(input: {
  campaign: SmartPopupCampaign;
  traits: SmartPopupUserTraits;
  locale: SmartPopupLocale;
}): SmartPopupFact[] {
  const metadata = input.campaign.metadata ?? {};
  const duration = applyTemplate(
    "{durationMinutes} min",
    input.traits,
    input.locale,
    metadata,
    input.campaign.reward_credits
  );

  if (input.campaign.campaign_type === "feedback_survey") {
    return [
      {
        icon: "gift",
        label: input.locale === "vi" ? "Phần thưởng" : "Reward",
        value: `+${input.campaign.reward_credits} Credits`,
      },
      {
        icon: "clock",
        label: input.locale === "vi" ? "Thời gian" : "Time",
        value: duration,
      },
    ];
  }

  const weakestSkill = input.traits.weakestSkill
    ? SKILL_LABELS[input.locale][input.traits.weakestSkill]
    : SKILL_LABELS[input.locale].logic;
  const score = applyTemplate(
    "{lastScore}/100",
    input.traits,
    input.locale,
    metadata,
    input.campaign.reward_credits
  );

  if (input.campaign.key === "weakest-skill") {
    return [
      {
        icon: "target",
        label: input.locale === "vi" ? "Kỹ năng yếu nhất" : "Weakest skill",
        value: weakestSkill,
      },
      {
        icon: "chart",
        label: input.locale === "vi" ? "Điểm gần nhất" : "Last score",
        value: score,
      },
    ];
  }

  return [
    {
      icon: "clock",
      label: input.locale === "vi" ? "Thời gian" : "Time",
      value: duration,
    },
    {
      icon: "target",
      label: input.locale === "vi" ? "Bước tiếp theo" : "Next step",
      value: input.locale === "vi" ? "Luyện tập" : "Practice",
    },
  ];
}

function buildPopupFacts(input: {
  campaign: SmartPopupCampaign;
  traits: SmartPopupUserTraits;
  locale: SmartPopupLocale;
}): SmartPopupFact[] {
  const metadata = input.campaign.metadata ?? {};
  const metadataFacts = getMetadataFacts(metadata, input.locale);
  const facts = metadataFacts
    ?.filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => {
      const label = applyTemplate(
        asText(item.label),
        input.traits,
        input.locale,
        metadata,
        input.campaign.reward_credits
      );
      const value = applyTemplate(
        asText(item.value),
        input.traits,
        input.locale,
        metadata,
        input.campaign.reward_credits
      );
      return {
        icon: normalizeFactIcon(item.icon),
        label,
        value: value || undefined,
      };
    })
    .filter((fact) => fact.label.length > 0 && fact.value !== "-/100")
    .slice(0, 2);

  return facts && facts.length > 0
    ? facts
    : buildDefaultFacts(input).slice(0, 2);
}

function pickPrimarySegment(
  campaign: SmartPopupCampaign,
  traits: SmartPopupUserTraits
) {
  const campaignSegments = campaign.rules?.segments ?? [];
  const matched =
    campaignSegments.find((segment) =>
      traits.segments.includes(segment as SmartPopupSegment)
    ) ?? traits.segments[0];

  return (matched ?? "active_user") as SmartPopupSegment;
}

export function createSmartPopupPayload(input: {
  campaign: SmartPopupCampaign;
  traits: SmartPopupUserTraits;
  locale?: SmartPopupLocale;
}): SmartPopupPayload {
  const locale = input.locale ?? "en";
  const copy =
    locale === "vi" ? input.campaign.copy_vi : input.campaign.copy_en;
  const fallbackCopy = input.campaign.copy_en;
  const metadata = input.campaign.metadata ?? {};
  const title = applyTemplate(
    copy.title ?? fallbackCopy.title,
    input.traits,
    locale,
    metadata,
    input.campaign.reward_credits
  );
  const body = applyTemplate(
    copy.body ?? fallbackCopy.body,
    input.traits,
    locale,
    metadata,
    input.campaign.reward_credits
  );

  return {
    key: input.campaign.key,
    surface: input.campaign.surface,
    campaignType: input.campaign.campaign_type,
    popupKind: getPopupKind(input.campaign),
    segment: pickPrimarySegment(input.campaign, input.traits),
    title,
    body,
    eyebrow: applyTemplate(
      copy.eyebrow ?? fallbackCopy.eyebrow,
      input.traits,
      locale,
      metadata,
      input.campaign.reward_credits
    ) || null,
    ctaLabel: applyTemplate(
      copy.ctaLabel ?? fallbackCopy.ctaLabel ?? "Continue",
      input.traits,
      locale,
      metadata,
      input.campaign.reward_credits
    ),
    dismissLabel: applyTemplate(
      copy.dismissLabel ?? fallbackCopy.dismissLabel ?? "Later",
      input.traits,
      locale,
      metadata,
      input.campaign.reward_credits
    ),
    dontShowAgainLabel: applyTemplate(
      copy.dontShowLabel ?? fallbackCopy.dontShowLabel ?? "Don't show this again",
      input.traits,
      locale,
      metadata,
      input.campaign.reward_credits
    ),
    ctaHref: input.campaign.cta_href,
    imageSrc: input.campaign.image_path,
    imageAlt: applyTemplate(
      copy.alt ?? fallbackCopy.alt ?? input.campaign.key,
      input.traits,
      locale,
      metadata,
      input.campaign.reward_credits
    ),
    facts: buildPopupFacts({ campaign: input.campaign, traits: input.traits, locale }),
    priority: input.campaign.priority,
    metadata: {
      campaignKey: input.campaign.key,
      popupKind: getPopupKind(input.campaign),
      notificationPattern: input.campaign.metadata?.notificationPattern,
      segment: pickPrimarySegment(input.campaign, input.traits),
      weakestSkill: input.traits.weakestSkill,
      lastScoredSessionScore: input.traits.lastScoredSessionScore,
      lastPracticeMinutes: input.traits.lastPracticeMinutes,
    },
  };
}

export function updateCampaignStateForEvent(input: {
  campaignState: SmartPopupCampaignState;
  campaignKey: string;
  eventType:
    | "impression"
    | "dismissed"
    | "cta_clicked"
    | "dont_show_again"
    | "survey_started"
    | "survey_submitted"
    | "survey_abandoned";
  occurredAt?: string;
}) {
  const occurredAt = input.occurredAt ?? new Date().toISOString();
  const current = input.campaignState[input.campaignKey] ?? {};
  const next: SmartPopupCampaignStateEntry = {
    ...current,
  };

  if (input.eventType === "impression") {
    next.impressions = asFiniteNumber(current.impressions, 0) + 1;
    next.lastShownAt = occurredAt;
  }

  if (input.eventType === "dismissed") {
    next.dismissedAt = occurredAt;
  }

  if (input.eventType === "cta_clicked") {
    next.clickedAt = occurredAt;
  }

  if (input.eventType === "survey_started") {
    next.surveyStartedAt = occurredAt;
  }

  if (input.eventType === "survey_submitted") {
    next.submittedAt = occurredAt;
    next.submissions = asFiniteNumber(current.submissions, 0) + 1;
  }

  if (input.eventType === "survey_abandoned") {
    next.abandonedAt = occurredAt;
    next.dismissedAt = occurredAt;
  }

  if (input.eventType === "dont_show_again") {
    next.hidden = true;
    next.dismissedAt = occurredAt;
  }

  return {
    ...input.campaignState,
    [input.campaignKey]: next,
  };
}

export function getDaysBetween(from: string | null | undefined, to = new Date()) {
  if (!from) return null;
  const timestamp = new Date(from).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((to.getTime() - timestamp) / DAY_MS));
}
