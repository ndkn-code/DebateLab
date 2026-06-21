"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DriftPoint } from "@/lib/ielts/prediction-quality/types";

const GRID = "#e5e7eb";
const AXIS = "#6b7280";
const LINE = "#2f4fdd";
const HALF_BAND = "#16a34a";

/**
 * Drift over time: the served model's overall MAE per calendar month of mock
 * boundaries. A rising line means predictions are degrading against reality. The
 * dashed reference marks the half-band threshold we want to stay under.
 */
export function DriftChart({ points }: { points: DriftPoint[] }) {
  const data = points.map((point) => ({
    label: point.label,
    mae: point.mae,
    boundaryCount: point.boundaryCount,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-on-surface-variant">
        Drift appears once mocks span more than one period.
      </div>
    );
  }

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, (max: number) => Math.max(1, Math.ceil(max * 2) / 2)]}
            tickFormatter={(value: number) => value.toFixed(1)}
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <ReferenceLine y={0.5} stroke={HALF_BAND} strokeDasharray="5 4" />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 13 }}
            formatter={(_value, _name, item) => {
              const point = item?.payload as { mae?: number | null; boundaryCount?: number };
              return [
                `${(point?.mae ?? 0).toFixed(2)} (${point?.boundaryCount ?? 0} boundaries)`,
                "Overall MAE",
              ];
            }}
          />
          <Line
            type="monotone"
            dataKey="mae"
            stroke={LINE}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
