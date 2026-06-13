"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { LandingV3Copy } from "./copy";
import { StarIcon } from "./icons";
import { Eyebrow, Highlight } from "./ui";
import { Reveal, Stagger, StaggerItem } from "./motion-primitives";
import { Display, Heading, Text } from "@/components/ui/typography";

function BentoCard({
  title,
  caption,
  children,
  className,
}: {
  title: string;
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-[28px] border border-outline-variant bg-white p-7 shadow-token-card transition-shadow duration-300 hover:shadow-token-panel",
        className
      )}
    >
      <div className="flex-1">{children}</div>
      <Heading level={3} className="mt-6 font-extrabold">{title}</Heading>
      <Text variant="body" className="mt-2 text-on-surface-variant">{caption}</Text>
    </motion.div>
  );
}

function CoachIllustration({ copy }: { copy: LandingV3Copy }) {
  return (
    <div className="flex h-full min-h-[220px] flex-col justify-between gap-6">
      <Stagger gap={0.25} delay={0.2} className="flex flex-col gap-3">
        <StaggerItem y={14} className="max-w-[260px] self-start">
          <div className="rounded-2xl rounded-bl-md border border-[#8BE8F7] bg-primary-container px-4 py-3 text-sm font-semibold leading-6 text-primary-dim">
            {copy.features.coach.bubbleA}
          </div>
        </StaggerItem>
        <StaggerItem y={14} className="max-w-[240px] self-end">
          <div className="rounded-2xl rounded-br-md border border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold leading-6 text-on-surface">
            {copy.features.coach.bubbleB}
          </div>
        </StaggerItem>
        <StaggerItem y={10} className="self-start">
          <div className="flex items-center gap-1 rounded-full border border-[#FFE6A6] bg-warning-container px-3 py-1.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <StarIcon key={index} className="h-3.5 w-3.5 text-[#E3A700]" />
            ))}
          </div>
        </StaggerItem>
      </Stagger>
      <div className="relative -mb-7 flex justify-end">
        <Image
          src="/brand/thinkfy/thinkfy-mascot-book.png"
          alt=""
          aria-hidden="true"
          width={400}
          height={500}
          className="h-auto w-36 object-contain transition-transform duration-500 group-hover:-translate-y-1.5 sm:w-44"
          sizes="176px"
        />
      </div>
    </div>
  );
}

function TopicsIllustration({ copy }: { copy: LandingV3Copy }) {
  return (
    <div className="relative">
      <span className="absolute -top-1 right-0 rounded-full bg-primary px-3 py-1 text-xs font-extrabold text-white">
        {copy.features.topics.badge}
      </span>
      <Stagger gap={0.07} delay={0.1} className="flex max-w-[88%] flex-wrap gap-2 pt-8">
        {copy.features.topics.chips.map((chip) => (
          <StaggerItem key={chip} y={10}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant bg-surface-container px-3.5 py-2 type-label font-bold text-on-surface transition-colors duration-200 hover:border-[#8BE8F7] hover:bg-primary-container hover:text-primary-dim">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {chip}
            </span>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function LiveIllustration({ copy }: { copy: LandingV3Copy }) {
  return (
    <div className="flex min-h-[96px] items-center justify-center gap-5 pt-4">
      <div className="flex flex-col items-center gap-1.5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#8BE8F7] bg-primary-container text-base font-extrabold text-primary-dim">
          {copy.features.live.you.slice(0, 1)}
        </span>
        <span className="text-xs font-bold text-on-surface-variant">{copy.features.live.you}</span>
      </div>
      <span className="text-sm font-extrabold tracking-widest text-on-surface-variant">VS</span>
      <div className="flex flex-col items-center gap-1.5">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[#FFD2D4] bg-error-container text-base font-extrabold text-error-dim">
          {copy.features.live.rival.slice(0, 1)}
        </span>
        <span className="text-xs font-bold text-on-surface-variant">{copy.features.live.rival}</span>
      </div>
      <span className="absolute right-7 top-7 inline-flex items-center gap-1.5 rounded-full bg-error px-2.5 py-1 type-caption font-extrabold tracking-widest text-white">
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="h-1.5 w-1.5 rounded-full bg-white"
        />
        {copy.features.live.liveLabel}
      </span>
    </div>
  );
}

function AnalyticsIllustration({ copy }: { copy: LandingV3Copy }) {
  const bars = [34, 48, 58, 72, 88];
  return (
    <div className="flex min-h-[96px] items-end justify-center gap-3 pt-4 sm:gap-4">
      {bars.map((height, index) => {
        const isLast = index === bars.length - 1;
        return (
          <div key={index} className="flex flex-col items-center gap-1.5">
            <div className="flex h-[88px] items-end">
              <motion.span
                initial={{ height: 0 }}
                whileInView={{ height: `${height}%` }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.8, delay: 0.15 + index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={cn("w-7 rounded-t-lg sm:w-8", isLast ? "bg-reward" : "bg-primary")}
              />
            </div>
            <span className="type-caption font-bold text-on-surface-variant">
              {copy.features.analytics.weeks[index]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function FeaturesSection({ copy }: { copy: LandingV3Copy }) {
  return (
    <section id="features" className="bg-surface-container-high px-6 py-20 md:px-8 md:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <Reveal>
            <Eyebrow>{copy.features.eyebrow}</Eyebrow>
            <Display size="sm" as="h2" className="mt-4 max-w-[560px]">
              <Highlight text={copy.features.title.text} highlight={copy.features.title.highlight} />
            </Display>
          </Reveal>
          <Reveal delay={0.15}>
            <Text variant="body" className="max-w-[320px] text-on-surface-variant lg:pb-2 lg:text-right">
              {copy.features.aside}
            </Text>
          </Reveal>
        </div>

        <Stagger gap={0.12} delay={0.1} className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2">
          <StaggerItem className="lg:row-span-2">
            <BentoCard
              title={copy.features.coach.title}
              caption={copy.features.coach.caption}
              className="h-full"
            >
              <CoachIllustration copy={copy} />
            </BentoCard>
          </StaggerItem>
          <StaggerItem className="lg:col-span-2">
            <BentoCard
              title={copy.features.topics.title}
              caption={copy.features.topics.caption}
              className="h-full"
            >
              <TopicsIllustration copy={copy} />
            </BentoCard>
          </StaggerItem>
          <StaggerItem>
            <BentoCard
              title={copy.features.live.title}
              caption={copy.features.live.caption}
              className="relative h-full"
            >
              <LiveIllustration copy={copy} />
            </BentoCard>
          </StaggerItem>
          <StaggerItem>
            <BentoCard
              title={copy.features.analytics.title}
              caption={copy.features.analytics.caption}
              className="h-full"
            >
              <AnalyticsIllustration copy={copy} />
            </BentoCard>
          </StaggerItem>
        </Stagger>
      </div>
    </section>
  );
}
