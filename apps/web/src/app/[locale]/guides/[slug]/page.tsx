import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StructuredData } from "@/components/seo/structured-data";
import { PublicGuidePage } from "@/components/seo/public-guide-page";
import {
  asPublicLocale,
  absolutePublicUrl,
  publicPageMetadata,
} from "@/lib/public-site";
import {
  getPublicGuide,
  isPublicGuideSlug,
  PUBLIC_GUIDE_SLUGS,
} from "@/lib/public-guides";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return PUBLIC_GUIDE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  if (!isPublicGuideSlug(slug)) return {};
  const locale = asPublicLocale(rawLocale);
  const guide = getPublicGuide(locale, slug);
  return publicPageMetadata({
    locale,
    path: `/guides/${slug}`,
    title: guide.title,
    description: guide.description,
  });
}

export default async function GuideRoute({ params }: Props) {
  const { locale: rawLocale, slug } = await params;
  if (!isPublicGuideSlug(slug)) notFound();
  const locale = asPublicLocale(rawLocale);
  const guide = getPublicGuide(locale, slug);
  return (
    <>
      <StructuredData
        value={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: guide.title,
          description: guide.description,
          inLanguage: locale,
          mainEntityOfPage: absolutePublicUrl(locale, `/guides/${slug}`),
          author: { "@type": "Organization", name: "Thinkfy" },
          publisher: { "@type": "Organization", name: "Thinkfy" },
        }}
      />
      <PublicGuidePage locale={locale} slug={slug} />
    </>
  );
}
