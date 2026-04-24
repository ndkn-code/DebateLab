import { DEFAULT_VOICE } from "@/lib/tts-voices";

export const ANALYTICS_COOKIE_NAME = "debatelab_analytics_consent";
export const ANALYTICS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const SETTINGS_DRAFT_STORAGE_KEY = "debatelab-settings-draft";

export const SUPPORTED_SETTINGS_LOCALES = ["vi", "en"] as const;
export type SettingsLocale = (typeof SUPPORTED_SETTINGS_LOCALES)[number];
export type SettingsDifficulty = "easy" | "medium" | "hard";

export interface SettingsPreferences extends Record<string, unknown> {
  default_prep_time?: number;
  default_speech_time?: number;
  default_ai_difficulty?: SettingsDifficulty;
  tts_voice?: string;
  preferred_locale?: SettingsLocale;
  detailed_feedback?: boolean;
  highlight_weak_areas?: boolean;
  explain_like_im_learning?: boolean;
  advanced_terminology?: boolean;
  practice_reminders?: boolean;
  streak_reminders?: boolean;
  achievement_updates?: boolean;
  email_notifications?: boolean;
  analytics_cookies_enabled?: boolean;
}

export interface SettingsDraft {
  displayName: string;
  avatarUrl: string;
  defaultPrepTime: number;
  defaultSpeechTime: number;
  defaultDifficulty: SettingsDifficulty;
  ttsVoice: string;
  preferredLocale: SettingsLocale;
  detailedFeedback: boolean;
  highlightWeakAreas: boolean;
  explainLikeImLearning: boolean;
  advancedTerminology: boolean;
  practiceReminders: boolean;
  streakReminders: boolean;
  achievementUpdates: boolean;
  emailNotifications: boolean;
  analyticsCookiesEnabled: boolean;
}

export interface SettingsDraftSnapshot {
  userId: string;
  draft: SettingsDraft;
  saved: SettingsDraft;
}

export interface AvatarPreset {
  id: string;
  label: string;
  monogram: string;
  colors: [string, string];
}

export const PREP_TIME_OPTIONS = [60, 120, 180, 300] as const;
export const SPEECH_TIME_OPTIONS = [120, 180, 240, 300] as const;
export const AI_DIFFICULTY_OPTIONS: SettingsDifficulty[] = [
  "easy",
  "medium",
  "hard",
];

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: "atlas",
    label: "Atlas",
    monogram: "A",
    colors: ["#4D86F7", "#8FB5FA"],
  },
  {
    id: "nova",
    label: "Nova",
    monogram: "N",
    colors: ["#6AA7FF", "#54D0FF"],
  },
  {
    id: "sage",
    label: "Sage",
    monogram: "S",
    colors: ["#34C759", "#7DE2A5"],
  },
  {
    id: "blaze",
    label: "Blaze",
    monogram: "B",
    colors: ["#FF8C5A", "#F5B942"],
  },
  {
    id: "echo",
    label: "Echo",
    monogram: "E",
    colors: ["#7B61FF", "#B39CFF"],
  },
  {
    id: "lumen",
    label: "Lumen",
    monogram: "L",
    colors: ["#00B8D9", "#8EE7F5"],
  },
];

const DEFAULT_SETTINGS = {
  defaultPrepTime: 180,
  defaultSpeechTime: 180,
  defaultDifficulty: "medium" as SettingsDifficulty,
  ttsVoice: DEFAULT_VOICE,
  preferredLocale: "vi" as SettingsLocale,
  detailedFeedback: true,
  highlightWeakAreas: true,
  explainLikeImLearning: true,
  advancedTerminology: false,
  practiceReminders: true,
  streakReminders: true,
  achievementUpdates: true,
  emailNotifications: true,
  analyticsCookiesEnabled: true,
};

const avatarUrlCache = new Map<string, string>();

function coerceBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function coerceLocale(value: unknown, fallback: SettingsLocale) {
  return SUPPORTED_SETTINGS_LOCALES.includes(value as SettingsLocale)
    ? (value as SettingsLocale)
    : fallback;
}

function coerceDifficulty(value: unknown, fallback: SettingsDifficulty) {
  return AI_DIFFICULTY_OPTIONS.includes(value as SettingsDifficulty)
    ? (value as SettingsDifficulty)
    : fallback;
}

