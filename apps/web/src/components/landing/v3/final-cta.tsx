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
      className="relative overflow-hidden bg-primary px-6 py-24 md:px-8 md:py-32"
    >
      {/* Edge vignette + grain */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0)_45%,rgba(7,136,160,0.4)_100%)]"
      />
      <Grain opacity={0.06} />

      {/* Sparkles */}
      <Sparkle className="absolute left-[12%] top-[18%]" size={18} color="#ffffff" delay={0.2} />
      <Sparkle className="absolute right-[18%] top-[14%]" size={13} color="#ffffff" delay={1.1} />
      <Sparkle className="absolute left-[24%] bottom-[22%]" size={12} color="#ffffff" delay={1.9} />
      <Sparkle className="absolute right-[30%] bottom-[30%]" size={16} color="#ffffff" delay={0.7} />

      <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <Reveal>
          <h2 className="type-display-sm text-balance text-white">
            {copy.cta.title}
          </h2>
        </Reveal>
        <Reveal delay={0.12}>
          <p className="mt-6 max-w-[520px] type-body-lg text-white/85">
            {copy.cta.description}
          </p>
        </Reveal>
        <Reveal delay={0.24}>
          <motion.div
            animate={reduceMotion ? undefined : { scale: [1, 1.03, 1] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
            className="mt-10"
          >
            <a
              href={landingHref(locale, isLoggedIn ? "/dashboard" : "/auth/signup")}
              className="inline-flex h-16 items-center justify-center rounded-2xl bg-white px-10 type-body-lg font-extrabold text-primary-dim shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_6px_0_#BFE3EC,0_22px_36px_-20px_rgba(7,46,57,0.55)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_7px_0_#BFE3EC,0_26px_40px_-20px_rgba(7,46,57,0.6)] active:translate-y-1 active:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_1px_0_#BFE3EC]"
            >
              {isLoggedIn ? copy.cta.buttonLoggedIn : copy.cta.button}
            </a>
          </motion.div>
        </Reveal>
        <Reveal delay={0.34}>
          <p className="mt-5 text-sm font-semibold text-white/75 underline decoration-white/40 underline-offset-4">
            {copy.cta.note}
          </p>
        </Reveal>
      </div>

      {/* Waving mascot pinned to the bottom-right */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute -bottom-4 right-4 hidden md:right-14 lg:block"
      >
        <motion.div
          animate={reduceMotion ? undefined : { rotate: [-1.5, 1.5, -1.5] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
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
