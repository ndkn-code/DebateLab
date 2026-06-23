"use client";

import * as React from "react";
import { curveNatural } from "@visx/curve";

import { cn } from "@/lib/utils";
import { Display, Eyebrow, Heading, Text } from "@/components/ui/typography";
import {
  ChartCard,
  ChartEmpty,
  ChartError,
  ChartSkeleton,
  DashboardSectionHeader,
  SegmentedRange,
  StatCard,
} from "@/components/data-viz";
import { Shake, Shimmer, Stagger, StaggerItem, Swap, SuccessCheck } from "@/components/motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
  Line,
  LineChart,
  RadarArea,
  RadarAxis,
  RadarChart,
  RadarGrid,
  RadarLabels,
  Ring,
  RingCenter,
  RingChart,
  XAxis,
} from "@/components/charts";

type Range = "7d" | "30d" | "90d";

const SPARKS: Record<Range, number[]> = {
  "7d": [4, 6, 5, 8, 7, 10, 12],
  "30d": [10, 12, 9, 14, 13, 18, 16, 20, 19, 24],
  "90d": [20, 24, 22, 30, 28, 35, 33, 42, 40, 52],
};
const MULT: Record<Range, number> = { "7d": 1, "30d": 4.2, "90d": 12.5 };

// ── Sample chart data (deterministic) ───────────────────────────────────────
const AREA_DATA = [
  { date: new Date("2024-01-01"), sessions: 18 },
  { date: new Date("2024-02-01"), sessions: 26 },
  { date: new Date("2024-03-01"), sessions: 22 },
  { date: new Date("2024-04-01"), sessions: 34 },
  { date: new Date("2024-05-01"), sessions: 30 },
  { date: new Date("2024-06-01"), sessions: 42 },
];
const BAR_DATA = [
  { day: "Mon", minutes: 24, target: 30 },
  { day: "Tue", minutes: 38, target: 30 },
  { day: "Wed", minutes: 18, target: 30 },
  { day: "Thu", minutes: 44, target: 30 },
  { day: "Fri", minutes: 32, target: 30 },
  { day: "Sat", minutes: 12, target: 30 },
  { day: "Sun", minutes: 8, target: 30 },
];
const LINE_DATA = [
  { date: new Date("2024-01-01"), score: 62 },
  { date: new Date("2024-02-01"), score: 66 },
  { date: new Date("2024-03-01"), score: 64 },
  { date: new Date("2024-04-01"), score: 71 },
  { date: new Date("2024-05-01"), score: 74 },
  { date: new Date("2024-06-01"), score: 79 },
];
const RADAR_METRICS = [
  { key: "matter", label: "Matter" },
  { key: "manner", label: "Manner" },
  { key: "method", label: "Method" },
  { key: "strategy", label: "Strategy" },
  { key: "delivery", label: "Delivery" },
];
const RADAR_DATA = [
  {
    label: "You",
    values: { matter: 78, manner: 65, method: 72, strategy: 60, delivery: 82 },
  },
];
const RING_DATA = [
  { label: "Matter", value: 78, maxValue: 100 },
  { label: "Manner", value: 65, maxValue: 100 },
  { label: "Method", value: 72, maxValue: 100 },
];
const HEATMAP_DATA = Array.from({ length: 6 }, (_, week) => ({
  bin: week,
  bins: Array.from({ length: 7 }, (_, day) => ({
    bin: day,
    count: (week * 3 + day * 2) % 5,
    date: new Date(2024, 0, 1 + week * 7 + day),
  })),
}));

const SWATCH_BG: Record<number, string> = {
  1: "bg-chart-1",
  2: "bg-chart-2",
  3: "bg-chart-3",
  4: "bg-chart-4",
  5: "bg-chart-5",
  6: "bg-chart-6",
  7: "bg-chart-7",
};
const TONES = [1, 2, 3, 4, 5, 6, 7] as const;

function Palette() {
  return (
    <div className="flex flex-wrap gap-4">
      {TONES.map((tone) => (
        <div key={tone} className="flex flex-col items-center gap-1">
          <div className={cn("h-12 w-12 rounded-lg ring-1 ring-[var(--card-border)]", SWATCH_BG[tone])} />
          <Text variant="caption" className="text-on-surface-variant">
            chart-{tone}
          </Text>
        </div>
      ))}
    </div>
  );
}

