"use client";

import Image from "next/image";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { LandingV3Copy } from "./copy";
import { ArrowRightIcon } from "./icons";
import { Eyebrow, Highlight } from "./ui";
import { Reveal } from "./motion-primitives";
import { Display } from "@/components/ui/typography";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const DIAL_RADIUS = 40;
const DIAL_CIRCUMFERENCE = 2 * Math.PI * DIAL_RADIUS;

function ScoreDial({ score, label }: { score: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const filled = (score / 100) * DIAL_CIRCUMFERENCE;

  return (
    <div ref={ref} className="relative flex h-28 w-28 items-center justify-center">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={DIAL_RADIUS} fill="none" stroke="#E5F8FC" strokeWidth="10" />
        <motion.circle
          cx="50"
          cy="50"
          r={DIAL_RADIUS}
          fill="none"
          stroke="#00B8D9"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={DIAL_CIRCUMFERENCE}
          initial={{ strokeDashoffset: DIAL_CIRCUMFERENCE }}
          animate={inView ? { strokeDashoffset: DIAL_CIRCUMFERENCE - filled } : undefined}
          transition={{ duration: 1.4, delay: 0.3, ease: EASE_OUT }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          animate={inView ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 0.5, delay: 0.9, ease: EASE_OUT }}
          className="type-heading-lg font-extrabold text-on-surface"
        >
          {score}
        </motion.span>
        <span className="mt-0.5 type-eyebrow text-on-surface-variant">
          {label}
        </span>
      </div>
    </div>
  );
}

function Meter({ label, value, delay }: { label: string; value: number; delay: number }) {
  return (
    <div>
      <div className="flex items-center justify-between type-caption font-bold">
        <span className="text-on-surface">{label}</span>
        <span className="text-on-surface-variant">{value}</span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-container-high">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${value}%` }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1, delay, ease: EASE_OUT }}
          className="h-full rounded-full bg-primary"
        />
      </div>
    </div>
  );
}

export function ShowcaseSection({ copy }: { copy: LandingV3Copy }) {
  const { panel } = copy.showcase;
  return (
    <section className="overflow-hidden bg-white px-6 py-20 md:px-8 md:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
        {/* UI panel stack */}
        <Reveal className="relative order-2 lg:order-1" margin="-120px">
          {/* Back panel suggesting a stack */}
          <div
            aria-hidden="true"
            className="absolute -left-4 top-6 hidden h-full w-full -rotate-2 rounded-[26px] border border-outline-variant bg-surface-container sm:block"
          />
          <motion.div
            whileHover={{ y: -4 }}
            transition={{ type: "spring", stiffness: 280, damping: 26 }}
            className="relative rounded-[26px] border border-outline-variant bg-white p-5 shadow-token-panel sm:p-6"
          >
            {/* Panel header */}
            <div className="flex items-center justify-between gap-3 border-b border-outline-variant pb-4">
              <p className="truncate type-body-sm font-bold text-on-surface">{panel.title}</p>
              <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 type-caption font-extrabold text-primary-dim">
                <motion.span
                  animate={{ opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  className="h-1.5 w-1.5 rounded-full bg-primary"
                />
                {panel.timer}
              </span>
            </div>

            <div className="mt-5 grid gap-6 sm:grid-cols-[1.3fr_auto]">
              {/* Transcript */}
              <div className="flex flex-col gap-3.5">
                {panel.transcript.map((line, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -14 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.55, delay: 0.25 + index * 0.16, ease: EASE_OUT }}
                  >
                    {line.tag ? (
                      <span
                        className={cn(
                          "mb-1 inline-block rounded-md px-1.5 py-0.5 type-eyebrow",
                          line.tone === "good"
                            ? "bg-primary-container text-primary-dim"
                            : "bg-warning-container text-on-warning-container"
                        )}
                      >
                        {line.tag}
                      </span>
                    ) : null}
                    <p
                      className={cn(
                        "type-body-sm text-on-surface-variant",
                        line.tone === "good" &&
                          "rounded-lg bg-primary-container/60 box-decoration-clone px-1 text-on-surface",
                        line.tone === "fix" &&
                          "rounded-lg bg-warning-container/70 box-decoration-clone px-1 text-on-surface"
                      )}
                    >
                      {line.text}
                    </p>
                  </motion.div>
                ))}
              </div>

              {/* Scores */}
              <div className="flex flex-row items-center gap-5 sm:w-[150px] sm:flex-col sm:items-stretch">
                <div className="flex justify-center">
                  <ScoreDial score={panel.score} label={panel.scoreLabel} />
                </div>
                <div className="flex flex-1 flex-col gap-3 sm:flex-none">
                  {panel.meters.map((meter, index) => (
                    <Meter key={meter.label} label={meter.label} value={meter.value} delay={0.5 + index * 0.15} />
                  ))}
                </div>
              </div>
            </div>

            {/* Coach note */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: 1, ease: EASE_OUT }}
              className="mt-5 flex items-center gap-3 rounded-2xl border border-[#8BE8F7] bg-primary-container/70 px-4 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#8BE8F7] bg-white">
                <Image
                  src="/brand/thinkfy/thinkfy-mascot-wave.png"
                  alt=""
                  aria-hidden="true"
                  width={80}
                  height={100}
                  className="h-7 w-auto object-contain"
                  sizes="36px"
                />
              </span>
              <p className="type-body-sm font-bold text-primary-dim">{panel.coachNote}</p>
            </motion.div>
          </motion.div>
        </Reveal>

        {/* Text column */}
        <div className="order-1 lg:order-2">
          <Reveal>
            <Eyebrow>{copy.showcase.eyebrow}</Eyebrow>
            <Display size="sm" as="h2" className="mt-4">
              <Highlight text={copy.showcase.title.text} highlight={copy.showcase.title.highlight} />
            </Display>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-6 type-body text-on-surface-variant">{copy.showcase.para1}</p>
            <p className="mt-4 type-body text-on-surface-variant">{copy.showcase.para2}</p>
          </Reveal>
          <Reveal delay={0.22}>
            <a
              href="#pricing"
              className="group mt-7 inline-flex items-center gap-2 type-body font-extrabold text-primary underline decoration-2 underline-offset-[6px] transition-colors hover:text-primary-dim"
            >
              {copy.showcase.link}
              <ArrowRightIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
