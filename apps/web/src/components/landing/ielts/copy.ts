import { getMarketingCopy } from "@/components/landing/marketing/copy";

export type IeltsLandingLocale = "en" | "vi";

/** Kept for compatibility with server-side copy inspection. */
export const IELTS_LANDING_COPY = {
  en: getMarketingCopy("ielts", "en"),
  vi: getMarketingCopy("ielts", "vi"),
} as const;
