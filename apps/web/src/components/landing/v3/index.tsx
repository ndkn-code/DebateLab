import { getMarketingCopy } from "@/components/landing/marketing/copy";
import { MarketingLanding } from "@/components/landing/marketing/marketing-landing";
import type { LandingLocale, LandingV3Copy } from "./copy";

interface LandingV3Props {
  copy: LandingV3Copy;
  isLoggedIn: boolean;
  locale: LandingLocale;
}

export function LandingV3({ copy, isLoggedIn, locale }: LandingV3Props) {
  return (
    <MarketingLanding
      asMain={false}
      copy={getMarketingCopy("debate", copy.locale)}
      isLoggedIn={isLoggedIn}
      locale={locale}
    />
  );
}
