"use client";

import { useTranslations } from "next-intl";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { DailyStatEntry } from "@/lib/api/dashboard";

interface WeeklyChartProps {
  stats: DailyStatEntry[];
}

export function WeeklyChart({ stats }: WeeklyChartProps) {
  const t = useTranslations("dashboard.home");
  const today = new Date().toISOString().split("T")[0];
  const totalMinutes = stats.reduce((s, d) => s + d.practice_minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
  const data = stats.map((s, i) => ({
    name: t(`days_labels.${dayKeys[i]}`),
    minutes: s.practice_minutes,
    isToday: s.date === today,
  }));

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 sm:p-6 soft-shadow">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-base font-semibold text-on-surface">
          {t("this_weeks_activity")}
        </h3>
        <span className="text-sm font-medium text-on-surface-variant">
          {t("total_hours", { hours: totalHours })}
        </span>
      </div>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={32} barGap={4}>
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{
                fontSize: 12,
                fontWeight: 500,
                fill: "var(--color-on-surface-variant)",
              }}
            />
            <YAxis hide />
            <Tooltip
              cursor={false}
              contentStyle={{
                background: "var(--color-surface-container-lowest)",
                border: "1px solid var(--color-outline-variant)",
                borderRadius: "0.75rem",
                fontSize: "0.8rem",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value) => [`${value} min`, ""]}
            />
            <Bar dataKey="minutes" radius={[8, 8, 4, 4]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.isToday
                      ? "var(--color-primary)"
                      : "var(--color-surface-container-highest)"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
