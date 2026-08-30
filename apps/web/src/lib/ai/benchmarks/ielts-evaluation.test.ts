import assert from "node:assert/strict";

import { parseGradingPrediction } from "./contracts";
import {
  isIeltsPredictionSchemaValid,
  summarizeIeltsEvaluation,
} from "./ielts-evaluation";
import {
  IELTS_EVALUATION_FIXTURES,
  IELTS_INVALID_PREDICTION_FIXTURES,
  validSpeaking,
  validWriting,
} from "./ielts-evaluation-fixtures";

assert.equal(isIeltsPredictionSchemaValid("ielts_writing", validWriting), true);
assert.equal(
  isIeltsPredictionSchemaValid("ielts_speaking", validSpeaking),
  true,
);
assert.equal(isIeltsPredictionSchemaValid("debate", validWriting), false);
for (const fixture of IELTS_INVALID_PREDICTION_FIXTURES)
  assert.equal(isIeltsPredictionSchemaValid("ielts_writing", fixture), false);
assert.equal(
  parseGradingPrediction("ielts_writing", validWriting)?.criteria.taskResponse,
  6.25,
);

const metrics = summarizeIeltsEvaluation(IELTS_EVALUATION_FIXTURES);
assert.equal(metrics.benchmark.observationCount, 6);
assert.equal(metrics.schema.validCount, 5);
assert.equal(metrics.schema.successRate, 5 / 6);
assert.equal(metrics.workflow.runCount, 5);
assert.equal(metrics.workflow.completedCount, 2);
assert.equal(metrics.workflow.retryCount, 2);
assert.equal(metrics.workflow.terminalFailureCount, 1);
assert.equal(metrics.workflow.strandedCount, 1);
assert.equal(metrics.provider.requestCount, 3);
assert.equal(metrics.provider.failedRequestCount, 1);
assert.equal(metrics.provider.totalCostUsd, 0.012);
assert.equal(metrics.provider.medianLatencyMs, 1500);
assert.equal(metrics.provider.p95LatencyMs, 3000);
assert.deepEqual(metrics.confidence.byLevel, {
  limited: 1,
  medium: 2,
  high: 1,
});
assert.equal(metrics.confidence.limitedRate, 0.25);
assert.equal(metrics.teacherDelta.count, 3);
assert.equal(metrics.teacherDelta.meanSignedDelta, 0);
assert.equal(metrics.teacherDelta.meanAbsoluteDelta, 1 / 3);
assert.equal(metrics.teacherDelta.withinHalfBandRate, 1);
assert.equal(
  metrics.teacherDelta.byCriterion.taskResponse.meanSignedDelta,
  -0.5,
);

const freshCutoff = summarizeIeltsEvaluation({
  ...IELTS_EVALUATION_FIXTURES,
  staleBefore: "2026-08-29T10:00:00.000Z",
});
assert.equal(freshCutoff.workflow.strandedCount, 0);
assert.equal(
  summarizeIeltsEvaluation({
    ...IELTS_EVALUATION_FIXTURES,
    observations: [],
    schemaValidPredictionCount: 99,
    workflowRuns: [],
    providerRequests: [],
    confidenceLevels: [],
    teacherDeltas: [],
    staleBefore: "not-a-date",
  }).schema.successRate,
  0,
);

console.log("IELTS evaluation fixtures and monitoring metrics tests passed");