function coerceDuration(
  value: unknown,
  supported: readonly number[],
  fallback: number
) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return supported.includes(value)
    ? value
    : supported.reduce((closest, option) =>
        Math.abs(option - value) < Math.abs(closest - value) ? option : closest
      );
}

export function getAnalyticsCookieValue(enabled: boolean) {
  return enabled ? "granted" : "denied";
}

export function isAnalyticsEnabled(cookieValue?: string | null) {
  return cookieValue !== "denied";
}

export function serializeAvatarPreset(preset: AvatarPreset) {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" role="img" aria-label="${preset.label}" data-preset="${preset.id}">
      <defs>
        <linearGradient id="g-${preset.id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${preset.colors[0]}" />
          <stop offset="100%" stop-color="${preset.colors[1]}" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill="url(#g-${preset.id})" />
      <circle cx="60" cy="60" r="48" fill="rgba(255,255,255,0.14)" />
      <circle cx="60" cy="60" r="38" fill="rgba(11,20,36,0.12)" />
      <text x="60" y="73" text-anchor="middle" font-size="42" font-family="ui-sans-serif, system-ui, sans-serif" font-weight="700" fill="#FFFFFF">
        ${preset.monogram}
      </text>
    </svg>
  `.trim();
}

export function getAvatarPresetUrl(presetId: string) {
  if (avatarUrlCache.has(presetId)) {
    return avatarUrlCache.get(presetId) ?? "";
  }

  const preset =
    AVATAR_PRESETS.find((candidate) => candidate.id === presetId) ??
    AVATAR_PRESETS[0];
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    serializeAvatarPreset(preset)
  )}`;
  avatarUrlCache.set(preset.id, url);
  return url;
}

export function getAvatarPresetId(avatarUrl?: string | null) {
  if (!avatarUrl || !avatarUrl.startsWith("data:image/svg+xml")) {
    return null;
  }

  const encodedSvg = avatarUrl.split(",", 2)[1];
  if (!encodedSvg) {
    return null;
  }

  try {
    const svg = decodeURIComponent(encodedSvg);
    const match = svg.match(/data-preset="([^"]+)"/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function getDefaultAvatarUrl() {
  return getAvatarPresetUrl(AVATAR_PRESETS[0].id);
}

export function normalizeAvatarUrl(avatarUrl?: string | null) {
  const value = avatarUrl?.trim() ?? "";
  if (!value) {
    return getDefaultAvatarUrl();
  }

  if (getAvatarPresetId(value)) {
    return value;
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("/") ||
    value.startsWith("data:image/")
  ) {
    return value;
  }

  return getDefaultAvatarUrl();
}

export function normalizeSettingsPreferences(
  preferences: Record<string, unknown> | null | undefined,
  fallbackLocale: SettingsLocale = DEFAULT_SETTINGS.preferredLocale
) {
  const source = (preferences ?? {}) as SettingsPreferences;

  return {
    defaultPrepTime: coerceDuration(
      source.default_prep_time,
      PREP_TIME_OPTIONS,
      DEFAULT_SETTINGS.defaultPrepTime
    ),
    defaultSpeechTime: coerceDuration(
      source.default_speech_time,
      SPEECH_TIME_OPTIONS,
      DEFAULT_SETTINGS.defaultSpeechTime
    ),
    defaultDifficulty: coerceDifficulty(
      source.default_ai_difficulty,
      DEFAULT_SETTINGS.defaultDifficulty
    ),
    ttsVoice:
      typeof source.tts_voice === "string" && source.tts_voice.length > 0
        ? source.tts_voice
        : DEFAULT_SETTINGS.ttsVoice,
    preferredLocale: coerceLocale(
      source.preferred_locale,
      fallbackLocale ?? DEFAULT_SETTINGS.preferredLocale
    ),
    detailedFeedback: coerceBoolean(
      source.detailed_feedback,
      DEFAULT_SETTINGS.detailedFeedback
    ),
    highlightWeakAreas: coerceBoolean(
      source.highlight_weak_areas,
      DEFAULT_SETTINGS.highlightWeakAreas
    ),
    explainLikeImLearning: coerceBoolean(
      source.explain_like_im_learning,
      DEFAULT_SETTINGS.explainLikeImLearning
    ),
    advancedTerminology: coerceBoolean(
      source.advanced_terminology,
      DEFAULT_SETTINGS.advancedTerminology
    ),
    practiceReminders: coerceBoolean(
      source.practice_reminders,
      DEFAULT_SETTINGS.practiceReminders
    ),
    streakReminders: coerceBoolean(
      source.streak_reminders,
      DEFAULT_SETTINGS.streakReminders
    ),
    achievementUpdates: coerceBoolean(
      source.achievement_updates,
      DEFAULT_SETTINGS.achievementUpdates
    ),
    emailNotifications: coerceBoolean(
      source.email_notifications,
      DEFAULT_SETTINGS.emailNotifications
    ),
    analyticsCookiesEnabled: coerceBoolean(
      source.analytics_cookies_enabled,
      DEFAULT_SETTINGS.analyticsCookiesEnabled
    ),
  };
}

