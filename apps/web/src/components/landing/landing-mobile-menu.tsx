"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { LandingCopy, LandingLocale } from "./copy";
import { landingHref } from "./links";

const NAV_LINKS = [
  { key: "features", href: "#features" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "pricing", href: "#pricing" },
  { key: "resources", href: "#resources" },
  { key: "about", href: "#about" },
] as const;

type LandingMobileMenuProps = {
  copy: LandingCopy;
  isLoggedIn: boolean;
  locale: LandingLocale;
};

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

export function LandingMobileMenu({
  copy,
  isLoggedIn,
  locale,
}: LandingMobileMenuProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#DEE8F8] bg-white text-[#162033] lg:hidden"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((current) => !current)}
      >
        {mobileOpen ? (
          <XIcon className="h-5 w-5" />
        ) : (
          <MenuIcon className="h-5 w-5" />
        )}
      </button>

      <div
        className={cn(
          "absolute left-0 right-0 top-full z-30 overflow-hidden border-t border-[#E8EFFA] bg-white shadow-[0_20px_40px_-32px_rgba(11,20,36,0.28)] transition-[max-height,opacity] duration-200 lg:hidden",
          mobileOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mx-auto max-w-6xl px-6 py-4 md:px-8">
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((item) => (
              <a
                key={item.key}
                href={item.href}
                className="rounded-xl px-3 py-3 text-sm font-semibold text-[#415069] transition-colors hover:bg-[#F7FAFE] hover:text-[#4D86F7]"
                onClick={() => setMobileOpen(false)}
              >
                {copy.nav[item.key]}
              </a>
            ))}
          </div>

          <div className="mt-4 border-t border-[#E8EFFA] pt-4">
            <a
              href={landingHref(
                locale,
                isLoggedIn ? "/dashboard" : "/auth/login"
              )}
              className="mb-3 block rounded-xl px-3 py-3 text-sm font-semibold text-[#162033] transition-colors hover:bg-[#F7FAFE] hover:text-[#4D86F7]"
              onClick={() => setMobileOpen(false)}
            >
              {isLoggedIn ? copy.nav.dashboard : copy.nav.login}
            </a>

            {!isLoggedIn ? (
              <a
                href={landingHref(locale, "/auth/signup")}
                className="btn-3d-primary inline-flex h-11 items-center rounded-[14px] bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-dim"
                onClick={() => setMobileOpen(false)}
              >
                {copy.nav.signup}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
