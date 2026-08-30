"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { ArrowRight, Clock3, Star, Target } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import type { DashboardRecommendedDrill } from "@/lib/api/dashboard";
import {
  getPlanCtaLabel,
  getPlanDescription,
  getPlanTitle,
  getPlanTrackLabel,
} from "./plan-copy";

/** Dedicated illustration per drill type (see design-artifacts/illustration-system.md). */
const DRILL_ILLUSTRATIONS: Record<
  DashboardRecommendedDrill["key"],
  { src: string; alt: string }
> = {
  "continue-course": { src: "/images/dashboard/focus-course.webp", alt: "" },
  "weakest-skill": { src: "/images/dashboard/focus-skill.webp", alt: "" },
  "underused-track": { src: "/images/dashboard/focus-balance.webp", alt: "" },
  "review-feedback": { src: "/images/dashboard/focus-review.webp", alt: "" },
  "start-speaking": { src: "/images/dashboard/focus-speaking.webp", alt: "" },
  "start-debate": { src: "/images/dashboard/focus-debate.webp", alt: "" },
  "coach-check": { src: "/images/dashboard/focus-coach.webp", alt: "" },
};

function HeroMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="min-w-0 border-l border-outline-variant/70 pl-3 first:border-l-0 first:pl-0 dark:border-outline-variant/60">
      <div className="flex items-center gap-1.5 text-on-surface-variant">
        <span aria-hidden="true" className="text-primary">
          {icon}
        </span>
        <span className="type-caption truncate font-medium">{label}</span>
      </div>
      <p className="type-label mt-1 truncate font-semibold tabular-nums text-on-surface">
        {value}
      </p>
    </div>
  );
}

export function DailyFocusHero({
  drill,
}: {
  drill: DashboardRecommendedDrill;
}) {
  const t = useTranslations("dashboard.home");
  const reduceMotion = useReducedMotion();
  const illustration =
    DRILL_ILLUSTRATIONS[drill.key] ?? DRILL_ILLUSTRATIONS["start-debate"];

  const targetValue = drill.skillKey
    ? t(`skill_labels.${drill.skillKey}`)
    : drill.track
      ? getPlanTrackLabel(drill.track, t)
      : null;
  const scoreValue =
    drill.scoreOutOf100 != null
      ? `${drill.scoreOutOf100}/100`
      : (drill.progressLabel ?? null);

  return (
    <section
      data-testid="dashboard-open-canvas"
      aria-labelledby="dashboard-daily-focus-title"
      className="relative overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-none dark:border-outline-variant/70"
    >
      <div className="relative grid min-h-[250px] items-center gap-4 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_210px] xl:gap-3">
        <div className="relative z-10 min-w-0">
          <span className="type-eyebrow inline-flex items-center gap-2 text-primary">
            <Target className="h-4 w-4" />
            {t("today_sprint")}
          </span>

          <h1
            data-testid="dashboard-daily-focus-title"
            className="type-heading-lg mt-2 max-w-[25ch] font-semibold text-on-surface"
          >
            {getPlanTitle(drill, t)}
          </h1>

          <p className="type-body mt-1 line-clamp-1 max-w-[52ch] leading-5 text-on-surface-variant">
            {getPlanDescription(drill, t)}
          </p>

          <div className="mt-3 grid max-w-[52ch] grid-cols-3 gap-2.5">
            <HeroMetric
              icon={<Clock3 className="h-3.5 w-3.5" />}
              label={t("recommended_detail_time")}
              value={t("recommended_meta_duration", {
                count: drill.durationMinutes,
              })}
            />
            {targetValue ? (
              <HeroMetric
                icon={<Target className="h-3.5 w-3.5" />}
                label={t("recommended_detail_context")}
                value={targetValue}
              />
            ) : (
              <HeroMetric
                icon={<Target className="h-3.5 w-3.5" />}
                label={t("recommended_detail_context")}
                value={getPlanTrackLabel(drill.track, t)}
              />
            )}
            {scoreValue ? (
              <HeroMetric
                icon={<Star className="h-3.5 w-3.5" />}
                label={t("summary_mastery")}
                value={scoreValue}
              />
            ) : (
              <HeroMetric
                icon={<Star className="h-3.5 w-3.5" />}
                label={t("summary_mastery")}
                value="—"
              />
            )}
          </div>

          <Link
            href={drill.href}
            data-testid="dashboard-recommended-cta"
            className="type-label mt-4 inline-flex h-8 min-w-[160px] items-center justify-center gap-2 rounded-[10px] bg-primary px-4 font-medium text-on-primary transition-[background-color,transform] hover:bg-primary-dim active:translate-y-px focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-primary/40"
          >
            {getPlanCtaLabel(drill, t)}
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>

        {/* Illustration slot */}
        <div
          data-testid="dashboard-recommended-illustration"
          className="relative mx-auto hidden h-[210px] w-[210px] items-center justify-center xl:flex"
        >
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
            transition={
              reduceMotion
                ? undefined
                : { duration: 4.2, repeat: Infinity, ease: "easeInOut" }
            }
            className="relative"
          >
            <Image
              src={illustration.src}
              alt={illustration.alt}
              aria-hidden="true"
              width={512}
              height={512}
              priority
              className="h-auto w-[190px] object-contain drop-shadow-token-card"
              sizes="190px"
            />
          </motion.div>
          {/* sparkles */}
          <span
            aria-hidden="true"
            className="absolute right-4 top-6 text-reward"
          >
            <Star className="h-4 w-4 fill-current" />
          </span>
          <span
            aria-hidden="true"
            className="absolute bottom-10 left-2 text-reward/70"
          >
            <Star className="h-3 w-3 fill-current" />
          </span>
        </div>
      </div>
    </section>
  );
}
