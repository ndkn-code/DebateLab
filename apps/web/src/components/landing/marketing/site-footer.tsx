import Link from "next/link";

import { LogoMark } from "@/components/landing/logo-mark";
import { ProductIcon } from "@/components/ui/product-icon";
import { Rule, Shell } from "./editorial";
import type { MarketingLocale, MarketingPageCopy } from "./types";

const linkClass =
  "rounded-md type-body-sm text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Column({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  // A labelled nav rather than a heading: these are three-item link groups, and
  // promoting them to <h2> would clutter screen-reader heading navigation.
  return (
    <nav aria-labelledby={id}>
      <p id={id} className="type-eyebrow text-on-surface">
        {title}
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">{children}</ul>
    </nav>
  );
}

export function SiteFooter({
  copy,
  locale,
}: {
  copy: MarketingPageCopy;
  locale: MarketingLocale;
}) {
  const localized = (path: string) => `/${locale}${path === "/" ? "" : path}`;

  return (
    <footer className="border-t border-outline-variant bg-surface">
      <Shell className="py-14 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-4">
            <LogoMark size="sm" variant="auto" />
            <p className="mt-4 max-w-[38ch] type-body-sm text-on-surface-variant">
              {copy.footer.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            <Column id="footer-products" title={copy.footer.productsLabel}>
              <li>
                <Link
                  href={localized("/")}
                  className={linkClass}
                  data-landing-event="landing_product_switched"
                  data-landing-placement="footer"
                  data-landing-product-target="debate"
                >
                  {copy.navigation.debate}
                </Link>
              </li>
              <li>
                <Link
                  href={localized("/ielts")}
                  className={linkClass}
                  data-landing-event="landing_product_switched"
                  data-landing-placement="footer"
                  data-landing-product-target="ielts"
                >
                  {copy.navigation.ielts}
                </Link>
              </li>
            </Column>

            <Column id="footer-guides" title={copy.footer.guidesLabel}>
              {copy.footer.guides.map((guide) => (
                <li key={guide.path}>
                  <Link href={localized(guide.path)} className={linkClass}>
                    {guide.label}
                  </Link>
                </li>
              ))}
            </Column>

            <Column id="footer-legal" title={copy.footer.legalLabel}>
              <li>
                <Link href={localized("/privacy")} className={linkClass}>
                  {copy.footer.privacy}
                </Link>
              </li>
              <li>
                <Link href={localized("/terms")} className={linkClass}>
                  {copy.footer.terms}
                </Link>
              </li>
              <li>
                <Link href={localized("/cookies")} className={linkClass}>
                  {copy.footer.cookies}
                </Link>
              </li>
            </Column>
          </div>
        </div>

        <Rule className="my-8" />

        <p className="max-w-[72ch] type-caption text-on-surface-variant">
          {copy.footer.disclaimer}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <span className="type-caption text-on-surface-variant">
            {copy.footer.copyright}
          </span>
          <a
            href="#top"
            className="inline-flex items-center gap-1.5 rounded-md type-caption text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.footer.backToTop}
            <ProductIcon name="chevronUp" size="xs" />
          </a>
        </div>
      </Shell>
    </footer>
  );
}
