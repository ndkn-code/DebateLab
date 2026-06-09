import { coercePracticeLanguage } from "@/lib/practice-language";
import {
  coerceVoiceForLanguage,
  DEFAULT_VOICE,
} from "@/lib/tts-voices";
import type { ProfileVisibility } from "@/lib/profile-social/model";
import {
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
  clampDurationSeconds,
} from "@/lib/practice-durations";
import type { PracticeLanguage } from "@/types";
import type { AppTheme } from "@/lib/theme";

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
  practice_language?: PracticeLanguage;
  detailed_feedback?: boolean;
  highlight_weak_areas?: boolean;
  explain_like_im_learning?: boolean;
  advanced_terminology?: boolean;
  practice_reminders?: boolean;
  streak_reminders?: boolean;
  achievement_updates?: boolean;
  smart_feature_popups?: boolean;
  email_notifications?: boolean;
  email_opt_in_scope?: "all" | "reminders_only" | null;
  analytics_cookies_enabled?: boolean;
  first_dashboard_visit?: boolean;
  theme?: AppTheme;
}

export interface SettingsDraft {
  displayName: string;
  handle: string;
  profileStatus: string;
  avatarUrl: string;
  profileVisibility: ProfileVisibility;
  analyticsVisibility: ProfileVisibility;
  activitiesVisibility: ProfileVisibility;
  achievementsVisibility: ProfileVisibility;
  organizationVisibility: ProfileVisibility;
  allowConnectionRequests: boolean;
  searchableByHandle: boolean;
  friendCodeDiscoveryEnabled: boolean;
  defaultPrepTime: number;
  defaultSpeechTime: number;
  defaultDifficulty: SettingsDifficulty;
  ttsVoice: string;
  preferredLocale: SettingsLocale;
  practiceLanguage: PracticeLanguage;
  detailedFeedback: boolean;
  highlightWeakAreas: boolean;
  explainLikeImLearning: boolean;
  advancedTerminology: boolean;
  practiceReminders: boolean;
  streakReminders: boolean;
  achievementUpdates: boolean;
  smartFeaturePopups: boolean;
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

export interface SettingsProfilePrivacy {
  profile_visibility?: ProfileVisibility | null;
  analytics_visibility?: ProfileVisibility | null;
  activities_visibility?: ProfileVisibility | null;
  achievements_visibility?: ProfileVisibility | null;
  organization_visibility?: ProfileVisibility | null;
  allow_connection_requests?: boolean | null;
  searchable_by_handle?: boolean | null;
  friend_code_discovery_enabled?: boolean | null;
}

export const PREP_TIME_OPTIONS = SOLO_PREP_DURATION.presetSeconds;
export const SPEECH_TIME_OPTIONS = SOLO_SPEECH_DURATION.presetSeconds;
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
    colors: ["#00B8D9", "#8BE8F7"],
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
    colors: ["#00B8D9", "#7DE2A5"],
  },
  {
    id: "blaze",
    label: "Blaze",
    monogram: "B",
    colors: ["#FF8C5A", "#FFD166"],
  },
  {
    id: "echo",
    label: "Echo",
    monogram: "E",
    colors: ["#00B8D9", "#B39CFF"],
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
  practiceLanguage: "vi" as PracticeLanguage,
  detailedFeedback: true,
  highlightWeakAreas: true,
  explainLikeImLearning: true,
  advancedTerminology: false,
  practiceReminders: true,
  streakReminders: true,
  achievementUpdates: true,
  smartFeaturePopups: true,
  emailNotifications: true,
  analyticsCookiesEnabled: true,
  profileVisibility: "connections" as ProfileVisibility,
  analyticsVisibility: "private" as ProfileVisibility,
  activitiesVisibility: "connections" as ProfileVisibility,
  achievementsVisibility: "connections" as ProfileVisibility,
  organizationVisibility: "connections" as ProfileVisibility,
  allowConnectionRequests: true,
  searchableByHandle: true,
  friendCodeDiscoveryEnabled: true,
};

const avatarUrlCache = new Map<string, string>();

function coerceBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function coerceProfileVisibility(
  value: unknown,
  fallback: ProfileVisibility
) {
  if (value === "trusted") {
    return "connections" as ProfileVisibility;
  }

  return value === "private" ||
    value === "connections" ||
    value === "public"
    ? (value as ProfileVisibility)
    : fallback;
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
  const preferredLocale = coerceLocale(
    source.preferred_locale,
    fallbackLocale ?? DEFAULT_SETTINGS.preferredLocale
  );
  const practiceLanguage = coercePracticeLanguage(preferredLocale);

  return {
    defaultPrepTime: coerceDuration(
      source.default_prep_time,
      SOLO_PREP_DURATION,
      DEFAULT_SETTINGS.defaultPrepTime
    ),
    defaultSpeechTime: coerceDuration(
      source.default_speech_time,
      SOLO_SPEECH_DURATION,
      DEFAULT_SETTINGS.defaultSpeechTime
    ),
    defaultDifficulty: coerceDifficulty(
      source.default_ai_difficulty,
      DEFAULT_SETTINGS.defaultDifficulty
    ),
    ttsVoice: coerceVoiceForLanguage(source.tts_voice, practiceLanguage),
    preferredLocale,
    practiceLanguage,
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
    smartFeaturePopups: coerceBoolean(
      source.smart_feature_popups,
      DEFAULT_SETTINGS.smartFeaturePopups
    ),
    emailNotifications: coerceBoolean(
      source.email_notifications,
      DEFAULT_SETTINGS.emailNotifications
    ),
    analyticsCookiesEnabled: true,
  };
}

function coerceDuration(
  value: unknown,
  config: typeof SOLO_PREP_DURATION | typeof SOLO_SPEECH_DURATION,
  fallback: number
) {
  return clampDurationSeconds(value, config, fallback);
}

export function buildSettingsDraft(input: {
  displayName?: string | null;
  handle?: string | null;
  profileStatus?: string | null;
  avatarUrl?: string | null;
  profilePrivacy?: SettingsProfilePrivacy | null;
  preferences?: Record<string, unknown> | null;
  currentLocale: SettingsLocale;
}) {
  const normalized = normalizeSettingsPreferences(
    input.preferences,
    input.currentLocale
  );

  return {
    displayName: input.displayName ?? "",
    handle: input.handle ?? "",
    profileStatus: input.profileStatus ?? "",
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    profileVisibility: coerceProfileVisibility(
      input.profilePrivacy?.profile_visibility,
      DEFAULT_SETTINGS.profileVisibility
    ),
    analyticsVisibility: coerceProfileVisibility(
      input.profilePrivacy?.analytics_visibility,
      DEFAULT_SETTINGS.analyticsVisibility
    ),
    activitiesVisibility: coerceProfileVisibility(
      input.profilePrivacy?.activities_visibility,
      DEFAULT_SETTINGS.activitiesVisibility
    ),
    achievementsVisibility: coerceProfileVisibility(
      input.profilePrivacy?.achievements_visibility,
      DEFAULT_SETTINGS.achievementsVisibility
    ),
    organizationVisibility: coerceProfileVisibility(
      input.profilePrivacy?.organization_visibility,
      DEFAULT_SETTINGS.organizationVisibility
    ),
    allowConnectionRequests: coerceBoolean(
      input.profilePrivacy?.allow_connection_requests,
      DEFAULT_SETTINGS.allowConnectionRequests
    ),
    searchableByHandle: coerceBoolean(
      input.profilePrivacy?.searchable_by_handle,
      DEFAULT_SETTINGS.searchableByHandle
    ),
    friendCodeDiscoveryEnabled: true,
    defaultPrepTime: normalized.defaultPrepTime,
    defaultSpeechTime: normalized.defaultSpeechTime,
    defaultDifficulty: normalized.defaultDifficulty,
    ttsVoice: coerceVoiceForLanguage(normalized.ttsVoice, input.currentLocale),
    preferredLocale: input.currentLocale,
    practiceLanguage: coercePracticeLanguage(input.currentLocale),
    detailedFeedback: normalized.detailedFeedback,
    highlightWeakAreas: normalized.highlightWeakAreas,
    explainLikeImLearning: normalized.explainLikeImLearning,
    advancedTerminology: normalized.advancedTerminology,
    practiceReminders: normalized.practiceReminders,
    streakReminders: normalized.streakReminders,
    achievementUpdates: normalized.achievementUpdates,
    smartFeaturePopups: normalized.smartFeaturePopups,
    emailNotifications: normalized.emailNotifications,
    analyticsCookiesEnabled: normalized.analyticsCookiesEnabled,
  } satisfies SettingsDraft;
}

