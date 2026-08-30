"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Flame, Target, Zap, type LucideIcon } from "@/components/ui/icons";
import { AnimatedNumber } from "@/components/motion";
import { cn } from "@/lib/utils";
import type { IeltsHomeRetentionView } from "@/lib/ielts/home/retention";
import type { IeltsTodayItemView } from "@/lib/ielts/home/today";
import { IeltsDailyTodaySection } from "./IeltsDailyTodaySection";

const METRIC_TONE = {
  streak: "bg-secondary-container text-on-secondary-container",
  goal: "bg-primary-container text-on-primary-container",
  xp: "bg-reward-container text-reward-dim",
} as const;

function Metric({
  icon: Icon,
  label,
  value,
  tone,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone: keyof typeof METRIC_TONE;
  children?: ReactNode;
}) {
  return (
    <article className="min-w-0 px-3 py-3.5 sm:px-4" data-ielts-metric>
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            METRIC_TONE[tone],
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block type-caption font-medium text-on-surface-variant">
            {label}
          </span>
          <span className="mt-0.5 block truncate type-title font-semibold tabular-nums text-on-surface">
            {value}
          </span>
        </span>
      </div>
      {children ? <div className="mt-2.5">{children}</div> : null}
    </article>
  );
}

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest"
      aria-hidden
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-150 motion-reduce:transition-none"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function StreakDots({
  dots,
}: {
  dots: IeltsHomeRetentionView["streak"]["dots"];
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5" aria-hidden>
      {dots.map((dot) => (
        <span
          key={dot.date}
          className={cn(
            "h-1.5 rounded-full",
            dot.active
              ? "bg-secondary"
              : dot.today
                ? "bg-on-surface-variant/35"
                : "bg-surface-container-highest",
          )}
        />
      ))}
    </div>
  );
}

function DailyMetrics({ retention }: { retention: IeltsHomeRetentionView }) {
  const t = useTranslations("dashboard.ielts");
  const goal = retention.dailyGoal;

  return (
    <section
      aria-label={t("retention_region_label")}
      className="grid divide-y divide-outline-variant overflow-hidden rounded-lg border border-outline-variant bg-surface-container-low sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      data-ielts-daily-metrics
    >
      <Metric
        icon={Target}
        label={t("retention_goal_label")}
        tone="goal"
        value={
          goal.hasPlan ? (
            <span>
              <AnimatedNumber startOnMount value={goal.minutesDone} /> /{" "}
              {goal.minutesGoal}{" "}
              <span className="type-caption text-on-surface-variant">
                {t("minutes_short")}
              </span>
            </span>
          ) : (
            t("retention_goal_empty")
          )
        }
      >
        <ProgressBar value={goal.progressPercent} />
      </Metric>

      <Metric
        icon={Flame}
        label={t("retention_streak_label")}
        tone="streak"
        value={
          <span>
            <AnimatedNumber startOnMount value={retention.streak.current} />{" "}
            <span className="type-caption text-on-surface-variant">
              {t("retention_days")}
            </span>
          </span>
        }
      >
        <StreakDots dots={retention.streak.dots} />
      </Metric>

      <Metric
        icon={Zap}
        label={t("retention_level", { level: retention.xp.level })}
        tone="xp"
        value={
          <span>
            <AnimatedNumber startOnMount value={retention.xp.lifetimeXp} />{" "}
            <span className="type-caption text-on-surface-variant">XP</span>
          </span>
        }
      >
        <ProgressBar value={retention.xp.progressPercent} />
      </Metric>
    </section>
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
      className="min-w-0 rounded-xl border border-outline-variant bg-surface-container p-4"
      data-ielts-daily-loop
      data-first-run-grace={retention.isFirstRunGrace ? "true" : "false"}
    >
      <div className="flex min-w-0 items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="type-eyebrow font-semibold uppercase text-primary">
            {t("daily_loop_eyebrow")}
          </p>
          <h2 className="mt-1 type-heading-md font-semibold text-on-surface">
            {t("daily_loop_title")}
          </h2>
        </div>
        {items.length > 0 ? (
          <p className="shrink-0 type-caption font-medium tabular-nums text-on-surface-variant">
            {t("today_total_minutes", { count: totalMinutes })}
          </p>
        ) : null}
      </div>

      <IeltsDailyTodaySection
        diagnosticReady={diagnosticReady}
        hasGoal={hasGoal}
        items={items}
        overflowCount={overflowCount}
        retention={retention}
      />

      <div className="mt-4">
        <DailyMetrics retention={retention} />
      </div>
    </section>
  );
}
