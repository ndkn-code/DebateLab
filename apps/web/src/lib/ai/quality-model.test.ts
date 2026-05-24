import assert from "node:assert/strict";
import {
  type AiQualityDashboardRow,
  computeAiQualityKpis,
  isFlaggedAiQualityRow,
} from "./quality-dashboard";
import {
  createAiQualityPreview,
  estimateAiCostUsd,
  isNegativeAiQualityRating,
  normalizeAiQualityReasonTags,
} from "./quality-model";

assert.equal(
  estimateAiCostUsd({
    provider: "deepseek",
    cacheHitTokens: 640,
    cacheMissTokens: 136,
    outputTokens: 900,
  }),
  0.000273
);

assert.equal(
  estimateAiCostUsd({
    provider: "DeepSeek",
    inputTokens: 1000,
    outputTokens: 1000,
  }),
  0.00042
);

assert.equal(
  estimateAiCostUsd({
    provider: "gemini",
    inputTokens: 1000,
    outputTokens: 1000,
  }),
  0
);

assert.deepEqual(
  normalizeAiQualityReasonTags([
    "too_generic",
    "unknown",
    "too_generic",
    "missed_argument",
  ]),
  ["too_generic", "missed_argument"]
);

assert.equal(isNegativeAiQualityRating({ usefulness: "yes", fairness: "fair" }), false);
assert.equal(isNegativeAiQualityRating({ usefulness: "somewhat" }), true);
assert.equal(isNegativeAiQualityRating({ fairness: "too_harsh" }), true);
assert.equal(
  createAiQualityPreview("  a   ".repeat(400), 20),
  "a a a a a a a a a a…"
);

const dashboardRows = [
  {
    status: "success",
    latency_ms: 100,
    cache_hit_tokens: 90,
    cache_miss_tokens: 10,
    estimated_cost_usd: 0.001,
    review_status: "unreviewed",
    rating: {
      usefulness: "yes",
      fairness: "fair",
      reason_tags: [],
    },
  },
  {
    status: "error",
    latency_ms: 300,
    cache_hit_tokens: 10,
    cache_miss_tokens: 90,
    estimated_cost_usd: 0.002,
    review_status: "unreviewed",
    rating: {
      usefulness: "no",
      fairness: "too_harsh",
      reason_tags: ["missed_argument"],
    },
  },
] as AiQualityDashboardRow[];

assert.deepEqual(computeAiQualityKpis(dashboardRows), {
  totalRuns: 2,
  ratedRuns: 2,
  usefulRate: 0.5,
  fairRate: 0.5,
  errorRate: 0.5,
  medianLatencyMs: 200,
  estimatedCostUsd: 0.003,
  cacheHitRatio: 0.5,
});
assert.equal(isFlaggedAiQualityRow(dashboardRows[0]), false);
assert.equal(isFlaggedAiQualityRow(dashboardRows[1]), true);

console.info("ai-quality utilities passed");
