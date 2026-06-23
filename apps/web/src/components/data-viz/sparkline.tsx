import * as React from "react";

import { cn } from "@/lib/utils";

export type ChartTone = 1 | 2 | 3 | 4 | 5 | 6 | 7;

type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  /** Chart-palette index (1..7). 3=positive, 4=caution, 7=negative by convention. */
  tone?: ChartTone;
  area?: boolean;
  className?: string;
};

const STROKE: Record<ChartTone, string> = {
  1: "stroke-chart-1",
  2: "stroke-chart-2",
  3: "stroke-chart-3",
  4: "stroke-chart-4",
  5: "stroke-chart-5",
  6: "stroke-chart-6",
  7: "stroke-chart-7",
};

const FILL: Record<ChartTone, string> = {
  1: "fill-chart-1",
  2: "fill-chart-2",
  3: "fill-chart-3",
  4: "fill-chart-4",
  5: "fill-chart-5",
  6: "fill-chart-6",
  7: "fill-chart-7",
};

/**
 * Lightweight tokenised SVG sparkline — first-party micro-viz for StatCards and
 * inline trends. Full charts come from the bklit ChartKit (WS-A1); this stays for
 * the tiny inline cases. Colours route through the chart tokens only.
 */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  tone = 1,
  area = true,
  className,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stepX = width / (data.length - 1);
  const points = data.map(
    (value, index) => [index * stepX, height - ((value - min) / span) * height] as const,
  );
  const line = points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden
      className={cn("overflow-visible", className)}
    >
      {area && <path d={areaPath} className={cn(FILL[tone], "opacity-10")} />}
      <path
        d={line}
        className={STROKE[tone]}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
