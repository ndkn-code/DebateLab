"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLandingCopy } from "./copy";
import { LogoMark } from "./logo-mark";

interface LandingNavbarProps {
  isLoggedIn: boolean;
}

const NAV_LINKS = [
  { key: "features", href: "#features" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "pricing", href: "#pricing" },
  { key: "resources", href: "#resources" },
  { key: "about", href: "#about" },
] as const;

export function LandingNavbar({ isLoggedIn }: LandingNavbarProps) {
  const locale = useLocale();
  const copy = getLandingCopy(locale);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="relative z-20 bg-[#F7FAFE]">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-6 md:px-8">
        <Link href="/" className="shrink-0">
          <LogoMark
            className="gap-2.5"
            bubbleClassName="h-8 w-8"
            textClassName="text-[1.35rem]"
          />
        </Link>

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
          <Link
            href={isLoggedIn ? "/dashboard" : "/auth/login"}
            className="text-sm font-semibold text-[#162033] transition-colors hover:text-[#4D86F7]"
          >
            {isLoggedIn ? copy.nav.dashboard : copy.nav.login}
          </Link>
          {!isLoggedIn ? (
            <Link
              href="/auth/signup"
              className="btn-3d-primary inline-flex h-12 items-center rounded-[14px] bg-primary px-6 text-sm font-semibold text-on-primary hover:bg-primary-dim"
            >
              {copy.nav.signup}
            </Link>
          ) : null}
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[#DEE8F8] bg-white text-[#162033] lg:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((current) => !current)}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-[#E8EFFA] bg-white transition-[max-height,opacity] duration-200 lg:hidden",
          mobileOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="mx-auto max-w-[1280px] px-6 py-4 md:px-8">
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
            <Link
              href={isLoggedIn ? "/dashboard" : "/auth/login"}
              className="mb-3 block rounded-xl px-3 py-3 text-sm font-semibold text-[#162033] transition-colors hover:bg-[#F7FAFE] hover:text-[#4D86F7]"
              onClick={() => setMobileOpen(false)}
            >
              {isLoggedIn ? copy.nav.dashboard : copy.nav.login}
            </Link>

            {!isLoggedIn ? (
              <Link
                href="/auth/signup"
                className="btn-3d-primary inline-flex h-11 items-center rounded-[14px] bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-dim"
                onClick={() => setMobileOpen(false)}
              >
                {copy.nav.signup}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
