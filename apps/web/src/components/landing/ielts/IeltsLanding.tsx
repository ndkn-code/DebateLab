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
    <main className="min-h-screen bg-background text-on-surface">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <Link href={href("/")} className="type-title font-bold tracking-tight">
          thinkfy<span className="text-primary">.</span>
        </Link>
        <Link
          href={href("/auth/login?next=/ielts")}
          className="rounded-lg border border-outline-variant px-4 py-2 type-label font-semibold hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {c.secondary}
        </Link>
      </header>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-10 md:px-8 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:pb-24 lg:pt-20">
        <div className="max-w-2xl">
          <p className="type-label font-semibold uppercase tracking-widest text-primary">
            {c.eyebrow}
          </p>
          <h1 className="mt-4 type-display font-bold tracking-tight">
            {c.title}
          </h1>
          <p className="mt-5 max-w-xl type-body-lg text-on-surface-variant">
            {c.intro}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={href("/auth/login?next=/ielts/onboarding")}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 type-label font-semibold text-on-primary hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {c.primary}
              <ProductIcon name="arrowRight" size="sm" weight="bold" />
            </Link>
          </div>
          <p className="mt-3 type-label text-on-surface-variant">{c.note}</p>
        </div>
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-5 shadow-token-card">
          <div className="flex items-center justify-between border-b border-outline-variant pb-4">
            <div className="flex items-center gap-2">
              <ProductIcon name="target" size="md" className="text-primary" />
              <span className="type-label font-semibold">{c.pathLabel}</span>
            </div>
            <span className="rounded-full bg-primary-container px-2.5 py-1 type-label font-semibold text-on-primary-container">
              01 / 04
            </span>
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-lg border border-primary bg-primary-container p-4">
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
                className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface px-4 py-3"
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
        <div className="mx-auto max-w-6xl px-5 py-14 md:px-8">
          <h2 className="type-heading-lg font-bold">{c.routeTitle}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {[c.academic, c.general].map((item, i) => (
              <article
                key={item.title}
                className="rounded-xl border border-outline-variant bg-surface p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <ProductIcon name="book" size="md" className="text-primary" />
                  <span className="type-label text-on-surface-variant">
                    {item.tag}
                  </span>
                </div>
                <h3 className="mt-6 type-heading-sm font-bold">{item.title}</h3>
                <p className="mt-2 type-body-sm text-on-surface-variant">
                  {item.body}
                </p>
                <p className="mt-5 type-label font-semibold text-primary">
                  {i === 0 ? c.academicDifference : c.generalDifference}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-14 md:px-8">
        <h2 className="type-heading-lg font-bold">{c.modesTitle}</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {c.modes.map(([title, body], i) => (
            <article
              key={title}
              className="rounded-xl border border-outline-variant p-5"
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
                <h3 className="type-title font-bold">{title}</h3>
              </div>
              <p className="mt-3 type-body-sm text-on-surface-variant">
                {body}
              </p>
            </article>
          ))}
        </div>
        <h2 className="mt-14 type-heading-lg font-bold">{c.skillsTitle}</h2>
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {c.skills.map((skill, i) => (
            <div
              key={skill}
              className="flex items-center gap-2 rounded-lg border border-outline-variant px-4 py-3 type-label font-semibold"
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
      </section>
      <footer className="border-t border-outline-variant px-5 py-8 md:px-8">
        <div className="mx-auto max-w-6xl type-label text-on-surface-variant">
          {c.footer}
        </div>
      </footer>
    </main>
  );
}
