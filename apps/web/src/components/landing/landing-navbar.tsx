import type { LandingCopy, LandingLocale } from "./copy";
import { LandingMobileMenu } from "./landing-mobile-menu";
import { landingHref } from "./links";
import { LogoMark } from "./logo-mark";

interface LandingNavbarProps {
  copy: LandingCopy;
  isLoggedIn: boolean;
  locale: LandingLocale;
}

const NAV_LINKS = [
  { key: "features", href: "#features" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "pricing", href: "#pricing" },
  { key: "resources", href: "#resources" },
  { key: "about", href: "#about" },
] as const;

export function LandingNavbar({
  copy,
  isLoggedIn,
  locale,
}: LandingNavbarProps) {
  return (
    <header className="relative z-20 bg-[#F7FAFE]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 md:px-8">
        <a href={`/${locale}`} className="shrink-0">
          <LogoMark size="sm" priority />
        </a>

        <nav className="hidden items-center gap-10 lg:flex">
          {NAV_LINKS.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className="text-sm font-semibold text-[#415069] transition-colors hover:text-[#4D86F7]"
            >
              {copy.nav[item.key]}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          <a
            href={landingHref(locale, isLoggedIn ? "/dashboard" : "/auth/login")}
            className="text-sm font-semibold text-[#162033] transition-colors hover:text-[#4D86F7]"
          >
            {isLoggedIn ? copy.nav.dashboard : copy.nav.login}
          </a>
          {!isLoggedIn ? (
            <a
              href={landingHref(locale, "/auth/signup")}
              className="btn-3d-primary inline-flex h-12 items-center rounded-[14px] bg-primary px-6 text-sm font-semibold text-on-primary hover:bg-primary-dim"
            >
              {copy.nav.signup}
            </a>
          ) : null}
        </div>

        <LandingMobileMenu copy={copy} isLoggedIn={isLoggedIn} locale={locale} />
      </div>
    </header>
  );
}
