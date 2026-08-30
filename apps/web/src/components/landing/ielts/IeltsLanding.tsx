import { getMarketingCopy } from "@/components/landing/marketing/copy";
import { MarketingLanding } from "@/components/landing/marketing/marketing-landing";
import type { IeltsLandingLocale } from "./copy";

export function IeltsLanding({
  locale,
  isLoggedIn = false,
}: {
  locale: IeltsLandingLocale;
  isLoggedIn?: boolean;
}) {
  return (
    <MarketingLanding
      copy={getMarketingCopy("ielts", locale)}
      locale={locale}
      isLoggedIn={isLoggedIn}
    />
  );
}
