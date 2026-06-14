export const DEFAULT_STREAK_TIMEZONE = "Asia/Ho_Chi_Minh";

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

export interface StreakProfileSnapshot {
  streak_current?: number | null;
  streak_last_active_date?: string | null;
}

export interface StreakDot {
  date: string;
  label: string;
  active: boolean;
  today: boolean;
}

export interface EffectiveStreakState {
  current: number;
  profileCurrent: number;
  lastActiveDate: string | null;
  profileLastActiveDate: string | null;
  activeToday: boolean;
  atRiskToday: boolean;
  activeDatesLast7: string[];
  dots: StreakDot[];
  timezone: string;
  mismatch: boolean;
}

const DAY_MS = 86_400_000;

export function normalizeStreakTimezone(timezone?: string | null) {
  if (!timezone) return DEFAULT_STREAK_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return DEFAULT_STREAK_TIMEZONE;
  }
}

export function dateKeyInTimezone(
  date: Date | string,
  timezone = DEFAULT_STREAK_TIMEZONE
) {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeStreakTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
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

export function daysBetweenDateKeys(
  fromDateKey: string | null | undefined,
  toDateKey: string
) {
  if (!fromDateKey) return Number.POSITIVE_INFINITY;
  const from = dateKeyToUtcDate(fromDateKey);
  const to = dateKeyToUtcDate(toDateKey);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
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

function buildDots(today: string, activeDates: Set<string>): StreakDot[] {
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

function computeCurrentStreakFromActiveDates(input: {
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

function computeProfileFallbackStreak(input: {
  profile: StreakProfileSnapshot;
  today: string;
}) {
  const profileCurrent = Math.max(0, input.profile.streak_current ?? 0);
  const lastActiveDate = input.profile.streak_last_active_date ?? null;
  const daysDifference = daysBetweenDateKeys(lastActiveDate, input.today);

  if (!lastActiveDate || profileCurrent <= 0) return 0;
  if (daysDifference < 0) return profileCurrent;
  if (daysDifference === 0 || daysDifference === 1) return profileCurrent;
  return 0;
}

export function computeEffectiveStreakState(input: {
  profile: StreakProfileSnapshot;
  activities?: StreakActivityEvent[] | null;
  timezone?: string | null;
  now?: Date;
}): EffectiveStreakState {
  const timezone = normalizeStreakTimezone(input.timezone);
  const now = input.now ?? new Date();
  const today = dateKeyInTimezone(now, timezone);
  const profileCurrent = Math.max(0, input.profile.streak_current ?? 0);
  const profileLastActiveDate = input.profile.streak_last_active_date ?? null;
  const activeDates = new Set<string>();

  for (const event of input.activities ?? []) {
    if (!isQualifyingStreakActivity(event)) continue;
    const dateKey = dateKeyInTimezone(event.created_at, timezone);
    if (dateKey <= today) activeDates.add(dateKey);
  }

  const sortedActiveDates = Array.from(activeDates).sort();
  const activityLastActiveDate = sortedActiveDates.at(-1) ?? null;
  const hasActivitySource = Array.isArray(input.activities);
  const lastActiveDate = hasActivitySource
    ? activityLastActiveDate
    : profileLastActiveDate;
  const current = hasActivitySource
    ? computeCurrentStreakFromActiveDates({
        today,
        lastActiveDate,
        activeDates,
      })
    : computeProfileFallbackStreak({ profile: input.profile, today });
  const activeToday = hasActivitySource
    ? activeDates.has(today)
    : lastActiveDate === today && current > 0;
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
    timezone,
    mismatch:
      profileCurrent !== current ||
      (profileLastActiveDate ?? null) !== (lastActiveDate ?? null),
  };
}
