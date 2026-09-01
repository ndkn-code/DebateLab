"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogoMark } from "@/components/landing/logo-mark";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { BentoCard, BentoGrid } from "@/components/magicui/bento-grid";
import {
  ProductIcon,
  type ProductIconName,
} from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import { FeedbackProductPreview, HeroProductPreview } from "./product-preview";
import type { MarketingLocale, MarketingPageCopy } from "./types";

const featureIcons: Record<
  MarketingPageCopy["features"]["items"][number]["icon"],
  ProductIconName
> = {
  target: "target",
  microphone: "mic",
  scales: "scale",
  chart: "chart",
  book: "book",
  timer: "timer",
};

function localizedHref(locale: MarketingLocale, path: string) {
  return `/${locale}${path}`;
}

function MarketingHeader({
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
  const productHref = copy.product === "debate" ? "/" : "/ielts";
  const navigation = [
    [copy.navigation.howItWorks, "#how-it-works"],
    [copy.navigation.features, "#features"],
    [copy.navigation.audiences, "#audiences"],
    [copy.navigation.faq, "#faq"],
  ] as const;

  return (
    <header className="sticky top-0 z-50 border-b border-outline-variant bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={localizedHref(locale, productHref)}
          aria-label="Thinkfy"
          className="rounded-control focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <LogoMark size="sm" priority />
        </Link>

        <nav
          aria-label={copy.navigation.productLabel}
          className="ml-auto hidden h-8 items-center rounded-control border border-outline-variant bg-surface-container p-[3px] sm:flex lg:ml-4"
        >
          {(["debate", "ielts"] as const).map((product) => (
            <Link
              key={product}
              href={localizedHref(
                locale,
                product === "debate" ? "/" : "/ielts",
              )}
              aria-current={copy.product === product ? "page" : undefined}
              data-landing-event="landing_product_switched"
              data-landing-placement="header"
              data-landing-product-target={product}
              className={cn(
                "inline-flex h-6 items-center rounded-[7px] px-2.5 type-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                copy.product === product
                  ? "bg-surface text-on-surface"
                  : "text-on-surface-variant hover:text-on-surface",
              )}
            >
              {product === "debate"
                ? copy.navigation.debate
                : copy.navigation.ielts}
            </Link>
          ))}
        </nav>

        <nav
          aria-label={locale === "vi" ? "Điều hướng trang" : "Page navigation"}
          className="ml-auto hidden items-center gap-5 lg:flex"
        >
          {navigation.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded-md type-label text-on-surface-variant transition-colors hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {label}
            </a>
          ))}
        </nav>

        <Button
          render={<Link href={studentHref} />}
          nativeButton={false}
          variant="outline"
          className="ml-auto hidden sm:inline-flex lg:ml-2"
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
            open
              ? locale === "vi"
                ? "Đóng điều hướng"
                : "Close navigation"
              : locale === "vi"
                ? "Mở điều hướng"
                : "Open navigation"
          }
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="ml-auto lg:hidden"
        >
          <ProductIcon name={open ? "x" : "menu"} size="sm" />
        </Button>
      </div>

      {open ? (
        <div className="border-t border-outline-variant bg-surface px-4 py-3 lg:hidden">
          <nav
            aria-label={
              locale === "vi" ? "Điều hướng di động" : "Mobile navigation"
            }
            className="mx-auto flex max-w-[1280px] flex-col gap-1"
          >
            <div className="mb-2 flex h-8 items-center rounded-control border border-outline-variant bg-surface-container p-[3px] sm:hidden">
              <Link
                href={localizedHref(locale, "/")}
                onClick={() => setOpen(false)}
                aria-current={copy.product === "debate" ? "page" : undefined}
                data-landing-event="landing_product_switched"
                data-landing-placement="mobile_header"
                data-landing-product-target="debate"
                className={cn(
                  "flex h-6 flex-1 items-center justify-center rounded-[7px] type-label",
                  copy.product === "debate" && "bg-surface",
                )}
              >
                {copy.navigation.debate}
              </Link>
              <Link
                href={localizedHref(locale, "/ielts")}
                onClick={() => setOpen(false)}
                aria-current={copy.product === "ielts" ? "page" : undefined}
                data-landing-event="landing_product_switched"
                data-landing-placement="mobile_header"
                data-landing-product-target="ielts"
                className={cn(
                  "flex h-6 flex-1 items-center justify-center rounded-[7px] type-label",
                  copy.product === "ielts" && "bg-surface",
                )}
              >
                {copy.navigation.ielts}
              </Link>
            </div>
            {navigation.map(([label, href]) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="flex min-h-10 items-center rounded-control px-3 type-label text-on-surface-variant hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {label}
              </a>
            ))}
            <Button
              render={<Link href={studentHref} />}
              nativeButton={false}
              className="mt-2 w-full"
              data-landing-event="landing_cta_clicked"
              data-landing-placement="mobile_header"
              data-landing-audience="student"
            >
              {isLoggedIn ? copy.hero.primaryLoggedIn : copy.navigation.signIn}
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function ProcessSection({ copy }: { copy: MarketingPageCopy }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLElement>(null);
  const secondRef = useRef<HTMLElement>(null);
  const thirdRef = useRef<HTMLElement>(null);
  const refs = [firstRef, secondRef, thirdRef] as const;

  return (
    <section
      id="how-it-works"
      className="border-y border-outline-variant bg-surface-container-low py-16 sm:py-20"
    >
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="type-label font-semibold text-secondary">
            {copy.process.eyebrow}
          </p>
          <h2 className="mt-2 type-heading-lg text-on-surface">
            {copy.process.title}
          </h2>
          <p className="mt-3 type-body text-on-surface-variant">
            {copy.process.description}
          </p>
        </div>
        <div
          ref={containerRef}
          className="relative mt-8 grid gap-3 md:grid-cols-3"
        >
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={firstRef}
            toRef={secondRef}
            className="hidden md:block"
          />
          <AnimatedBeam
            containerRef={containerRef}
            fromRef={secondRef}
            toRef={thirdRef}
            delay={1.3}
            className="hidden md:block"
          />
          {copy.process.steps.map((step, index) => (
            <article
              key={step.title}
              ref={refs[index]}
              className="relative z-10 rounded-[12px] border border-outline-variant bg-surface p-5"
            >
              <span className="flex size-8 items-center justify-center rounded-control bg-primary type-label font-semibold text-on-primary">
                0{index + 1}
              </span>
              <h3 className="mt-5 type-title font-semibold">{step.title}</h3>
              <p className="mt-2 type-body-sm text-on-surface-variant">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function AudienceTabs({
  copy,
  studentHref,
  teacherHref,
}: {
  copy: MarketingPageCopy;
  studentHref: string;
  teacherHref: string;
}) {
  return (
    <Tabs defaultValue="student" className="mt-8">
      <TabsList aria-label={copy.audiences.title}>
        <TabsTrigger
          value="student"
          data-landing-event="landing_audience_selected"
          data-landing-audience="student"
          data-landing-placement="audience_tabs"
        >
          {copy.audiences.studentTab}
        </TabsTrigger>
        <TabsTrigger
          value="teacher"
          data-landing-event="landing_audience_selected"
          data-landing-audience="teacher"
          data-landing-placement="audience_tabs"
        >
          {copy.audiences.teacherTab}
        </TabsTrigger>
      </TabsList>
      {(["student", "teacher"] as const).map((audience) => {
        const content = copy.audiences[audience];
        const href = audience === "student" ? studentHref : teacherHref;
        return (
          <TabsContent key={audience} value={audience} className="mt-3">
            <div className="grid gap-6 rounded-[12px] border border-outline-variant bg-surface p-5 md:grid-cols-[1.1fr_.9fr] md:p-7">
              <div>
                <h3 className="type-heading-md">{content.title}</h3>
                <p className="mt-3 max-w-2xl type-body text-on-surface-variant">
                  {content.body}
                </p>
                <Button
                  render={<a href={href} />}
                  nativeButton={false}
                  className="mt-5"
                  data-landing-event={
                    audience === "student"
                      ? "landing_cta_clicked"
                      : "teacher_contact_clicked"
                  }
                  data-landing-placement="audience_panel"
                  data-landing-audience={audience}
                >
                  {content.cta}
                  <ProductIcon name="arrowRight" size="sm" />
                </Button>
              </div>
              <ul className="grid gap-2" aria-label={content.title}>
                {content.points.map((point) => (
                  <li
                    key={point}
                    className="flex min-h-10 items-center gap-3 rounded-control bg-surface-container-low px-3 type-body-sm"
                  >
                    <ProductIcon
                      name="check"
                      size="sm"
                      weight="bold"
                      className="text-success"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

export function MarketingLanding({
  copy,
  locale,
  isLoggedIn = false,
  asMain = true,
}: {
  copy: MarketingPageCopy;
  locale: MarketingLocale;
  isLoggedIn?: boolean;
  asMain?: boolean;
}) {
  const nextPath =
    copy.product === "debate" ? "/onboarding" : "/ielts/onboarding";
  const appPath = copy.product === "debate" ? "/dashboard" : "/ielts/home";
  const studentHref = isLoggedIn
    ? localizedHref(locale, appPath)
    : `${localizedHref(locale, "/auth/login")}?next=${nextPath}`;
  const teacherHref = `mailto:support@thinkfy.net?subject=${encodeURIComponent(copy.teacherSubject)}`;
  const Root = asMain ? "main" : "div";

  return (
    <Root
      id="top"
      className="min-h-dvh bg-background text-on-surface"
      data-landing-product={copy.product}
      data-landing-locale={locale}
    >
      <MarketingHeader
        copy={copy}
        locale={locale}
        studentHref={studentHref}
        isLoggedIn={isLoggedIn}
      />

      <section className="mx-auto grid max-w-[1280px] gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.04fr_.96fr] lg:items-center lg:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="type-label font-semibold text-secondary">
            {copy.hero.eyebrow}
          </p>
          <h1 className="mt-3 type-display-md text-on-surface">
            {copy.hero.title}
          </h1>
          <p className="mt-5 max-w-xl type-body-lg text-on-surface-variant">
            {copy.hero.description}
          </p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <Button
              render={<Link href={studentHref} />}
              nativeButton={false}
              className="px-4"
              data-landing-event="landing_cta_clicked"
              data-landing-placement="hero"
              data-landing-audience="student"
            >
              {isLoggedIn ? copy.hero.primaryLoggedIn : copy.hero.primary}
              <ProductIcon name="arrowRight" size="sm" />
            </Button>
            <Button
              render={<a href={teacherHref} />}
              nativeButton={false}
              variant="outline"
              className="px-4"
              data-landing-event="teacher_contact_clicked"
              data-landing-placement="hero"
              data-landing-audience="teacher"
            >
              {copy.hero.teacher}
            </Button>
          </div>
          <p className="mt-4 type-caption text-on-surface-variant">
            {copy.hero.note}
          </p>
        </div>
        <HeroProductPreview copy={copy} />
      </section>

      <ProcessSection copy={copy} />

      <section
        id="features"
        className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <div className="max-w-2xl">
          <p className="type-label font-semibold text-secondary">
            {copy.features.eyebrow}
          </p>
          <h2 className="mt-2 type-heading-lg">{copy.features.title}</h2>
          <p className="mt-3 type-body text-on-surface-variant">
            {copy.features.description}
          </p>
        </div>
        <BentoGrid className="mt-8">
          {copy.features.items.map((feature) => {
            const icon = featureIcons[feature.icon];
            return (
              <BentoCard
                key={feature.title}
                className={cn(feature.size === "wide" && "md:col-span-2")}
              >
                <div className="flex size-9 items-center justify-center rounded-control bg-surface-container text-secondary">
                  <ProductIcon name={icon} size="md" />
                </div>
                <div className="mt-8 max-w-xl">
                  <span className="inline-flex h-5 items-center rounded-[6px] bg-primary-container px-2 type-caption font-semibold text-on-primary-container">
                    {feature.detail}
                  </span>
                  <h3 className="mt-3 type-title font-semibold">
                    {feature.title}
                  </h3>
                  <p className="mt-2 type-body-sm text-on-surface-variant">
                    {feature.body}
                  </p>
                </div>
              </BentoCard>
            );
          })}
        </BentoGrid>
      </section>

      <section className="border-y border-outline-variant bg-surface-container-low py-16 sm:py-20">
        <div className="mx-auto grid max-w-[1120px] gap-8 px-4 sm:px-6 lg:grid-cols-[.78fr_1.22fr] lg:items-center lg:px-8">
          <div>
            <p className="type-label font-semibold text-secondary">
              {copy.productProof.eyebrow}
            </p>
            <h2 className="mt-2 type-heading-lg">{copy.productProof.title}</h2>
            <p className="mt-3 type-body text-on-surface-variant">
              {copy.productProof.description}
            </p>
          </div>
          <FeedbackProductPreview copy={copy} />
        </div>
      </section>

      <section
        id="audiences"
        className="mx-auto max-w-[1120px] px-4 py-16 sm:px-6 sm:py-20 lg:px-8"
      >
        <p className="type-label font-semibold text-secondary">
          {copy.audiences.eyebrow}
        </p>
        <h2 className="mt-2 max-w-2xl type-heading-lg">
          {copy.audiences.title}
        </h2>
        <AudienceTabs
          copy={copy}
          studentHref={studentHref}
          teacherHref={teacherHref}
        />
      </section>

      <section className="border-y border-outline-variant bg-surface py-16 sm:py-20">
        <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="type-label font-semibold text-secondary">
              {copy.proof.eyebrow}
            </p>
            <h2 className="mt-2 type-heading-lg">{copy.proof.title}</h2>
            <p className="mt-3 type-body text-on-surface-variant">
              {copy.proof.description}
            </p>
          </div>
          <dl className="mt-8 grid overflow-hidden rounded-[12px] border border-outline-variant md:grid-cols-3">
            {copy.proof.items.map((item, index) => (
              <div
                key={item.label}
                className={cn(
                  "bg-surface-container-low p-5",
                  index > 0 &&
                    "border-t border-outline-variant md:border-l md:border-t-0",
                )}
              >
                <dt className="type-caption font-semibold text-on-surface-variant">
                  {item.label}
                </dt>
                <dd className="mt-2 type-title font-semibold">{item.value}</dd>
                <dd className="mt-2 type-body-sm text-on-surface-variant">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section
        id="faq"
        className="mx-auto grid max-w-[1120px] gap-8 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[.75fr_1.25fr] lg:px-8"
      >
        <div>
          <p className="type-label font-semibold text-secondary">
            {copy.faq.eyebrow}
          </p>
          <h2 className="mt-2 type-heading-lg">{copy.faq.title}</h2>
        </div>
        <Accordion className="rounded-[12px] border border-outline-variant bg-surface px-4">
          {copy.faq.items.map((item) => (
            <AccordionItem key={item.question} value={item.question}>
              <AccordionTrigger
                className="py-4 type-label font-semibold hover:no-underline"
                data-landing-event="landing_faq_opened"
                data-landing-placement="faq"
              >
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="pb-4 type-body-sm text-on-surface-variant">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="px-4 pb-16 sm:px-6 sm:pb-20 lg:px-8">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-5 rounded-[12px] bg-primary p-6 text-on-primary sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="type-heading-lg">{copy.finalCta.title}</h2>
            <p className="mt-2 type-body text-on-primary/75">
              {copy.finalCta.body}
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button
              render={<Link href={studentHref} />}
              nativeButton={false}
              className="bg-surface text-on-surface hover:bg-surface-container"
              data-landing-event="landing_cta_clicked"
              data-landing-placement="final_cta"
              data-landing-audience="student"
            >
              {copy.finalCta.student}
              <ProductIcon name="arrowRight" size="sm" />
            </Button>
            <Button
              render={<a href={teacherHref} />}
              nativeButton={false}
              variant="outline"
              className="border-surface/30 bg-transparent text-on-primary hover:bg-surface/10 hover:text-on-primary"
              data-landing-event="teacher_contact_clicked"
              data-landing-placement="final_cta"
              data-landing-audience="teacher"
            >
              {copy.finalCta.teacher}
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-outline-variant bg-surface py-10">
        <div className="mx-auto grid max-w-[1120px] gap-8 px-4 sm:px-6 md:grid-cols-[1fr_auto_auto_auto] lg:px-8">
          <div>
            <LogoMark size="sm" />
            <p className="mt-3 max-w-sm type-body-sm text-on-surface-variant">
              {copy.footer.description}
            </p>
          </div>
          <div>
            <p className="type-label font-semibold">
              {copy.footer.guidesLabel}
            </p>
            <div className="mt-3 flex flex-col gap-2 type-body-sm text-on-surface-variant">
              {copy.footer.guides.map((guide) => (
                <Link key={guide.path} href={localizedHref(locale, guide.path)}>
                  {guide.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="type-label font-semibold">{copy.footer.product}</p>
            <div className="mt-3 flex flex-col gap-2 type-body-sm text-on-surface-variant">
              <Link
                href={localizedHref(locale, "/")}
                data-landing-event="landing_product_switched"
                data-landing-placement="footer"
                data-landing-product-target="debate"
              >
                {copy.navigation.debate}
              </Link>
              <Link
                href={localizedHref(locale, "/ielts")}
                data-landing-event="landing_product_switched"
                data-landing-placement="footer"
                data-landing-product-target="ielts"
              >
                {copy.navigation.ielts}
              </Link>
            </div>
          </div>
          <div>
            <p className="type-label font-semibold">{copy.footer.legal}</p>
            <div className="mt-3 flex flex-col gap-2 type-body-sm text-on-surface-variant">
              <Link href={localizedHref(locale, "/privacy")}>
                {copy.footer.privacy}
              </Link>
              <Link href={localizedHref(locale, "/terms")}>
                {copy.footer.terms}
              </Link>
              <Link href={localizedHref(locale, "/cookies")}>
                {copy.footer.cookies}
              </Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 flex max-w-[1120px] items-center justify-between gap-4 border-t border-outline-variant px-4 pt-5 type-caption text-on-surface-variant sm:px-6 lg:px-8">
          <span>{copy.footer.copyright}</span>
          <a
            href="#top"
            className="inline-flex items-center gap-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.productName}
            <ProductIcon name="chevronRight" size="xs" />
          </a>
        </div>
      </footer>
    </Root>
  );
}
