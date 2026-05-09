import type { SupabaseClient } from "@supabase/supabase-js";
import { getRangeWindow } from "@/lib/analytics/events";
import type { AnalyticsRangePreset } from "@/types";

export const WEB_VITAL_METRICS = ["TTFB", "FCP", "LCP", "INP", "CLS"] as const;

export type WebVitalMetricName = (typeof WEB_VITAL_METRICS)[number];
export type WebVitalRating = "good" | "needs-improvement" | "poor";

export interface PerformanceEventRow {
  route: string | null;
  duration_ms: number | null;
  occurred_at?: string | null;
  metadata: Record<string, unknown> | null;
}

export interface PerformanceMetricSummary {
  metricName: WebVitalMetricName;
  samples: number;
  p75: number | null;
  good: number;
  needsImprovement: number;
  poor: number;
}

export interface PerformanceRouteSummary {
  route: string;
  samples: number;
  metrics: PerformanceMetricSummary[];
}

export interface PerformanceSummary {
  range: AnalyticsRangePreset;
  generatedAt: string;
  routes: PerformanceRouteSummary[];
}

const METRIC_SET = new Set<string>(WEB_VITAL_METRICS);
const RATING_SET = new Set<string>(["good", "needs-improvement", "poor"]);

export function normalizePerformanceRange(value?: string | null): AnalyticsRangePreset {
  if (value === "7d" || value === "30d" || value === "90d") return value;
  return "30d";
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return sorted[index];
}

function getString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeRoute(value: string | null | undefined) {
  const route = value?.trim();
  return route ? route.slice(0, 500) : "unknown";
}

function readMetric(row: PerformanceEventRow) {
  const metadata = row.metadata ?? {};
  const metricName = getString(metadata.metricName);
  if (!metricName || !METRIC_SET.has(metricName)) return null;

  const value =
    getNumber(metadata.value) ??
    (metricName === "CLS" ? null : row.duration_ms);
  if (value == null || value < 0) return null;

  const rating = getString(metadata.rating);
  return {
    metricName: metricName as WebVitalMetricName,
    value,
    rating: RATING_SET.has(rating ?? "") ? (rating as WebVitalRating) : null,
    route: normalizeRoute(getString(metadata.route) ?? row.route),
  };
}

export function buildPerformanceSummary(
  rows: PerformanceEventRow[],
  range: AnalyticsRangePreset,
  generatedAt = new Date()
): PerformanceSummary {
  const byRoute = new Map<string, Map<WebVitalMetricName, Array<{ value: number; rating: WebVitalRating | null }>>>();

  for (const row of rows) {
    const metric = readMetric(row);
    if (!metric) continue;

    const routeMetrics = byRoute.get(metric.route) ?? new Map();
    const values = routeMetrics.get(metric.metricName) ?? [];
    values.push({ value: metric.value, rating: metric.rating });
    routeMetrics.set(metric.metricName, values);
    byRoute.set(metric.route, routeMetrics);
  }

  const routes = [...byRoute.entries()]
    .map(([route, routeMetrics]) => {
      const metrics = WEB_VITAL_METRICS.flatMap((metricName) => {
        const samples = routeMetrics.get(metricName) ?? [];
        if (samples.length === 0) return [];

        return [
          {
            metricName,
            samples: samples.length,
            p75: percentile(samples.map((sample) => sample.value), 75),
            good: samples.filter((sample) => sample.rating === "good").length,
            needsImprovement: samples.filter(
              (sample) => sample.rating === "needs-improvement"
            ).length,
            poor: samples.filter((sample) => sample.rating === "poor").length,
          } satisfies PerformanceMetricSummary,
        ];
      });

      return {
        route,
        samples: metrics.reduce((sum, metric) => sum + metric.samples, 0),
        metrics,
      };
    })
    .sort((left, right) => right.samples - left.samples || left.route.localeCompare(right.route));

  return {
    range,
    generatedAt: generatedAt.toISOString(),
    routes,
  };
}

export async function getPerformanceSummary(
  supabase: SupabaseClient,
  range: AnalyticsRangePreset
) {
  const window = getRangeWindow(range);
  const { data, error } = await supabase
    .from("analytics_events")
    .select("route, duration_ms, metadata, occurred_at")
    .eq("event_name", "web_vital_recorded")
    .gte("occurred_at", window.startIso)
    .order("occurred_at", { ascending: false })
    .limit(5000);

  if (error) {
    throw error;
  }

  return buildPerformanceSummary(
    (data ?? []) as PerformanceEventRow[],
    range
  );
}
