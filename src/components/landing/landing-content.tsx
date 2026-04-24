"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Clock3,
  MessageCircleMore,
  MessageSquareText,
  Mic,
  Star,
  Trophy,
  Users,
} from "lucide-react";
import { getLandingCopy } from "./copy";
import { LogoMark } from "./logo-mark";
import { cn } from "@/lib/utils";

interface LandingContentProps {
  isLoggedIn: boolean;
}

const socialAvatars = [
  { label: "AL", gradient: "from-[#EAC3A3] to-[#C88B67]" },
  { label: "JM", gradient: "from-[#A2C5FF] to-[#4D86F7]" },
  { label: "RS", gradient: "from-[#F8D39B] to-[#E89A42]" },
  { label: "NP", gradient: "from-[#BFD8FF] to-[#89AFFF]" },
] as const;

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
  const iconClassName = cn("h-6 w-6 text-[#4D86F7]", className);

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
  const iconClassName = cn("h-7 w-7 text-[#4D86F7]", className);

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
  if (type === "book") return <BookOpen className="h-10 w-10 text-[#4D86F7]" />;
  if (type === "users") return <Users className="h-10 w-10 text-[#4D86F7]" />;
  return <BarChart3 className="h-10 w-10 text-[#4D86F7]" />;
}

function PrimaryButton({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="btn-3d-primary inline-flex h-14 items-center gap-2 rounded-[16px] bg-primary px-7 text-sm font-semibold text-on-primary hover:bg-primary-dim"
    >
      {label}
      <ArrowRight className="h-4 w-4" />
    </Link>
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
      className="inline-flex h-14 items-center rounded-[16px] border border-[#DEE8F8] bg-white px-7 text-sm font-semibold text-[#3E78EC] shadow-[0_16px_32px_-24px_rgba(11,20,36,0.25)] transition-all hover:-translate-y-0.5 hover:border-[#C8DAF7]"
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
              "relative flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-white text-[10px] font-bold text-white shadow-sm",
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
        <div className="flex items-center gap-1.5 text-[#F5B942]">
          {Array.from({ length: 5 }).map((_, index) => (
            <Star
              key={index}
              className="h-4 w-4 fill-current stroke-current"
            />
          ))}
        </div>
        <p className="text-sm text-[#718096]">
          {prefix} <span className="font-semibold text-[#4D86F7]">{count}</span>{" "}
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
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#D7E5FF] to-[#87AFFF] text-sm font-bold text-[#214EA8]">
      {initials}
    </div>
  );
}

