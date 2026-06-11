"use client";

import Image from "next/image";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import { landingHref } from "../links";
import type { LandingLocale, LandingV3Copy } from "./copy";
import { CheckIcon, StarIcon } from "./icons";
import { Float, Sparkle } from "./motion-primitives";
import { GhostButton, PrimaryButton } from "./ui";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const AVATARS = [
  { label: "AL", gradient: "from-[#EAC3A3] to-[#C88B67]" },
  { label: "JM", gradient: "from-[#8BE8F7] to-[#00B8D9]" },
  { label: "RS", gradient: "from-[#F8D39B] to-[#E89A42]" },
  { label: "NP", gradient: "from-[#BFD8FF] to-[#89AFFF]" },
] as const;

function HeadlineWords({
  text,
  highlight,
  startDelay = 0,
}: {
  text: string;
  highlight?: string;
  startDelay?: number;
}) {
  const words = text.split(" ");
  return (
    <span className="inline-block">
      {words.map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          initial={{ opacity: 0, y: 34 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: startDelay + index * 0.08, ease: EASE_OUT }}
          className={cn(
            "mr-[0.24em] inline-block last:mr-0",
            highlight && highlight.includes(word.replace(/[.,!?]/g, "")) && "text-primary"
          )}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

function SpeechBubble({
  side,
  label,
  className,
}: {
  side: "pro" | "con";
  label: string;
  className?: string;
}) {
  const isPro = side === "pro";
  return (
    <div
      className={cn(
        "relative flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold shadow-token-card",
        isPro
          ? "border-[#8BE8F7] bg-white text-primary-dim"
          : "border-[#FFD2D4] bg-white text-error-dim",
        className
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full text-white",
          isPro ? "bg-primary" : "bg-error"
        )}
      >
        {isPro ? (
          <CheckIcon className="h-3 w-3" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden="true">
            <path d="M7 17 17 7M17 7h-7M17 7v7" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
          </svg>
        )}
      </span>
      {label}
      <span
        className={cn(
          "absolute -bottom-[7px] h-3.5 w-3.5 rotate-45 border-b border-r bg-white",
          isPro ? "left-7 border-[#8BE8F7]" : "right-7 border-[#FFD2D4]"
        )}
      />
    </div>
  );
}

export function HeroSection({
  copy,
  isLoggedIn,
  locale,
}: {
  copy: LandingV3Copy;
  isLoggedIn: boolean;
  locale: LandingLocale;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const sceneY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 90]);
  const bubblesY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 150]);

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden bg-[linear-gradient(180deg,#FFFFFF_0%,#F3FCFE_55%,#E5F8FC_100%)] px-6 pb-0 pt-32 md:px-8 md:pt-40"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
        <h1 className="text-balance text-[2.9rem] font-extrabold leading-[1.02] tracking-[-0.03em] text-on-surface sm:text-[4.2rem] lg:text-[5rem]">
          <HeadlineWords text={copy.hero.line1} />
          <br />
          <HeadlineWords text={copy.hero.line2.text} highlight={copy.hero.line2.highlight} startDelay={0.22} />
        </h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5, ease: EASE_OUT }}
          className="mt-7 max-w-[560px] text-pretty text-[1.08rem] leading-8 text-on-surface-variant sm:text-[1.18rem]"
        >
          {copy.hero.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.64, ease: EASE_OUT }}
          className="mt-9 flex flex-col items-center gap-4 sm:flex-row"
        >
          <PrimaryButton
            href={landingHref(locale, isLoggedIn ? "/dashboard" : "/auth/signup")}
            label={isLoggedIn ? copy.hero.primaryCtaLoggedIn : copy.hero.primaryCta}
            withArrow
          />
          <GhostButton href="#journey" label={copy.hero.secondaryCta} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.85 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
        >
          <div className="flex items-center">
            {AVATARS.map((avatar, index) => (
              <span
                key={avatar.label}
                className={cn(
                  "relative flex h-10 w-10 items-center justify-center rounded-full border-[3px] border-white text-[10px] font-extrabold text-white shadow-sm",
                  index > 0 && "-ml-2.5"
                )}
              >
                <span className={cn("absolute inset-0 rounded-full bg-gradient-to-br", avatar.gradient)} />
                <span className="relative z-10">{avatar.label}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <span className="flex items-center gap-1 text-warning">
              {Array.from({ length: 5 }).map((_, index) => (
                <StarIcon key={index} className="h-3.5 w-3.5" />
              ))}
            </span>
            <p className="text-sm text-on-surface-variant">
              {copy.hero.lovedBy.prefix}{" "}
              <span className="font-bold text-primary">{copy.hero.lovedBy.count}</span>{" "}
              {copy.hero.lovedBy.suffix}
            </p>
          </div>
        </motion.div>
      </div>

      {/* Stage scene */}
      <motion.div
        style={{ y: sceneY }}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.9, ease: EASE_OUT }}
        className="relative mx-auto mt-14 max-w-4xl md:mt-16"
      >
        {/* Spotlight */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-[-40px] h-[420px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(0,184,217,0.16)_0%,rgba(0,184,217,0)_65%)]"
        />

        {/* Floating speech bubbles */}
        <motion.div style={{ y: bubblesY }} className="pointer-events-none absolute inset-0 z-20">
          <Float distance={9} duration={3.8} className="absolute left-[2%] top-[8%] sm:left-[8%]">
            <SpeechBubble side="pro" label={copy.hero.proBubble} />
          </Float>
          <Float distance={8} duration={4.4} delay={0.6} className="absolute right-[2%] top-[2%] sm:right-[7%]">
            <SpeechBubble side="con" label={copy.hero.conBubble} />
          </Float>
          <Sparkle className="absolute left-[22%] top-[30%]" size={18} delay={0.3} />
          <Sparkle className="absolute right-[24%] top-[24%]" size={14} delay={1.2} />
          <Sparkle className="absolute left-[38%] top-[2%]" size={12} delay={2} />
        </motion.div>

        <div className="relative flex items-end justify-center">
          {/* Student debaters at the far sides (left/right crops of one square asset) */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.2, ease: EASE_OUT }}
            className="absolute bottom-0 left-[2%] hidden h-[250px] w-[125px] overflow-hidden sm:block md:left-[8%] lg:left-[14%]"
          >
            <Image
              src="/images/landing-v3/hero-students.webp"
              alt=""
              aria-hidden="true"
              width={1254}
              height={1254}
              priority
              className="h-[250px] w-[250px] max-w-none object-contain"
              sizes="250px"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.35, ease: EASE_OUT }}
            className="absolute bottom-0 right-[2%] hidden h-[250px] w-[125px] overflow-hidden sm:block md:right-[8%] lg:right-[14%]"
          >
            <Image
              src="/images/landing-v3/hero-students.webp"
              alt=""
              aria-hidden="true"
              width={1254}
              height={1254}
              priority
              className="-ml-[125px] h-[250px] w-[250px] max-w-none object-contain"
              sizes="250px"
            />
          </motion.div>

          {/* Mascot at the podium */}
          <div className="relative z-10">
            <Float distance={5} duration={4.6}>
              <Image
                src="/images/landing-v3/mascot-podium.webp"
                alt="Thinkfy mascot, a friendly water buffalo debater, speaking at a podium"
                width={1254}
                height={1254}
                priority
                className="h-auto w-60 object-contain drop-shadow-[0_18px_24px_rgba(16,41,54,0.18)] sm:w-80"
                sizes="(max-width: 640px) 240px, 320px"
              />
            </Float>
          </div>
        </div>

        {/* Stage floor */}
        <div
          aria-hidden="true"
          className="mx-auto h-5 w-[92%] max-w-3xl rounded-[50%] bg-[#CDECF3]/80"
        />
      </motion.div>
    </section>
  );
}
