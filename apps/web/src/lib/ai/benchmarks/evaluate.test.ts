import assert from "node:assert/strict";

import {
  IELTS_BENCHMARK_REQUIRED_BANDS,
  IELTS_BENCHMARK_REQUIREMENTS,
  criterionKappasFromObservations,
  evaluateDerivedReleaseGate,
  evaluateBenchmark,
  evaluateReleaseGate,
  quadraticWeightedKappa,
  validateIeltsBenchmarkCoverage,
} from "./evaluate";
import {
  parseBenchmarkEvaluationImport,
  parseGradingPrediction,
} from "./contracts";

assert.equal(quadraticWeightedKappa([4, 5, 6, 7], [4, 5, 6, 7]), 1);
assert.ok(quadraticWeightedKappa([4, 5, 6, 7], [7, 6, 5, 4]) < 0);

const metrics = evaluateBenchmark([
  {
    benchmarkId: "1",
    criterion: "lexical",
    expectedBand: 6,
    predictedBand: 6,
    taskType: "speaking_part_2",
    accentGroup: "vi",
  },
  {
    benchmarkId: "2",
    criterion: "grammar",
    expectedBand: 7,
    predictedBand: 7.5,
    taskType: "writing_task_2",
  },
]);
assert.equal(metrics.withinHalfBandRate, 1);
assert.equal(metrics.meanSignedError, 0.25);

const gate = evaluateReleaseGate({
  metrics: {
    ...metrics,
    observationCount: 100,
    quadraticWeightedKappa: 0.9,
    maxAbsoluteGroupBias: 0.1,
  },
  criterionKappas: { lexical: 0.8, grammar: 0.81 },
  repeatWithinHalfBandRate: 0.96,
  schemaSuccessRate: 0.999,
  invalidAuthoritativeCitationCount: 0,
  duplicatePaidScoringCount: 0,
  strandedWorkflowCount: 0,
});
assert.deepEqual(gate, { passed: true, failures: [] });

const completeCoverage = Object.entries(IELTS_BENCHMARK_REQUIREMENTS).flatMap(
  ([skill, requirement]) =>
    requirement.criteria.flatMap((criterion) =>
      requirement.taskTypes.flatMap((taskType) =>
        IELTS_BENCHMARK_REQUIRED_BANDS.map((expectedBand) => ({
          benchmarkId: `${skill}:${criterion}:${taskType}:${expectedBand}`,
          skill,
          criterion,
          expectedBand,
          taskType,
        })),
      ),
    ),
);
const coverage = validateIeltsBenchmarkCoverage(completeCoverage);
assert.equal(coverage.passed, true);
assert.equal(coverage.missingCells.length, 0);

const missingAccentCoverage = validateIeltsBenchmarkCoverage(
  completeCoverage.map((row, index) =>
    index === 0 ? { ...row, accentGroup: "vi" } : row,
  ),
);
assert.equal(missingAccentCoverage.passed, false);
assert.ok(missingAccentCoverage.missingCells.length > 0);

assert.deepEqual(
  parseGradingPrediction("ielts_speaking", {
    criteria: {
      fluencyCoherence: { band: 7 },
      lexicalResource: { band: 7 },
      grammaticalRangeAccuracy: { band: 7 },
      pronunciation: { band: 7 },
    },
  }),
  {
    criteria: {
      fluencyCoherence: 7,
      lexicalResource: 7,
      grammaticalRangeAccuracy: 7,
      pronunciation: 7,
    },
  },
);
assert.equal(
  parseGradingPrediction("ielts_writing", { criteria: { taskResponse: 7 } }),
  null,
);
assert.throws(() =>
  parseBenchmarkEvaluationImport({
    graderVersion: "v1",
    corpusVersion: 1,
    evaluations: [
      { benchmarkKey: "one", prediction: {} },
      { benchmarkKey: "one", prediction: {} },
    ],
  }),
);

const derived = evaluateDerivedReleaseGate({
  observations: completeCoverage.map((item) => ({
    ...item,
    predictedBand: item.expectedBand,
  })),
  coverage,
  expectedEvaluationCount: completeCoverage.length,
  schemaValidPredictionCount: completeCoverage.length,
  repeatPairs: completeCoverage.map((item) => {
    const observation = { ...item, predictedBand: item.expectedBand };
    return { first: observation, second: observation };
  }),
  expectedRepeatPairCount: completeCoverage.length,
  invalidAuthoritativeCitationCount: 0,
  duplicatePaidScoringCount: 0,
  strandedWorkflowCount: 0,
});
assert.equal(derived.passed, true);
assert.equal(
  criterionKappasFromObservations(
    completeCoverage.map((item) => ({
      ...item,
      predictedBand: item.expectedBand,
    })),
  ).pronunciation,
  1,
);

console.log("AI benchmark evaluator tests passed");
