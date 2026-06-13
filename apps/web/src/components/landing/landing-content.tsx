import Image from "next/image";
import type { LandingCopy, LandingLocale } from "./copy";
import { landingHref } from "./links";
import { LogoMark } from "./logo-mark";
import { cn } from "@/lib/utils";
import { Display, Eyebrow, Stat } from "@/components/ui/typography";

interface LandingContentProps {
  copy: LandingCopy;
  isLoggedIn: boolean;
  locale: LandingLocale;
}

const socialAvatars = [
  { label: "AL", gradient: "from-[#EAC3A3] to-[#C88B67]" },
  { label: "JM", gradient: "from-[#8BE8F7] to-[#00B8D9]" },
  { label: "RS", gradient: "from-[#F8D39B] to-[#E89A42]" },
  { label: "NP", gradient: "from-[#BFD8FF] to-[#89AFFF]" },
] as const;

type LandingIconProps = {
  className?: string;
};

function ArrowRight({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="M13.5 5.25 20.25 12l-6.75 6.75M19.5 12H3.75"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function BarChart3({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5 20V10M12 20V4M19 20v-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function BookOpen({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H20" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function Clock3({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function MessageCircleMore({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M4 12a8 8 0 1 1 4.6 7.24L4 20l.76-4.6A7.96 7.96 0 0 1 4 12Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2.5" />
    </svg>
  );
}

function MessageSquareText({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M8 9h8M8 13h5" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function Mic({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  );
}

function Star({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path
        d="m12 3 2.78 5.63 6.22.9-4.5 4.38 1.06 6.19L12 17.18 6.44 20.1l1.06-6.19L3 9.53l6.22-.9L12 3Z"
        fill="currentColor"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function Trophy({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" />
      <path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M10 17h4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

function Users({ className }: LandingIconProps) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <path d="M15 19a5 5 0 0 0-10 0M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 19a4 4 0 0 0-4-4M17 4.5a3.5 3.5 0 0 1 0 7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    </svg>
  );
}

const socialIcons = {
  twitter: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M18.9 2H22l-6.77 7.73L23 22h-6.1l-4.78-6.25L6.65 22H3.54l7.24-8.27L1.5 2h6.25l4.32 5.72L18.9 2Z" />
    </svg>
  ),
  discord: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M19.74 5.33A17.52 17.52 0 0 0 15.4 4l-.2.4c1.64.4 2.4.98 2.4.98a8.15 8.15 0 0 0-2.56-.8 8.63 8.63 0 0 0-6.08 0 10.13 10.13 0 0 0-2.56.8s.8-.62 2.61-1.02L8.8 4a17.35 17.35 0 0 0-4.36 1.35C1.7 9.44.96 13.43 1.2 17.36a17.73 17.73 0 0 0 5.33 2.68l.43-.7c-1.01-.38-1.4-.75-1.4-.75.31.2.61.38.9.53 2.17 1.08 4.52 1.38 6.92.88 1.15-.23 2.25-.64 3.25-1.21 0 0-.42.4-1.49.78l.42.71a17.65 17.65 0 0 0 5.35-2.68c.28-4.55-.48-8.5-3.17-12.03ZM8.95 14.95c-1.04 0-1.88-.93-1.88-2.08 0-1.15.83-2.08 1.88-2.08 1.05 0 1.9.94 1.88 2.08 0 1.15-.83 2.08-1.88 2.08Zm6.1 0c-1.04 0-1.88-.93-1.88-2.08 0-1.15.83-2.08 1.88-2.08 1.05 0 1.9.94 1.88 2.08 0 1.15-.83 2.08-1.88 2.08Z" />
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M21.58 7.19a2.92 2.92 0 0 0-2.05-2.06C17.73 4.63 12 4.63 12 4.63s-5.73 0-7.53.5A2.92 2.92 0 0 0 2.42 7.2 30.62 30.62 0 0 0 2 12a30.62 30.62 0 0 0 .42 4.81 2.92 2.92 0 0 0 2.05 2.06c1.8.5 7.53.5 7.53.5s5.73 0 7.53-.5a2.92 2.92 0 0 0 2.05-2.06A30.62 30.62 0 0 0 22 12a30.62 30.62 0 0 0-.42-4.81ZM10.09 15.01V8.99L15.27 12l-5.18 3.01Z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm0 1.9A3.85 3.85 0 0 0 3.9 7.75v8.5A3.85 3.85 0 0 0 7.75 20.1h8.5a3.85 3.85 0 0 0 3.85-3.85v-8.5A3.85 3.85 0 0 0 16.25 3.9h-8.5Zm8.87 1.42a1.06 1.06 0 1 1 0 2.12 1.06 1.06 0 0 1 0-2.12ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2Z" />
    </svg>
  ),
} as const;

function StatIcon({
  type,
  className,
}: {
  type: "users" | "message" | "star" | "clock";
  className?: string;
}) {
  const iconClassName = cn("h-6 w-6 text-primary", className);

  if (type === "users") return <Users className={iconClassName} />;
  if (type === "message") return <MessageCircleMore className={iconClassName} />;
  if (type === "star") return <Star className={iconClassName} />;
  return <Clock3 className={iconClassName} />;
}

function FeatureIcon({
  type,
  className,
}: {
  type: "mic" | "book" | "users" | "chart" | "message" | "trophy";
  className?: string;
}) {
  const iconClassName = cn("h-7 w-7 text-primary", className);

  if (type === "mic") return <Mic className={iconClassName} />;
  if (type === "book") return <BookOpen className={iconClassName} />;
  if (type === "users") return <Users className={iconClassName} />;
  if (type === "chart") return <BarChart3 className={iconClassName} />;
  if (type === "message") return <MessageSquareText className={iconClassName} />;
  return <Trophy className={iconClassName} />;
}

function StepIcon({
  type,
}: {
  type: "book" | "users" | "chart";
}) {
  if (type === "book") return <BookOpen className="h-10 w-10 text-primary" />;
  if (type === "users") return <Users className="h-10 w-10 text-primary" />;
  return <BarChart3 className="h-10 w-10 text-primary" />;
}

function PrimaryButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="btn-3d-primary inline-flex h-14 items-center gap-2 rounded-[16px] bg-primary px-7 text-sm font-semibold text-on-primary hover:bg-primary-dim"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function SecondaryButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex h-14 items-center rounded-[16px] border border-outline-variant bg-white px-7 text-sm font-semibold text-primary-dim shadow-token-card transition-all hover:-translate-y-0.5 hover:border-outline-variant"
    >
      {label}
    </a>
  );
}

function SocialProof({
  prefix,
  count,
  suffix,
}: {
  prefix: string;
  count: string;
  suffix: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex items-center">
        {socialAvatars.map((avatar, index) => (
          <div
            key={avatar.label}
            className={cn(
              "relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white type-caption font-bold text-white shadow-sm",
              index > 0 && "-ml-2.5"
            )}
          >
            <div
              className={cn(
                "absolute inset-0 rounded-full bg-gradient-to-br",
                avatar.gradient
              )}
            />
            <span className="relative z-10">{avatar.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-warning">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className="h-4 w-4 fill-current stroke-current"
            />
          ))}
        </div>
        <p className="text-sm text-on-surface-variant">
          {prefix} <span className="font-semibold text-primary">{count}</span>{" "}
          {suffix}
        </p>
      </div>
    </div>
  );
}

function TestimonialAvatar({
  initials,
}: {
  initials: string;
}) {
  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#D7E5FF] to-[#87AFFF] text-sm font-bold text-on-surface-variant">
      {initials}
    </div>
  );
}

export function LandingContent({
  copy,
  isLoggedIn,
  locale,
}: LandingContentProps) {
  return (
    <div className="bg-background text-on-surface">
      <section className="px-6 pb-10 pt-4 md:px-8 md:pb-14">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
          <div className="order-2 w-full min-w-0 max-w-[calc(100vw-3rem)] sm:max-w-[560px] lg:order-1">
            <Display className="mt-5 break-words lg:mt-[4.25rem]">
              {copy.hero.line1}
              <br />
              <span className="text-primary">{copy.hero.line2}</span>
            </Display>

            <p className="mt-7 w-full max-w-[320px] type-body-lg text-on-surface-variant sm:max-w-[500px]">
              {copy.hero.description}
            </p>

            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row">
              <PrimaryButton
                href={landingHref(
                  locale,
                  isLoggedIn ? "/dashboard" : "/auth/signup"
                )}
                label={isLoggedIn ? copy.hero.primaryCtaLoggedIn : copy.hero.primaryCta}
              />
              <SecondaryButton href="#features" label={copy.hero.secondaryCta} />
            </div>

            <div className="mt-10">
              <SocialProof
                prefix={copy.hero.lovedByPrefix}
                count={copy.hero.lovedByCount}
                suffix={copy.hero.lovedBySuffix}
              />
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="relative mx-auto max-w-[874px]">
              <Image
                src="/images/landing/hero-reference-aqua.png"
                alt="Two debaters standing at podiums in a clean debate illustration"
                width={1536}
                height={1024}
                priority
                className="h-auto w-full object-contain lg:scale-[1.15]"
                sizes="(max-width: 1024px) 100vw, 56vw"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-18 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid overflow-hidden rounded-[28px] border border-outline-variant bg-white shadow-token-card md:grid-cols-2 xl:grid-cols-4">
            {copy.stats.map((item, index) => (
              <div
                key={`${item.value}-${item.label}`}
                className={cn(
                  "flex items-center gap-5 px-8 py-8",
                  index < copy.stats.length - 1 &&
                    "border-b border-outline-variant xl:border-b-0 xl:border-r"
                )}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-surface-container">
                  <StatIcon type={item.icon} />
                </div>
                <div>
                  <Stat as="p" size="heading-xl" className="text-on-surface">
                    {item.value}
                  </Stat>
                  <p className="text-sm text-on-surface-variant">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-[760px] text-center">
            <Eyebrow className="text-primary">
              {copy.features.eyebrow}
            </Eyebrow>
            <Display size="sm" as="h2" className="mt-4">
              {copy.features.title}
            </Display>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {copy.features.items.map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-outline-variant bg-white p-8 shadow-token-card"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-surface-container">
                  <FeatureIcon type={item.icon} />
                </div>
                <h3 className="mt-6 type-heading-lg font-semibold text-on-surface">
                  {item.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-on-surface-variant">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-6 py-18 md:px-8 md:py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-[760px] text-center">
            <Eyebrow className="text-primary">
              {copy.steps.eyebrow}
            </Eyebrow>
            <Display size="sm" as="h2" className="mt-4">
              {copy.steps.title}
            </Display>
          </div>

          <div className="relative mt-16 grid gap-12 lg:grid-cols-3 lg:gap-8">
            <div className="absolute left-[17%] right-[17%] top-[82px] hidden border-t border-dashed border-outline-variant lg:block" />

            {copy.steps.items.map((item, index) => (
              <div key={item.title} className="relative text-center">
                <div className="absolute left-[18%] top-9 z-10 hidden h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white lg:flex">
                  {index + 1}
                </div>
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-outline-variant bg-[linear-gradient(180deg,#F3FCFE_0%,#E5F8FC_100%)] shadow-token-card">
                  <StepIcon type={item.icon} />
                </div>
                <h3 className="mt-7 type-heading-lg font-semibold text-on-surface">
                  {item.title}
                </h3>
                <p className="mx-auto mt-3 max-w-[320px] text-base leading-7 text-on-surface-variant">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14 md:px-8 md:py-18">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-[760px] text-center">
            <Eyebrow className="text-primary">
              {copy.testimonials.eyebrow}
            </Eyebrow>
            <Display size="sm" as="h2" className="mt-4">
              {copy.testimonials.title}
            </Display>
          </div>

          <div className="mt-16 grid gap-5 lg:grid-cols-3">
            {copy.testimonials.items.map((item) => (
              <div
                key={item.name}
                className="rounded-[24px] border border-outline-variant bg-white p-8 shadow-token-card"
              >
                <div className="flex items-center gap-1 text-warning">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className="h-4 w-4 fill-current stroke-current"
                    />
                  ))}
                </div>

                <p className="mt-6 min-h-[136px] type-body text-on-surface-variant">
                  &ldquo;{item.quote}&rdquo;
                </p>

                <div className="mt-8 flex items-center gap-3">
                  <TestimonialAvatar initials={item.initials} />
                  <div>
                    <p className="text-base font-semibold text-on-surface">
                      {item.name}
                    </p>
                    <p className="text-sm text-on-surface-variant">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface-container-high" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface-container-high" />
            <span className="h-2.5 w-2.5 rounded-full bg-surface-container-high" />
          </div>
        </div>
      </section>

      <section id="pricing" className="px-6 py-14 md:px-8 md:py-18">
        <div className="mx-auto max-w-6xl">
          <div className="overflow-hidden rounded-[34px] border border-outline-variant bg-[linear-gradient(180deg,#F3FCFE_0%,#E5F8FC_100%)] px-8 py-10 shadow-token-card md:px-12 md:py-12">
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_476px]">
              <div className="max-w-[560px]">
                <Display size="md" as="h2">
                  {copy.cta.title}
                </Display>
                <p className="mt-5 type-body-lg text-on-surface-variant">
                  {copy.cta.description}
                </p>
                <div className="mt-8">
                  <PrimaryButton
                    href={landingHref(
                      locale,
                      isLoggedIn ? "/dashboard" : "/auth/signup"
                    )}
                    label={isLoggedIn ? copy.cta.buttonLoggedIn : copy.cta.button}
                  />
                </div>
              </div>

              <div className="mx-auto w-full max-w-[476px] lg:-ml-14 lg:mr-0">
                <Image
                  src="/brand/thinkfy/thinkfy-mascot-standing.png"
                  alt="Thinkfy mascot ready to practice"
                  width={512}
                  height={654}
                  className="mx-auto h-auto w-full max-w-[330px] object-contain drop-shadow-token-card"
                  sizes="(max-width: 1024px) 260px, 330px"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer
        id="about"
        className="px-6 pb-10 pt-8 md:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div
            id="resources"
            className="grid gap-10 border-t border-outline-variant pt-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1.1fr]"
          >
            <div>
              <LogoMark
                size="md"
              />
              <p className="mt-5 max-w-[300px] type-body text-on-surface-variant">
                {copy.footer.brandDescription}
              </p>
              <div className="mt-6 flex items-center gap-3 text-on-surface-variant">
                {Object.values(socialIcons).map((icon, index) => (
                  <a
                    key={index}
                    href="#"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-on-surface-variant shadow-token-card transition-colors hover:text-primary"
                  >
                    {icon}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-on-surface">
                {copy.footer.product.title}
              </p>
              <div className="mt-5 flex flex-col gap-3.5">
                {copy.footer.product.links.map((link) => (
                  <a
                    key={link.label}
                    href={landingHref(locale, link.href)}
                    className="type-body text-on-surface-variant transition-colors hover:text-primary"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-on-surface">
                {copy.footer.resources.title}
              </p>
              <div className="mt-5 flex flex-col gap-3.5">
                {copy.footer.resources.links.map((link) => (
                  <a
                    key={link.label}
                    href={landingHref(locale, link.href)}
                    className="type-body text-on-surface-variant transition-colors hover:text-primary"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-on-surface">
                {copy.footer.company.title}
              </p>
              <div className="mt-5 flex flex-col gap-3.5">
                {copy.footer.company.links.map((link) => (
                  <a
                    key={link.label}
                    href={landingHref(locale, link.href)}
                    className="type-body text-on-surface-variant transition-colors hover:text-primary"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-on-surface">
                {copy.footer.newsletter.title}
              </p>
              <p className="mt-5 max-w-[260px] type-body text-on-surface-variant">
                {copy.footer.newsletter.description}
              </p>
              <form className="mt-5 flex gap-3">
                <input
                  type="email"
                  placeholder={copy.footer.newsletter.placeholder}
                  className="h-12 min-w-0 flex-1 rounded-[14px] border border-outline-variant bg-white px-4 text-sm text-on-surface outline-none placeholder:text-on-surface-variant focus:border-primary-fixed"
                />
                <button
                  type="submit"
                  className="btn-3d-primary h-12 rounded-[14px] bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-dim"
                >
                  {copy.footer.newsletter.button}
                </button>
              </form>
            </div>
          </div>

          <div className="mt-10 border-t border-outline-variant pt-6 text-center text-sm text-muted-foreground">
            {copy.footer.copyright}
          </div>
        </div>
      </footer>
    </div>
  );
}
