export const ANALYTICS_COOKIE_NAME = "debatelab_analytics_consent";
export const ANALYTICS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type AnalyticsConsentState = "granted" | "denied" | null;

export function getAnalyticsCookieValue(enabled: boolean) {
  return enabled ? "granted" : "denied";
}

export function isAnalyticsEnabled(cookieValue?: string | null) {
  return cookieValue === "granted";
}

export function readAnalyticsConsentFromCookieHeader(
  cookieHeader: string
): AnalyticsConsentState {
  const encodedName = `${ANALYTICS_COOKIE_NAME}=`;
  const value = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(encodedName))
    ?.slice(encodedName.length);

  return value === "granted" || value === "denied" ? value : null;
}

export function hasBrowserAnalyticsConsent() {
  return (
    typeof document !== "undefined" &&
    isAnalyticsEnabled(readAnalyticsConsentFromCookieHeader(document.cookie))
  );
}
