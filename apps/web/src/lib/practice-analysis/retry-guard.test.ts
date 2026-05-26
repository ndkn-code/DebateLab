import assert from "node:assert/strict";
import { getPracticeAnalysisRetryDecision } from "./retry-guard";

const nowMs = Date.parse("2026-05-26T20:00:00.000Z");

assert.deepEqual(
  getPracticeAnalysisRetryDecision({
    jobStatus: "processing",
    dbDeliveryCount: 93,
    maxAttempts: 3,
    queueDeliveryCount: 93,
    startedAt: "2026-05-26T05:39:49.000Z",
    nowMs,
  }),
  { action: "fail", reason: "db_retry_limit_exceeded" }
);

assert.deepEqual(
  getPracticeAnalysisRetryDecision({
    jobStatus: "processing",
    dbDeliveryCount: 1,
    maxAttempts: 3,
    queueDeliveryCount: 2,
    startedAt: "2026-05-26T19:59:30.000Z",
    nowMs,
  }),
  { action: "skip", reason: "processing_not_stale" }
);

assert.deepEqual(
  getPracticeAnalysisRetryDecision({
    jobStatus: "processing",
    dbDeliveryCount: 1,
    maxAttempts: 3,
    queueDeliveryCount: 1,
    startedAt: "2026-05-26T19:55:00.000Z",
    nowMs,
  }),
  {
    action: "process",
    deliveryCount: 2,
    allowedStatuses: ["processing"],
    reason: "reclaim_stale_processing",
  }
);

assert.deepEqual(
  getPracticeAnalysisRetryDecision({
    jobStatus: "queued",
    dbDeliveryCount: 0,
    maxAttempts: 3,
    queueDeliveryCount: 1,
    startedAt: null,
    nowMs,
  }),
  {
    action: "process",
    deliveryCount: 1,
    allowedStatuses: ["queued"],
    reason: "queued",
  }
);

assert.deepEqual(
  getPracticeAnalysisRetryDecision({
    jobStatus: "queued",
    dbDeliveryCount: 2,
    maxAttempts: 3,
    queueDeliveryCount: 1,
    startedAt: null,
    nowMs,
  }),
  {
    action: "process",
    deliveryCount: 3,
    allowedStatuses: ["queued"],
    reason: "queued",
  }
);

console.log("practice-analysis retry guard passed");
