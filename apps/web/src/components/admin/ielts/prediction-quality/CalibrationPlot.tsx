"use client";

import {
  ChartTooltip,
  Grid,
  Line,
  LineChart,
} from "@/components/charts";
import { ChartEmpty } from "@/components/data-viz";
import type { CalibrationPoint } from "@/lib/ielts/prediction-quality/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const CALIBRATION_START = Date.UTC(2026, 0, 1);

type CalibrationDatum = {
  date: Date;
  label: string;
  claimed: number;
  empirical: number;
  calibrated: number | null;
  overconfident: number | null;
  floor: number;
  ceiling: number;
  sampleSize: number;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function toCalibrationData(points: CalibrationPoint[]): CalibrationDatum[] {
  return points
    .filter((point) => point.sampleSize > 0)
    .map((point, index) => {
      const calibrated = point.empirical + 1e-9 >= point.claimed;
      return {
        date: new Date(CALIBRATION_START + index * DAY_MS),
        label: point.label,
        claimed: point.claimed,
        empirical: point.empirical,
        calibrated: calibrated ? point.empirical : null,
        overconfident: calibrated ? null : point.empirical,
        floor: 0,
        ceiling: 1,
        sampleSize: point.sampleSize,
      };
    });
}

function CalibrationTooltipContent({ point }: { point: Record<string, unknown> }) {
  const label = typeof point.label === "string" ? point.label : "Target";
  const empirical = typeof point.empirical === "number" ? point.empirical : 0;
  const claimed = typeof point.claimed === "number" ? point.claimed : 0;
  const sampleSize = typeof point.sampleSize === "number" ? point.sampleSize : 0;
  const isCalibrated = empirical + 1e-9 >= claimed;

  return (
    <div className="min-w-40 px-3 py-2.5">
      <p className="type-caption font-semibold uppercase text-chart-tooltip-muted">
        {label}
      </p>
      <p className="mt-1 type-body-sm font-semibold text-chart-tooltip-foreground">
        {formatPercent(empirical)} empirical
      </p>
      <p className="mt-1 type-caption text-chart-tooltip-muted">
        Claimed {formatPercent(claimed)} · n={sampleSize}
      </p>
      <p className="mt-2 type-caption font-semibold text-chart-tooltip-foreground">
        {isCalibrated ? "Calibrated" : "Overconfident interval"}
      </p>
    </div>
  );
}

/**
 * Per-target calibration: does each served interval contain the truth as often
 * as it claims? Every dot is one target's empirical coverage; the dashed line is
 * the claimed level. On/above the line ⇒ calibrated; below ⇒ overconfident
 * (intervals too narrow).
 */
export function CalibrationPlot({ points }: { points: CalibrationPoint[] }) {
  const claimed = points[0]?.claimed ?? 0.8;
  const data = toCalibrationData(points);

  if (data.length === 0) {
    return (
      <ChartEmpty
        className="h-64"
        description="Interval observations appear once scored mock boundaries accumulate."
        title="No calibration points yet"
      />
    );
  }

  return (
    <div className="flex h-72 flex-col gap-2">
      <div className="min-h-0 flex-1">
        <LineChart
          aspectRatio="unset"
          data={data}
          margin={{ top: 14, right: 18, bottom: 18, left: 44 }}
          style={{ height: "100%" }}
        >
          <Grid
            horizontal
            highlightRowStroke="var(--chart-line-secondary)"
            highlightRowStrokeDasharray="5,4"
            highlightRowValues={[claimed]}
            rowTickValues={[0, 0.25, 0.5, 0.75, 1]}
          />
          <Line
            dataKey="claimed"
            fadeEdges={false}
            showMarkers={false}
            stroke="var(--chart-line-secondary)"
            strokeWidth={2}
          />
          <Line
            dataKey="calibrated"
            fadeEdges={false}
            markers={{
              fill: "var(--color-chart-3)",
              outlineColor: "var(--chart-background)",
              outlineWidth: 2,
              radius: 4.5,
              ringGap: 1.5,
              stroke: "var(--color-chart-3)",
            }}
            showHighlight={false}
            showMarkers
            stroke="transparent"
            strokeWidth={0}
          />
          <Line
            dataKey="overconfident"
            fadeEdges={false}
            markers={{
              fill: "var(--color-chart-4)",
              outlineColor: "var(--chart-background)",
              outlineWidth: 2,
              radius: 4.5,
              ringGap: 1.5,
              stroke: "var(--color-chart-4)",
            }}
            showHighlight={false}
            showMarkers
            stroke="transparent"
            strokeWidth={0}
          />
          <Line
            dataKey="floor"
            fadeEdges={false}
            showHighlight={false}
            stroke="transparent"
            strokeWidth={0}
          />
          <Line
            dataKey="ceiling"
            fadeEdges={false}
            showHighlight={false}
            stroke="transparent"
            strokeWidth={0}
          />
          <ChartTooltip
            content={({ point }) => <CalibrationTooltipContent point={point} />}
            showDatePill={false}
          />
        </LineChart>
      </div>
      <div className="flex justify-between gap-2 pl-11 pr-4 type-caption font-semibold text-on-surface-variant">
        {data.map((point) => (
          <span key={point.label} className="min-w-0 truncate text-center">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
