import type { SkillMetricKey } from "@/lib/analytics/skill-snapshot";

export const SMART_POPUP_EVENT_TYPES = [
  "impression",
  "dismissed",
  "cta_clicked",
  "dont_show_again",
] as const;

export const SMART_POPUP_SEGMENTS = [
  "first_time_user",
  "returning_user",
  "skill_focus",
  "course_discovery",
  "coach_candidate",
  "active_user",
] as const;

export type SmartPopupEventType = (typeof SMART_POPUP_EVENT_TYPES)[number];
export type SmartPopupSegment = (typeof SMART_POPUP_SEGMENTS)[number];
export type SmartPopupLocale = "en" | "vi";
export type SmartPopupSurface = "dashboard" | "global";

export interface SmartPopupCopy {
  eyebrow?: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  dismissLabel?: string;
  dontShowLabel?: string;
  alt?: string;
}

export interface SmartPopupRules {
  segments?: string[];
  roles?: string[];
  minSessions?: number;
  maxSessions?: number;
  minDaysSinceLastPractice?: number;
  requiresWeakestSkill?: boolean;
  maxCourseProgressCount?: number;
  maxCoachEventCount?: number;
}

export interface SmartPopupCampaign {
  id?: string;
  key: string;
  surface: SmartPopupSurface;
  status: "active" | "paused" | "archived";
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  cooldown_hours: number;
  max_impressions_per_user: number;
  daily_cap_per_user: number;
  weekly_cap_per_user: number;
  cta_href: string;
  image_path: string;
  copy_en: SmartPopupCopy;
  copy_vi: SmartPopupCopy;
  rules: SmartPopupRules;
  metadata?: Record<string, unknown>;
}

export interface SmartPopupCampaignStateEntry {
  impressions?: number;
  lastShownAt?: string | null;
  dismissedAt?: string | null;
  clickedAt?: string | null;
  hidden?: boolean;
}

export type SmartPopupCampaignState = Record<string, SmartPopupCampaignStateEntry>;

export interface SmartPopupImpressionCounts {
  userDaily: number;
  userWeekly: number;
  campaignDaily: number;
  campaignWeekly: number;
}

export interface SmartPopupUserTraits {
  userId?: string;
  role: string;
  onboardingCompleted: boolean;
  smartFeaturePopupsEnabled: boolean;
  firstDashboardVisit: boolean;
  totalSessionsCompleted: number;
  daysSinceSignup: number;
  daysSinceLastPractice: number | null;
  currentStreak: number;
  courseProgressCount: number;
  coachEventCount: number;
  weakestSkill: SkillMetricKey | null;
  segments: SmartPopupSegment[];
}

export interface SmartPopupPayload {
  key: string;
  surface: SmartPopupSurface;
  segment: SmartPopupSegment;
  title: string;
  body: string;
  eyebrow: string | null;
  ctaLabel: string;
  dismissLabel: string;
  dontShowAgainLabel: string;
  ctaHref: string;
  imageSrc: string;
  imageAlt: string;
  priority: number;
  metadata: Record<string, unknown>;
}