export function buildSettingsDraft(input: {
  displayName?: string | null;
  avatarUrl?: string | null;
  preferences?: Record<string, unknown> | null;
  currentLocale: SettingsLocale;
}) {
  const normalized = normalizeSettingsPreferences(
    input.preferences,
    input.currentLocale
  );

  return {
    displayName: input.displayName ?? "",
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    defaultPrepTime: normalized.defaultPrepTime,
    defaultSpeechTime: normalized.defaultSpeechTime,
    defaultDifficulty: normalized.defaultDifficulty,
    ttsVoice: normalized.ttsVoice,
    preferredLocale: input.currentLocale,
    detailedFeedback: normalized.detailedFeedback,
    highlightWeakAreas: normalized.highlightWeakAreas,
    explainLikeImLearning: normalized.explainLikeImLearning,
    advancedTerminology: normalized.advancedTerminology,
    practiceReminders: normalized.practiceReminders,
    streakReminders: normalized.streakReminders,
    achievementUpdates: normalized.achievementUpdates,
    emailNotifications: normalized.emailNotifications,
    analyticsCookiesEnabled: normalized.analyticsCookiesEnabled,
  } satisfies SettingsDraft;
}

export function buildSavedSettingsDraft(input: {
  displayName?: string | null;
  avatarUrl?: string | null;
  preferences?: Record<string, unknown> | null;
  currentLocale: SettingsLocale;
}) {
  const normalized = normalizeSettingsPreferences(
    input.preferences,
    input.currentLocale
  );

  return {
    displayName: input.displayName ?? "",
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    defaultPrepTime: normalized.defaultPrepTime,
    defaultSpeechTime: normalized.defaultSpeechTime,
    defaultDifficulty: normalized.defaultDifficulty,
    ttsVoice: normalized.ttsVoice,
    preferredLocale: normalized.preferredLocale,
    detailedFeedback: normalized.detailedFeedback,
    highlightWeakAreas: normalized.highlightWeakAreas,
    explainLikeImLearning: normalized.explainLikeImLearning,
    advancedTerminology: normalized.advancedTerminology,
    practiceReminders: normalized.practiceReminders,
    streakReminders: normalized.streakReminders,
    achievementUpdates: normalized.achievementUpdates,
    emailNotifications: normalized.emailNotifications,
    analyticsCookiesEnabled: normalized.analyticsCookiesEnabled,
  } satisfies SettingsDraft;
}

export function draftToPreferences(
  draft: SettingsDraft,
  existing: Record<string, unknown> | null | undefined
) {
  return {
    ...(existing ?? {}),
    default_prep_time: draft.defaultPrepTime,
    default_speech_time: draft.defaultSpeechTime,
    default_ai_difficulty: draft.defaultDifficulty,
    tts_voice: draft.ttsVoice,
    preferred_locale: draft.preferredLocale,
    detailed_feedback: draft.detailedFeedback,
    highlight_weak_areas: draft.highlightWeakAreas,
    explain_like_im_learning: draft.explainLikeImLearning,
    advanced_terminology: draft.advancedTerminology,
    practice_reminders: draft.practiceReminders,
    streak_reminders: draft.streakReminders,
    achievement_updates: draft.achievementUpdates,
    email_notifications: draft.emailNotifications,
    analytics_cookies_enabled: draft.analyticsCookiesEnabled,
  } satisfies SettingsPreferences;
}
