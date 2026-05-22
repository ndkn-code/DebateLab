import assert from "node:assert/strict";
import {
  buildPerformanceSummary,
  normalizePerformanceRange,
  type PerformanceEventRow,
} from "@/lib/analytics/performance-summary";

assert.equal(normalizePerformanceRange("7d"), "7d");
assert.equal(normalizePerformanceRange("bad"), "30d");

const rows: PerformanceEventRow[] = [
  {
    route: "/en/dashboard",
    duration_ms: 1800,
    metadata: {
      metricName: "LCP",
      value: 1800,
      rating: "good",
      route: "/en/dashboard",
    },
  },
  {
    route: "/en/dashboard",
    duration_ms: 2600,
    metadata: {
      metricName: "LCP",
      value: 2600,
      rating: "needs-improvement",
      route: "/en/dashboard",
    },
  },
  {
    route: "/en/dashboard",
    duration_ms: null,
    metadata: {
      metricName: "CLS",
      value: 0.14,
      rating: "needs-improvement",
      route: "/en/dashboard",
    },
  },
  {
    route: "/en/chat",
    duration_ms: 120,
    metadata: {
      metricName: "INP",
      value: 120,
      rating: "good",
      route: "/en/chat",
    },
  },
];

const summary = buildPerformanceSummary(rows, "30d", new Date("2026-05-09T12:00:00.000Z"));
assert.equal(summary.generatedAt, "2026-05-09T12:00:00.000Z");
assert.equal(summary.routes[0].route, "/en/dashboard");
assert.equal(summary.routes[0].samples, 3);
assert.equal(summary.routes[0].metrics.find((metric) => metric.metricName === "LCP")?.p75, 2600);
assert.equal(summary.routes[0].metrics.find((metric) => metric.metricName === "CLS")?.p75, 0.14);
assert.equal(summary.routes[1].metrics[0].metricName, "INP");

console.log("performance summary tests passed");
