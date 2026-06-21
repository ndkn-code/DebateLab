"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowRight, CalendarDays, Check, Clock3, Repeat2 } from "@/components/ui/icons";
import { Stat } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { IeltsHomeRetentionView } from "@/lib/ielts/home/retention";

const STREAK_ICON_SRC = "/images/rewards/streak-fire.webp";
const XP_ICON_SRC = "/images/rewards/xp-bolt.webp";

function RetentionCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-token-card",
        className,
      )}
    >
      {children}
    </section>
  );
}

function CardLabel({ children }: { children: ReactNode }) {
  return (
    <p className="type-caption font-extrabold uppercase tracking-normal text-on-surface-variant">
      {children}
    </p>
  );
}

function MiniDots({ dots }: { dots: IeltsHomeRetentionView["streak"]["dots"] }) {
  return (
    <div className="mt-3 grid grid-cols-7 gap-1.5" aria-hidden="true">
      {dots.map((dot) => (
        <span
          key={dot.date}
          className={cn(
            "h-2 rounded-full transition-colors",
            dot.active
              ? "bg-reward"
              : dot.today
                ? "bg-primary"
                : "bg-surface-container-highest",
          )}
        />
      ))}
    </div>
  );
}

function GoalRing({
  progressPercent,
  children,
}: {
  progressPercent: number;
  children: ReactNode;
}) {
  const style = {
    background: `conic-gradient(var(--color-reward) ${progressPercent * 3.6}deg, var(--color-surface-container-high) 0deg)`,
  } satisfies CSSProperties;

  return (
    <div
      className="relative flex size-20 shrink-0 items-center justify-center rounded-full"
      style={style}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-container-lowest text-center">
        {children}
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "reward" }: { value: number; tone?: "reward" | "primary" }) {
  return (
    <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-container-high">
      <div
        className={cn("h-full rounded-full", tone === "reward" ? "bg-reward" : "bg-primary")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function streakStatusKey(streak: IeltsHomeRetentionView["streak"]) {
  if (streak.activeToday) return "retention_streak_active";
  if (streak.atRiskToday) return "retention_streak_at_risk";
  if (streak.current <= 0) return "retention_streak_zero";
  return "retention_streak_keep";
}

function StreakCard({ streak }: { streak: IeltsHomeRetentionView["streak"] }) {
  const t = useTranslations("dashboard.ielts");

  return (
    <RetentionCard className="bg-[linear-gradient(135deg,var(--color-reward-container),var(--color-surface-container-lowest)_58%)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardLabel>{t("retention_streak_label")}</CardLabel>
          <div className="mt-2 flex items-end gap-1.5">
            <Stat size="heading-xl" className="font-black leading-none text-on-surface">
              {streak.current}
            </Stat>
            <span className="pb-1 type-caption font-bold text-on-surface-variant">
              {t("retention_days")}
            </span>
          </div>
        </div>
        <Image
          src={STREAK_ICON_SRC}
          alt=""
          width={64}
          height={64}
          className={cn("size-12 shrink-0 object-contain", streak.current === 0 && "grayscale")}
          sizes="48px"
          aria-hidden="true"
          unoptimized
        />
      </div>
      <p className="mt-2 min-h-5 type-caption font-semibold text-on-surface-variant">
        {t(streakStatusKey(streak))}
      </p>
      <MiniDots dots={streak.dots} />
    </RetentionCard>
  );
}

function DailyGoalCard({ goal }: { goal: IeltsHomeRetentionView["dailyGoal"] }) {
  const t = useTranslations("dashboard.ielts");
  const status = !goal.hasPlan
    ? t("retention_goal_no_plan")
    : goal.metGoal
      ? t("retention_goal_met")
      : t("retention_goal_remaining", { count: goal.remainingMinutes });

  return (
    <RetentionCard>
      <div className="flex items-center gap-4">
        <GoalRing progressPercent={goal.progressPercent}>
          <span className="type-caption font-black text-on-surface">
            {goal.progressPercent}%
          </span>
        </GoalRing>
        <div className="min-w-0 flex-1">
          <CardLabel>{t("retention_goal_label")}</CardLabel>
          <p className="mt-1 truncate type-title font-black text-on-surface">
            {goal.hasPlan
              ? t("retention_goal_progress", {
                  done: goal.minutesDone,
                  goal: goal.minutesGoal,
                })
              : t("retention_goal_empty")}
          </p>
          <p className="mt-1 type-caption font-semibold text-on-surface-variant">
            {status}
          </p>
        </div>
      </div>
      {goal.itemsPlannedToday > 0 ? (
        <p className="mt-3 inline-flex items-center gap-1.5 type-caption font-bold text-primary">
          <Check className="size-3.5" aria-hidden />
          {t("retention_goal_items", {
            done: goal.itemsDoneToday,
            total: goal.itemsPlannedToday,
          })}
        </p>
      ) : null}
    </RetentionCard>
  );
}

function XpCard({ xp }: { xp: IeltsHomeRetentionView["xp"] }) {
  const t = useTranslations("dashboard.ielts");

  return (
    <RetentionCard>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardLabel>{t("retention_xp_label")}</CardLabel>
          <p className="mt-1 truncate type-title font-black text-on-surface">
            {t("retention_level", { level: xp.level })}
          </p>
          <p className="mt-1 type-caption font-semibold text-on-surface-variant">
            {t("retention_lifetime_xp", { count: xp.lifetimeXp })}
          </p>
        </div>
        <Image
          src={XP_ICON_SRC}
          alt=""
          width={64}
          height={64}
          className="size-12 shrink-0 object-contain"
          sizes="48px"
          aria-hidden="true"
          unoptimized
        />
      </div>
      <ProgressBar value={xp.progressPercent} />
      <div className="mt-2 flex items-center justify-between gap-3 type-caption font-bold text-on-surface-variant">
        <span>{t("retention_xp_progress", { current: xp.xpInLevel, goal: xp.xpPerLevel })}</span>
        <span className="shrink-0 text-primary">
          {t("retention_xp_next", { count: xp.xpToNextLevel })}
        </span>
      </div>
    </RetentionCard>
  );
}

function PlanNudgeCard({ nudge }: { nudge: IeltsHomeRetentionView["nudge"] }) {
  const t = useTranslations("dashboard.ielts");
  const locale = useLocale();
  const nextTitle = locale === "vi" ? nudge.nextTitleVi : nudge.nextTitleEn;
  const hasPlanItem = Boolean(nextTitle);
  const reviewLabel =
    nudge.reviewsDueCount > 0
      ? t("retention_reviews_due_count", { count: nudge.reviewsDueCount })
      : t("retention_reviews_clear");

  return (
    <RetentionCard className="flex flex-col justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardLabel>{t("retention_plan_label")}</CardLabel>
            <p className="mt-1 truncate type-title font-black text-on-surface">
              {hasPlanItem ? nextTitle : t("retention_plan_empty")}
            </p>
          </div>
          <CalendarDays className="size-6 shrink-0 text-primary" aria-hidden />
        </div>

        <div className="mt-3 grid gap-2 type-caption font-bold text-on-surface-variant">
          <span className="inline-flex min-w-0 items-center gap-2">
            <Repeat2 className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{reviewLabel}</span>
            {nudge.reviewsOverdueCount > 0 ? (
              <span className="shrink-0 text-error">
                {t("retention_reviews_overdue", { count: nudge.reviewsOverdueCount })}
              </span>
            ) : null}
          </span>
          <span className="inline-flex min-w-0 items-center gap-2">
            <Clock3 className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">
              {nudge.todayItemCount > 0
                ? t("retention_plan_count", { count: nudge.todayItemCount })
                : t("retention_plan_none_due")}
            </span>
          </span>
        </div>
      </div>

      <Link
        href={nudge.nextHref}
        className="inline-flex h-9 items-center justify-center gap-1.5 self-start rounded-full bg-primary px-3.5 type-caption font-black text-on-primary transition-colors hover:bg-primary/90"
      >
        {hasPlanItem ? t("today_start") : t("cta_view_plan")}
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </RetentionCard>
  );
}

export function IeltsRetentionPanel({ retention }: { retention: IeltsHomeRetentionView }) {
  const t = useTranslations("dashboard.ielts");

  return (
    <section
      aria-label={t("retention_region_label")}
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
    >
      <StreakCard streak={retention.streak} />
      <DailyGoalCard goal={retention.dailyGoal} />
      <XpCard xp={retention.xp} />
      <PlanNudgeCard nudge={retention.nudge} />
    </section>
  );
}
