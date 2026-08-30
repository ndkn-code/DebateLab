import Link from "next/link";
import {
  ProductIcon,
  type ProductIconName,
} from "@/components/ui/product-icon";
import { IELTS_LANDING_COPY, type IeltsLandingLocale } from "./copy";

const SKILL_ICONS: readonly ProductIconName[] = [
  "volume",
  "book",
  "penLine",
  "messageCircle",
];

export function IeltsLanding({ locale }: { locale: IeltsLandingLocale }) {
  const c = IELTS_LANDING_COPY[locale];
  const href = (path: string) => `/${locale}${path}`;
  return (
    <main className="min-h-dvh bg-background text-on-surface">
      <header className="sticky top-0 z-30 border-b border-outline-variant bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href={href("/")}
            className="shrink-0 type-title font-bold tracking-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            thinkfy<span className="text-primary">.</span>
          </Link>
          <nav
            aria-label={c.productLabel}
            className="mx-auto flex h-8 items-center rounded-[10px] border border-outline-variant bg-surface p-0.5"
          >
            <Link
              href={href("/")}
              className="inline-flex h-7 items-center rounded-lg px-3 type-label font-medium text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {c.debate}
            </Link>
            <Link
              href={href("/ielts")}
              aria-current="page"
              className="inline-flex h-7 items-center rounded-lg bg-on-surface px-3 type-label font-medium text-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {c.ielts}
            </Link>
          </nav>
          <Link
            href={href("/auth/login?next=/ielts")}
            className="inline-flex h-8 shrink-0 items-center rounded-[10px] border border-outline-variant px-3 type-label font-semibold hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {c.secondary}
          </Link>
        </div>
      </header>
      <section className="mx-auto grid max-w-[1280px] gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.08fr_.92fr] lg:items-center lg:px-8 lg:py-14">
        <div className="max-w-2xl">
          <p className="type-label font-semibold uppercase tracking-widest text-primary">
            {c.eyebrow}
          </p>
          <h1 className="mt-3 type-display font-semibold tracking-tight">
            {c.title}
          </h1>
          <p className="mt-4 max-w-xl type-body text-on-surface-variant">
            {c.intro}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={href("/auth/login?next=/ielts/onboarding")}
              className="inline-flex h-8 items-center gap-2 rounded-[10px] bg-on-surface px-4 type-label font-semibold text-surface transition-colors hover:bg-on-surface/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {c.primary}
              <ProductIcon name="arrowRight" size="sm" weight="bold" />
            </Link>
          </div>
          <p className="mt-3 type-label text-on-surface-variant">{c.note}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between border-b border-outline-variant pb-4">
            <div className="flex items-center gap-2">
              <ProductIcon name="target" size="md" className="text-primary" />
              <span className="type-label font-semibold">{c.pathLabel}</span>
            </div>
            <span className="inline-flex h-5 items-center rounded-md bg-primary-container px-2 type-caption font-semibold text-on-primary-container">
              01 / 04
            </span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="rounded-[10px] border border-primary bg-primary-container p-3">
              <p className="type-label font-semibold uppercase text-primary">
                {c.todayLabel}
              </p>
              <p className="mt-1 type-title font-semibold">{c.todayTitle}</p>
              <p className="mt-1 type-body-sm text-on-surface-variant">
                {c.todayBody}
              </p>
            </div>
            {c.pathSteps.map((item, i) => (
              <div
                key={item}
                className="flex min-h-10 items-center gap-3 rounded-[10px] border border-outline-variant bg-surface-container-low px-3 py-2"
              >
                <span className="type-label font-semibold text-on-surface-variant">
                  0{i + 2}
                </span>
                <span className="type-body-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="border-y border-outline-variant bg-surface-container-low">
        <div className="mx-auto grid max-w-[1280px] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.15fr_.85fr] lg:px-8">
          <div>
            <h2 className="type-heading-md font-semibold">{c.routeTitle}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[c.academic, c.general].map((item, i) => (
                <article
                  key={item.title}
                  className="rounded-xl border border-outline-variant bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <ProductIcon
                      name="book"
                      size="md"
                      className="text-primary"
                    />
                    <span className="type-label text-on-surface-variant">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="mt-4 type-title font-semibold">
                    {item.title}
                  </h3>
                  <p className="mt-2 type-body-sm text-on-surface-variant">
                    {item.body}
                  </p>
                  <p className="mt-4 type-label font-semibold text-primary">
                    {i === 0 ? c.academicDifference : c.generalDifference}
                  </p>
                </article>
              ))}
            </div>
          </div>
          <div>
            <h2 className="type-heading-md font-semibold">{c.modesTitle}</h2>
            <div className="mt-4 grid gap-3">
              {c.modes.map(([title, body], i) => (
                <article
                  key={title}
                  className="rounded-xl border border-outline-variant bg-surface p-4"
                >
                  <div className="flex items-center gap-3">
                    {i === 0 ? (
                      <ProductIcon
                        name="clock"
                        size="md"
                        className="text-primary"
                      />
                    ) : (
                      <ProductIcon
                        name="target"
                        size="md"
                        className="text-primary"
                      />
                    )}
                    <h3 className="type-title font-semibold">{title}</h3>
                  </div>
                  <p className="mt-3 type-body-sm text-on-surface-variant">
                    {body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface p-4 md:flex-row md:items-center md:justify-between">
          <h2 className="type-title font-semibold">{c.skillsTitle}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {c.skills.map((skill, i) => (
              <div
                key={skill}
                className="flex h-10 items-center gap-2 rounded-[10px] bg-surface-container-low px-3 type-label font-semibold"
              >
                <ProductIcon
                  name={SKILL_ICONS[i]}
                  size="sm"
                  className="text-primary"
                />
                {skill}
              </div>
            ))}
          </div>
        </div>
      </section>
      <footer className="border-t border-outline-variant px-5 py-8 md:px-8">
        <div className="mx-auto max-w-6xl type-label text-on-surface-variant">
          {c.footer}
        </div>
      </footer>
    </main>
  );
}
