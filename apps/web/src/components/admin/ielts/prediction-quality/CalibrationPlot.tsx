"use client";

import {
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import type { CalibrationPoint } from "@/lib/ielts/prediction-quality/types";

const GRID = "#e5e7eb";
const AXIS = "#6b7280";
const ON_TARGET = "#16a34a";
const OVERCONFIDENT = "#d97706";

/**
 * Per-target calibration: does each served interval contain the truth as often
 * as it claims? Every dot is one target's empirical coverage; the dashed line is
 * the claimed level. On/above the line ⇒ calibrated; below ⇒ overconfident
 * (intervals too narrow).
 */
export function CalibrationPlot({ points }: { points: CalibrationPoint[] }) {
  const claimed = points[0]?.claimed ?? 0.8;
  const data = points
    .filter((point) => point.sampleSize > 0)
    .map((point) => ({
      label: point.label,
      empirical: point.empirical,
      claimed: point.claimed,
      sampleSize: point.sampleSize,
      calibrated: point.empirical + 1e-9 >= point.claimed,
    }));

  if (data.length === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-on-surface-variant">
        No interval observations to calibrate yet.
      </div>
    );
  }

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
          <XAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="empirical"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
            tick={{ fontSize: 11, fill: AXIS }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <ZAxis range={[120, 120]} />
          <ReferenceLine
            y={claimed}
            stroke={AXIS}
            strokeDasharray="5 4"
            label={{
              value: `claimed ${Math.round(claimed * 100)}%`,
              position: "insideTopRight",
              fontSize: 11,
              fill: AXIS,
            }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={{ borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 13 }}
            formatter={(_value, _name, item) => {
              const point = item?.payload as { empirical?: number; sampleSize?: number };
              return [
                `${Math.round((point?.empirical ?? 0) * 100)}% (n=${point?.sampleSize ?? 0})`,
                "Empirical coverage",
              ];
            }}
          />
          <Scatter data={data} dataKey="empirical">
            {data.map((point) => (
              <Cell key={point.label} fill={point.calibrated ? ON_TARGET : OVERCONFIDENT} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
