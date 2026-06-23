"use client";

import { useTranslations } from "next-intl";
import { Activity, CalendarDays, TimerReset } from "@/components/ui/icons";
import { Bar, BarChart, BarXAxis, ChartTooltip, Grid } from "@/components/charts";
import { ChartCard, ChartEmpty, StatCard } from "@/components/data-viz";
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
    <ChartCard
      title={t("this_weeks_activity")}
      subtitle={
        totalSessions > 0
          ? t("weekly_chart_subtitle")
          : t("weekly_chart_empty_subtitle")
      }
      actions={
        <span className="type-label whitespace-nowrap text-on-surface-variant">
          {t("total_hours", { hours: totalHours })}
        </span>
      }
      className="rounded-[2rem] p-5 sm:p-6"
      bodyClassName="flex flex-col gap-5"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("weekly_active_days_label")}
          value={activeDays}
          format={(value) => `${Math.round(value)}/7`}
          icon={<CalendarDays className="h-4 w-4 text-primary" />}
          animate={false}
          className="rounded-[1.25rem] p-3.5"
        />
        <StatCard
          label={t("weekly_sessions_label")}
          value={totalSessions}
          icon={<Activity className="h-4 w-4 text-secondary" />}
          animate={false}
          className="rounded-[1.25rem] p-3.5"
        />
        <StatCard
          label={t("weekly_best_day_label")}
          value={bestDay.practice_minutes}
          format={(value) => `${Math.round(value)} ${t("min")}`}
          icon={<TimerReset className="h-4 w-4 text-tertiary" />}
          animate={false}
          className="rounded-[1.25rem] p-3.5"
        />
      </div>

      {totalSessions === 0 && maxMinutes <= 1 ? (
        <ChartEmpty
          title={t("weekly_chart_empty_note")}
          description={t("weekly_chart_empty_subtitle")}
          className="h-48 rounded-[1.5rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-4"
        />
      ) : (
        <div className="h-64">
          <BarChart
            data={data}
            xDataKey="name"
            margin={{ top: 24, right: 18, bottom: 34, left: 18 }}
            barGap={0.35}
          >
            <Grid horizontal />
            <Bar dataKey="minutes" fill="var(--chart-line-primary)" lineCap="round" minBarHeight={6} />
            <Bar dataKey="sessions" fill="var(--chart-line-secondary)" lineCap="round" minBarHeight={4} />
            <BarXAxis showAllLabels />
            <ChartTooltip
              rows={(point) => [
                {
                  label: t("min"),
                  value: `${point.minutes ?? 0}`,
                  color: "var(--chart-line-primary)",
                },
                {
                  label: t("weekly_sessions_label"),
                  value: `${point.sessions ?? 0}`,
                  color: "var(--chart-line-secondary)",
                },
              ]}
            />
          </BarChart>
        </div>
      )}
    </ChartCard>
  );
}
