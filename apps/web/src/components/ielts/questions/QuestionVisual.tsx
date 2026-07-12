"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  BarXAxis,
  Grid,
  Line,
  LineChart,
  Ring,
  RingChart,
} from "@/components/charts";
import { Text } from "@/components/ui/typography";
import type {
  IeltsChartVisual,
  IeltsImageHotspot,
  IeltsTableVisual,
  IeltsVisual,
  IeltsVisualGap,
} from "@/lib/ielts/question-types";
import { cn } from "@/lib/utils";

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

interface QuestionVisualProps {
  visual: IeltsVisual;
  className?: string;
  framed?: boolean;
  renderGap?: (gap: IeltsVisualGap) => React.ReactNode;
}

function ImageVisual({
  visual,
  scrollable,
}: {
  visual: Extract<IeltsVisual, { kind: "image" }>;
  scrollable: boolean;
}) {
  return (
    <figure>
      <div className={cn("relative", scrollable && "min-w-80")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- authored diagrams are arbitrary remote assets */}
        <img
          src={visual.url}
          alt={visual.alt ?? ""}
          className="w-full rounded-2xl border border-outline-variant"
        />
        {visual.hotspots.map((hotspot: IeltsImageHotspot, index) => (
          <span
            key={hotspot.id}
            style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
            className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary shadow-sm ring-2 ring-surface"
          >
            {hotspot.label ?? index + 1}
          </span>
        ))}
      </div>
      {visual.caption ? (
        <figcaption className="mt-2 type-caption text-on-surface-variant">
          {visual.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function TableVisual({
  visual,
  renderGap,
}: {
  visual: IeltsTableVisual;
  renderGap?: (gap: IeltsVisualGap) => React.ReactNode;
}) {
  return (
    <table className="min-w-full border-collapse overflow-hidden rounded-2xl">
      {visual.caption ? (
        <caption className="mb-2 text-left">
          <Text variant="caption" className="text-on-surface-variant">
            {visual.caption}
          </Text>
        </caption>
      ) : null}
      {visual.headers.length > 0 ? (
        <thead>
          <tr>
            {visual.headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                scope="col"
                className="min-w-32 border border-outline-variant bg-surface-container px-3 py-2 text-left type-body-sm font-semibold text-on-surface"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
      ) : null}
      <tbody>
        {visual.rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className="min-w-32 border border-outline-variant p-2 align-top"
              >
                {cell.gap && renderGap ? (
                  renderGap(cell.gap)
                ) : (
                  <Text variant="body-sm" className="break-words text-on-surface">
                    {cell.text ?? cell.gap?.label ?? ""}
                  </Text>
                )}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function chartXAxisKey(visual: IeltsChartVisual): string {
  if (visual.xAxisKey) return visual.xAxisKey;
  const seriesKeys = new Set(visual.series.map((series) => series.dataKey));
  return Object.keys(visual.data[0] ?? {}).find((key) => !seriesKeys.has(key)) ?? "name";
}

function SeriesLegend({ visual }: { visual: IeltsChartVisual }) {
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Chart legend">
      {visual.series.map((series, index) => (
        <li key={series.dataKey} className="flex items-center gap-2 type-caption text-on-surface-variant">
          <span
            className="size-2.5 rounded-full"
            style={{ backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length] }}
          />
          {series.label}
        </li>
      ))}
    </ul>
  );
}

function CartesianChart({ visual }: { visual: IeltsChartVisual }) {
  const xKey = chartXAxisKey(visual);
  const timelineData = visual.data.map((datum, index) => ({
    ...datum,
    __visualDate: new Date(Date.UTC(2000, 0, index + 1)),
  }));
  const firstLabel = String(visual.data[0]?.[xKey] ?? "");
  const lastLabel = String(visual.data.at(-1)?.[xKey] ?? "");

  if (visual.chartType === "bar") {
    return (
      <BarChart
        data={visual.data}
        xDataKey={xKey}
        aspectRatio="4 / 3"
        margin={{ top: 16, right: 12, bottom: 34, left: 36 }}
      >
        <Grid horizontal />
        {visual.series.map((series, index) => (
          <Bar
            key={series.dataKey}
            dataKey={series.dataKey}
            fill={SERIES_COLORS[index % SERIES_COLORS.length]}
            stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
          />
        ))}
        <BarXAxis maxLabels={6} />
      </BarChart>
    );
  }

  if (visual.chartType === "area") {
    return (
      <>
        <AreaChart
          data={timelineData}
          xDataKey="__visualDate"
          aspectRatio="4 / 3"
          margin={{ top: 16, right: 12, bottom: 20, left: 36 }}
        >
          <Grid horizontal />
          {visual.series.map((series, index) => (
            <Area
              key={series.dataKey}
              dataKey={series.dataKey}
              fill={SERIES_COLORS[index % SERIES_COLORS.length]}
              stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
              fillOpacity={0.24}
              showMarkers
            />
          ))}
        </AreaChart>
        <ChartEndpoints first={firstLabel} last={lastLabel} />
      </>
    );
  }

  return (
    <>
      <LineChart
        data={timelineData}
        xDataKey="__visualDate"
        aspectRatio="4 / 3"
        margin={{ top: 16, right: 12, bottom: 20, left: 36 }}
      >
        <Grid horizontal />
        {visual.series.map((series, index) => (
          <Line
            key={series.dataKey}
            dataKey={series.dataKey}
            stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
            showMarkers
            fadeEdges={false}
          />
        ))}
      </LineChart>
      <ChartEndpoints first={firstLabel} last={lastLabel} />
    </>
  );
}

function ChartEndpoints({ first, last }: { first: string; last: string }) {
  if (!first && !last) return null;
  return (
    <div className="mt-1 flex justify-between gap-3 type-caption text-on-surface-variant">
      <span>{first}</span>
      <span className="text-right">{last}</span>
    </div>
  );
}

function PieChartVisual({ visual }: { visual: IeltsChartVisual }) {
  const xKey = chartXAxisKey(visual);
  const values =
    visual.series.length === 1 && visual.data.length > 1
      ? visual.data.map((datum) => ({
          label: String(datum[xKey] ?? visual.series[0]?.label ?? ""),
          value: Number(datum[visual.series[0]?.dataKey ?? ""] ?? 0),
        }))
      : visual.series.map((series) => ({
          label: series.label,
          value: visual.data.reduce((sum, datum) => sum + Number(datum[series.dataKey] ?? 0), 0),
        }));
  const total = Math.max(values.reduce((sum, item) => sum + Math.max(0, item.value), 0), 1);
  const ringData = values.map((item, index) => ({
    ...item,
    value: Math.max(0, item.value),
    maxValue: total,
    color: SERIES_COLORS[index % SERIES_COLORS.length],
  }));

  return (
    <div className="flex flex-col items-center gap-3">
      <RingChart data={ringData} size={240} strokeWidth={16} baseInnerRadius={52}>
        {ringData.map((item, index) => (
          <Ring key={`${item.label}-${index}`} index={index} color={item.color} />
        ))}
      </RingChart>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-2" aria-label="Chart legend">
        {ringData.map((item) => (
          <li key={item.label} className="flex items-center gap-2 type-caption text-on-surface-variant">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}: {item.value}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChartVisual({ visual }: { visual: IeltsChartVisual }) {
  const label = visual.title ?? `${visual.chartType} chart`;
  return (
    <figure role="img" aria-label={label} className="min-w-80">
      {visual.title ? (
        <figcaption className="mb-3 type-body-sm font-semibold text-on-surface">
          {visual.title}
        </figcaption>
      ) : null}
      {visual.chartType === "pie" ? (
        <PieChartVisual visual={visual} />
      ) : (
        <>
          <CartesianChart visual={visual} />
          <SeriesLegend visual={visual} />
        </>
      )}
    </figure>
  );
}

export function QuestionVisual({
  visual,
  className,
  framed = true,
  renderGap,
}: QuestionVisualProps) {
  if (visual.kind === "described") {
    return (
      <section
        aria-label="Figure description"
        className={cn(
          "rounded-2xl border border-outline-variant bg-surface-container p-5",
          className,
        )}
      >
        <p className="type-label-sm font-semibold text-on-surface">Figure description</p>
        <p className="mt-3 whitespace-pre-wrap type-body-sm leading-relaxed text-on-surface">
          {visual.description}
        </p>
      </section>
    );
  }

  return (
    <div
      className={cn(
        framed
          ? "max-w-full overflow-x-auto rounded-2xl border border-outline-variant bg-surface p-4 pb-5"
          : visual.kind === "table"
            ? "overflow-x-auto pb-1"
            : "",
        className,
      )}
    >
      {visual.kind === "image" ? <ImageVisual visual={visual} scrollable={framed} /> : null}
      {visual.kind === "table" ? <TableVisual visual={visual} renderGap={renderGap} /> : null}
      {visual.kind === "chart" ? <ChartVisual visual={visual} /> : null}
    </div>
  );
}
