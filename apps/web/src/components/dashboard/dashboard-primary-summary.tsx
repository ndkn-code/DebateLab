"use client";

import { CheckCircle2, Gauge, Target } from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import type { DashboardGoalSummary } from "@/lib/api/dashboard";

function SummaryItem({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone: "success" | "primary" | "warning";
}) {
  const toneClass = {
    success: "bg-success-container text-success-dim",
    primary: "bg-primary-container text-primary",
    warning: "bg-warning-container text-reward-dim",
  }[tone];

  return (
    <div className="min-w-0 flex-1 px-3 py-3 first:pl-0 last:pr-0 sm:px-4 sm:py-3.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${toneClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <span className="type-caption block truncate font-medium text-on-surface-variant">
            {label}
          </span>
          <p className="type-title mt-0.5 truncate font-semibold tabular-nums text-on-surface">
            {value}
          </p>
        </div>
      </div>
      {detail ? (
        <p className="type-caption mt-2 truncate pl-9 text-on-surface-variant">
          {detail}
        </p>
      ) : null}
    </div>
  );
}

export function DashboardPrimarySummary({
  weeklySessions,
  weeklyGoal,
  overallScore,
}: {
  weeklySessions: number;
  weeklyGoal: DashboardGoalSummary;
  overallScore: number | null;
}) {
  const t = useTranslations("dashboard.home");
  const masteryValue =
    overallScore == null ? "—" : `${Math.round(overallScore)}/100`;
  const paceValue = weeklyGoal.metGoal
    ? t("summary_on_track")
    : t("summary_minutes_left", { count: weeklyGoal.remainingMinutes });

  return (
    <section
      aria-labelledby="dashboard-primary-summary-heading"
      className="rounded-xl border border-outline-variant bg-surface/80 px-3 shadow-none dark:border-outline-variant/70 sm:px-4"
    >
      <h2 id="dashboard-primary-summary-heading" className="sr-only">
        {t("progress_title")}
      </h2>
      <div className="flex divide-x divide-outline-variant/70 max-sm:flex-col max-sm:divide-x-0 max-sm:divide-y">
        <SummaryItem
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={t("summary_done")}
          value={t("summary_sessions", { count: weeklySessions })}
          tone="success"
          detail={t("weekly_goal_progress", {
            practiced: weeklyGoal.practicedMinutes,
            goal: weeklyGoal.goalMinutes,
          })}
        />
        <SummaryItem
          icon={<Target className="h-5 w-5" />}
          label={t("summary_mastery")}
          value={masteryValue}
          tone="primary"
        />
        <SummaryItem
          icon={<Gauge className="h-5 w-5" />}
          label={t("summary_pace")}
          value={paceValue}
          tone="warning"
        />
      </div>
    </section>
  );
}