function Kpis({ range }: { range: Range }) {
  const mult = MULT[range];
  const spark = SPARKS[range];
  return (
    <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StaggerItem>
        <StatCard label="Active learners" value={Math.round(128 * mult)} delta={12.4} spark={spark} sparkTone={1} />
      </StaggerItem>
      <StaggerItem>
        <StatCard label="Practice minutes" value={Math.round(540 * mult)} delta={8.1} spark={spark} sparkTone={3} />
      </StaggerItem>
      <StaggerItem>
        <StatCard label="Avg score" value={72 + Math.round(mult)} delta={3.2} deltaSuffix=" pts" spark={spark} sparkTone={5} />
      </StaggerItem>
      <StaggerItem>
        <StatCard
          label="Error rate"
          value={2.4}
          format={(n) => `${n.toFixed(1)}%`}
          delta={-1.1}
          invertDelta
          spark={spark}
          sparkTone={7}
        />
      </StaggerItem>
    </Stagger>
  );
}

function Charts() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <ChartCard title="Weekly sessions" eyebrow="Area">
        <div className="h-56">
          <AreaChart data={AREA_DATA}>
            <Grid horizontal />
            <Area dataKey="sessions" curve={curveNatural} strokeWidth={2.5} fillOpacity={0.35} />
            <XAxis />
            <ChartTooltip />
          </AreaChart>
        </div>
      </ChartCard>

      <ChartCard title="Practice by day" eyebrow="Bar">
        <div className="h-56">
          <BarChart data={BAR_DATA} xDataKey="day">
            <Grid horizontal />
            <Bar dataKey="minutes" fill="var(--chart-line-primary)" lineCap="round" />
            <Bar dataKey="target" fill="var(--chart-line-secondary)" lineCap="round" />
            <BarXAxis />
            <ChartTooltip />
          </BarChart>
        </div>
      </ChartCard>

      <ChartCard title="Score over time" eyebrow="Line">
        <div className="h-56">
          <LineChart data={LINE_DATA}>
            <Grid horizontal />
            <Line dataKey="score" curve={curveNatural} stroke="var(--chart-line-primary)" />
            <XAxis />
            <ChartTooltip />
          </LineChart>
        </div>
      </ChartCard>

      <ChartCard title="Skill profile" eyebrow="Radar">
        <div className="flex h-56 items-center justify-center">
          <RadarChart data={RADAR_DATA} metrics={RADAR_METRICS} size={220}>
            <RadarGrid />
            <RadarAxis />
            <RadarLabels fontSize={10} offset={16} />
            {RADAR_DATA.map((row, index) => (
              <RadarArea key={row.label} index={index} />
            ))}
          </RadarChart>
        </div>
      </ChartCard>

      <ChartCard title="Overall score" eyebrow="Ring">
        <div className="flex h-56 items-center justify-center">
          <RingChart data={RING_DATA} size={200} strokeWidth={14}>
            {RING_DATA.map((item, index) => (
              <Ring index={index} key={item.label} />
            ))}
            <RingCenter defaultLabel="Skills" />
          </RingChart>
        </div>
      </ChartCard>

      <ChartCard title="Activity" eyebrow="Heatmap">
        <HeatmapInteractionProvider>
          <HeatmapInteractionBoundary>
            <div className="flex flex-col gap-3">
              <HeatmapChart className="w-full" data={HEATMAP_DATA} layout="fluid">
                <HeatmapCells />
                <HeatmapXAxis />
                <HeatmapYAxis />
                <HeatmapTooltip />
              </HeatmapChart>
              <HeatmapLegend />
            </div>
          </HeatmapInteractionBoundary>
        </HeatmapInteractionProvider>
      </ChartCard>
    </div>
  );
}

