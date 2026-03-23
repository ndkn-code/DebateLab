"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

interface Props {
  title: string;
  data: { date: string; count: number }[];
  color?: string;
}

export function TrendChart({ title, data, color = "#2f4fdd" }: Props) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
  }));

  return (
    <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-on-surface mb-4">{title}</h3>
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formatted}>
            <defs>
              <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                fontSize: 13,
              }}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${color})`}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
