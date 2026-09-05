import type { Metadata } from "next";
import { headers } from "next/headers";
import { setRequestLocale } from "next-intl/server";
import { MarketingLanding } from "@/components/landing/marketing/marketing-landing";
import { getMarketingCopy } from "@/components/landing/marketing/copy";
import { StructuredData } from "@/components/seo/structured-data";
import { PublicSiteAnalytics } from "@/components/analytics/public-site-analytics";
import {
  PUBLIC_SITE_URL,
  asPublicLocale,
  publicPageMetadata,
} from "@/lib/public-site";
import { createTypedServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asPublicLocale((await params).locale);
  return publicPageMetadata({
    locale,
    path: "/ielts",
    title:
      locale === "vi"
        ? "Luyện IELTS với lộ trình rõ ràng"
        : "IELTS practice with a clear study path",
    description:
      locale === "vi"
        ? "Luyện Nghe, Đọc, Viết và Nói với bài tập tập trung, phản hồi hữu ích và lộ trình thích ứng theo tiến độ."
        : "Practice IELTS Listening, Reading, Writing, and Speaking with focused work, useful feedback, and an adaptive study path.",
    keywords:
      locale === "vi"
        ? ["luyện IELTS", "IELTS online", "lộ trình IELTS", "IELTS speaking"]
        : [
            "IELTS practice",
            "IELTS preparation",
            "IELTS study plan",
            "IELTS speaking practice",
          ],
  });
}

export default async function IeltsLandingPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const landingLocale = asPublicLocale(locale);
  const marketingCopy = getMarketingCopy("ielts", landingLocale);
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PublicSiteAnalytics locale={landingLocale} product="ielts">
      <StructuredData
        nonce={nonce}
        value={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Thinkfy IELTS",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            url: `${PUBLIC_SITE_URL}/${landingLocale}/ielts`,
            description:
              landingLocale === "vi"
                ? "Luyện IELTS bốn kỹ năng với lộ trình học thích ứng và phản hồi AI hỗ trợ."
                : "Four-skill IELTS practice with an adaptive study path and AI-assisted feedback.",
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
        locale={landingLocale}
        isLoggedIn={Boolean(user)}
      />
    </PublicSiteAnalytics>
  );
}
