import type { AnalyticsRangePreset, PracticeLanguage } from "@/types";

export const PROFILE_TAB_DATA_STATES = [
  "not_found",
  "blocked",
  "private",
  "visible",
] as const;

export const PROFILE_ACTIVITY_KINDS = [
  "practice",
  "duel",
  "lesson",
  "course",
  "achievement",
  "level",
  "activity",
] as const;

export type ProfileTabDataState = (typeof PROFILE_TAB_DATA_STATES)[number];
export type ProfileTabViewerMode = "self" | "public";
export type ProfileActivityKind = (typeof PROFILE_ACTIVITY_KINDS)[number];

export interface ProfileAnalyticsTabData {
  state: ProfileTabDataState;
  viewerMode: ProfileTabViewerMode;
  range: AnalyticsRangePreset;
  practiceLanguage: PracticeLanguage;
  totalPracticeMinutes: number;
  totalSessions: number;
  averageScore: number | null;
  speakingCount: number;
  debateCount: number;
  level: number | null;
  lifetimeXp: number | null;
}

export interface ProfileActivityFeedItem {
  id: string;
  kind: ProfileActivityKind;
  title: string;
  subtitle: string | null;
  createdAt: string;
  xpEarned: number;
  score: number | null;
  durationMinutes: number | null;
  href: string | null;
}

export interface ProfileActivityFeedData {
  state: ProfileTabDataState;
  viewerMode: ProfileTabViewerMode;
  items: ProfileActivityFeedItem[];
}

export interface ProfileAchievementItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  titleReward: string | null;
  xpReward: number;
  conditionType: string;
  conditionValue: number;
  sortOrder: number;
  unlocked: boolean;
  unlockedAt: string | null;
  progressValue: number | null;
  progressTarget: number | null;
  progressPercent: number | null;
  isFeatured: boolean;
}

export interface ProfileAchievementsData {
  state: ProfileTabDataState;
  viewerMode: ProfileTabViewerMode;
  featured: ProfileAchievementItem[];
  achievements: ProfileAchievementItem[];
  categories: string[];
  unlockedCount: number;
  totalCount: number;
  maxFeatured: number;
}

const DEFAULT_ANALYTICS: ProfileAnalyticsTabData = {
  state: "private",
  viewerMode: "public",
  range: "30d",
  practiceLanguage: "en",
  totalPracticeMinutes: 0,
  totalSessions: 0,
  averageScore: null,
  speakingCount: 0,
  debateCount: 0,
  level: null,
  lifetimeXp: null,
};

const DEFAULT_ACTIVITY: ProfileActivityFeedData = {
  state: "private",
  viewerMode: "public",
  items: [],
};

