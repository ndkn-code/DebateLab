import { DEFAULT_EMAIL_TIME_ZONE } from "@/lib/email/config";
import type { EmailProfile, EmailStreakDot, EmailStreakState } from "@/lib/email/types";

export const QUALIFYING_STREAK_ACTIVITY_TYPES = new Set([
  "debate_completed",
  "duel_completed",
  "lesson_completed",
]);

export const QUALIFYING_STREAK_REFERENCE_TYPES = new Set([
  "debate_session",
  "debate_duel",
]);

export interface StreakActivityEvent {
  activity_type?: string | null;
  reference_type?: string | null;
  created_at: string;
}

export function vietnamDateKey(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_EMAIL_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function vietnamWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_EMAIL_TIME_ZONE,
    weekday: "short",
  }).format(date);
}

export function dateKeyToUtcDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = dateKeyToUtcDate(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysBetweenDateKeys(fromDateKey: string | null, toDateKey: string) {
  if (!fromDateKey) return Number.POSITIVE_INFINITY;
  const from = dateKeyToUtcDate(fromDateKey);
  const to = dateKeyToUtcDate(toDateKey);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

export function isQualifyingStreakActivity(event: StreakActivityEvent) {
  return (
    QUALIFYING_STREAK_ACTIVITY_TYPES.has(event.activity_type ?? "") ||
    QUALIFYING_STREAK_REFERENCE_TYPES.has(event.reference_type ?? "")
  );
}

function weekdayLabel(dateKey: string) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
  }).format(dateKeyToUtcDate(dateKey));
  const labels: Record<string, string> = {
    Sun: "CN",
    Mon: "T2",
    Tue: "T3",
    Wed: "T4",
    Thu: "T5",
    Fri: "T6",
    Sat: "T7",
  };

  return labels[weekday] ?? weekday;
}

function buildDots(today: string, activeDates: Set<string>): EmailStreakDot[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDaysToDateKey(today, index - 6);
    return {
      date,
      label: weekdayLabel(date),
      active: activeDates.has(date),
      today: date === today,
    };
  });
}

function computeCurrentStreak(input: {
  today: string;
  lastActiveDate: string | null;
  activeDates: Set<string>;
}) {
  const { today, lastActiveDate, activeDates } = input;
  if (!lastActiveDate) return 0;

  const yesterday = addDaysToDateKey(today, -1);
  if (lastActiveDate !== today && lastActiveDate !== yesterday) return 0;

  let cursor = lastActiveDate;
  let count = 0;
  while (activeDates.has(cursor)) {
    count += 1;
    cursor = addDaysToDateKey(cursor, -1);
  }

  return count;
}

export function computeEmailStreakState(input: {
  profile: Pick<EmailProfile, "streak_current" | "streak_last_active_date">;
  activities: StreakActivityEvent[];
  now?: Date;
}): EmailStreakState {
  const now = input.now ?? new Date();
  const today = vietnamDateKey(now);
  const activeDates = new Set<string>();
  for (const event of input.activities) {
    if (!isQualifyingStreakActivity(event)) continue;
    const dateKey = vietnamDateKey(event.created_at);
    if (dateKey <= today) activeDates.add(dateKey);
  }
  const sortedActiveDates = Array.from(activeDates).sort();
  const lastActiveDate = sortedActiveDates.at(-1) ?? null;
  const current = computeCurrentStreak({ today, lastActiveDate, activeDates });
  const profileLastActiveDate = input.profile.streak_last_active_date;
  const profileCurrent = input.profile.streak_current ?? 0;
  const activeToday = activeDates.has(today);
  const atRiskToday =
    current > 0 &&
    !activeToday &&
    lastActiveDate === addDaysToDateKey(today, -1);

  return {
    current,
    profileCurrent,
    lastActiveDate,
    profileLastActiveDate,
    activeToday,
    atRiskToday,
    activeDatesLast7: buildDots(today, activeDates)
      .filter((dot) => dot.active)
      .map((dot) => dot.date),
    dots: buildDots(today, activeDates),
    timezone: DEFAULT_EMAIL_TIME_ZONE,
    mismatch: profileCurrent !== current || (profileLastActiveDate ?? null) !== lastActiveDate,
  };
}
