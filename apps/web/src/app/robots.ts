import type { MetadataRoute } from "next";
import { PUBLIC_SITE_URL } from "@/lib/public-site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "OAI-SearchBot",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/en/auth/",
          "/vi/auth/",
          "/en/guardian-consent/",
          "/vi/guardian-consent/",
        ],
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/ingest/",
          "/auth/",
          "/en/auth/",
          "/vi/auth/",
          "/en/dashboard/",
          "/vi/dashboard/",
          "/en/dev/",
          "/vi/dev/",
          "/en/onboarding/",
          "/vi/onboarding/",
          "/en/guardian-consent/",
          "/vi/guardian-consent/",
        ],
      },
    ],
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
    host: PUBLIC_SITE_URL,
  };
}
