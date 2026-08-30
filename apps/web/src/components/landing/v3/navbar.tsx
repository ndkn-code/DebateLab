"use client";

import Image from "next/image";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { landingHref } from "../links";
import type { LandingLocale, LandingV3Copy } from "./copy";

interface NavbarProps {
  copy: LandingV3Copy;
  isLoggedIn: boolean;
  locale: LandingLocale;
}

export function LandingV3Navbar({ copy, isLoggedIn, locale }: NavbarProps) {
  const { scrollY } = useScroll();
  const reduceMotion = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 24);
  });

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 md:px-6">
      <motion.div
        layout={!reduceMotion}
        className={cn(
          "mx-auto flex max-w-6xl items-center justify-between rounded-[10px] border px-4 py-2 transition-colors duration-150 md:px-5",
          scrolled
            ? "border-outline-variant bg-white/90 shadow-token-card backdrop-blur-md"
            : "border-transparent bg-transparent"
        )}
      >
        <a href={`/${locale}`} className="shrink-0" aria-label="Thinkfy home">
          <Image
            src="/brand/thinkfy/thinkfy-logo-light.png"
            alt="Thinkfy"
            width={640}
            height={226}
            priority
            className="h-9 w-auto object-contain"
          />
        </a>

        <nav className="hidden items-center gap-8 lg:flex">
          {copy.nav.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-bold text-on-surface-variant transition-colors hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a
            href={landingHref(locale, isLoggedIn ? "/dashboard" : "/auth/login")}
            className="px-2 text-sm font-bold text-on-surface transition-colors hover:text-primary"
          >
            {isLoggedIn ? copy.nav.dashboard : copy.nav.login}
          </a>
          {!isLoggedIn ? (
            <a
              href={landingHref(locale, "/auth/signup")}
            className="inline-flex h-8 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-on-primary transition-colors hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {copy.nav.signup}
            </a>
          ) : null}
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
          className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-outline-variant bg-white text-on-surface transition-colors hover:bg-surface-container lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
            )}
          </svg>
        </button>
      </motion.div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -10, scale: 0.98 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: "easeOut" }}
            className="mx-auto mt-2 max-w-6xl rounded-[10px] border border-outline-variant bg-white p-3 shadow-none lg:hidden"
          >
            <nav className="flex flex-col gap-1">
              {copy.nav.links.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-[8px] px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex flex-col gap-2 border-t border-outline-variant pt-4">
              <a
                href={landingHref(locale, isLoggedIn ? "/dashboard" : "/auth/login")}
                className="inline-flex h-8 items-center justify-center rounded-[10px] border border-outline-variant bg-white text-sm font-medium text-on-surface"
              >
                {isLoggedIn ? copy.nav.dashboard : copy.nav.login}
              </a>
              {!isLoggedIn ? (
                <a
                  href={landingHref(locale, "/auth/signup")}
                  className="inline-flex h-8 items-center justify-center rounded-[10px] bg-primary text-sm font-medium text-on-primary"
                >
                  {copy.nav.signup}
                </a>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
