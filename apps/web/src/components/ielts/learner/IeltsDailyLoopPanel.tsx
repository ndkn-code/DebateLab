"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { thinkfyMotion } from "@thinkfy/shared/design-system";
import { useTranslations } from "next-intl";
import {
  Flame,
  Target,
  Zap,
  type LucideIcon,
} from "@/components/ui/icons";
import { AnimatedNumber, SuccessCheck } from "@/components/motion";
import { cn } from "@/lib/utils";
import type { IeltsHomeRetentionView } from "@/lib/ielts/home/retention";
import type { IeltsTodayItemView } from "@/lib/ielts/home/today";
import { IeltsDailyTodaySection } from "./IeltsDailyTodaySection";

function motionTransition(delayMs = 0) {
  return {
    duration: thinkfyMotion.duration.slow,
    ease: thinkfyMotion.ease.standard,
    delay: delayMs / 1000,
  };
}

function percentFormat(value: number) {
  return `${Math.round(value)}%`;
}

function MetricShell({
  icon: Icon,
  label,
  value,
  caption,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  caption: string;
  children?: ReactNode;
}) {
  return (
    <article className="min-w-0 rounded-lg bg-surface-container-low p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-container text-on-primary-container">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="type-caption font-semibold uppercase text-on-surface-variant">
            {label}
          </p>
          <div className="mt-1 type-heading-md font-bold tabular-nums text-on-surface">
            {value}
          </div>
          <p className="mt-1 type-caption font-medium text-on-surface-variant">
            {caption}
          </p>
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}

function StreakDots({ dots }: { dots: IeltsHomeRetentionView["streak"]["dots"] }) {
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-hidden="true">
      {dots.map((dot) => (
        <span
          key={dot.date}
          className={cn(
            "h-2 rounded-full",
            dot.active
              ? "bg-primary"
              : dot.today
                ? "bg-surface-container-highest"
                : "bg-surface-container-high",
          )}
        />
      ))}
    </div>
  );
}

function GoalRing({
  progressPercent,
  complete,
}: {
  progressPercent: number;
  complete: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const progress = Math.max(0, Math.min(100, progressPercent)) / 100;
  const radius = 35;
  const center = 44;

  return (
    <div className="relative size-22 shrink-0">
      <svg aria-hidden="true" className="size-full" focusable="false" viewBox="0 0 88 88">
        <circle
          cx={center}
          cy={center}
          fill="none"
          r={radius}
          stroke="var(--chart-ring-background)"
          strokeWidth="8"
        />
        <motion.circle
          animate={{ pathLength: progress }}
          cx={center}
          cy={center}
          fill="none"
          initial={{ pathLength: reduceMotion ? progress : 0 }}
          r={radius}
          stroke="var(--color-chart-1)"
          strokeLinecap="round"
          strokeWidth="8"
          style={{
            filter:
              "drop-shadow(0 0 8px color-mix(in srgb, var(--color-chart-1) 28%, transparent))",
            transform: "rotate(-90deg)",
            transformOrigin: "center",
          }}
          transition={reduceMotion ? { duration: 0 } : motionTransition()}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        {complete ? (
          <SuccessCheck size={40} className="text-success" />
        ) : (
          <AnimatedNumber
            className="type-title font-black text-on-surface"
            format={percentFormat}
            startOnMount
            value={progressPercent}
          />
        )}
      </div>
    </div>
  );
}

function XpProgress({ progressPercent }: { progressPercent: number }) {
  const reduceMotion = useReducedMotion();
  const progress = Math.max(0, Math.min(100, progressPercent)) / 100;

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-surface-container-high">
      <motion.div
        animate={{ scaleX: progress }}
        className="h-full w-full rounded-full"
        initial={{ scaleX: reduceMotion ? progress : 0 }}
        style={{
          background:
            "linear-gradient(90deg, var(--color-chart-1), var(--color-chart-6))",
          transformOrigin: "left center",
        }}
        transition={reduceMotion ? { duration: 0 } : motionTransition(120)}
      />
    </div>
  );
}

function streakCaption(retention: IeltsHomeRetentionView) {
  if (retention.isFirstRunGrace || retention.streak.current <= 0) {
    return "retention_streak_start_today";
  }
  if (retention.streak.activeToday) return "retention_streak_active";
  if (retention.streak.atRiskToday) return "retention_streak_at_risk";
  return "retention_streak_keep";
}

