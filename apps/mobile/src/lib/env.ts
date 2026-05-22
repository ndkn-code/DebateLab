import type { ThinkfyAppEnv } from "@thinkfy/shared/api-client";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const publicEnv = {
  EXPO_PUBLIC_SUPABASE_URL: process?.env?.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process?.env?.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_SUPABASE_ANON_KEY:
    process?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_API_BASE_URL: process?.env?.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_APP_ENV: process?.env?.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:
    process?.env?.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME:
    process?.env?.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME,
  EXPO_PUBLIC_ENABLE_MOBILE_DESIGN_PREVIEW:
    process?.env?.EXPO_PUBLIC_ENABLE_MOBILE_DESIGN_PREVIEW,
  EXPO_PUBLIC_ENABLE_MOBILE_E2E_LOGIN:
    process?.env?.EXPO_PUBLIC_ENABLE_MOBILE_E2E_LOGIN,
  EXPO_PUBLIC_MOBILE_DESIGN_PREVIEW_ROUTE:
    process?.env?.EXPO_PUBLIC_MOBILE_DESIGN_PREVIEW_ROUTE,
};

export const MOBILE_PUBLIC_ENV_KEYS = [
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_APP_ENV",
  "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
  "EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME",
] as const;

export type MobilePublicEnvKey = (typeof MOBILE_PUBLIC_ENV_KEYS)[number];

function readPublicEnv(key: MobilePublicEnvKey) {
  return publicEnv[key]?.trim() ?? "";
}

function coerceAppEnv(value: string): ThinkfyAppEnv {
  return value === "preview" || value === "production" ? value : "development";
}

function coerceDesignPreviewRoute(value: string) {
  return value === "practice" ||
    value === "coach" ||
    value === "courses" ||
    value === "profile"
    ? value
    : "today";
}

export const mobileEnv = {
  supabaseUrl: readPublicEnv("EXPO_PUBLIC_SUPABASE_URL"),
  supabaseKey:
    readPublicEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ||
    readPublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  supabasePublishableKey: readPublicEnv("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseAnonKey: readPublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY"),
  apiBaseUrl: readPublicEnv("EXPO_PUBLIC_API_BASE_URL"),
  appEnv: coerceAppEnv(readPublicEnv("EXPO_PUBLIC_APP_ENV")),
  googleWebClientId: readPublicEnv("EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID"),
  googleIosUrlScheme: readPublicEnv("EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME"),
  enableDesignPreview:
    publicEnv.EXPO_PUBLIC_ENABLE_MOBILE_DESIGN_PREVIEW?.trim() === "1",
  enableE2ELogin:
    publicEnv.EXPO_PUBLIC_ENABLE_MOBILE_E2E_LOGIN?.trim() === "1",
  designPreviewRoute: coerceDesignPreviewRoute(
    publicEnv.EXPO_PUBLIC_MOBILE_DESIGN_PREVIEW_ROUTE?.trim() ?? ""
  ),
};

export function getMissingMobileEnvKeys() {
  const missing = MOBILE_PUBLIC_ENV_KEYS.filter((key) => !readPublicEnv(key));

  if (mobileEnv.supabaseKey) {
    return missing.filter(
      (key) =>
        key !== "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY" &&
        key !== "EXPO_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return missing;
}

export function getGoogleIosClientId() {
  const prefix = "com.googleusercontent.apps.";

  if (!mobileEnv.googleIosUrlScheme.startsWith(prefix)) {
    return "";
  }

  return `${mobileEnv.googleIosUrlScheme.slice(prefix.length)}.apps.googleusercontent.com`;
}