export function buildSavedSettingsDraft(input: {
  displayName?: string | null;
  handle?: string | null;
  profileStatus?: string | null;
  avatarUrl?: string | null;
  profilePrivacy?: SettingsProfilePrivacy | null;
  preferences?: Record<string, unknown> | null;
  currentLocale: SettingsLocale;
}) {
  const normalized = normalizeSettingsPreferences(
    input.preferences,
    input.currentLocale
  );

  return {
    displayName: input.displayName ?? "",
    handle: input.handle ?? "",
    profileStatus: input.profileStatus ?? "",
    avatarUrl: normalizeAvatarUrl(input.avatarUrl),
    profileVisibility: coerceProfileVisibility(
      input.profilePrivacy?.profile_visibility,
      DEFAULT_SETTINGS.profileVisibility
    ),
    analyticsVisibility: coerceProfileVisibility(
      input.profilePrivacy?.analytics_visibility,
      DEFAULT_SETTINGS.analyticsVisibility
    ),
    activitiesVisibility: coerceProfileVisibility(
      input.profilePrivacy?.activities_visibility,
      DEFAULT_SETTINGS.activitiesVisibility
    ),
    achievementsVisibility: coerceProfileVisibility(
      input.profilePrivacy?.achievements_visibility,
      DEFAULT_SETTINGS.achievementsVisibility
    ),
    organizationVisibility: coerceProfileVisibility(
      input.profilePrivacy?.organization_visibility,
      DEFAULT_SETTINGS.organizationVisibility
    ),
    allowConnectionRequests: coerceBoolean(
      input.profilePrivacy?.allow_connection_requests,
      DEFAULT_SETTINGS.allowConnectionRequests
    ),
    searchableByHandle: coerceBoolean(
      input.profilePrivacy?.searchable_by_handle,
      DEFAULT_SETTINGS.searchableByHandle
    ),
    friendCodeDiscoveryEnabled: true,
    defaultPrepTime: normalized.defaultPrepTime,
    defaultSpeechTime: normalized.defaultSpeechTime,
    defaultDifficulty: normalized.defaultDifficulty,
    ttsVoice: normalized.ttsVoice,
    preferredLocale: normalized.preferredLocale,
    practiceLanguage: normalized.practiceLanguage,
    detailedFeedback: normalized.detailedFeedback,
    highlightWeakAreas: normalized.highlightWeakAreas,
    explainLikeImLearning: normalized.explainLikeImLearning,
    advancedTerminology: normalized.advancedTerminology,
    practiceReminders: normalized.practiceReminders,
    streakReminders: normalized.streakReminders,
    achievementUpdates: normalized.achievementUpdates,
    smartFeaturePopups: normalized.smartFeaturePopups,
    emailNotifications: normalized.emailNotifications,
    analyticsCookiesEnabled: normalized.analyticsCookiesEnabled,
  } satisfies SettingsDraft;
}

export function draftToPreferences(
  draft: SettingsDraft,
  existing: Record<string, unknown> | null | undefined
) {
  const practiceLanguage = coercePracticeLanguage(draft.preferredLocale);

  return {
    ...(existing ?? {}),
    default_prep_time: draft.defaultPrepTime,
    default_speech_time: draft.defaultSpeechTime,
    default_ai_difficulty: draft.defaultDifficulty,
    tts_voice: draft.ttsVoice,
    preferred_locale: draft.preferredLocale,
    practice_language: practiceLanguage,
    detailed_feedback: draft.detailedFeedback,
    highlight_weak_areas: draft.highlightWeakAreas,
    explain_like_im_learning: draft.explainLikeImLearning,
    advanced_terminology: draft.advancedTerminology,
    practice_reminders: draft.practiceReminders,
    streak_reminders: draft.streakReminders,
    achievement_updates: draft.achievementUpdates,
    smart_feature_popups: draft.smartFeaturePopups,
    email_notifications: draft.emailNotifications,
    email_opt_in_scope: draft.emailNotifications ? "all" : null,
    analytics_cookies_enabled: true,
  } satisfies SettingsPreferences;
}
