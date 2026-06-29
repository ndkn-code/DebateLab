import type { Tables } from "@/types/supabase";
import {
  DEFAULT_STREAK_TIMEZONE,
  computeEffectiveStreakState,
  dateKeyInTimezone,
  normalizeStreakTimezone,
  type EffectiveStreakState,
  type StreakActivityEvent,
  type StreakDot,
} from "@/lib/streaks/model";
import { XP_PER_LEVEL, getLevelFromXp } from "@/lib/xp/model";
import type { IeltsPlanItemStatus } from "./today";

export type IeltsRetentionProfileRow = Pick<
  Tables<"profiles">,
  | "created_at"
  | "streak_current"
  | "streak_longest"
  | "streak_last_active_date"
  | "xp"
  | "level"
>;

export type IeltsRetentionPlanRow = Pick<
  Tables<"ielts_study_plans">,
  "created_at" | "daily_minutes" | "timezone"
>;

export type IeltsRetentionDailyStatRow = Pick<
  Tables<"daily_stats">,
  "date" | "minutes_studied" | "practice_minutes" | "xp_earned" | "sessions_completed"
>;

export interface IeltsRetentionPlanItemRow {
  id: string;
  status: IeltsPlanItemStatus;
  scheduled_date: string;
  estimated_minutes: number;
  completed_at: string | null;
}

export type IeltsRetentionReviewRow = Pick<Tables<"ielts_review_items">, "id" | "due_at">;

export interface IeltsRetentionTodayItemSummary {
  titleEn: string;
  titleVi: string;
  launchHref: string;
}

export interface IeltsHomeRetentionView {
  timezone: string;
  today: string;
  isFirstRunGrace: boolean;
  streak: {
    current: number;
    longest: number;
    activeToday: boolean;
    atRiskToday: boolean;
    dots: StreakDot[];
  };
  dailyGoal: {
    hasPlan: boolean;
    minutesDone: number;
    minutesGoal: number;
    remainingMinutes: number;
    progressPercent: number;
    metGoal: boolean;
    itemsDoneToday: number;
    itemsPlannedToday: number;
  };
  xp: {
    level: number;
    lifetimeXp: number;
    xpInLevel: number;
    xpPerLevel: number;
    xpToNextLevel: number;
    progressPercent: number;
  };
  nudge: {
    reviewsDueCount: number;
    reviewsOverdueCount: number;
    todayDueCount: number;
    todayItemCount: number;
    todayOverflowCount: number;
    showOverdueWarning: boolean;
    nextTitleEn: string | null;
    nextTitleVi: string | null;
    nextHref: string;
  };
}

const DEFAULT_PLAN_HREF = "/ielts/study-plan";

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function safeNumber(value: number | null | undefined): number {
  return Math.max(0, Math.round(Number.isFinite(value) ? (value ?? 0) : 0));
}

function createdToday(
  value: string | null | undefined,
  today: string,
  timezone: string,
): boolean {
  return Boolean(value && dateKeyInTimezone(value, timezone) === today);
}

function hasCompletedPlanHistory(items: readonly IeltsRetentionPlanItemRow[]): boolean {
  return items.some((item) => item.status === "completed" || Boolean(item.completed_at));
}

function buildFirstRunGrace(params: {
  profile: IeltsRetentionProfileRow | null;
  plan: IeltsRetentionPlanRow | null;
  planItems: readonly IeltsRetentionPlanItemRow[];
  hasRecentAttempts: boolean;
  today: string;
  timezone: string;
}): boolean {
  const dayOne =
    createdToday(params.profile?.created_at, params.today, params.timezone) ||
    createdToday(params.plan?.created_at, params.today, params.timezone);
  if (!dayOne) return false;
  return !params.hasRecentAttempts && !hasCompletedPlanHistory(params.planItems);
}

function buildXpView(profile: IeltsRetentionProfileRow | null): IeltsHomeRetentionView["xp"] {
  const lifetimeXp = safeNumber(profile?.xp);
  const computedLevel = getLevelFromXp(lifetimeXp);
  const level = Math.max(1, safeNumber(profile?.level), computedLevel);
  const xpInLevel = lifetimeXp % XP_PER_LEVEL;
  const xpToNextLevel = XP_PER_LEVEL - xpInLevel;

  return {
    level,
    lifetimeXp,
    xpInLevel,
    xpPerLevel: XP_PER_LEVEL,
    xpToNextLevel,
    progressPercent: clampPercent((xpInLevel / XP_PER_LEVEL) * 100),
  };
}

function buildStreakView(params: {
  profile: IeltsRetentionProfileRow | null;
  activities?: StreakActivityEvent[] | null;
  timezone: string;
  now: Date;
}): IeltsHomeRetentionView["streak"] {
  const state: EffectiveStreakState = computeEffectiveStreakState({
    profile: params.profile ?? {},
    activities: params.activities,
    timezone: params.timezone,
    now: params.now,
  });

  return {
    current: state.current,
    longest: Math.max(params.profile?.streak_longest ?? 0, state.current),
    activeToday: state.activeToday,
    atRiskToday: state.atRiskToday,
    dots: state.dots,
  };
}

