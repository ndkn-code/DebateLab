import type { EmailLocale } from "@/lib/email/types";

export const THINKFY_EMAIL_DOMAIN = "thinkfy.net";
export const DEFAULT_EMAIL_TIME_ZONE = "Asia/Ho_Chi_Minh";
export const DEFAULT_EMAIL_LOCALE: EmailLocale = "vi";

export function getAppBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

  return (configured || "https://thinkfy.net").replace(/\/$/, "");
}

export function getEmailSettingsUrl(locale: EmailLocale) {
  const baseUrl = getAppBaseUrl();
  return locale === "en" ? `${baseUrl}/en/settings` : `${baseUrl}/settings`;
}

export function getDashboardUrl(locale: EmailLocale) {
  const baseUrl = getAppBaseUrl();
  return locale === "en" ? `${baseUrl}/en/dashboard` : `${baseUrl}/dashboard`;
}

export function getPracticeUrl(locale: EmailLocale) {
  const baseUrl = getAppBaseUrl();
  return locale === "en" ? `${baseUrl}/en/practice` : `${baseUrl}/practice`;
}

export function getCoursesUrl(locale: EmailLocale) {
  const baseUrl = getAppBaseUrl();
  return locale === "en" ? `${baseUrl}/en/courses` : `${baseUrl}/courses`;
}

export function getPublicAssetUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${getAppBaseUrl()}${normalizedPath}`;
}

export function getEmailUnsubscribeUrl(token: string) {
  return `${getAppBaseUrl()}/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function getEmailOneClickUnsubscribeUrl(token: string) {
  return `${getAppBaseUrl()}/api/email/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function getSenderEmailAddress() {
  return (
    process.env.SENDER_EMAIL_ADDRESS?.trim() ||
    "Thinkfy <hello@thinkfy.net>"
  );
}

export function getReplyToEmailAddresses() {
  const raw = process.env.REPLY_TO_EMAIL_ADDRESSES?.trim();
  if (!raw) return ["support@thinkfy.net"];

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getSupportEmailAddress() {
  return getReplyToEmailAddresses()[0] || "support@thinkfy.net";
}

export function getEmailTestRecipient() {
  return process.env.EMAIL_TEST_RECIPIENT?.trim() || null;
}

export function isEmailSendingEnabled() {
  return process.env.EMAILS_ENABLED !== "false" && Boolean(process.env.RESEND_API_KEY);
}

export function isEmailDryRun() {
  if (process.env.EMAILS_DRY_RUN === "true") return true;
  if (process.env.EMAILS_DRY_RUN === "false") return false;
  return process.env.NODE_ENV !== "production";
}

export function resolveEmailLocale(preferences: Record<string, unknown> | null): EmailLocale {
  return preferences?.preferred_locale === "en" ? "en" : DEFAULT_EMAIL_LOCALE;
}
