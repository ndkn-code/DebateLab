import { AudienceSplit } from "./audience-split";
import { CapabilityGrid } from "./capability-grid";
import { DebateDeepProof } from "./deep-proof-debate";
import { FaqSection } from "./faq-section";
import { FinalCta } from "./final-cta";
import { Hero } from "./hero";
import { HonestyBand } from "./honesty-band";
import { IeltsDeepProof } from "./deep-proof-ielts";
import { LoopStrip } from "./loop-strip";
import { DebateReviewPanel } from "./panels/debate-review-panel";
import { IeltsPlanPanel } from "./panels/ielts-plan-panel";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import type { MarketingLocale, MarketingPageCopy } from "./types";

/**
 * Composition root for both public product sites. The shell is shared; the hero
 * panel and the deep-proof spread are the two places where the products tell
 * genuinely different stories rather than swapping strings.
 */
export function MarketingLanding({
  copy,
  locale,
  isLoggedIn = false,
}: {
  copy: MarketingPageCopy;
  locale: MarketingLocale;
  isLoggedIn?: boolean;
}) {
  const nextPath =
    copy.product === "debate" ? "/onboarding" : "/ielts/onboarding";
  const appPath = copy.product === "debate" ? "/dashboard" : "/ielts/home";
  const studentHref = isLoggedIn
    ? `/${locale}${appPath}`
    : `/${locale}/auth/login?next=${nextPath}`;
  const teacherHref = `mailto:support@thinkfy.net?subject=${encodeURIComponent(
    copy.teacherSubject,
  )}`;

  return (
    <main
      id="top"
      className="min-h-dvh bg-background text-on-surface"
      data-landing-product={copy.product}
      data-landing-locale={locale}
    >
      <SiteHeader
        copy={copy}
        locale={locale}
        studentHref={studentHref}
        isLoggedIn={isLoggedIn}
      />

      <Hero
        copy={copy}
        studentHref={studentHref}
        teacherHref={teacherHref}
        isLoggedIn={isLoggedIn}
      >
        {copy.product === "debate" ? (
          <DebateReviewPanel copy={copy.panel} />
        ) : (
          <IeltsPlanPanel copy={copy.panel} />
        )}
      </Hero>

      <LoopStrip copy={copy.loop} />
      <CapabilityGrid copy={copy.grid} />

      {copy.product === "debate" ? (
        <DebateDeepProof copy={copy.proof} />
      ) : (
        <IeltsDeepProof copy={copy.proof} />
      )}

      <AudienceSplit
        copy={copy.audiences}
        studentHref={studentHref}
        teacherHref={teacherHref}
      />
      <HonestyBand copy={copy.honesty} />
      <FaqSection copy={copy.faq} />
      <FinalCta
        copy={copy.finalCta}
        studentHref={studentHref}
        teacherHref={teacherHref}
      />
      <SiteFooter copy={copy} locale={locale} />
    </main>
  );
}
