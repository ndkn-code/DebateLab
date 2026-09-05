import type { Metadata } from "next";

export const PUBLIC_SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://thinkfy.net"
).replace(/\/$/, "");

export const PUBLIC_LOCALES = ["vi", "en"] as const;
export type PublicLocale = (typeof PUBLIC_LOCALES)[number];
export type LandingProduct = "debate" | "ielts";
export type LandingAudience = "student" | "teacher";

export function asPublicLocale(locale: string): PublicLocale {
  return locale === "en" ? "en" : "vi";
}

export function localizedPath(locale: PublicLocale, path = "") {
  const normalized =
    path === "/" ? "" : path.startsWith("/") ? path : `/${path}`;
  return `/${locale}${normalized}`;
}

export function absolutePublicUrl(locale: PublicLocale, path = "") {
  return `${PUBLIC_SITE_URL}${localizedPath(locale, path)}`;
}

export function localizedAlternates(
  locale: PublicLocale,
  path = "",
): Metadata["alternates"] {
  return {
    canonical: absolutePublicUrl(locale, path),
    languages: {
      vi: absolutePublicUrl("vi", path),
      en: absolutePublicUrl("en", path),
      "x-default": absolutePublicUrl("vi", path),
    },
  };
}

export function publicPageMetadata(input: {
  locale: PublicLocale;
  path?: string;
  title: string;
  description: string;
  keywords?: string[];
  noIndex?: boolean;
}): Metadata {
  const url = absolutePublicUrl(input.locale, input.path);
  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    alternates: localizedAlternates(input.locale, input.path),
    robots: input.noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: "Thinkfy",
      locale: input.locale === "vi" ? "vi_VN" : "en_US",
      alternateLocale: input.locale === "vi" ? ["en_US"] : ["vi_VN"],
      type: "website",
      images: [
        {
          url: "/brand/thinkfy/thinkfy-logo-light.png",
          width: 640,
          height: 226,
          alt: "Thinkfy",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: ["/brand/thinkfy/thinkfy-logo-light.png"],
    },
  };
}

export function legalPublicationReady() {
  return Boolean(
    process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim() &&
    process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW?.trim(),
  );
}

export function legalOperatorDetails() {
  return {
    name:
      process.env.NEXT_PUBLIC_LEGAL_OPERATOR_NAME?.trim() || "Thinkfy operator",
    address: process.env.NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS?.trim() || null,
    governingLaw:
      process.env.NEXT_PUBLIC_LEGAL_GOVERNING_LAW?.trim() ||
      "Governing law pending legal review",
    privacyEmail:
      process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || "support@thinkfy.net",
    copyrightEmail: process.env.NEXT_PUBLIC_COPYRIGHT_EMAIL?.trim() || null,
  };
}
