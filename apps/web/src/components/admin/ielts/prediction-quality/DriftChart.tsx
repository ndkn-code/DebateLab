"use client";

import {
  Area,
  AreaChart,
  ChartTooltip,
  Grid,
  XAxis,
} from "@/components/charts";
import { ChartEmpty } from "@/components/data-viz";
import type { DriftPoint } from "@/lib/ielts/prediction-quality/types";

type DriftDatum = {
  date: Date;
  label: string;
  mae: number;
  threshold: number;
  boundaryCount: number;
};

function toDriftData(points: DriftPoint[]): DriftDatum[] {
  return points
    .filter((point) => point.mae !== null)
    .map((point) => ({
      date: new Date(`${point.window}-01T00:00:00.000Z`),
      label: point.label,
      mae: point.mae ?? 0,
      threshold: 0.5,
      boundaryCount: point.boundaryCount,
    }));
}

function DriftTooltipContent({ point }: { point: Record<string, unknown> }) {
  const label = typeof point.label === "string" ? point.label : "Window";
  const mae = typeof point.mae === "number" ? point.mae : 0;
  const boundaryCount =
    typeof point.boundaryCount === "number" ? point.boundaryCount : 0;

  return (
    <div className="min-w-40 px-3 py-2.5">
      <p className="type-caption font-semibold uppercase text-chart-tooltip-muted">
        {label}
      </p>
      <p className="mt-1 type-body-sm font-semibold text-chart-tooltip-foreground">
        {mae.toFixed(2)} overall MAE
      </p>
      <p className="mt-1 type-caption text-chart-tooltip-muted">
        {boundaryCount} scored boundaries
      </p>
    </div>
  );
}

/**
 * Drift over time: the served model's overall MAE per calendar month of mock
 * boundaries. A rising line means predictions are degrading against reality. The
 * dashed reference marks the half-band threshold we want to stay under.
 */
export function DriftChart({ points }: { points: DriftPoint[] }) {
  const data = toDriftData(points);

  if (data.length === 0) {
    return (
      <ChartEmpty
        className="h-64"
        description="Drift appears once scored mocks span more than one period."
        title="No drift window yet"
      />
    );
  }

  return (
    <div className="h-72">
      <AreaChart
        aspectRatio="unset"
        data={data}
        margin={{ top: 14, right: 18, bottom: 34, left: 40 }}
        style={{ height: "100%" }}
      >
        <Grid
          horizontal
          highlightRowStroke="var(--color-chart-3)"
          highlightRowStrokeDasharray="5,4"
          highlightRowValues={[0.5]}
        />
        <Area
          dataKey="mae"
          fill="var(--chart-line-primary)"
          fillOpacity={0.3}
          showMarkers
          stroke="var(--chart-line-primary)"
          strokeWidth={2.5}
        />
        <Area
          dataKey="threshold"
          fill="transparent"
          fillOpacity={0}
          showLine={false}
        />
        <XAxis />
        <ChartTooltip
          content={({ point }) => <DriftTooltipContent point={point} />}
          showDatePill={false}
        />
      </AreaChart>
    </div>
  );
}