function MotionLab() {
  const [replay, setReplay] = React.useState(0);
  const [errorTick, setErrorTick] = React.useState(0);
  const [saved, setSaved] = React.useState(false);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <ChartCard title="Success" subtitle="SuccessCheck">
        <div className="flex flex-col items-center gap-3 py-2">
          <SuccessCheck key={replay} />
          <button
            type="button"
            onClick={() => setReplay((n) => n + 1)}
            className="type-label text-primary hover:underline"
          >
            Replay
          </button>
        </div>
      </ChartCard>

      <ChartCard title="Error shake" subtitle="Shake">
        <Shake trigger={errorTick} className="flex flex-col items-center gap-3 py-2">
          <div className="w-full rounded-lg bg-error-container px-3 py-2 text-center">
            <Text variant="body-sm" className="text-error">
              Invalid code
            </Text>
          </div>
        </Shake>
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setErrorTick((n) => n + 1)}
            className="type-label text-primary hover:underline"
          >
            Trigger
          </button>
        </div>
      </ChartCard>

      <ChartCard title="Swap" subtitle="Text/icon swap">
        <div className="flex flex-col items-center gap-3 py-2">
          <Swap swapKey={saved ? "saved" : "save"}>
            <Heading level={4} as="span" className="text-on-surface">
              {saved ? "Saved ✓" : "Save"}
            </Heading>
          </Swap>
          <button
            type="button"
            onClick={() => setSaved((value) => !value)}
            className="type-label text-primary hover:underline"
          >
            Toggle
          </button>
        </div>
      </ChartCard>

      <ChartCard title="Shimmer" subtitle="Skeleton sweep">
        <div className="flex flex-col gap-2 py-2">
          <Shimmer className="h-4 w-3/4" />
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-1/2" />
        </div>
      </ChartCard>
    </div>
  );
}

function DarkPanel({ range }: { range: Range }) {
  return (
    <div className="dark rounded-2xl bg-background p-6">
      <div className="flex flex-col gap-4">
        <Heading level={3} className="text-on-surface">
          Dark mode
        </Heading>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Active learners" value={Math.round(128 * MULT[range])} delta={12.4} spark={SPARKS[range]} sparkTone={1} animate={false} />
          <StatCard label="Practice minutes" value={Math.round(540 * MULT[range])} delta={8.1} spark={SPARKS[range]} sparkTone={3} animate={false} />
          <StatCard label="Error rate" value={2.4} format={(n) => `${n.toFixed(1)}%`} delta={-1.1} invertDelta spark={SPARKS[range]} sparkTone={7} animate={false} />
        </div>
        <ChartCard title="Weekly sessions" eyebrow="Area">
          <div className="h-48">
            <AreaChart data={AREA_DATA}>
              <Grid horizontal />
              <Area dataKey="sessions" curve={curveNatural} strokeWidth={2.5} fillOpacity={0.35} />
              <XAxis />
              <ChartTooltip />
            </AreaChart>
          </div>
        </ChartCard>
        <Palette />
      </div>
    </div>
  );
}

export default function UiSystemShowcasePage() {
  const [range, setRange] = React.useState<Range>("30d");

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-10">
      <header className="flex flex-col gap-2">
        <Eyebrow className="text-primary">Thinkfy UI System</Eyebrow>
        <Display size="sm">Data-viz &amp; Motion</Display>
        <Text variant="body" className="max-w-2xl text-on-surface-variant">
          Phase-0 foundation for the analytics revamp: chart + motion tokens, the
          motion kit (transitions.dev), data-viz primitives, and the bklit ChartKit
          (Visx) re-themed onto the Thinkfy chart tokens.
        </Text>
      </header>

      <section className="flex flex-col gap-4">
        <DashboardSectionHeader eyebrow="Tokens" title="Chart palette" description="design.md §Chart Colors, promoted to --color-chart-1..7 (light + dark)." />
        <ChartCard>
          <Palette />
        </ChartCard>
      </section>

      <section className="flex flex-col gap-4">
        <DashboardSectionHeader
          eyebrow="Primitives"
          title="KPIs"
          description="StatCard with count-up numbers, signed deltas, and tokenised sparklines."
          actions={<SegmentedRange value={range} onChange={setRange} />}
        />
        <Kpis range={range} />
      </section>

      <section className="flex flex-col gap-4">
        <DashboardSectionHeader eyebrow="ChartKit" title="Charts" description="bklit Visx charts inside ChartCards, themed through the --chart-* token bridge." />
        <Charts />
      </section>

      <section className="flex flex-col gap-4">
        <DashboardSectionHeader eyebrow="Primitives" title="States" description="Loading / empty / error states every chart shares." />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartCard title="Loading">
            <ChartSkeleton />
          </ChartCard>
          <ChartCard title="Empty">
            <ChartEmpty title="No sessions yet" description="Complete a practice to see your trend." />
          </ChartCard>
          <ChartCard title="Error">
            <ChartError onRetry={() => undefined} />
          </ChartCard>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <DashboardSectionHeader eyebrow="Motion" title="Micro-interactions" description="transitions.dev vocabulary on framer-motion, driven by the motion tokens." />
        <MotionLab />
      </section>

      <section className="flex flex-col gap-4">
        <DarkPanel range={range} />
      </section>
    </div>
  );
}