function isCompletedToday(
  item: IeltsRetentionPlanItemRow,
  today: string,
  timezone: string,
): boolean {
  if (item.completed_at) {
    return dateKeyInTimezone(item.completed_at, timezone) === today;
  }
  return item.status === "completed" && item.scheduled_date === today;
}

function buildDailyGoalView(params: {
  plan: IeltsRetentionPlanRow | null;
  planItems: readonly IeltsRetentionPlanItemRow[];
  todayStat: IeltsRetentionDailyStatRow | null;
  today: string;
  timezone: string;
}): IeltsHomeRetentionView["dailyGoal"] {
  const planGoal = safeNumber(params.plan?.daily_minutes);
  const itemsPlannedToday = params.planItems.filter(
    (item) => item.scheduled_date === params.today,
  );
  const completedToday = params.planItems.filter((item) =>
    isCompletedToday(item, params.today, params.timezone),
  );
  const statMinutes = Math.max(
    safeNumber(params.todayStat?.minutes_studied),
    safeNumber(params.todayStat?.practice_minutes),
  );
  const completedMinutes = completedToday.reduce(
    (sum, item) => sum + safeNumber(item.estimated_minutes),
    0,
  );
  const minutesDone = Math.max(statMinutes, completedMinutes);
  const minutesGoal = planGoal;

  return {
    hasPlan: Boolean(params.plan),
    minutesDone,
    minutesGoal,
    remainingMinutes: Math.max(minutesGoal - minutesDone, 0),
    progressPercent: minutesGoal > 0 ? clampPercent((minutesDone / minutesGoal) * 100) : 0,
    metGoal: minutesGoal > 0 && minutesDone >= minutesGoal,
    itemsDoneToday: completedToday.length,
    itemsPlannedToday: itemsPlannedToday.length,
  };
}

function buildNudgeView(params: {
  reviewsDue: readonly IeltsRetentionReviewRow[];
  todayItems: readonly IeltsRetentionTodayItemSummary[];
  todayDueCount: number;
  todayOverflowCount: number;
  isFirstRunGrace: boolean;
  today: string;
  timezone: string;
}): IeltsHomeRetentionView["nudge"] {
  const next = params.todayItems[0] ?? null;
  const reviewsOverdueCount = params.reviewsDue.filter(
    (review) => dateKeyInTimezone(review.due_at, params.timezone) < params.today,
  ).length;

  return {
    reviewsDueCount: params.reviewsDue.length,
    reviewsOverdueCount,
    todayDueCount: Math.max(0, params.todayDueCount),
    todayItemCount: params.todayItems.length,
    todayOverflowCount: Math.max(0, params.todayOverflowCount),
    showOverdueWarning: reviewsOverdueCount > 0 && !params.isFirstRunGrace,
    nextTitleEn: next?.titleEn ?? null,
    nextTitleVi: next?.titleVi ?? null,
    nextHref: next?.launchHref ?? DEFAULT_PLAN_HREF,
  };
}

export function todayIsoForIeltsRetention(now: Date, timezone?: string | null): string {
  return dateKeyInTimezone(now, normalizeStreakTimezone(timezone ?? DEFAULT_STREAK_TIMEZONE));
}

export function buildIeltsHomeRetentionView(params: {
  profile: IeltsRetentionProfileRow | null;
  plan: IeltsRetentionPlanRow | null;
  planItems: readonly IeltsRetentionPlanItemRow[];
  todayStat: IeltsRetentionDailyStatRow | null;
  reviewsDue: readonly IeltsRetentionReviewRow[];
  todayItems: readonly IeltsRetentionTodayItemSummary[];
  todayDueCount: number;
  todayOverflowCount: number;
  hasRecentAttempts?: boolean;
  activities?: StreakActivityEvent[] | null;
  now?: Date;
}): IeltsHomeRetentionView {
  const now = params.now ?? new Date();
  const timezone = normalizeStreakTimezone(params.plan?.timezone ?? DEFAULT_STREAK_TIMEZONE);
  const today = todayIsoForIeltsRetention(now, timezone);
  const isFirstRunGrace = buildFirstRunGrace({
    profile: params.profile,
    plan: params.plan,
    planItems: params.planItems,
    hasRecentAttempts: Boolean(params.hasRecentAttempts),
    today,
    timezone,
  });

  return {
    timezone,
    today,
    isFirstRunGrace,
    streak: buildStreakView({
      profile: params.profile,
      activities: params.activities,
      timezone,
      now,
    }),
    dailyGoal: buildDailyGoalView({
      plan: params.plan,
      planItems: params.planItems,
      todayStat: params.todayStat,
      today,
      timezone,
    }),
    xp: buildXpView(params.profile),
    nudge: buildNudgeView({
      reviewsDue: params.reviewsDue,
      todayItems: params.todayItems,
      todayDueCount: params.todayDueCount,
      todayOverflowCount: params.todayOverflowCount,
      isFirstRunGrace,
      today,
      timezone,
    }),
  };
}
