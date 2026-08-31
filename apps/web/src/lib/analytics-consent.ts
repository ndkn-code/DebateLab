export const ANALYTICS_COOKIE_NAME = "debatelab_analytics_consent";
export const ANALYTICS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const ANALYTICS_CONSENT_CHANGED_EVENT =
  "debatelab:analytics-consent-changed";

export type AnalyticsConsentState = "granted" | "denied" | null;

export function syncAnalyticsConsent(
  enabled: boolean,
  onEnabled: () => void,
  onDisabled: () => void
) {
  if (enabled) {
    onEnabled();
    return true;
  }

  onDisabled();
  return false;
}

export function captureWithAnalyticsConsent<T>(
  enabled: boolean,
  capture: () => T
) {
  return enabled ? capture() : undefined;
}

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

export function notifyAnalyticsConsentChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
}
