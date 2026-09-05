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
    <div className="min-w-0 flex-1 px-3 py-2.5 first:pl-0 last:pr-0 sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${toneClass}`}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <span className="type-caption block font-medium text-on-surface-variant">
            {label}
          </span>
          <p className="type-title mt-0.5 font-semibold tabular-nums text-on-surface">
            {value}
          </p>
        </div>
      </div>
      {detail ? (
        <p className="type-caption mt-1.5 pl-10 text-on-surface-variant">
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
  activityAvailable = true,
  activityPartial = false,
  goalsAvailable = true,
  skillsAvailable = true,
}: {
  activityAvailable?: boolean;
  activityPartial?: boolean;
  goalsAvailable?: boolean;
  skillsAvailable?: boolean;
  weeklySessions: number;
  weeklyGoal: DashboardGoalSummary;
  overallScore: number | null;
}) {
  const t = useTranslations("dashboard.home");
  const masteryValue = !skillsAvailable
    ? t("progress_unavailable")
    : overallScore == null
      ? t("progress_not_measured")
      : `${Math.round(overallScore)}/100`;
  const paceValue = !goalsAvailable
    ? t("progress_unavailable")
    : weeklyGoal.metGoal
      ? t("summary_on_track")
      : t("summary_minutes_left", { count: weeklyGoal.remainingMinutes });

  return (
    <section
      aria-labelledby="dashboard-primary-summary-heading"
      className="rounded-xl border border-outline-variant bg-surface px-3 shadow-none  sm:px-4"
    >
      <h2 id="dashboard-primary-summary-heading" className="sr-only">
        {t("progress_title")}
      </h2>
      <div className="flex divide-x divide-outline-variant max-sm:flex-col max-sm:divide-x-0 max-sm:divide-y">
        <SummaryItem
          icon={<CheckCircle2 className="h-5 w-5" />}
          label={t("summary_done")}
          value={
            activityAvailable
              ? t(
                  activityPartial
                    ? "summary_sessions_partial"
                    : "summary_sessions",
                  { count: weeklySessions },
                )
              : t("progress_unavailable")
          }
          tone="success"
          detail={
            goalsAvailable
              ? t("weekly_goal_progress", {
                  practiced: weeklyGoal.practicedMinutes,
                  goal: weeklyGoal.goalMinutes,
                })
              : undefined
          }
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
