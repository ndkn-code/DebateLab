"use client";

import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

const COLORS: Record<string, string> = {
  gemini_analysis: "#2f4fdd",
  gemini_rebuttal: "#7c3aed",
  gemini_chat: "#059669",
  deepgram_stt: "#d97706",
  deepgram_tts: "#dc2626",
};

interface Props {
  data: { service: string; total_calls: number; total_cost: number }[];
}

export function ApiUsageChart({ data }: Props) {
  const t = useTranslations("admin.overview");
  const totalCost = data.reduce((sum, d) => sum + d.total_cost, 0);

  const formatted = data.map((d) => ({
    ...d,
    label: d.service.replace(/_/g, " "),
    fill: COLORS[d.service] ?? "#6b7280",
  }));

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-on-surface">{t("apiUsage")}</h3>
        <span className="text-xs font-medium text-on-surface-variant">
          Total: ${totalCost.toFixed(2)}
        </span>
      </div>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-on-surface-variant text-sm">
          {t("noData")}
        </div>
      ) : (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={formatted} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#6b7280" }} tickLine={false} axisLine={false} />
              <YAxis
                dataKey="label"
                type="category"
                tick={{ fontSize: 11, fill: "#6b7280" }}
                tickLine={false}
                axisLine={false}
                width={110}
              />
              <Tooltip
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13 }}
              />
              <Bar dataKey="total_calls" radius={[0, 6, 6, 0]} barSize={20}>
                {formatted.map((entry, i) => (
                  <rect key={i} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
