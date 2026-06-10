import type { LandingLocale, LandingV3Copy } from "./copy";
import { LandingV3Navbar } from "./navbar";
import { HeroSection } from "./hero";
import { ProofSection } from "./proof";
import { FeaturesSection } from "./features";
import { ShowcaseSection } from "./showcase";
import { JourneySection } from "./journey";
import { GamificationSection } from "./gamification";
import { TestimonialsSection } from "./testimonials";
import { FinalCtaSection } from "./final-cta";
import { LandingV3Footer } from "./footer";

interface LandingV3Props {
  copy: LandingV3Copy;
  isLoggedIn: boolean;
  locale: LandingLocale;
}

export function LandingV3({ copy, isLoggedIn, locale }: LandingV3Props) {
  return (
    <>
      <LandingV3Navbar copy={copy} isLoggedIn={isLoggedIn} locale={locale} />
      <HeroSection copy={copy} isLoggedIn={isLoggedIn} locale={locale} />
      <ProofSection copy={copy} />
      <FeaturesSection copy={copy} />
      <ShowcaseSection copy={copy} />
      <JourneySection copy={copy} />
      <GamificationSection copy={copy} />
      <TestimonialsSection copy={copy} />
      <FinalCtaSection copy={copy} isLoggedIn={isLoggedIn} locale={locale} />
      <LandingV3Footer copy={copy} locale={locale} />
    </>
  );
}
