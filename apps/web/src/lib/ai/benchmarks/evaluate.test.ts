import assert from "node:assert/strict";

import {
  IELTS_BENCHMARK_REQUIRED_BANDS,
  IELTS_BENCHMARK_MIN_CASES_PER_CELL,
  IELTS_BENCHMARK_REQUIREMENTS,
  criterionKappasFromObservations,
  deriveIeltsTaskBand,
  evaluateDerivedReleaseGate,
  evaluateBenchmark,
  evaluateBenchmarkAgainstExpected,
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
assert.equal(deriveIeltsTaskBand([6, 6.5, 7, 7.5]), 7);
assert.equal(deriveIeltsTaskBand([6, 6.5, 7]), null);

const metrics = evaluateBenchmark([
  {
    benchmarkId: "1",
    criterion: "lexical",
    expectedBand: 6,
    predictedBand: 6,
    taskType: "speaking_part_2",
    accentGroup: "vi",
    l1Group: "Vietnamese",
    audioQualityGroup: "typical_device",
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
assert.equal(metrics.groupBias["l1:Vietnamese"], 0);
assert.equal(metrics.groupBias["audio_quality:typical_device"], 0);

const gate = evaluateReleaseGate({
  metrics: {
    ...metrics,
    observationCount: 100,
    quadraticWeightedKappa: 0.9,
    maxAbsoluteGroupBias: 0.1,
  },
  overallMetrics: {
    ...metrics,
    observationCount: 25,
    quadraticWeightedKappa: 0.9,
    maxAbsoluteGroupBias: 0.1,
  },
  criterionKappas: { lexical: 0.8, grammar: 0.81 },
  repeatWithinHalfBandRate: 0.96,
  overallRepeatWithinHalfBandRate: 0.96,
  schemaSuccessRate: 0.999,
  invalidAuthoritativeCitationCount: 0,
  duplicatePaidScoringCount: 0,
  strandedWorkflowCount: 0,
  invalidBenchmarkLabelCount: 0,
});
assert.deepEqual(gate, { passed: true, failures: [] });

const completeCoverage = Object.entries(IELTS_BENCHMARK_REQUIREMENTS).flatMap(
  ([skill, requirement]) =>
    requirement.criteria.flatMap((criterion) =>
      requirement.taskTypes.flatMap((taskType) =>
        IELTS_BENCHMARK_REQUIRED_BANDS.flatMap((expectedBand) =>
          Array.from(
            { length: IELTS_BENCHMARK_MIN_CASES_PER_CELL },
            (_, sampleIndex) => ({
              benchmarkId: `${skill}:${criterion}:${taskType}:${expectedBand}:${sampleIndex}`,
              skill,
              criterion,
              expectedBand,
              taskType,
              l1Group:
                skill === "ielts_speaking"
                  ? sampleIndex % 2 === 0
                    ? "vi"
                    : "other_documented"
                  : null,
              audioQualityGroup:
                skill === "ielts_speaking"
                  ? (
                      [
                        "studio",
                        "quiet_room",
                        "typical_device",
                        "degraded",
                      ] as const
                    )[sampleIndex % 4]
                  : null,
            }),
          ),
        ),
      ),
    ),
);
const coverage = validateIeltsBenchmarkCoverage(completeCoverage);
assert.equal(coverage.passed, true);
assert.equal(coverage.missingCells.length, 0);
assert.equal(coverage.underfilledCells.length, 0);

const perfectOverallObservations = completeCoverage.map((item) => ({
  ...item,
  criterion: "overall",
  predictedBand: item.expectedBand,
}));
const perfectOverallRepeatPairs = perfectOverallObservations.map(
  (observation) => ({ first: observation, second: observation }),
);

const underfilledCoverage = validateIeltsBenchmarkCoverage(
  completeCoverage.filter(
    (row) =>
      row.benchmarkId !==
      `ielts_speaking:pronunciation:speaking_part1:4:${IELTS_BENCHMARK_MIN_CASES_PER_CELL - 1}`,
  ),
);
assert.equal(underfilledCoverage.passed, false);
assert.ok(
  underfilledCoverage.underfilledCells.some(
    (cell) =>
      cell.skill === "ielts_speaking" &&
      cell.criterion === "pronunciation" &&
      cell.taskType === "speaking_part1" &&
      cell.expectedBand === 4 &&
      cell.observedBenchmarkCount === IELTS_BENCHMARK_MIN_CASES_PER_CELL - 1,
  ),
);

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
      {
        benchmarkKey: "one",
        runs: [
          {
            runKind: "primary",
            prediction: {},
            providerRequestId: "00000000-0000-4000-8000-000000000001",
          },
          {
            runKind: "repeat",
            prediction: {},
            providerRequestId: "00000000-0000-4000-8000-000000000002",
          },
        ],
      },
      {
        benchmarkKey: "one",
        runs: [
          {
            runKind: "primary",
            prediction: {},
            providerRequestId: "00000000-0000-4000-8000-000000000003",
          },
          {
            runKind: "repeat",
            prediction: {},
            providerRequestId: "00000000-0000-4000-8000-000000000004",
          },
        ],
      },
    ],
  }),
);
assert.throws(() =>
  parseBenchmarkEvaluationImport({
    graderVersion: "v1",
    corpusVersion: 1,
    evaluations: [
      {
        benchmarkKey: "copied-repeat",
        runs: [
          {
            runKind: "primary",
            prediction: {},
            providerRequestId: "00000000-0000-4000-8000-000000000005",
          },
          {
            runKind: "repeat",
            prediction: {},
            providerRequestId: "00000000-0000-4000-8000-000000000005",
          },
        ],
      },
    ],
  }),
);

