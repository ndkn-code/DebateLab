"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LandingV3Copy } from "./copy";
import { CrownIcon, FlameIcon, StarIcon } from "./icons";
import { Reveal } from "./motion-primitives";
import { Eyebrow, GhostButton, Highlight } from "./ui";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

function GameCard({
  children,
  className,
  rotate,
  delay,
  bobDelay = 0,
}: {
  children: ReactNode;
  className?: string;
  rotate: number;
  delay: number;
  bobDelay?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 56, rotate: rotate * 2.4 }}
      whileInView={{ opacity: 1, y: 0, rotate }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ type: "spring", stiffness: 160, damping: 19, delay }}
      whileHover={{ rotate: 0, scale: 1.04, zIndex: 30 }}
      className={cn(
        "rounded-[24px] border border-outline-variant bg-white p-5 shadow-token-panel",
        className
      )}
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 4.2, delay: bobDelay, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export function GamificationSection({ copy }: { copy: LandingV3Copy }) {
  const reduceMotion = useReducedMotion();
  const { streak, league, xp } = copy.gamification;

  return (
    <section className="overflow-hidden bg-white px-6 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
        {/* Text column */}
        <div>
          <Reveal>
            <Eyebrow>{copy.gamification.eyebrow}</Eyebrow>
            <h2 className="mt-4 text-[2.1rem] font-extrabold leading-[1.12] tracking-[-0.03em] text-on-surface sm:text-[2.7rem]">
              <Highlight text={copy.gamification.title.text} highlight={copy.gamification.title.highlight} />
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-6 max-w-[440px] text-[1.02rem] leading-8 text-on-surface-variant">
              {copy.gamification.description}
            </p>
          </Reveal>
          <Reveal delay={0.22}>
            <GhostButton href="#pricing" label={copy.gamification.cta} className="mt-8" />
          </Reveal>
        </div>

        {/* Card cluster: stacked on mobile, scattered collage from sm up */}
        <div className="relative mx-auto flex w-full max-w-[540px] flex-col items-center gap-6 sm:block sm:h-[430px]">
          {/* Streak card */}
          <GameCard rotate={-4} delay={0.05} bobDelay={0} className="relative z-10 w-[250px] sm:absolute sm:left-0 sm:top-2">
            <div className="flex items-center gap-3">
              <motion.span
                animate={reduceMotion ? undefined : { scale: [1, 1.14, 1] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF1E0]"
              >
                <FlameIcon className="h-7 w-7 text-[#FF9F45]" />
              </motion.span>
              <div>
                <p className="text-[1.05rem] font-extrabold text-on-surface">{streak.title}</p>
                <p className="text-xs font-bold text-on-surface-variant">{streak.caption}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              {Array.from({ length: 7 }).map((_, index) => (
                <motion.span
                  key={index}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 380, damping: 16, delay: 0.5 + index * 0.07 }}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full",
                    index < 5 ? "bg-[#FF9F45]" : "border-2 border-dashed border-outline-variant bg-white"
                  )}
                >
                  {index < 5 ? <FlameIcon className="h-3.5 w-3.5 text-white" /> : null}
                </motion.span>
              ))}
            </div>
          </GameCard>

          {/* League card */}
          <GameCard
            rotate={2.5}
            delay={0.2}
            bobDelay={1.4}
            className="relative z-20 w-[280px] sm:absolute sm:right-0 sm:top-0 sm:w-[290px]"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-container">
                <CrownIcon className="h-5 w-5 text-[#E3A700]" />
              </span>
              <p className="text-[1.02rem] font-extrabold text-on-surface">{league.title}</p>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              {league.rows.map((row, index) => (
                <motion.div
                  key={row.name}
                  initial={{ opacity: 0, x: 18 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.55 + index * 0.12, ease: EASE_OUT }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2",
                    row.you ? "bg-primary-container" : "bg-surface-container"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold",
                      index === 0 ? "bg-reward text-white" : "bg-white text-on-surface-variant"
                    )}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={cn(
                      "flex-1 truncate text-[13px] font-extrabold",
                      row.you ? "text-primary-dim" : "text-on-surface"
                    )}
                  >
                    {row.name}
                  </span>
                  <span className="text-[12px] font-bold text-on-surface-variant">{row.xp}</span>
                  {row.you ? (
                    <motion.svg
                      viewBox="0 0 24 24"
                      className="h-3.5 w-3.5 text-success"
                      animate={reduceMotion ? undefined : { y: [0, -3, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                      aria-hidden="true"
                    >
                      <path d="M12 19V5m0 0-6 6m6-6 6 6" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.6" />
                    </motion.svg>
                  ) : null}
                </motion.div>
              ))}
            </div>
          </GameCard>

          {/* XP card */}
          <GameCard
            rotate={-2}
            delay={0.35}
            bobDelay={2.6}
            className="relative z-10 w-[230px] sm:absolute sm:bottom-6 sm:right-12"
          >
            <div className="flex items-center justify-between">
              <p className="text-[1.5rem] font-extrabold tracking-[-0.02em] text-primary">{xp.burst}</p>
              <div className="flex gap-0.5">
                {Array.from({ length: 3 }).map((_, index) => (
                  <motion.span
                    key={index}
                    initial={{ scale: 0, rotate: -40 }}
                    whileInView={{ scale: 1, rotate: 0 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 360, damping: 14, delay: 0.7 + index * 0.1 }}
                  >
                    <StarIcon className="h-5 w-5 text-reward" />
                  </motion.span>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-container-high">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "72%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, delay: 0.7, ease: EASE_OUT }}
                  className="h-full rounded-full bg-reward"
                />
              </div>
              <p className="mt-2 text-[12px] font-extrabold text-on-surface-variant">{xp.level}</p>
            </div>
          </GameCard>

          {/* Mascot presenting the cards */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.7, delay: 0.5, ease: EASE_OUT }}
            className="relative z-30 -mt-2 self-start pl-4 sm:absolute sm:-bottom-2 sm:left-8 sm:mt-0 sm:pl-0"
          >
            <Image
              src="/brand/thinkfy/thinkfy-mascot-wave.png"
              alt=""
              aria-hidden="true"
              width={400}
              height={500}
              className="h-auto w-32 object-contain drop-shadow-[0_14px_18px_rgba(16,41,54,0.16)] sm:w-36"
              sizes="144px"
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
