"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Clock3, Star, Target } from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
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

function MetaChip({
  icon,
  label,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "default" | "gold";
}) {
  return (
    <span className="type-label inline-flex min-h-9 items-center gap-2 rounded-full border border-outline-variant bg-surface px-3.5 font-bold text-on-surface shadow-token-card dark:border-outline-variant/70">
      <span className={tone === "gold" ? "text-reward-dim" : "text-primary"}>{icon}</span>
      {label}
    </span>
  );
}

export function DailyFocusHero({ drill }: { drill: DashboardRecommendedDrill }) {
  const t = useTranslations("dashboard.home");
  const reduceMotion = useReducedMotion();
  const illustration = DRILL_ILLUSTRATIONS[drill.key] ?? DRILL_ILLUSTRATIONS["start-debate"];

  const targetLabel = drill.skillKey
    ? t("recommended_meta_target_skill", {
        skill: t(`skill_labels.${drill.skillKey}`),
      })
    : drill.track
      ? t("recommended_meta_track", { track: getPlanTrackLabel(drill.track, t) })
      : null;
  const scoreLabel =
    drill.scoreOutOf100 != null
      ? t("recommended_meta_score", { score: drill.scoreOutOf100 })
      : drill.progressLabel
        ? t("recommended_meta_progress", { progress: drill.progressLabel })
        : null;

  return (
    <section
      data-testid="dashboard-open-canvas"
      className="relative overflow-hidden rounded-[2rem] border border-outline-variant bg-[linear-gradient(125deg,#F8FDFF_0%,#E5F8FC_100%)] shadow-token-card dark:border-outline-variant/70 dark:bg-[linear-gradient(125deg,#0A2730_0%,#0E3A46_100%)]"
    >
      <div className="grid items-center gap-2 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
        <div className="relative z-10 min-w-0">
          <span className="type-eyebrow inline-flex items-center gap-2 text-primary">
            <Target className="h-4 w-4" />
            {t("daily_focus")}
          </span>

          <h1
            data-testid="dashboard-daily-focus-title"
            className="type-heading-xl mt-3 max-w-[18ch] font-extrabold text-on-surface"
          >
            {getPlanTitle(drill, t)}
          </h1>

          <p className="type-body mt-3 max-w-[46ch] leading-7 text-on-surface-variant">
            {getPlanDescription(drill, t)}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <MetaChip
              icon={<Clock3 className="h-4 w-4" />}
              label={t("recommended_meta_duration", { count: drill.durationMinutes })}
            />
            {targetLabel ? (
              <MetaChip icon={<Target className="h-4 w-4" />} label={targetLabel} />
            ) : null}
            {scoreLabel ? (
              <MetaChip
                icon={<Star className="h-4 w-4" />}
                label={scoreLabel}
                tone="gold"
              />
            ) : null}
          </div>

          <Link href={drill.href} data-testid="dashboard-recommended-cta">
            <Button className="mt-6 min-h-13 min-w-[200px] rounded-2xl bg-primary px-9 text-base font-extrabold text-on-primary">
              {getPlanCtaLabel(drill, t)}
            </Button>
          </Link>
        </div>

        {/* Illustration slot */}
        <div
          data-testid="dashboard-recommended-illustration"
          className="relative mx-auto hidden h-[240px] w-[240px] items-center justify-center lg:flex"
        >
          <div
            aria-hidden="true"
            className="absolute inset-3 rounded-full bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,rgba(255,255,255,0.25)_60%,rgba(255,255,255,0)_75%)] dark:bg-[radial-gradient(circle_at_center,rgba(0,184,217,0.18)_0%,rgba(0,184,217,0)_72%)]"
          />
          <motion.div
            animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
            className="relative"
          >
            <Image
              src={illustration.src}
              alt={illustration.alt}
              aria-hidden="true"
              width={512}
              height={512}
              priority
              className="h-auto w-[210px] object-contain drop-shadow-[0_14px_18px_rgba(16,41,54,0.16)]"
              sizes="210px"
            />
          </motion.div>
          {/* sparkles */}
          <span aria-hidden="true" className="absolute right-4 top-6 text-reward">
            <Star className="h-4 w-4 fill-current" />
          </span>
          <span aria-hidden="true" className="absolute bottom-10 left-2 text-reward/70">
            <Star className="h-3 w-3 fill-current" />
          </span>
        </div>
      </div>
    </section>
  );
}
