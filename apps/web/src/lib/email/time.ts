import { DEFAULT_EMAIL_TIME_ZONE } from "@/lib/email/config";
import type { EmailProfile, EmailStreakDot, EmailStreakState } from "@/lib/email/types";
import {
  addDaysToDateKey,
  computeEffectiveStreakState,
  dateKeyInTimezone,
  dateKeyToUtcDate,
  daysBetweenDateKeys,
  isQualifyingStreakActivity,
  QUALIFYING_STREAK_ACTIVITY_TYPES,
  QUALIFYING_STREAK_REFERENCE_TYPES,
  type StreakActivityEvent,
} from "@/lib/streaks/model";

export {
  addDaysToDateKey,
  dateKeyToUtcDate,
  daysBetweenDateKeys,
  isQualifyingStreakActivity,
  QUALIFYING_STREAK_ACTIVITY_TYPES,
  QUALIFYING_STREAK_REFERENCE_TYPES,
  type StreakActivityEvent,
};

export function vietnamDateKey(date: Date | string) {
  return dateKeyInTimezone(date, DEFAULT_EMAIL_TIME_ZONE);
}

export function vietnamWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: DEFAULT_EMAIL_TIME_ZONE,
    weekday: "short",
  }).format(date);
}

export function computeEmailStreakState(input: {
  profile: Pick<EmailProfile, "streak_current" | "streak_last_active_date">;
  activities: StreakActivityEvent[];
  now?: Date;
}): EmailStreakState {
  const state = computeEffectiveStreakState({
    profile: input.profile,
    activities: input.activities,
    now: input.now,
    timezone: DEFAULT_EMAIL_TIME_ZONE,
  });

  return {
    ...state,
    dots: state.dots as EmailStreakDot[],
  };
}