const derived = evaluateDerivedReleaseGate({
  expectedObservations: completeCoverage,
  observations: completeCoverage.map((item) => ({
    ...item,
    predictedBand: item.expectedBand,
  })),
  expectedOverallObservations: perfectOverallObservations,
  overallObservations: perfectOverallObservations,
  coverage,
  expectedEvaluationCount: completeCoverage.length,
  schemaValidPredictionCount: completeCoverage.length,
  repeatPairs: completeCoverage.map((item) => {
    const observation = { ...item, predictedBand: item.expectedBand };
    return { first: observation, second: observation };
  }),
  overallRepeatPairs: perfectOverallRepeatPairs,
  invalidAuthoritativeCitationCount: 0,
  duplicatePaidScoringCount: 0,
  strandedWorkflowCount: 0,
  invalidBenchmarkLabelCount: 0,
});
assert.equal(derived.passed, true);

const cellCorruptedObservations = completeCoverage.map((item) => ({
  ...item,
  predictedBand:
    item.skill === "ielts_speaking" &&
    item.criterion === "pronunciation" &&
    item.taskType === "speaking_part3" &&
    item.expectedBand === 6
      ? 7
      : item.expectedBand,
}));
const cellCorrupted = evaluateDerivedReleaseGate({
  expectedObservations: completeCoverage,
  observations: cellCorruptedObservations,
  expectedOverallObservations: perfectOverallObservations,
  overallObservations: perfectOverallObservations,
  coverage,
  expectedEvaluationCount: completeCoverage.length,
  schemaValidPredictionCount: completeCoverage.length,
  repeatPairs: cellCorruptedObservations.map((observation) => ({
    first: observation,
    second: observation,
  })),
  overallRepeatPairs: perfectOverallRepeatPairs,
  invalidAuthoritativeCitationCount: 0,
  duplicatePaidScoringCount: 0,
  strandedWorkflowCount: 0,
  invalidBenchmarkLabelCount: 0,
});
assert.equal(cellCorrupted.passed, false);
assert.ok(cellCorrupted.failures.includes("cell_within_half_band_below_90pct"));

const missingCellKeys = new Set(
  completeCoverage
    .filter(
      (item) =>
        item.skill === "ielts_writing" &&
        item.criterion === "taskResponse" &&
        item.taskType === "writing_task1_academic" &&
        item.expectedBand === 4,
    )
    .slice(0, 2)
    .map((item) => item.benchmarkId),
);
assert.equal(missingCellKeys.size, 2);
const observationsWithTwoMissing = completeCoverage
  .filter((item) => !missingCellKeys.has(item.benchmarkId))
  .map((item) => ({ ...item, predictedBand: item.expectedBand }));
const metricsWithTwoMissing = evaluateBenchmarkAgainstExpected(
  completeCoverage,
  observationsWithTwoMissing,
);
assert.equal(metricsWithTwoMissing.observationCount, completeCoverage.length);
assert.equal(
  metricsWithTwoMissing.withinHalfBandRate,
  (completeCoverage.length - 2) / completeCoverage.length,
);
const overallWithTwoMissing = perfectOverallObservations.filter(
  (item) => !missingCellKeys.has(item.benchmarkId),
);
const twoMissingInOneCell = evaluateDerivedReleaseGate({
  expectedObservations: completeCoverage,
  observations: observationsWithTwoMissing,
  expectedOverallObservations: perfectOverallObservations,
  overallObservations: overallWithTwoMissing,
  coverage,
  expectedEvaluationCount: completeCoverage.length,
  schemaValidPredictionCount: completeCoverage.length - 2,
  repeatPairs: observationsWithTwoMissing.map((observation) => ({
    first: observation,
    second: observation,
  })),
  overallRepeatPairs: overallWithTwoMissing.map((observation) => ({
    first: observation,
    second: observation,
  })),
  invalidAuthoritativeCitationCount: 0,
  duplicatePaidScoringCount: 0,
  strandedWorkflowCount: 0,
  invalidBenchmarkLabelCount: 0,
});
assert.equal(twoMissingInOneCell.passed, false);
assert.ok(
  twoMissingInOneCell.failures.includes("cell_within_half_band_below_90pct"),
);
assert.ok(
  twoMissingInOneCell.failures.includes("repeat_measurement_incomplete"),
);
assert.ok(
  twoMissingInOneCell.failures.includes(
    "overall_repeat_measurement_incomplete",
  ),
);
assert.equal(
  twoMissingInOneCell.failures.includes("schema_success_below_99_5pct"),
  false,
);

