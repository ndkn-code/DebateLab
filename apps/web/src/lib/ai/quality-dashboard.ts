import { isNegativeAiQualityRating } from "@/lib/ai/quality-model";
import type { AiQualityRating, AiQualityRun } from "@/types";

export type AiQualityDashboardRow = AiQualityRun & {
  rating: AiQualityRating | null;
};

export type AiProviderRequestDashboardRow = {
  id: string;
  provider: string;
  model: string;
  status: "success" | "error";
  source_route: string | null;
  output_type: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cache_hit_tokens: number | null;
  cache_miss_tokens: number | null;
  estimated_cost_usd: number | string | null;
};

export type AiProviderRequestGroup = {
  key: string;
  provider: string;
  model: string;
  sourceRoute: string | null;
  outputType: string | null;
  status: "success" | "error";
  requestCount: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheHitTokens: number;
  cacheMissTokens: number;
  estimatedCostUsd: number;
  medianLatencyMs: number | null;
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function numeric(value: number | string | null | undefined) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

export function isFlaggedAiQualityRow(row: AiQualityDashboardRow) {
  return (
    row.review_status === "flagged" ||
    (row.rating
      ? isNegativeAiQualityRating({
          usefulness: row.rating.usefulness,
          fairness: row.rating.fairness,
          reasonTags: row.rating.reason_tags,
        })
      : false)
  );
}

export function computeAiQualityKpis(rows: AiQualityDashboardRow[]) {
  const ratedRows = rows.filter((row) => row.rating);
  const usefulRatings = ratedRows.filter((row) => row.rating?.usefulness === "yes");
  const fairnessRatings = ratedRows.filter((row) => row.rating?.fairness);
  const fairRatings = fairnessRatings.filter((row) => row.rating?.fairness === "fair");
  const cacheHitTokens = rows.reduce((sum, row) => sum + (row.cache_hit_tokens ?? 0), 0);
  const cacheMissTokens = rows.reduce((sum, row) => sum + (row.cache_miss_tokens ?? 0), 0);

  return {
    totalRuns: rows.length,
    ratedRuns: ratedRows.length,
    usefulRate: ratedRows.length ? usefulRatings.length / ratedRows.length : null,
    fairRate: fairnessRatings.length ? fairRatings.length / fairnessRatings.length : null,
    errorRate: rows.length
      ? rows.filter((row) => row.status === "error").length / rows.length
      : null,
    medianLatencyMs: median(
      rows
        .map((row) => row.latency_ms)
        .filter((value): value is number => typeof value === "number")
    ),
    estimatedCostUsd: rows.reduce(
      (sum, row) => sum + Number(row.estimated_cost_usd ?? 0),
      0
    ),
    cacheHitRatio:
      cacheHitTokens + cacheMissTokens > 0
        ? cacheHitTokens / (cacheHitTokens + cacheMissTokens)
        : null,
  };
}

export function computeProviderRequestKpis(rows: AiProviderRequestDashboardRow[]) {
  const cacheHitTokens = rows.reduce((sum, row) => sum + numeric(row.cache_hit_tokens), 0);
  const cacheMissTokens = rows.reduce((sum, row) => sum + numeric(row.cache_miss_tokens), 0);
  const errorCount = rows.filter((row) => row.status === "error").length;

  return {
    requestCount: rows.length,
    errorCount,
    errorRate: rows.length ? errorCount / rows.length : null,
    totalTokens: rows.reduce((sum, row) => sum + numeric(row.total_tokens), 0),
    inputTokens: rows.reduce((sum, row) => sum + numeric(row.input_tokens), 0),
    outputTokens: rows.reduce((sum, row) => sum + numeric(row.output_tokens), 0),
    estimatedCostUsd: rows.reduce(
      (sum, row) => sum + numeric(row.estimated_cost_usd),
      0
    ),
    cacheHitRatio:
      cacheHitTokens + cacheMissTokens > 0
        ? cacheHitTokens / (cacheHitTokens + cacheMissTokens)
        : null,
    medianLatencyMs: median(
      rows
        .map((row) => row.latency_ms)
        .filter((value): value is number => typeof value === "number")
    ),
  };
}

export function groupProviderRequests(
  rows: AiProviderRequestDashboardRow[]
): AiProviderRequestGroup[] {
  const groups = new Map<string, AiProviderRequestDashboardRow[]>();
  rows.forEach((row) => {
    const key = [
      row.provider,
      row.model,
      row.source_route ?? "unknown_route",
      row.output_type ?? "unknown_output",
      row.status,
    ].join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });

  return Array.from(groups.entries())
    .map(([key, items]) => ({
      key,
      provider: items[0]?.provider ?? "unknown",
      model: items[0]?.model ?? "unknown",
      sourceRoute: items[0]?.source_route ?? null,
      outputType: items[0]?.output_type ?? null,
      status: items[0]?.status ?? "error",
      requestCount: items.length,
      totalTokens: items.reduce((sum, row) => sum + numeric(row.total_tokens), 0),
      inputTokens: items.reduce((sum, row) => sum + numeric(row.input_tokens), 0),
      outputTokens: items.reduce((sum, row) => sum + numeric(row.output_tokens), 0),
      cacheHitTokens: items.reduce((sum, row) => sum + numeric(row.cache_hit_tokens), 0),
      cacheMissTokens: items.reduce((sum, row) => sum + numeric(row.cache_miss_tokens), 0),
      estimatedCostUsd: items.reduce(
        (sum, row) => sum + numeric(row.estimated_cost_usd),
        0
      ),
      medianLatencyMs: median(
        items
          .map((row) => row.latency_ms)
          .filter((value): value is number => typeof value === "number")
      ),
    }))
    .sort((left, right) => right.requestCount - left.requestCount);
}
