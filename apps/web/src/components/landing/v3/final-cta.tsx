"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { landingHref } from "../links";
import type { LandingLocale, LandingV3Copy } from "./copy";
import { Grain, Reveal, Sparkle } from "./motion-primitives";

export function FinalCtaSection({
  copy,
  isLoggedIn,
  locale,
}: {
  copy: LandingV3Copy;
  isLoggedIn: boolean;
  locale: LandingLocale;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-y border-outline-variant bg-surface-container px-6 py-16 md:px-8 md:py-20"
    >
      {/* Edge vignette + grain */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-surface-container"
      />
      <Grain opacity={0.06} />

      {/* Sparkles */}
      <Sparkle className="absolute left-[12%] top-[18%]" size={18} color="var(--color-primary)" delay={0.2} />
      <Sparkle className="absolute right-[18%] top-[14%]" size={13} color="var(--color-primary)" delay={1.1} />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <Reveal>
          <h2 className="type-heading-lg text-balance text-on-surface">
            {copy.cta.title}
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-4 max-w-[520px] type-body text-on-surface-variant">
            {copy.cta.description}
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <motion.div
            animate={reduceMotion ? undefined : { scale: [1, 1.03, 1] }}
            transition={reduceMotion ? { duration: 0 } : { duration: 2.4, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
            className="mt-7"
          >
            <a
              href={landingHref(locale, isLoggedIn ? "/dashboard" : "/auth/signup")}
              className="inline-flex h-8 items-center justify-center rounded-[10px] bg-primary px-5 type-body font-medium text-on-primary transition-colors duration-150 hover:bg-primary-dim active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              {isLoggedIn ? copy.cta.buttonLoggedIn : copy.cta.button}
            </a>
          </motion.div>
        </Reveal>
        <Reveal delay={0.34}>
          <p className="mt-4 text-sm text-on-surface-variant underline decoration-outline-variant underline-offset-4">
            {copy.cta.note}
          </p>
        </Reveal>
      </div>

      {/* Waving mascot pinned to the bottom-right */}
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 60 }}
        whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute -bottom-4 right-4 hidden md:right-14 lg:block"
      >
        <motion.div
          animate={reduceMotion ? undefined : { rotate: [-1.5, 1.5, -1.5] }}
          transition={reduceMotion ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "bottom center" }}
        >
          <Image
            src="/brand/thinkfy/thinkfy-mascot-wave.png"
            alt=""
            aria-hidden="true"
            width={400}
            height={500}
            className="h-auto w-48 object-contain drop-shadow-[0_18px_24px_rgba(7,46,57,0.3)]"
            sizes="192px"
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