const DEFAULT_ACHIEVEMENTS: ProfileAchievementsData = {
  state: "private",
  viewerMode: "public",
  featured: [],
  achievements: [],
  categories: [],
  unlockedCount: 0,
  totalCount: 0,
  maxFeatured: 4,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function toBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toState(value: unknown): ProfileTabDataState {
  return PROFILE_TAB_DATA_STATES.includes(value as ProfileTabDataState)
    ? (value as ProfileTabDataState)
    : "private";
}

function toViewerMode(value: unknown): ProfileTabViewerMode {
  return value === "self" ? "self" : "public";
}

function toRange(value: unknown): AnalyticsRangePreset {
  return value === "7d" || value === "90d" ? value : "30d";
}

function toPracticeLanguage(value: unknown): PracticeLanguage {
  return value === "vi" ? "vi" : "en";
}

function toActivityKind(value: unknown): ProfileActivityKind {
  return PROFILE_ACTIVITY_KINDS.includes(value as ProfileActivityKind)
    ? (value as ProfileActivityKind)
    : "activity";
}

function coerceStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function getAchievementProgressPercent(input: {
  progressValue: number | null | undefined;
  progressTarget: number | null | undefined;
  unlocked?: boolean;
}) {
  if (input.unlocked) return 100;
  const value = toNumber(input.progressValue, 0);
  const target = toNumber(input.progressTarget, 0);
  if (target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

export function normalizeFeaturedAchievementIds(
  achievementIds: unknown,
  maxFeatured = 4
) {
  if (!Array.isArray(achievementIds)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const id of achievementIds) {
    if (typeof id !== "string") continue;
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
    if (normalized.length >= maxFeatured) break;
  }

  return normalized;
}

export function coerceProfileAnalyticsTabData(
  value: unknown
): ProfileAnalyticsTabData {
  if (!isRecord(value)) return DEFAULT_ANALYTICS;

  return {
    state: toState(value.state),
    viewerMode: toViewerMode(value.viewerMode),
    range: toRange(value.range),
    practiceLanguage: toPracticeLanguage(value.practiceLanguage),
    totalPracticeMinutes: toNumber(value.totalPracticeMinutes),
    totalSessions: toNumber(value.totalSessions),
    averageScore: toNullableNumber(value.averageScore),
    speakingCount: toNumber(value.speakingCount),
    debateCount: toNumber(value.debateCount),
    level: toNullableNumber(value.level),
    lifetimeXp: toNullableNumber(value.lifetimeXp),
  };
}

export function coerceProfileActivityFeedData(
  value: unknown
): ProfileActivityFeedData {
  if (!isRecord(value)) return DEFAULT_ACTIVITY;

  const items = Array.isArray(value.items)
    ? value.items.filter(isRecord).map((item): ProfileActivityFeedItem => ({
        id: toString(item.id, cryptoSafeId(item.title, item.createdAt)),
        kind: toActivityKind(item.kind),
        title: toString(item.title, "Activity"),
        subtitle: toNullableString(item.subtitle),
        createdAt: toString(item.createdAt, new Date(0).toISOString()),
        xpEarned: toNumber(item.xpEarned),
        score: toNullableNumber(item.score),
        durationMinutes: toNullableNumber(item.durationMinutes),
        href: toNullableString(item.href),
      }))
    : [];

  return {
    state: toState(value.state),
    viewerMode: toViewerMode(value.viewerMode),
    items,
  };
}

export function coerceProfileAchievementItem(
  value: unknown
): ProfileAchievementItem | null {
  if (!isRecord(value)) return null;

  return {
    id: toString(value.id),
    slug: toString(value.slug),
    title: toString(value.title, "Achievement"),
    description: toString(value.description),
    category: toString(value.category, "general"),
    icon: toString(value.icon, "*"),
    titleReward: toNullableString(value.titleReward),
    xpReward: toNumber(value.xpReward),
    conditionType: toString(value.conditionType),
    conditionValue: toNumber(value.conditionValue),
    sortOrder: toNumber(value.sortOrder),
    unlocked: toBoolean(value.unlocked),
    unlockedAt: toNullableString(value.unlockedAt),
    progressValue: toNullableNumber(value.progressValue),
    progressTarget: toNullableNumber(value.progressTarget),
    progressPercent: toNullableNumber(value.progressPercent),
    isFeatured: toBoolean(value.isFeatured),
  };
}

export function coerceProfileAchievementsData(
  value: unknown
): ProfileAchievementsData {
  if (!isRecord(value)) return DEFAULT_ACHIEVEMENTS;

  const achievements = Array.isArray(value.achievements)
    ? value.achievements
        .map(coerceProfileAchievementItem)
        .filter((item): item is ProfileAchievementItem => Boolean(item?.id))
    : [];
  const featured = Array.isArray(value.featured)
    ? value.featured
        .map(coerceProfileAchievementItem)
        .filter((item): item is ProfileAchievementItem => Boolean(item?.id))
    : achievements.filter((item) => item.isFeatured && item.unlocked).slice(0, 4);

  return {
    state: toState(value.state),
    viewerMode: toViewerMode(value.viewerMode),
    featured,
    achievements,
    categories: coerceStringArray(value.categories),
    unlockedCount: toNumber(value.unlockedCount),
    totalCount: toNumber(value.totalCount, achievements.length),
    maxFeatured: toNumber(value.maxFeatured, 4),
  };
}

function cryptoSafeId(...parts: unknown[]) {
  return parts
    .map((part) => String(part ?? ""))
    .join(":")
    .replace(/[^a-z0-9:_-]/gi, "")
    .slice(0, 80);
}