function DailyMetrics({ retention }: { retention: IeltsHomeRetentionView }) {
  const t = useTranslations("dashboard.ielts");
  const goal = retention.dailyGoal;
  const goalCaption = retention.isFirstRunGrace
    ? t("retention_goal_start_ring")
    : !goal.hasPlan
      ? t("retention_goal_no_plan")
      : goal.metGoal
        ? t("retention_goal_met")
        : t("retention_goal_remaining", { count: goal.remainingMinutes });
  const xpCaption =
    retention.isFirstRunGrace && retention.xp.lifetimeXp <= 0
      ? t("retention_xp_start")
      : t("retention_xp_next", { count: retention.xp.xpToNextLevel });

  return (
    <div className="mt-5 grid gap-3 lg:grid-cols-3">
      <MetricShell
        caption={t(streakCaption(retention))}
        icon={Flame}
        label={t("retention_streak_label")}
        value={
          <span className="inline-flex items-baseline gap-1.5">
            <AnimatedNumber startOnMount value={retention.streak.current} />
            <span className="type-caption font-semibold text-on-surface-variant">
              {t("retention_days")}
            </span>
          </span>
        }
      >
        <StreakDots dots={retention.streak.dots} />
      </MetricShell>

      <MetricShell
        caption={goalCaption}
        icon={Target}
        label={t("retention_goal_label")}
        value={
          goal.hasPlan ? (
            <span className="inline-flex items-baseline gap-1.5">
              <AnimatedNumber startOnMount value={goal.minutesDone} />
              <span className="type-caption font-semibold text-on-surface-variant">
                / {goal.minutesGoal} {t("minutes_short")}
              </span>
            </span>
          ) : (
            t("retention_goal_empty")
          )
        }
      >
        <div className="flex items-center gap-3">
          <GoalRing complete={goal.metGoal} progressPercent={goal.progressPercent} />
          <p className="min-w-0 type-caption font-semibold text-on-surface-variant">
            {goal.itemsPlannedToday > 0
              ? t("retention_goal_items", {
                  done: goal.itemsDoneToday,
                  total: goal.itemsPlannedToday,
                })
              : t("retention_goal_first_session")}
          </p>
        </div>
      </MetricShell>

      <MetricShell
        caption={xpCaption}
        icon={Zap}
        label={t("retention_xp_label")}
        value={
          <span className="inline-flex items-baseline gap-1.5">
            <AnimatedNumber startOnMount value={retention.xp.lifetimeXp} />
            <span className="type-caption font-semibold text-on-surface-variant">XP</span>
          </span>
        }
      >
        <XpProgress progressPercent={retention.xp.progressPercent} />
        <div className="mt-2 flex items-center justify-between gap-3 type-caption font-semibold text-on-surface-variant">
          <span>{t("retention_level", { level: retention.xp.level })}</span>
          <span className="tabular-nums">
            {t("retention_xp_progress", {
              current: retention.xp.xpInLevel,
              goal: retention.xp.xpPerLevel,
            })}
          </span>
        </div>
      </MetricShell>
    </div>
  );
}

export function IeltsDailyLoopPanel({
  retention,
  items,
  overflowCount,
  hasGoal,
  diagnosticReady,
  totalMinutes,
}: {
  retention: IeltsHomeRetentionView;
  items: IeltsTodayItemView[];
  overflowCount: number;
  hasGoal: boolean;
  diagnosticReady: boolean;
  totalMinutes: number;
}) {
  const t = useTranslations("dashboard.ielts");

  return (
    <section
      aria-label={t("daily_loop_region_label")}
      className="min-w-0 rounded-lg border border-outline-variant bg-surface-container p-4 shadow-token-card sm:p-5"
      data-ielts-daily-loop
      data-first-run-grace={retention.isFirstRunGrace ? "true" : "false"}
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="type-eyebrow font-semibold uppercase text-primary">
            {t("daily_loop_eyebrow")}
          </p>
          <h2 className="mt-1 type-heading-lg font-bold text-on-surface">
            {t("daily_loop_title")}
          </h2>
        </div>
        {items.length > 0 ? (
          <p className="type-body-sm font-medium text-on-surface-variant">
            {t("today_total_minutes", { count: totalMinutes })}
          </p>
        ) : null}
      </div>

      <DailyMetrics retention={retention} />
      <IeltsDailyTodaySection
        diagnosticReady={diagnosticReady}
        hasGoal={hasGoal}
        items={items}
        overflowCount={overflowCount}
        retention={retention}
      />
    </section>
  );
}
