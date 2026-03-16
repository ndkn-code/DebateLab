"use client";

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

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface WeeklyChartProps {
  stats: DailyStatEntry[];
}

export function WeeklyChart({ stats }: WeeklyChartProps) {
  const today = new Date().toISOString().split("T")[0];
  const totalMinutes = stats.reduce((s, d) => s + d.practice_minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  const data = stats.map((s, i) => ({
    name: DAY_LABELS[i],
    minutes: s.practice_minutes,
    isToday: s.date === today,
  }));

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 sm:p-6 soft-shadow">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-base font-semibold text-on-surface">
          This Week&apos;s Activity
        </h3>
        <span className="text-sm font-medium text-on-surface-variant">
          {totalHours}h total
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
              formatter={(value) => [`${value} min`, "Practice"]}
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
