import type { SkillMetricKey } from "@/lib/analytics/skill-snapshot";
import type {
  SmartPopupCampaign,
  SmartPopupCampaignState,
  SmartPopupCampaignStateEntry,
  SmartPopupImpressionCounts,
  SmartPopupLocale,
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

function asFiniteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
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
        now: input.now,
      })
    )
    .sort((left, right) => {
      if (left.priority !== right.priority) return left.priority - right.priority;
      return left.key.localeCompare(right.key);
    });
}

function applyTemplate(value: string | undefined, traits: SmartPopupUserTraits, locale: SmartPopupLocale) {
  const weakestSkill = traits.weakestSkill
    ? SKILL_LABELS[locale][traits.weakestSkill]
    : SKILL_LABELS[locale].logic;

  return (value ?? "").replaceAll("{weakestSkill}", weakestSkill);
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
  const title = applyTemplate(copy.title ?? fallbackCopy.title, input.traits, locale);
  const body = applyTemplate(copy.body ?? fallbackCopy.body, input.traits, locale);

  return {
    key: input.campaign.key,
    surface: input.campaign.surface,
    segment: pickPrimarySegment(input.campaign, input.traits),
    title,
    body,
    eyebrow: applyTemplate(copy.eyebrow ?? fallbackCopy.eyebrow, input.traits, locale) || null,
    ctaLabel: applyTemplate(copy.ctaLabel ?? fallbackCopy.ctaLabel ?? "Continue", input.traits, locale),
    dismissLabel: applyTemplate(copy.dismissLabel ?? fallbackCopy.dismissLabel ?? "Later", input.traits, locale),
    dontShowAgainLabel: applyTemplate(
      copy.dontShowLabel ?? fallbackCopy.dontShowLabel ?? "Don't show this again",
      input.traits,
      locale
    ),
    ctaHref: input.campaign.cta_href,
    imageSrc: input.campaign.image_path,
    imageAlt: applyTemplate(copy.alt ?? fallbackCopy.alt ?? input.campaign.key, input.traits, locale),
    priority: input.campaign.priority,
    metadata: {
      campaignKey: input.campaign.key,
      segment: pickPrimarySegment(input.campaign, input.traits),
      weakestSkill: input.traits.weakestSkill,
    },
  };
}

export function updateCampaignStateForEvent(input: {
  campaignState: SmartPopupCampaignState;
  campaignKey: string;
  eventType: "impression" | "dismissed" | "cta_clicked" | "dont_show_again";
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
