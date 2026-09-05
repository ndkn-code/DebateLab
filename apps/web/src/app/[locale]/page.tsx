import type { Metadata } from "next";
import { headers } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { createTypedServerClient } from "@/lib/supabase/server";
import { MarketingLanding } from "@/components/landing/marketing/marketing-landing";
import { getMarketingCopy } from "@/components/landing/marketing/copy";
import { StructuredData } from "@/components/seo/structured-data";
import { PublicSiteAnalytics } from "@/components/analytics/public-site-analytics";
import {
  PUBLIC_SITE_URL,
  asPublicLocale,
  publicPageMetadata,
} from "@/lib/public-site";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asPublicLocale((await params).locale);
  return publicPageMetadata({
    locale,
    title:
      locale === "vi"
        ? "Luyện tranh biện tiếng Anh cùng AI"
        : "Practice English debate with AI feedback",
    description:
      locale === "vi"
        ? "Luyện lập luận, trình bày và phản biện bằng tiếng Anh với phản hồi AI có cấu trúc dành cho học sinh Việt Nam."
        : "Build stronger arguments, delivery, and rebuttals in English with structured AI-assisted feedback for Vietnamese students.",
    keywords:
      locale === "vi"
        ? [
            "luyện tranh biện",
            "tranh biện tiếng Anh",
            "phản biện",
            "AI giáo dục",
          ]
        : [
            "debate practice",
            "English debate",
            "argumentation practice",
            "AI feedback",
          ],
  });
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const landingLocale = asPublicLocale(locale);
  const marketingCopy = getMarketingCopy("debate", landingLocale);
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PublicSiteAnalytics locale={landingLocale} product="debate">
      <StructuredData
        nonce={nonce}
        value={[
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Thinkfy",
            url: PUBLIC_SITE_URL,
            inLanguage: ["vi", "en"],
          },
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Thinkfy Debate",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            url: `${PUBLIC_SITE_URL}/${landingLocale}`,
            description:
              landingLocale === "vi"
                ? "Nền tảng luyện tranh biện tiếng Anh với phản hồi AI hỗ trợ."
                : "English debate practice with AI-assisted feedback.",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: marketingCopy.faq.items.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          },
        ]}
      />
      <MarketingLanding
        copy={marketingCopy}
        isLoggedIn={!!user}
        locale={landingLocale}
      />
    </PublicSiteAnalytics>
  );
}
