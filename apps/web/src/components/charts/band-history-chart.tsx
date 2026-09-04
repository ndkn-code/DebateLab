"use client";

import { curveLinear } from "@visx/curve";
import { scaleLinear, scaleTime } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useId } from "react";

export interface BandHistoryPoint {
  date: string;
  value: number | null;
}

/** Static measured observations for screen and print, using the existing Visx engine. */
export function BandHistoryChart({
  data,
  label,
  locale,
  timeZone = "Asia/Ho_Chi_Minh",
}: {
  data: BandHistoryPoint[];
  label: string;
  locale: "vi" | "en";
  timeZone?: string;
}) {
  const titleId = useId();
  const observations = data
    .map((point) => ({ ...point, timestamp: new Date(point.date).getTime() }))
    .filter((point) => Number.isFinite(point.timestamp))
    .sort((a, b) => a.timestamp - b.timestamp);
  const monthNumber = (timestamp: number) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(timestamp);
    return (
      Number(parts.find((part) => part.type === "year")?.value) * 12 +
      Number(parts.find((part) => part.type === "month")?.value)
    );
  };
  // A month without an observation is a gap, not a measured trend segment.
  const points = observations.flatMap((point, index) => {
    const previous = observations[index - 1];
    if (
      !previous ||
      monthNumber(point.timestamp) - monthNumber(previous.timestamp) <= 1
    )
      return [point];
    const timestamp = (previous.timestamp + point.timestamp) / 2;
    return [
      { date: new Date(timestamp).toISOString(), timestamp, value: null },
      point,
    ];
  });
  const valid = (point: (typeof points)[number]) =>
    point.value !== null &&
    Number.isFinite(point.value) &&
    point.value >= 0 &&
    point.value <= 9;
  const observed = points.filter(valid);
  if (observed.length === 0) {
    return (
      <p className="type-body text-on-surface-variant">
        {locale === "vi"
          ? "Chưa có kết quả để vẽ biểu đồ."
          : "No results to plot yet."}
      </p>
    );
  }
  const first = points[0].timestamp;
  const last = points[points.length - 1].timestamp;
  const padding = first === last ? 86_400_000 : (last - first) * 0.04;
  const x = scaleTime<number>({
    domain: [new Date(first - padding), new Date(last + padding)],
    range: [34, 646],
  });
  const y = scaleLinear<number>({ domain: [0, 9], range: [132, 12] });
  const date = (timestamp: number) =>
    new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
      day: "numeric",
      month: "short",
      timeZone,
    }).format(timestamp);
  const ticks = [
    ...new Set([
      first,
      ...(points.length > 2
        ? [points[Math.floor(points.length / 2)].timestamp]
        : []),
      last,
    ]),
  ];
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <svg
        viewBox="0 0 680 164"
        role="img"
        aria-labelledby={titleId}
        className="block w-full min-w-lg print:min-w-0"
        data-band-history-chart
      >
        <title
          id={titleId}
        >{`${label}: ${observed.map((point) => `${date(point.timestamp)}: ${point.value}`).join(", ")}`}</title>
        {[0, 3, 6, 9].map((tick) => (
          <g key={tick}>
            <line
              x1={34}
              x2={646}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--color-chart-grid)"
            />
            <text
              x={24}
              y={y(tick) + 4}
              textAnchor="end"
              fill="var(--color-on-surface-variant)"
              className="type-caption"
            >
              {tick}
            </text>
          </g>
        ))}
        <LinePath
          data={points}
          defined={valid}
          curve={curveLinear}
          x={(point) => x(new Date(point.timestamp))}
          y={(point) => y(point.value ?? 0)}
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          fill="none"
        />
        {observed.map((point, index) => (
          <circle
            key={`${point.date}-${index}`}
            cx={x(new Date(point.timestamp))}
            cy={y(point.value ?? 0)}
            r={3.5}
            fill="var(--color-chart-1)"
          >
            <title>{`${date(point.timestamp)}: ${point.value}`}</title>
          </circle>
        ))}
        {ticks.map((tick) => (
          <text
            key={tick}
            x={x(new Date(tick))}
            y={156}
            textAnchor={
              tick === first && first !== last
                ? "start"
                : tick === last && first !== last
                  ? "end"
                  : "middle"
            }
            fill="var(--color-on-surface-variant)"
            className="type-caption"
          >
            {date(tick)}
          </text>
        ))}
      </svg>
    </div>
  );
}
