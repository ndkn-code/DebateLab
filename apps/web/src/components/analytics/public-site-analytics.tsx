import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PostHogPageview, PostHogProvider } from "@/app/posthog-provider";
import { FaroProvider } from "@/app/faro-provider";
import { LandingInteractionTracker } from "@/components/analytics/landing-interaction-tracker";
import { ANALYTICS_COOKIE_NAME, isAnalyticsEnabled } from "@/lib/settings";
import type { LandingProduct, PublicLocale } from "@/lib/public-site";

export async function PublicSiteAnalytics({
  children,
  locale,
  product,
}: {
  children: React.ReactNode;
  locale: PublicLocale;
  product: LandingProduct;
}) {
  const cookieStore = await cookies();
  const enabled = isAnalyticsEnabled(
    cookieStore.get(ANALYTICS_COOKIE_NAME)?.value,
  );

  if (!enabled) return children;

  return (
    <FaroProvider enabled>
      <PostHogProvider enabled>
        <PostHogPageview enabled />
        <LandingInteractionTracker locale={locale} product={product} />
        {children}
        <Analytics />
        <SpeedInsights />
      </PostHogProvider>
    </FaroProvider>
  );
}
