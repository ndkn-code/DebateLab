import assert from "node:assert/strict";
import {
  type AiProviderRequestDashboardRow,
  type AiQualityDashboardRow,
  computeAiQualityKpis,
  computeProviderRequestKpis,
  groupProviderRequests,
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

const providerRequests = [
  {
    id: "1",
    provider: "google",
    model: "gemini-3.1-flash-lite",
    status: "success",
    source_route: "/api/queues/practice-analysis",
    output_type: "practice_judging",
    latency_ms: 1000,
    input_tokens: 100,
    output_tokens: 50,
    total_tokens: 150,
    cache_hit_tokens: null,
    cache_miss_tokens: null,
    estimated_cost_usd: 0,
  },
  {
    id: "2",
    provider: "deepseek",
    model: "deepseek-v4-flash",
    status: "error",
    source_route: "/api/rebuttal",
    output_type: "rebuttal",
    latency_ms: 3000,
    input_tokens: 1000,
    output_tokens: 0,
    total_tokens: 1000,
    cache_hit_tokens: 800,
    cache_miss_tokens: 200,
    estimated_cost_usd: "0.001",
  },
] as AiProviderRequestDashboardRow[];

assert.deepEqual(computeProviderRequestKpis(providerRequests), {
  requestCount: 2,
  errorCount: 1,
  errorRate: 0.5,
  totalTokens: 1150,
  inputTokens: 1100,
  outputTokens: 50,
  estimatedCostUsd: 0.001,
  cacheHitRatio: 0.8,
  medianLatencyMs: 2000,
});
assert.equal(groupProviderRequests(providerRequests).length, 2);
assert.equal(groupProviderRequests(providerRequests)[0].requestCount, 1);

console.info("ai-quality utilities passed");