const missingDeclaredSlices = completeCoverage.map((item) => ({
  ...item,
  l1Group: item.skill === "ielts_speaking" ? "vi" : null,
  audioQualityGroup: item.skill === "ielts_speaking" ? "studio" : null,
}));
const missingDeclaredSliceObservations = missingDeclaredSlices.map((item) => ({
  ...item,
  predictedBand: item.expectedBand,
}));
const missingDeclaredSliceGate = evaluateDerivedReleaseGate({
  expectedObservations: missingDeclaredSlices,
  observations: missingDeclaredSliceObservations,
  expectedOverallObservations: perfectOverallObservations,
  overallObservations: perfectOverallObservations,
  coverage,
  expectedEvaluationCount: completeCoverage.length,
  schemaValidPredictionCount: completeCoverage.length,
  repeatPairs: missingDeclaredSliceObservations.map((observation) => ({
    first: observation,
    second: observation,
  })),
  overallRepeatPairs: perfectOverallRepeatPairs,
  invalidAuthoritativeCitationCount: 0,
  duplicatePaidScoringCount: 0,
  strandedWorkflowCount: 0,
  invalidBenchmarkLabelCount: 0,
});
assert.equal(missingDeclaredSliceGate.passed, false);
assert.ok(missingDeclaredSliceGate.failures.includes("slice_sample_below_30"));

const selectedSliceCells = new Set<string>();
const sparseBadSliceObservations = completeCoverage.map((item) => {
  const cell = `${item.skill}|${item.criterion}|${item.taskType}|${item.expectedBand}`;
  const useForSlice =
    item.skill === "ielts_speaking" &&
    selectedSliceCells.size < 10 &&
    !selectedSliceCells.has(cell);
  if (useForSlice) selectedSliceCells.add(cell);
  return {
    ...item,
    predictedBand: useForSlice
      ? Math.min(9, item.expectedBand + 1)
      : item.expectedBand,
    l1Group: useForSlice ? "underfilled-test-group" : null,
    audioQualityGroup: useForSlice ? "degraded" : null,
  };
});
const sparseBadSlice = evaluateDerivedReleaseGate({
  expectedObservations: sparseBadSliceObservations,
  observations: sparseBadSliceObservations,
  expectedOverallObservations: perfectOverallObservations,
  overallObservations: perfectOverallObservations,
  coverage,
  expectedEvaluationCount: completeCoverage.length,
  schemaValidPredictionCount: completeCoverage.length,
  repeatPairs: sparseBadSliceObservations.map((observation) => ({
    first: observation,
    second: observation,
  })),
  overallRepeatPairs: perfectOverallRepeatPairs,
  invalidAuthoritativeCitationCount: 0,
  duplicatePaidScoringCount: 0,
  strandedWorkflowCount: 0,
  invalidBenchmarkLabelCount: 0,
});
assert.equal(sparseBadSlice.passed, false);
assert.ok(sparseBadSlice.failures.includes("slice_sample_below_30"));
assert.ok(
  sparseBadSlice.failures.includes("slice_within_half_band_below_90pct"),
);

const firstObservation = {
  ...completeCoverage[0]!,
  predictedBand: completeCoverage[0]!.expectedBand,
};
const concentratedRepeats = evaluateDerivedReleaseGate({
  expectedObservations: completeCoverage,
  observations: completeCoverage.map((item) => ({
    ...item,
    predictedBand: item.expectedBand,
  })),
  expectedOverallObservations: perfectOverallObservations,
  overallObservations: perfectOverallObservations,
  coverage,
  expectedEvaluationCount: completeCoverage.length,
  schemaValidPredictionCount: completeCoverage.length,
  repeatPairs: Array.from({ length: completeCoverage.length }, () => ({
    first: firstObservation,
    second: firstObservation,
  })),
  overallRepeatPairs: perfectOverallRepeatPairs,
  invalidAuthoritativeCitationCount: 0,
  duplicatePaidScoringCount: 0,
  strandedWorkflowCount: 0,
  invalidBenchmarkLabelCount: 0,
});
assert.equal(concentratedRepeats.passed, false);
assert.ok(
  concentratedRepeats.failures.includes("repeat_measurement_incomplete"),
);
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
