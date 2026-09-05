"use client";

import Link from "next/link";
import { useState } from "react";

import { LogoMark } from "@/components/landing/logo-mark";
import { Button } from "@/components/ui/button";
import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import type { MarketingLocale, MarketingPageCopy } from "./types";

function localized(locale: MarketingLocale, path: string) {
  return `/${locale}${path === "/" ? "" : path}`;
}

function ProductSwitch({
  copy,
  locale,
  placement,
  onNavigate,
  className,
}: {
  copy: MarketingPageCopy;
  locale: MarketingLocale;
  placement: string;
  onNavigate?: () => void;
  className?: string;
}) {
  const products = [
    { id: "debate" as const, label: copy.navigation.debate, path: "/" },
    { id: "ielts" as const, label: copy.navigation.ielts, path: "/ielts" },
  ];

  return (
    <nav
      aria-label={copy.navigation.productLabel}
      className={cn(
        "flex h-9 items-center rounded-[11px] border border-outline-variant bg-surface-container p-[3px]",
        className,
      )}
    >
      {products.map((product) => {
        const active = copy.product === product.id;
        return (
          <Link
            key={product.id}
            href={localized(locale, product.path)}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            data-landing-event="landing_product_switched"
            data-landing-placement={placement}
            data-landing-product-target={product.id}
            className={cn(
              "inline-flex h-full flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 type-label whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-surface text-on-surface shadow-token-card"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full transition-colors",
                active
                  ? product.id === "ielts"
                    ? "bg-chart-1"
                    : "bg-on-surface"
                  : "bg-transparent",
              )}
            />
            {product.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteHeader({
  copy,
  locale,
  studentHref,
  isLoggedIn,
}: {
  copy: MarketingPageCopy;
  locale: MarketingLocale;
  studentHref: string;
  isLoggedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const otherLocale: MarketingLocale = locale === "en" ? "vi" : "en";
  const localeHref = localized(
    otherLocale,
    copy.product === "debate" ? "/" : "/ielts",
  );
  const close = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-background">
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center gap-4 px-5 sm:px-8 lg:px-10">
        <Link
          href={localized(locale, copy.product === "debate" ? "/" : "/ielts")}
          aria-label="Thinkfy"
          className="rounded-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogoMark size="icon" variant="auto" priority />
        </Link>

        <ProductSwitch
          copy={copy}
          locale={locale}
          placement="header"
          className="hidden sm:flex"
        />

        <nav
          aria-label={copy.navigation.pageNav}
          className="ml-auto hidden items-center gap-7 lg:flex"
        >
          {copy.navigation.sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              className="rounded-md type-label text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {section.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-6">
          <Link
            href={localeHref}
            lang={otherLocale}
            className="hidden h-9 items-center rounded-[10px] px-2.5 type-label text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
          >
            {otherLocale.toUpperCase()}
            <span className="sr-only"> — {copy.navigation.localeLabel}</span>
          </Link>
          <Button
            render={<Link href={studentHref} />}
            nativeButton={false}
            className="hidden h-9 rounded-[10px] px-4 sm:inline-flex"
            data-landing-event="landing_cta_clicked"
            data-landing-placement="header"
            data-landing-audience="student"
          >
            {isLoggedIn ? copy.hero.primaryLoggedIn : copy.navigation.signIn}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={
              open ? copy.navigation.closeMenu : copy.navigation.openMenu
            }
            aria-expanded={open}
            aria-controls="marketing-mobile-nav"
            onClick={() => setOpen((value) => !value)}
            className="size-9 lg:hidden"
          >
            <ProductIcon name={open ? "x" : "menu"} size="sm" />
          </Button>
        </div>
      </div>

      {open ? (
        <div
          id="marketing-mobile-nav"
          className="border-t border-outline-variant bg-surface px-5 py-4 sm:px-8 lg:hidden"
        >
          <nav
            aria-label={copy.navigation.pageNav}
            className="mx-auto flex w-full max-w-[1200px] flex-col gap-1"
          >
            <ProductSwitch
              copy={copy}
              locale={locale}
              placement="mobile_header"
              onNavigate={close}
              className="mb-3 sm:hidden"
            />
            {copy.navigation.sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={close}
                className="flex min-h-11 items-center rounded-[10px] px-3 type-label text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {section.label}
              </a>
            ))}
            <div className="mt-3 flex items-center gap-2">
              <Button
                render={<Link href={studentHref} />}
                nativeButton={false}
                onClick={close}
                className="h-11 flex-1 rounded-[10px]"
                data-landing-event="landing_cta_clicked"
                data-landing-placement="mobile_header"
                data-landing-audience="student"
              >
                {isLoggedIn
                  ? copy.hero.primaryLoggedIn
                  : copy.navigation.signIn}
              </Button>
              <Button
                render={<Link href={localeHref} lang={otherLocale} />}
                nativeButton={false}
                variant="outline"
                onClick={close}
                className="h-11 rounded-[10px] px-4"
              >
                {otherLocale.toUpperCase()}
                <span className="sr-only">
                  {" "}
                  — {copy.navigation.localeLabel}
                </span>
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
