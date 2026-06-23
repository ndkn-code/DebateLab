"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Eyebrow, Text } from "@/components/ui/typography";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { Sparkline, type ChartTone } from "./sparkline";

type StatCardProps = {
  label: React.ReactNode;
  value: number;
  format?: (value: number) => string;
  /** Signed percentage change vs the previous period. */
  delta?: number;
  deltaSuffix?: string;
  /** For metrics where down is good (error rate, latency): inverts delta colour. */
  invertDelta?: boolean;
  icon?: React.ReactNode;
  spark?: number[];
  sparkTone?: ChartTone;
  animate?: boolean;
  className?: string;
};

type Trend = "up" | "down" | "neutral";

const TREND_CLASS: Record<Trend, string> = {
  up: "text-success",
  down: "text-error",
  neutral: "text-on-surface-variant",
};

const TREND_GLYPH: Record<Trend, string> = { up: "▲", down: "▼", neutral: "•" };

function resolveTrend(delta: number | undefined, invert: boolean): Trend {
  if (delta === undefined || delta === 0) return "neutral";
  const isGood = invert ? delta < 0 : delta > 0;
  return isGood ? "up" : "down";
}

/** KPI atom: label, animated value, signed delta, optional sparkline. */
export function StatCard({
  label,
  value,
  format = (n) => Math.round(n).toLocaleString(),
  delta,
  deltaSuffix = "%",
  invertDelta = false,
  icon,
  spark,
  sparkTone = 1,
  animate = true,
  className,
}: StatCardProps) {
  const trend = resolveTrend(delta, invertDelta);
  return (
    <div
      data-slot="stat-card"
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-[var(--card-bg)] p-4 shadow-token-card ring-1 ring-[var(--card-border)]",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Eyebrow className="text-on-surface-variant">{label}</Eyebrow>
        {icon && <span className="text-on-surface-variant">{icon}</span>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          {animate ? (
            <AnimatedNumber value={value} format={format} className="type-display-sm text-on-surface" />
          ) : (
            <span className="type-display-sm tabular-nums text-on-surface">{format(value)}</span>
          )}
          {delta !== undefined && (
            <Text variant="caption" className={cn("inline-flex items-center gap-1", TREND_CLASS[trend])}>
              <span aria-hidden>{TREND_GLYPH[trend]}</span>
              {Math.abs(delta).toLocaleString()}
              {deltaSuffix}
            </Text>
          )}
        </div>
        {spark && spark.length > 1 && <Sparkline data={spark} tone={sparkTone} className="self-end" />}
      </div>
    </div>
  );
}
