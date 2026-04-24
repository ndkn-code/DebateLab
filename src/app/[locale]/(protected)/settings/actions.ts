"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  ANALYTICS_COOKIE_MAX_AGE,
  ANALYTICS_COOKIE_NAME,
  type SettingsDraft,
  type SettingsLocale,
  SUPPORTED_SETTINGS_LOCALES,
  AI_DIFFICULTY_OPTIONS,
  PREP_TIME_OPTIONS,
  SPEECH_TIME_OPTIONS,
  buildSavedSettingsDraft,
  draftToPreferences,
  getAnalyticsCookieValue,
  normalizeAvatarUrl,
} from "@/lib/settings";
import { DEFAULT_VOICE } from "@/lib/tts-voices";

const USER_TIMEZONE = "America/New_York";
const SETTINGS_REVALIDATE_PATHS = [
  "/settings",
  "/en/settings",
  "/dashboard",
  "/en/dashboard",
  "/history",
  "/en/history",
  "/profile",
  "/en/profile",
  "/practice",
  "/en/practice",
  "/chat",
  "/en/chat",
] as const;

interface ActivityLogRow {
  id: string;
  activity_type: string;
  reference_id: string | null;
  reference_type: string | null;
  xp_earned: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface DailyStatsRow {
  id: string;
  date: string;
  average_score: number | null;
  minutes_studied?: number;
  practice_minutes?: number;
}

interface DuelRow {
  id: string;
  completed_at: string | null;
  created_at: string;
  prep_time_seconds: number;
}

interface DuelSpeechRow {
  duel_id: string;
  duration_seconds: number;
}

interface DailyStatsAggregate {
  date: string;
  sessionsCompleted: number;
  minutes: number;
  averageScore: number | null;
  xpEarned: number;
}

function revalidateSettingsRoutes() {
  for (const path of SETTINGS_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

function getDateFormatter() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: USER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateInZone(date: string | Date) {
  return getDateFormatter().format(
    typeof date === "string" ? new Date(date) : date
  );
}

function getSupportedLocale(locale: string): SettingsLocale {
  return SUPPORTED_SETTINGS_LOCALES.includes(locale as SettingsLocale)
    ? (locale as SettingsLocale)
    : "vi";
}

function getClosestOption(value: number, supported: readonly number[]) {
  if (!Number.isFinite(value)) {
    return supported[0];
  }

  return supported.reduce((closest, option) =>
    Math.abs(option - value) < Math.abs(closest - value) ? option : closest
  );
}

function sanitizeDraft(input: SettingsDraft): SettingsDraft {
  const locale = getSupportedLocale(input.preferredLocale);
  const displayName = input.displayName.trim();
  const defaultPrepTime = getClosestOption(
    input.defaultPrepTime,
    PREP_TIME_OPTIONS
  );
  const defaultSpeechTime = getClosestOption(
    input.defaultSpeechTime,
    SPEECH_TIME_OPTIONS
  );
  const defaultDifficulty = AI_DIFFICULTY_OPTIONS.includes(
    input.defaultDifficulty
  )
    ? input.defaultDifficulty
    : "medium";

  return {
    displayName: displayName.length > 0 ? displayName.slice(0, 80) : "Debater",
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    defaultPrepTime,
    defaultSpeechTime,
    defaultDifficulty,
    ttsVoice: input.ttsVoice.trim() || DEFAULT_VOICE,
    preferredLocale: locale,
    detailedFeedback: Boolean(input.detailedFeedback),
    highlightWeakAreas: Boolean(input.highlightWeakAreas),
    explainLikeImLearning: Boolean(input.explainLikeImLearning),
    advancedTerminology: Boolean(input.advancedTerminology),
    practiceReminders: Boolean(input.practiceReminders),
    streakReminders: Boolean(input.streakReminders),
    achievementUpdates: Boolean(input.achievementUpdates),
    emailNotifications: Boolean(input.emailNotifications),
    analyticsCookiesEnabled: Boolean(input.analyticsCookiesEnabled),
  };
}

function computeStreakStats(dateKeys: string[]) {
  if (dateKeys.length === 0) {
    return {
      streakCurrent: 0,
      streakLongest: 0,
      streakLastActiveDate: null as string | null,
    };
  }

  const uniqueDates = [...new Set(dateKeys)].sort();
  let currentRun = 1;
  let longestRun = 1;
  let latestRun = 1;

  for (let index = 1; index < uniqueDates.length; index += 1) {
    const previous = new Date(`${uniqueDates[index - 1]}T00:00:00`);
    const current = new Date(`${uniqueDates[index]}T00:00:00`);
    const daysApart = Math.round(
      (current.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysApart === 1) {
      currentRun += 1;
    } else {
      currentRun = 1;
    }

    longestRun = Math.max(longestRun, currentRun);
    if (index === uniqueDates.length - 1) {
      latestRun = currentRun;
    }
  }

  return {
    streakCurrent: latestRun,
    streakLongest: longestRun,
    streakLastActiveDate: uniqueDates[uniqueDates.length - 1],
  };
}

function getNumericMetadata(
  metadata: Record<string, unknown> | null | undefined,
  keys: string[]
) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return 0;
}

function getDailyStatsMinuteField(rows: DailyStatsRow[]) {
  if (rows.some((row) => typeof row.minutes_studied === "number")) {
    return "minutes_studied" as const;
  }

  return "practice_minutes" as const;
}

function createDailyStatsAggregate(date: string): DailyStatsAggregate {
  return {
    date,
    sessionsCompleted: 0,
    minutes: 0,
    averageScore: null,
    xpEarned: 0,
  };
}

function upsertDailyAggregate(
  aggregates: Map<string, DailyStatsAggregate>,
  date: string
) {
  const existing = aggregates.get(date);
  if (existing) {
    return existing;
  }

  const created = createDailyStatsAggregate(date);
  aggregates.set(date, created);
  return created;
}

async function rebuildDailyStats(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  remainingSessionIds: Set<string>;
  duelMinutesById: Map<string, number>;
}) {
  const { supabase, userId, remainingSessionIds, duelMinutesById } = input;
  const [activityRes, dailyStatsRes] = await Promise.all([
    supabase
      .from("activity_log")
      .select(
        "id, activity_type, reference_id, reference_type, xp_earned, metadata, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
    supabase
      .from("daily_stats")
      .select("*")
      .eq("user_id", userId),
  ]);

  if (activityRes.error) {
    throw new Error(activityRes.error.message);
  }

  if (dailyStatsRes.error) {
    throw new Error(dailyStatsRes.error.message);
  }

  const aggregates = new Map<string, DailyStatsAggregate>();
  const activityRows = (activityRes.data ?? []) as ActivityLogRow[];
  const dailyStatsRows = (dailyStatsRes.data ?? []) as DailyStatsRow[];
  const minuteField = getDailyStatsMinuteField(dailyStatsRows);

  for (const row of activityRows) {
    const date = formatDateInZone(row.created_at);
    const aggregate = upsertDailyAggregate(aggregates, date);

    if (
      row.reference_type === "debate_session" &&
      row.activity_type === "debate_completed"
    ) {
      if (!row.reference_id || !remainingSessionIds.has(row.reference_id)) {
        continue;
      }

      aggregate.sessionsCompleted += 1;
      aggregate.xpEarned += row.xp_earned ?? 0;
      aggregate.minutes += Math.max(
        0,
        Math.round(
          getNumericMetadata(row.metadata, ["duration_seconds", "duration"]) / 60
        )
      );
      continue;
    }

    if (
      row.reference_type === "debate_duel" &&
      row.activity_type === "duel_completed"
    ) {
      aggregate.sessionsCompleted += 1;
      aggregate.xpEarned += row.xp_earned ?? 0;
      aggregate.minutes += row.reference_id
        ? duelMinutesById.get(row.reference_id) ?? 0
        : 0;
      continue;
    }

    aggregate.xpEarned += row.xp_earned ?? 0;
    aggregate.minutes += Math.max(
      0,
      Math.round(
        getNumericMetadata(row.metadata, ["timeSpentSeconds", "time_spent_seconds"]) /
          60
      )
    );
  }

  const existingByDate = new Map(dailyStatsRows.map((row) => [row.date, row]));

  for (const row of dailyStatsRows) {
    const aggregate = aggregates.get(row.date);
    const update = aggregate
      ? {
          sessions_completed: aggregate.sessionsCompleted,
          [minuteField]: aggregate.minutes,
          average_score: aggregate.averageScore,
          xp_earned: aggregate.xpEarned,
        }
      : {
          sessions_completed: 0,
          [minuteField]: 0,
          average_score: null,
          xp_earned: 0,
        };

    const { error } = await supabase
      .from("daily_stats")
      .update(update)
      .eq("id", row.id)
      .eq("user_id", userId);

    if (error) {
      throw new Error(error.message);
    }
  }

  for (const aggregate of aggregates.values()) {
    if (existingByDate.has(aggregate.date)) {
      continue;
    }

    const insertPayload = {
      user_id: userId,
      date: aggregate.date,
      sessions_completed: aggregate.sessionsCompleted,
      [minuteField]: aggregate.minutes,
      average_score: aggregate.averageScore,
      xp_earned: aggregate.xpEarned,
    };

    const { error } = await supabase.from("daily_stats").insert(insertPayload);
    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function saveSettings(input: SettingsDraft) {
  const draft = sanitizeDraft(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, preferences")
    .eq("id", user.id)
    .single();

  if (profileError) {
    throw new Error(profileError.message);
  }

  const preferences = draftToPreferences(
    draft,
    (profile?.preferences as Record<string, unknown> | null | undefined) ?? {}
  );

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: draft.displayName,
      avatar_url: draft.avatarUrl,
      preferences,
    })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  const cookieStore = await cookies();
  cookieStore.set(ANALYTICS_COOKIE_NAME, getAnalyticsCookieValue(draft.analyticsCookiesEnabled), {
    httpOnly: false,
    maxAge: ANALYTICS_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  revalidateSettingsRoutes();

  return {
    saved: buildSavedSettingsDraft({
      displayName: draft.displayName,
      avatarUrl: draft.avatarUrl,
      preferences,
      currentLocale: draft.preferredLocale,
    }),
  };
}

export async function clearSoloPracticeHistory() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: sessionRows, error: sessionsError } = await supabase
    .from("debate_sessions")
    .select("id")
    .eq("user_id", user.id);

  if (sessionsError) {
    throw new Error(sessionsError.message);
  }

  const deletedCount = sessionRows?.length ?? 0;

  if (deletedCount > 0) {
    const { error: deleteError } = await supabase
      .from("debate_sessions")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  const { data: duelParticipants, error: participantsError } = await supabase
    .from("debate_duel_participants")
    .select("duel_id")
    .eq("user_id", user.id);

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  const duelIds = [...new Set((duelParticipants ?? []).map((row) => row.duel_id))];
  let duelRows: DuelRow[] = [];
  let duelSpeechRows: DuelSpeechRow[] = [];

  if (duelIds.length > 0) {
    const [duelsRes, speechesRes] = await Promise.all([
      supabase
        .from("debate_duels")
        .select("id, completed_at, created_at, prep_time_seconds")
        .in("id", duelIds)
        .eq("status", "completed"),
      supabase
        .from("debate_duel_speeches")
        .select("duel_id, duration_seconds")
        .in("duel_id", duelIds),
    ]);

    if (duelsRes.error) {
      throw new Error(duelsRes.error.message);
    }

    if (speechesRes.error) {
      throw new Error(speechesRes.error.message);
    }

    duelRows = (duelsRes.data ?? []) as DuelRow[];
    duelSpeechRows = (speechesRes.data ?? []) as DuelSpeechRow[];
  }

  const speechSecondsByDuelId = duelSpeechRows.reduce((map, speech) => {
    map.set(
      speech.duel_id,
      (map.get(speech.duel_id) ?? 0) + (speech.duration_seconds ?? 0)
    );
    return map;
  }, new Map<string, number>());

  const duelMinutesById = new Map<string, number>();
  const activityDates: string[] = [];
  let duelMinutesTotal = 0;

  for (const duel of duelRows) {
    const prepWindow = Math.max(
      30,
      Math.min(duel.prep_time_seconds ?? 0, 60)
    );
    const totalSeconds =
      (speechSecondsByDuelId.get(duel.id) ?? 0) + duel.prep_time_seconds + prepWindow;
    const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
    duelMinutesById.set(duel.id, totalMinutes);
    duelMinutesTotal += totalMinutes;
    activityDates.push(formatDateInZone(duel.completed_at ?? duel.created_at));
  }

  const streak = computeStreakStats(activityDates);
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      total_sessions_completed: duelRows.length,
      total_practice_minutes: duelMinutesTotal,
      streak_current: streak.streakCurrent,
      streak_longest: streak.streakLongest,
      streak_last_active_date: streak.streakLastActiveDate,
    })
    .eq("id", user.id);

  if (profileError) {
    throw new Error(profileError.message);
  }

  await rebuildDailyStats({
    supabase,
    userId: user.id,
    remainingSessionIds: new Set<string>(),
    duelMinutesById,
  });

  revalidateSettingsRoutes();

  return {
    deletedCount,
  };
}

export async function changePassword(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Not authenticated");

  const currentPassword = (formData.get("current_password") as string | null)?.trim() ?? "";
  const newPassword = formData.get("new_password") as string;
  const confirmPassword = formData.get("confirm_password") as string;

  if (!currentPassword) {
    throw new Error("Enter your current password to continue");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  if (newPassword !== confirmPassword) {
    throw new Error("Passwords do not match");
  }

  if (!user.email) {
    throw new Error("This account cannot verify a current password");
  }

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (verifyError) {
    throw new Error("Current password is incorrect");
  }

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw new Error(error.message);
  }
}