export function LandingContent({ isLoggedIn }: LandingContentProps) {
  const locale = useLocale();
  const copy = getLandingCopy(locale);

  return (
    <div className="bg-[#F7FAFE] text-[#0B1424]">
      <section className="px-6 pb-10 pt-4 md:px-8 md:pb-14">
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
          <div className="order-2 max-w-[560px] lg:order-1">
            <h1 className="mt-[4.25rem] text-[3.2rem] font-bold leading-[0.98] tracking-[-0.05em] text-[#0B1424] sm:text-[4.4rem]">
              {copy.hero.line1}
              <br />
              <span className="text-[#4D86F7]">{copy.hero.line2}</span>
            </h1>

            <p className="mt-7 max-w-[500px] text-[1.15rem] leading-8 text-[#61718C]">
              {copy.hero.description}
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <PrimaryButton
                href={isLoggedIn ? "/dashboard" : "/auth/signup"}
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
                src="/images/landing/hero-reference.png"
                alt="Two debaters standing at podiums in a clean blue illustration"
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
        <div className="mx-auto max-w-[1280px]">
          <div className="grid overflow-hidden rounded-[28px] border border-[#E3ECF8] bg-white shadow-[0_30px_60px_-40px_rgba(11,20,36,0.28)] md:grid-cols-2 xl:grid-cols-4">
            {copy.stats.map((item, index) => (
              <div
                key={`${item.value}-${item.label}`}
                className={cn(
                  "flex items-center gap-5 px-8 py-8",
                  index < copy.stats.length - 1 &&
                    "border-b border-[#EEF3FA] xl:border-b-0 xl:border-r"
                )}
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[18px] bg-[#F1F6FD]">
                  <StatIcon type={item.icon} />
                </div>
                <div>
                  <p className="text-[2rem] font-bold tracking-[-0.03em] text-[#0B1424]">
                    {item.value}
                  </p>
                  <p className="text-sm text-[#718096]">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="px-6 py-10 md:px-8 md:py-14">
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#4D86F7]">
              {copy.features.eyebrow}
            </p>
            <h2 className="mt-4 text-[2.2rem] font-bold leading-[1.22] tracking-[-0.04em] text-[#0B1424] sm:text-[3.2rem]">
              {copy.features.title}
            </h2>
          </div>

          <div className="mt-16 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {copy.features.items.map((item) => (
              <div
                key={item.title}
                className="rounded-[24px] border border-[#E3ECF8] bg-white p-8 shadow-[0_22px_48px_-42px_rgba(11,20,36,0.35)]"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#F1F6FD]">
                  <FeatureIcon type={item.icon} />
                </div>
                <h3 className="mt-6 text-[1.55rem] font-semibold tracking-[-0.03em] text-[#0B1424]">
                  {item.title}
                </h3>
                <p className="mt-3 text-base leading-7 text-[#718096]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-6 py-18 md:px-8 md:py-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#4D86F7]">
              {copy.steps.eyebrow}
            </p>
            <h2 className="mt-4 text-[2.2rem] font-bold leading-[1.22] tracking-[-0.04em] text-[#0B1424] sm:text-[3.2rem]">
              {copy.steps.title}
            </h2>
          </div>

          <div className="relative mt-16 grid gap-12 lg:grid-cols-3 lg:gap-8">
            <div className="absolute left-[17%] right-[17%] top-[82px] hidden border-t border-dashed border-[#CFE0FB] lg:block" />

            {copy.steps.items.map((item, index) => (
              <div key={item.title} className="relative text-center">
                <div className="absolute left-[18%] top-9 z-10 hidden h-9 w-9 items-center justify-center rounded-full bg-[#4D86F7] text-sm font-semibold text-white lg:flex">
                  {index + 1}
                </div>
                <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-full border border-[#DEE8F8] bg-[linear-gradient(180deg,#F5F9FF_0%,#EAF2FF_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
                  <StepIcon type={item.icon} />
                </div>
                <h3 className="mt-7 text-[1.6rem] font-semibold tracking-[-0.03em] text-[#0B1424]">
                  {item.title}
                </h3>
                <p className="mx-auto mt-3 max-w-[320px] text-base leading-7 text-[#718096]">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-14 md:px-8 md:py-18">
        <div className="mx-auto max-w-[1280px]">
          <div className="mx-auto max-w-[760px] text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#4D86F7]">
              {copy.testimonials.eyebrow}
            </p>
            <h2 className="mt-4 text-[2.2rem] font-bold leading-[1.22] tracking-[-0.04em] text-[#0B1424] sm:text-[3.2rem]">
              {copy.testimonials.title}
            </h2>
          </div>

          <div className="mt-16 grid gap-5 lg:grid-cols-3">
            {copy.testimonials.items.map((item) => (
              <div
                key={item.name}
                className="rounded-[24px] border border-[#E3ECF8] bg-white p-8 shadow-[0_22px_48px_-42px_rgba(11,20,36,0.35)]"
              >
                <div className="flex items-center gap-1 text-[#F5B942]">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star
                      key={index}
                      className="h-4 w-4 fill-current stroke-current"
                    />
                  ))}
                </div>

                <p className="mt-6 min-h-[136px] text-[1.02rem] leading-8 text-[#415069]">
                  &ldquo;{item.quote}&rdquo;
                </p>

                <div className="mt-8 flex items-center gap-3">
                  <TestimonialAvatar initials={item.initials} />
                  <div>
                    <p className="text-base font-semibold text-[#0B1424]">
                      {item.name}
                    </p>
                    <p className="text-sm text-[#718096]">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-[#4D86F7]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#D5E2F7]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#D5E2F7]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#D5E2F7]" />
          </div>
        </div>
      </section>

      <section id="pricing" className="px-6 py-14 md:px-8 md:py-18">
        <div className="mx-auto max-w-[1280px]">
          <div className="overflow-hidden rounded-[34px] border border-[#E3ECF8] bg-[linear-gradient(180deg,#F2F7FF_0%,#ECF3FF_100%)] px-8 py-10 shadow-[0_24px_56px_-44px_rgba(11,20,36,0.38)] md:px-12 md:py-12">
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_476px]">
              <div className="max-w-[560px]">
                <h2 className="text-[2.4rem] font-bold leading-[1.15] tracking-[-0.04em] text-[#0B1424] sm:text-[3rem]">
                  {copy.cta.title}
                </h2>
                <p className="mt-5 text-[1.05rem] leading-8 text-[#718096]">
                  {copy.cta.description}
                </p>
                <div className="mt-8">
                  <PrimaryButton
                    href={isLoggedIn ? "/dashboard" : "/auth/signup"}
                    label={isLoggedIn ? copy.cta.buttonLoggedIn : copy.cta.button}
                  />
                </div>
              </div>

              <div className="mx-auto w-full max-w-[476px] lg:-ml-14 lg:mr-0">
                <Image
                  src="/images/landing/trophy-reference.png"
                  alt="Blue trophy standing on a podium with confetti"
                  width={1365}
                  height={1024}
                  className="h-auto w-full object-contain"
                  sizes="(max-width: 1024px) 370px, 476px"
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
        <div className="mx-auto max-w-[1280px]">
          <div
            id="resources"
            className="grid gap-10 border-t border-[#E4EDF8] pt-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_1.1fr]"
          >
            <div>
              <LogoMark
                className="gap-2.5"
                bubbleClassName="h-9 w-9"
                textClassName="text-[1.55rem]"
              />
              <p className="mt-5 max-w-[300px] text-[0.98rem] leading-7 text-[#718096]">
                {copy.footer.brandDescription}
              </p>
              <div className="mt-6 flex items-center gap-3 text-[#718096]">
                {Object.values(socialIcons).map((icon, index) => (
                  <a
                    key={index}
                    href="#"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#718096] shadow-[0_10px_24px_-18px_rgba(11,20,36,0.3)] transition-colors hover:text-[#4D86F7]"
                  >
                    {icon}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0B1424]">
                {copy.footer.product.title}
              </p>
              <div className="mt-5 flex flex-col gap-3.5">
                {copy.footer.product.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-[0.98rem] text-[#718096] transition-colors hover:text-[#4D86F7]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0B1424]">
                {copy.footer.resources.title}
              </p>
              <div className="mt-5 flex flex-col gap-3.5">
                {copy.footer.resources.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-[0.98rem] text-[#718096] transition-colors hover:text-[#4D86F7]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0B1424]">
                {copy.footer.company.title}
              </p>
              <div className="mt-5 flex flex-col gap-3.5">
                {copy.footer.company.links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className="text-[0.98rem] text-[#718096] transition-colors hover:text-[#4D86F7]"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-[#0B1424]">
                {copy.footer.newsletter.title}
              </p>
              <p className="mt-5 max-w-[260px] text-[0.98rem] leading-7 text-[#718096]">
                {copy.footer.newsletter.description}
              </p>
              <form className="mt-5 flex gap-3">
                <input
                  type="email"
                  placeholder={copy.footer.newsletter.placeholder}
                  className="h-12 min-w-0 flex-1 rounded-[14px] border border-[#DEE8F8] bg-white px-4 text-sm text-[#162033] outline-none placeholder:text-[#A1ADC0] focus:border-[#A9C6FB]"
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

          <div className="mt-10 border-t border-[#E4EDF8] pt-6 text-center text-sm text-[#8A96A8]">
            {copy.footer.copyright}
          </div>
        </div>
      </footer>
    </div>
  );
}
