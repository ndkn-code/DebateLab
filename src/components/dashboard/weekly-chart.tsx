"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Activity, CalendarDays, TimerReset } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyStatEntry } from "@/lib/api/dashboard";

interface WeeklyChartProps {
  stats: DailyStatEntry[];
}

export function WeeklyChart({ stats }: WeeklyChartProps) {
  const t = useTranslations("dashboard.home");
  const today = new Date().toISOString().split("T")[0];
  const totalMinutes = stats.reduce((s, d) => s + d.practice_minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);
  const totalSessions = stats.reduce((sum, day) => sum + day.sessions_completed, 0);
  const activeDays = stats.filter(
    (day) => day.practice_minutes > 0 || day.sessions_completed > 0
  ).length;
  const bestDay = stats.reduce(
    (best, day) =>
      day.practice_minutes > best.practice_minutes ? day : best,
    stats[0] ?? { date: today, practice_minutes: 0, sessions_completed: 0, xp_earned: 0 }
  );
  const maxMinutes = Math.max(...stats.map((day) => day.practice_minutes), 1);

  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const data = stats.map((s, i) => ({
    name: t(`days_labels.${dayKeys[i]}`),
    minutes: s.practice_minutes,
    sessions: s.sessions_completed,
    isToday: s.date === today,
  }));

  return (
    <section className="rounded-[2rem] border border-outline-variant/15 bg-surface-container-lowest p-5 soft-shadow sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-on-surface">
            {t("this_weeks_activity")}
          </h3>
          <p className="mt-1 text-sm text-on-surface-variant">
            {totalSessions > 0
              ? t("weekly_chart_subtitle")
              : t("weekly_chart_empty_subtitle")}
          </p>
        </div>
        <span className="text-sm font-medium text-on-surface-variant">
          {t("total_hours", { hours: totalHours })}
        </span>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <SummaryPill
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          label={t("weekly_active_days_label")}
          value={`${activeDays}/7`}
        />
        <SummaryPill
          icon={<Activity className="h-4 w-4 text-secondary" />}
          label={t("weekly_sessions_label")}
          value={String(totalSessions)}
        />
        <SummaryPill
          icon={<TimerReset className="h-4 w-4 text-tertiary" />}
          label={t("weekly_best_day_label")}
          value={`${bestDay.practice_minutes} ${t("min")}`}
        />
      </div>

      <div className="grid grid-cols-7 gap-2 sm:gap-3">
        {data.map((entry) => {
          const heightPercent =
            entry.minutes > 0 ? Math.max((entry.minutes / maxMinutes) * 100, 16) : 8;

          return (
            <div key={entry.name} className="flex flex-col items-center gap-2">
              <div className="flex h-28 w-full max-w-[56px] items-end rounded-[1.25rem] bg-surface-container-low p-1.5">
                <div
                  className={cn(
                    "w-full rounded-[0.9rem] transition-colors",
                    entry.isToday
                      ? "bg-primary"
                      : entry.minutes > 0
                        ? "bg-primary/30"
                        : "bg-outline-variant/20"
                  )}
                  style={{ height: `${heightPercent}%` }}
                />
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-xs font-medium",
                    entry.isToday ? "text-on-surface" : "text-on-surface-variant"
                  )}
                >
                  {entry.name}
                </p>
                <p className="mt-0.5 text-[11px] text-on-surface-variant">
                  {entry.minutes > 0 ? `${entry.minutes}` : "0"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {totalSessions === 0 ? (
        <div className="mt-5 rounded-[1.25rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          {t("weekly_chart_empty_note")}
        </div>
      ) : null}
    </section>
  );
}

function SummaryPill({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-outline-variant/10 bg-surface-container-low p-3.5">
      <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-on-surface">{value}</p>
    </div>
  );
}
