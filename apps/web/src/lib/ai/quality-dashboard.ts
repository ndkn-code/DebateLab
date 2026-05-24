import { isNegativeAiQualityRating } from "@/lib/ai/quality-model";
import type { AiQualityRating, AiQualityRun } from "@/types";

export type AiQualityDashboardRow = AiQualityRun & {
  rating: AiQualityRating | null;
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
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
