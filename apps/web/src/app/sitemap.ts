import type { MetadataRoute } from "next";
import {
  PUBLIC_LOCALES,
  PUBLIC_SITE_URL,
  absolutePublicUrl,
  legalPublicationReady,
} from "@/lib/public-site";
import { PUBLIC_GUIDE_SLUGS } from "@/lib/public-guides";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const pages: Array<{
    path: string;
    priority: number;
    frequency: "weekly" | "monthly";
  }> = [
    { path: "", priority: 1, frequency: "weekly" },
    { path: "/ielts", priority: 0.95, frequency: "weekly" },
    ...PUBLIC_GUIDE_SLUGS.map((slug) => ({
      path: `/guides/${slug}`,
      priority: 0.65,
      frequency: "monthly" as const,
    })),
  ];

  if (legalPublicationReady()) {
    pages.push(
      { path: "/privacy", priority: 0.2, frequency: "monthly" },
      { path: "/terms", priority: 0.2, frequency: "monthly" },
      { path: "/cookies", priority: 0.2, frequency: "monthly" },
    );
  }

  const localizedEntries: MetadataRoute.Sitemap = PUBLIC_LOCALES.flatMap(
    (locale) =>
      pages.map((page) => ({
        url: absolutePublicUrl(locale, page.path),
        lastModified: now,
        changeFrequency: page.frequency,
        priority: page.priority,
        alternates: {
          languages: {
            vi: absolutePublicUrl("vi", page.path),
            en: absolutePublicUrl("en", page.path),
          },
        },
      })),
  );

  return [
    ...localizedEntries,
    {
      url: PUBLIC_SITE_URL,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
