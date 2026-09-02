import { IELTS_BENCHMARK_STUDY_DESIGN_V1 } from "./study-design";

/** A criterion-level prediction from a protected benchmark label. */
export interface BenchmarkObservation {
  benchmarkId: string;
  skill?: IeltsBenchmarkSkill | "debate" | string;
  criterion: string;
  expectedBand: number;
  predictedBand: number;
  taskType: string;
  accentGroup?: string | null;
  l1Group?: string | null;
  audioQualityGroup?: string | null;
  model?: string | null;
  rubricVersion?: string | number | null;
}

/** The label-side fields needed to prove the evaluation corpus is representative. */
export interface BenchmarkCoverageObservation {
  benchmarkId: string;
  skill: IeltsBenchmarkSkill | "debate" | string;
  criterion: string;
  expectedBand: number;
  taskType: string;
  accentGroup?: string | null;
  l1Group?: string | null;
  audioQualityGroup?: string | null;
}

export type IeltsBenchmarkSkill = "ielts_speaking" | "ielts_writing";

/**
 * The task formats and four official productive-skill criteria used by this
 * application. The gate intentionally uses the exact internal question type
 * keys: a generic `writing_task_1` cannot stand in for both Task 1 variants.
 */
export const IELTS_BENCHMARK_REQUIREMENTS: Record<
  IeltsBenchmarkSkill,
  { criteria: readonly string[]; taskTypes: readonly string[] }
> = {
  ielts_speaking: {
    criteria: [
      "fluencyCoherence",
      "lexicalResource",
      "grammaticalRangeAccuracy",
      "pronunciation",
    ],
    taskTypes: ["speaking_part1", "speaking_part2_cuecard", "speaking_part3"],
  },
  ielts_writing: {
    criteria: [
      "taskResponse",
      "coherenceCohesion",
      "lexicalResource",
      "grammaticalRangeAccuracy",
    ],
    taskTypes: [
      "writing_task1_academic",
      "writing_task1_general",
      "writing_task2_essay",
    ],
  },
};

/** Half-band granularity is required because the released scorer returns halves. */
export const IELTS_BENCHMARK_REQUIRED_BANDS = [
  4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9,
] as const;

/** Independent response count required in every band/task/criterion slice. */
export const IELTS_BENCHMARK_MIN_CASES_PER_CELL = 15;
export const IELTS_BENCHMARK_MIN_CASES_PER_SLICE = 30;

export interface BenchmarkCoverageCell {
  skill: IeltsBenchmarkSkill;
  criterion: string;
  expectedBand: number;
  taskType: string;
  accentGroup: string | null;
}

export interface BenchmarkCoverageDeficit extends BenchmarkCoverageCell {
  observedBenchmarkCount: number;
  requiredBenchmarkCount: number;
}

export interface BenchmarkCoverageResult {
  passed: boolean;
  requiredCellCount: number;
  coveredCellCount: number;
  missingCells: BenchmarkCoverageCell[];
  underfilledCells: BenchmarkCoverageDeficit[];
  /** Input values that cannot satisfy a required cell and need corpus review. */
  unknownCriteria: string[];
  unknownTaskTypes: string[];
}

export interface BenchmarkMetrics {
  observationCount: number;
  withinHalfBandRate: number;
  meanSignedError: number;
  quadraticWeightedKappa: number;
  maxAbsoluteGroupBias: number;
  groupBias: Record<string, number>;
}

export interface ReleaseGateInputs {
  /** Aggregate criterion-level accuracy across all productive-skill outputs. */
  metrics: BenchmarkMetrics;
  /** Deterministic mean-of-four task bands, evaluated separately from criteria. */
  overallMetrics: BenchmarkMetrics;
  criterionKappas: Record<string, number>;
  coverage?: BenchmarkCoverageResult;
  repeatWithinHalfBandRate: number;
  overallRepeatWithinHalfBandRate: number;
  schemaSuccessRate: number;
  invalidAuthoritativeCitationCount: number;
  duplicatePaidScoringCount: number;
  strandedWorkflowCount: number;
  invalidBenchmarkLabelCount: number;
}

export interface DerivedReleaseGateInputs {
  /** Every protected criterion label, including cases whose prediction is absent. */
  expectedObservations: BenchmarkCoverageObservation[];
  observations: BenchmarkObservation[];
  /** Every protected overall label, including cases whose prediction is absent. */
  expectedOverallObservations: BenchmarkCoverageObservation[];
  overallObservations: BenchmarkObservation[];
  coverage: BenchmarkCoverageResult;
  /** Every active holdout benchmark expected to have an evaluation. */
  expectedEvaluationCount: number;
  /** Predictions which pass the task's strict output contract. */
  schemaValidPredictionCount: number;
  /** Raw repeated predictions, not a pre-computed percentage. */
  repeatPairs: Array<{
    first: BenchmarkObservation;
    second: BenchmarkObservation;
  }>;
  overallRepeatPairs: Array<{
    first: BenchmarkObservation;
    second: BenchmarkObservation;
  }>;
  /** Operational checks must be supplied by a fault-injection/reconciliation run. */
  invalidAuthoritativeCitationCount: number;
  duplicatePaidScoringCount: number;
  strandedWorkflowCount: number;
  invalidBenchmarkLabelCount: number;
}

export interface ReleaseGateResult {
  passed: boolean;
  failures: string[];
}

function snapBand(value: number): number {
  return Math.min(9, Math.max(0, Math.round(value * 2) / 2));
}

/** Matches production task-band math: mean four criteria, round-half-up. */
export function deriveIeltsTaskBand(values: readonly number[]): number | null {
  if (
    values.length !== 4 ||
    values.some((value) => !Number.isFinite(value) || value < 0 || value > 9)
  ) {
    return null;
  }
  return snapBand(values.reduce((sum, value) => sum + value, 0) / 4);
}

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizedToken(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

const CRITERION_ALIASES: Record<string, string> = {
  fluencycoherence: "fluencyCoherence",
  lexicalresource: "lexicalResource",
  grammaticalrangeaccuracy: "grammaticalRangeAccuracy",
  pronunciation: "pronunciation",
  taskresponse: "taskResponse",
  taskachievement: "taskResponse",
  coherencecohesion: "coherenceCohesion",
};

export function normalizeIeltsCriterion(criterion: string): string {
  return CRITERION_ALIASES[normalizedToken(criterion)] ?? criterion;
}

function benchmarkObservationKey(
  observation: BenchmarkObservation | BenchmarkCoverageObservation,
): string {
  return `${observation.benchmarkId}|${normalizeIeltsCriterion(observation.criterion)}`;
}

function isRequiredSkill(skill: string): skill is IeltsBenchmarkSkill {
  return skill === "ielts_speaking" || skill === "ielts_writing";
}

function cellKey(cell: BenchmarkCoverageCell): string {
  return [
    cell.skill,
    cell.criterion,
    cell.expectedBand,
    cell.taskType,
    cell.accentGroup ?? "__unlabelled__",
  ].join("|");
}

/**
 * Proves that the locked IELTS corpus covers every scorer output criterion,
 * every released half-band from 4 to 9, and every app task format. If a corpus
 * has accent labels, each supplied group must meet the same matrix; this avoids
 * hiding uneven calibration behind an aggregate score.
 */
export function validateIeltsBenchmarkCoverage(
  observations: BenchmarkCoverageObservation[],
): BenchmarkCoverageResult {
  const ielts = observations.filter(
    (
      item,
    ): item is BenchmarkCoverageObservation & { skill: IeltsBenchmarkSkill } =>
      isRequiredSkill(item.skill),
  );
  const unknownCriteria = new Set<string>();
  const unknownTaskTypes = new Set<string>();
  const observed = new Map<string, Set<string>>();
  const groupsBySkill = new Map<IeltsBenchmarkSkill, Set<string>>();

  for (const item of ielts) {
    const requirements = IELTS_BENCHMARK_REQUIREMENTS[item.skill];
    const criterion = normalizeIeltsCriterion(item.criterion);
    if (!requirements.criteria.includes(criterion))
      unknownCriteria.add(item.criterion);
    if (!requirements.taskTypes.includes(item.taskType))
      unknownTaskTypes.add(item.taskType);
    if (!Number.isFinite(item.expectedBand)) continue;
    const accentGroup = item.accentGroup?.trim() || null;
    if (accentGroup) {
      const groups = groupsBySkill.get(item.skill) ?? new Set<string>();
      groups.add(accentGroup);
      groupsBySkill.set(item.skill, groups);
    }
    const key = cellKey({
      skill: item.skill,
      criterion,
      expectedBand: snapBand(item.expectedBand),
      taskType: item.taskType,
      accentGroup,
    });
    const benchmarkIds = observed.get(key) ?? new Set<string>();
    benchmarkIds.add(item.benchmarkId);
    observed.set(key, benchmarkIds);
  }

  const required: BenchmarkCoverageCell[] = [];
  for (const skill of Object.keys(
    IELTS_BENCHMARK_REQUIREMENTS,
  ) as IeltsBenchmarkSkill[]) {
    const requirements = IELTS_BENCHMARK_REQUIREMENTS[skill];
    const suppliedGroups = [...(groupsBySkill.get(skill) ?? [])];
    const accentGroups: Array<string | null> =
      suppliedGroups.length > 0 ? suppliedGroups.sort() : [null];
    for (const criterion of requirements.criteria) {
      for (const expectedBand of IELTS_BENCHMARK_REQUIRED_BANDS) {
        for (const taskType of requirements.taskTypes) {
          for (const accentGroup of accentGroups) {
            required.push({
              skill,
              criterion,
              expectedBand,
              taskType,
              accentGroup,
            });
          }
        }
      }
    }
  }
  const underfilledCells = required.flatMap((cell) => {
    const observedBenchmarkCount = observed.get(cellKey(cell))?.size ?? 0;
    return observedBenchmarkCount < IELTS_BENCHMARK_MIN_CASES_PER_CELL
      ? [
          {
            ...cell,
            observedBenchmarkCount,
            requiredBenchmarkCount: IELTS_BENCHMARK_MIN_CASES_PER_CELL,
          },
        ]
      : [];
  });
  const missingCells = underfilledCells
    .filter((cell) => cell.observedBenchmarkCount === 0)
    .map((cell) => ({
      skill: cell.skill,
      taskType: cell.taskType,
      criterion: cell.criterion,
      expectedBand: cell.expectedBand,
      accentGroup: cell.accentGroup,
    }));
  return {
    passed:
      underfilledCells.length === 0 &&
      unknownCriteria.size === 0 &&
      unknownTaskTypes.size === 0,
    requiredCellCount: required.length,
    coveredCellCount: required.length - underfilledCells.length,
    missingCells,
    underfilledCells,
    unknownCriteria: [...unknownCriteria].sort(),
    unknownTaskTypes: [...unknownTaskTypes].sort(),
  };
}

/** Quadratic weighted kappa over half-band categories (0..18). */
export function quadraticWeightedKappa(
  expected: number[],
  predicted: number[],
): number {
  if (expected.length !== predicted.length || expected.length === 0) return 0;
  const categories = 19;
  const observed = Array.from({ length: categories }, () =>
    Array.from({ length: categories }, () => 0),
  );
  const expectedHistogram = Array.from({ length: categories }, () => 0);
  const predictedHistogram = Array.from({ length: categories }, () => 0);
  for (let index = 0; index < expected.length; index += 1) {
    const left = Math.round(snapBand(expected[index]!) * 2);
    const right = Math.round(snapBand(predicted[index]!) * 2);
    observed[left]![right]! += 1;
    expectedHistogram[left]! += 1;
    predictedHistogram[right]! += 1;
  }
  let observedDisagreement = 0;
  let chanceDisagreement = 0;
  const denominator = (categories - 1) ** 2;
  for (let left = 0; left < categories; left += 1) {
    for (let right = 0; right < categories; right += 1) {
      const weight = (left - right) ** 2 / denominator;
      observedDisagreement += weight * observed[left]![right]!;
      chanceDisagreement +=
        weight *
        ((expectedHistogram[left]! * predictedHistogram[right]!) /
          expected.length);
    }
  }
  return chanceDisagreement === 0
    ? observedDisagreement === 0
      ? 1
      : 0
    : 1 - observedDisagreement / chanceDisagreement;
}

export function evaluateBenchmark(
  observations: BenchmarkObservation[],
): BenchmarkMetrics {
  const errors = observations.map(
    (item) => snapBand(item.predictedBand) - snapBand(item.expectedBand),
  );
  const grouped = new Map<string, number[]>();
  observations.forEach((item, index) => {
    const keys = [
      `criterion:${normalizeIeltsCriterion(item.criterion)}`,
      `task:${item.taskType}`,
      ...(item.accentGroup ? [`accent:${item.accentGroup}`] : []),
      ...(item.l1Group ? [`l1:${item.l1Group}`] : []),
      ...(item.audioQualityGroup
        ? [`audio_quality:${item.audioQualityGroup}`]
        : []),
      `band:${snapBand(item.expectedBand)}`,
    ];
    for (const key of keys)
      grouped.set(key, [...(grouped.get(key) ?? []), errors[index]!]);
  });
  const groupBias = Object.fromEntries(
    [...grouped].map(([key, values]) => [key, mean(values)]),
  );
  return {
    observationCount: observations.length,
    withinHalfBandRate:
      observations.length === 0
        ? 0
        : errors.filter((error) => Math.abs(error) <= 0.5).length /
          observations.length,
    meanSignedError: mean(errors),
    quadraticWeightedKappa: quadraticWeightedKappa(
      observations.map((item) => item.expectedBand),
      observations.map((item) => item.predictedBand),
    ),
    maxAbsoluteGroupBias: Math.max(
      0,
      ...Object.values(groupBias).map((value) => Math.abs(value)),
    ),
    groupBias,
  };
}

/** Counts an absent or malformed prediction as a miss against its protected label. */
export function evaluateBenchmarkAgainstExpected(
  expectedObservations: BenchmarkCoverageObservation[],
  observations: BenchmarkObservation[],
): BenchmarkMetrics {
  const expectedByKey = new Map(
    expectedObservations.map((observation) => [
      benchmarkObservationKey(observation),
      observation,
    ]),
  );
  const observationsByKey = new Map(
    observations.map((observation) => [
      benchmarkObservationKey(observation),
      observation,
    ]),
  );
  const outcomes = [...expectedByKey].map(([key, expected]) => {
    const prediction = observationsByKey.get(key);
    return {
      expected,
      prediction,
      withinHalfBand:
        prediction !== undefined &&
        Math.abs(
          snapBand(prediction.predictedBand) - snapBand(expected.expectedBand),
        ) <= 0.5,
    };
  });
  const matchedObservations = outcomes.flatMap(({ expected, prediction }) =>
    prediction
      ? [
          {
            ...prediction,
            skill: expected.skill,
            criterion: expected.criterion,
            expectedBand: expected.expectedBand,
            taskType: expected.taskType,
            accentGroup: expected.accentGroup,
            l1Group: expected.l1Group,
            audioQualityGroup: expected.audioQualityGroup,
          },
        ]
      : [],
  );
  const observedMetrics = evaluateBenchmark(matchedObservations);
  return {
    ...observedMetrics,
    observationCount: outcomes.length,
    withinHalfBandRate:
      outcomes.length === 0
        ? 0
        : outcomes.filter((outcome) => outcome.withinHalfBand).length /
          outcomes.length,
  };
}

export function evaluateReleaseGate(
  input: ReleaseGateInputs,
): ReleaseGateResult {
  const failures: string[] = [];
  if (input.metrics.observationCount === 0) failures.push("benchmark_empty");
  if (input.coverage && !input.coverage.passed) {
    failures.push("benchmark_coverage_incomplete");
  }
  if (input.metrics.withinHalfBandRate < 0.9)
    failures.push("within_half_band_below_90pct");
  if (input.overallMetrics.observationCount === 0)
    failures.push("overall_benchmark_empty");
  if (input.overallMetrics.withinHalfBandRate < 0.9)
    failures.push("overall_within_half_band_below_90pct");
  if (input.metrics.quadraticWeightedKappa < 0.8)
    failures.push("overall_kappa_below_0_80");
  if (input.overallMetrics.quadraticWeightedKappa < 0.8)
    failures.push("task_band_kappa_below_0_80");
  for (const [criterion, kappa] of Object.entries(input.criterionKappas)) {
    if (kappa < 0.75) failures.push(`criterion_kappa_below_0_75:${criterion}`);
  }
  if (input.metrics.maxAbsoluteGroupBias >= 0.25)
    failures.push("group_bias_not_below_0_25");
  if (input.overallMetrics.maxAbsoluteGroupBias >= 0.25)
    failures.push("overall_group_bias_not_below_0_25");
  if (input.repeatWithinHalfBandRate < 0.95)
    failures.push("repeat_consistency_below_95pct");
  if (input.overallRepeatWithinHalfBandRate < 0.95)
    failures.push("overall_repeat_consistency_below_95pct");
  if (input.schemaSuccessRate < 0.995)
    failures.push("schema_success_below_99_5pct");
  if (input.invalidAuthoritativeCitationCount > 0)
    failures.push("invalid_authoritative_citations");
  if (input.duplicatePaidScoringCount > 0)
    failures.push("duplicate_paid_scoring");
  if (input.strandedWorkflowCount > 0) failures.push("stranded_workflows");
  if (input.invalidBenchmarkLabelCount > 0)
    failures.push("benchmark_labels_not_independently_adjudicated");
  return { passed: failures.length === 0, failures };
}

/** Derives every criterion kappa from the same raw prediction observations. */
export function criterionKappasFromObservations(
  observations: BenchmarkObservation[],
): Record<string, number> {
  const byCriterion = new Map<string, BenchmarkObservation[]>();
  for (const observation of observations) {
    const criterion = normalizeIeltsCriterion(observation.criterion);
    byCriterion.set(criterion, [
      ...(byCriterion.get(criterion) ?? []),
      observation,
    ]);
  }
  return Object.fromEntries(
    [...byCriterion].map(([criterion, values]) => [
      criterion,
      quadraticWeightedKappa(
        values.map((item) => item.expectedBand),
        values.map((item) => item.predictedBand),
      ),
    ]),
  );
}

/**
 * Preferred release-gate entrypoint. It derives accuracy, per-criterion,
 * schema-completion and repeat-consistency values from raw predictions rather
 * than accepting pre-computed rates from a metadata blob.
 */
export function evaluateDerivedReleaseGate(
  input: DerivedReleaseGateInputs,
): ReleaseGateResult {
  const observationKey = benchmarkObservationKey;
  const expectedByKey = new Map(
    input.expectedObservations.map((observation) => [
      observationKey(observation),
      observation,
    ]),
  );
  const observationsByKey = new Map(
    input.observations.map((observation) => [
      observationKey(observation),
      observation,
    ]),
  );
  const criterionOutcomes = [...expectedByKey].map(([key, expected]) => {
    const prediction = observationsByKey.get(key);
    const withinHalfBand =
      prediction !== undefined &&
      Math.abs(
        snapBand(prediction.predictedBand) - snapBand(expected.expectedBand),
      ) <= 0.5;
    return { expected, prediction, withinHalfBand };
  });
  const matchedObservations = criterionOutcomes.flatMap(
    ({ expected, prediction }) =>
      prediction
        ? [
            {
              ...prediction,
              skill: expected.skill,
              criterion: expected.criterion,
              expectedBand: expected.expectedBand,
              taskType: expected.taskType,
              accentGroup: expected.accentGroup,
              l1Group: expected.l1Group,
              audioQualityGroup: expected.audioQualityGroup,
            },
          ]
        : [],
  );
  const metrics = evaluateBenchmarkAgainstExpected(
    input.expectedObservations,
    input.observations,
  );

  const overallMetrics = evaluateBenchmarkAgainstExpected(
    input.expectedOverallObservations,
    input.overallObservations,
  );
  const accuracyByCell = new Map<string, boolean[]>();
  for (const { expected, withinHalfBand } of criterionOutcomes) {
    const key = cellKey({
      skill:
        expected.skill === "ielts_speaking"
          ? "ielts_speaking"
          : "ielts_writing",
      criterion: normalizeIeltsCriterion(expected.criterion),
      expectedBand: snapBand(expected.expectedBand),
      taskType: expected.taskType,
      accentGroup: expected.accentGroup?.trim() || null,
    });
    accuracyByCell.set(key, [
      ...(accuracyByCell.get(key) ?? []),
      withinHalfBand,
    ]);
  }
  const hasInaccurateCell = [...accuracyByCell.values()].some(
    (values) => values.filter(Boolean).length / values.length < 0.9,
  );
  const accuracyBySlice = new Map<string, Map<string, boolean>>();
  for (const criterion of IELTS_BENCHMARK_REQUIREMENTS.ielts_speaking
    .criteria) {
    for (const group of IELTS_BENCHMARK_STUDY_DESIGN_V1.strata.l1Groups) {
      accuracyBySlice.set(`l1:${group}|criterion:${criterion}`, new Map());
    }
    for (const group of IELTS_BENCHMARK_STUDY_DESIGN_V1.strata
      .audioQualityGroups) {
      accuracyBySlice.set(
        `audio_quality:${group}|criterion:${criterion}`,
        new Map(),
      );
    }
  }
  for (const { expected, withinHalfBand } of criterionOutcomes) {
    if (expected.skill !== "ielts_speaking") continue;
    const criterion = normalizeIeltsCriterion(expected.criterion);
    const slices = [
      ...(expected.l1Group
        ? [`l1:${expected.l1Group}|criterion:${criterion}`]
        : []),
      ...(expected.audioQualityGroup
        ? [`audio_quality:${expected.audioQualityGroup}|criterion:${criterion}`]
        : []),
    ];
    for (const slice of slices) {
      const cases = accuracyBySlice.get(slice) ?? new Map<string, boolean>();
      cases.set(expected.benchmarkId, withinHalfBand);
      accuracyBySlice.set(slice, cases);
    }
  }
  const hasUnderfilledSlice = [...accuracyBySlice.values()].some(
    (cases) => cases.size < IELTS_BENCHMARK_MIN_CASES_PER_SLICE,
  );
  const hasInaccurateSlice = [...accuracyBySlice.values()].some((cases) => {
    const results = [...cases.values()];
    return results.filter(Boolean).length / results.length < 0.9;
  });
  const repeatKey = observationKey;
  const expectedRepeatKeys = new Set(expectedByKey.keys());
  const repeatPairsByKey = new Map<
    string,
    Array<(typeof input.repeatPairs)[number]>
  >();
  for (const pair of input.repeatPairs) {
    const firstKey = repeatKey(pair.first);
    const secondKey = repeatKey(pair.second);
    if (firstKey !== secondKey) continue;
    repeatPairsByKey.set(firstKey, [
      ...(repeatPairsByKey.get(firstKey) ?? []),
      pair,
    ]);
  }
  const repeatCoverageComplete =
    expectedRepeatKeys.size > 0 &&
    [...expectedRepeatKeys].every(
      (key) => repeatPairsByKey.get(key)?.length === 1,
    );
  const oneRepeatPerObservation = [...expectedRepeatKeys].flatMap(
    (key) => repeatPairsByKey.get(key)?.slice(0, 1) ?? [],
  );
  const repeatWithinHalfBandRate =
    expectedRepeatKeys.size === 0
      ? 0
      : oneRepeatPerObservation.filter(
          ({ first, second }) =>
            Math.abs(
              snapBand(first.predictedBand) - snapBand(second.predictedBand),
            ) <= 0.5,
        ).length / expectedRepeatKeys.size;
  const overallRepeatKey = (
    observation: BenchmarkObservation | BenchmarkCoverageObservation,
  ) => observation.benchmarkId;
  const expectedOverallRepeatKeys = new Set(
    input.expectedOverallObservations.map(overallRepeatKey),
  );
  const overallPairsByKey = new Map<
    string,
    Array<(typeof input.overallRepeatPairs)[number]>
  >();
  for (const pair of input.overallRepeatPairs) {
    const firstKey = overallRepeatKey(pair.first);
    const secondKey = overallRepeatKey(pair.second);
    if (firstKey !== secondKey) continue;
    overallPairsByKey.set(firstKey, [
      ...(overallPairsByKey.get(firstKey) ?? []),
      pair,
    ]);
  }
  const overallRepeatCoverageComplete =
    expectedOverallRepeatKeys.size > 0 &&
    [...expectedOverallRepeatKeys].every(
      (key) => overallPairsByKey.get(key)?.length === 1,
    );
  const oneOverallRepeatPerObservation = [...expectedOverallRepeatKeys].flatMap(
    (key) => overallPairsByKey.get(key)?.slice(0, 1) ?? [],
  );
  const overallRepeatWithinHalfBandRate =
    expectedOverallRepeatKeys.size === 0
      ? 0
      : oneOverallRepeatPerObservation.filter(
          ({ first, second }) =>
            Math.abs(
              snapBand(first.predictedBand) - snapBand(second.predictedBand),
            ) <= 0.5,
        ).length / expectedOverallRepeatKeys.size;
  const result = evaluateReleaseGate({
    metrics,
    overallMetrics,
    criterionKappas: criterionKappasFromObservations(matchedObservations),
    coverage: input.coverage,
    repeatWithinHalfBandRate,
    overallRepeatWithinHalfBandRate,
    schemaSuccessRate:
      input.expectedEvaluationCount <= 0
        ? 0
        : input.schemaValidPredictionCount / input.expectedEvaluationCount,
    invalidAuthoritativeCitationCount: input.invalidAuthoritativeCitationCount,
    duplicatePaidScoringCount: input.duplicatePaidScoringCount,
    strandedWorkflowCount: input.strandedWorkflowCount,
    invalidBenchmarkLabelCount: input.invalidBenchmarkLabelCount,
  });
  const cellFailures = hasInaccurateCell
    ? ["cell_within_half_band_below_90pct"]
    : [];
  const sliceFailures = [
    ...(hasUnderfilledSlice ? ["slice_sample_below_30"] : []),
    ...(hasInaccurateSlice ? ["slice_within_half_band_below_90pct"] : []),
  ];
  if (
    repeatCoverageComplete &&
    overallRepeatCoverageComplete &&
    cellFailures.length === 0 &&
    sliceFailures.length === 0
  ) {
    return result;
  }
  return {
    passed: false,
    failures: [
      ...result.failures,
      ...cellFailures,
      ...sliceFailures,
      ...(repeatCoverageComplete ? [] : ["repeat_measurement_incomplete"]),
      ...(overallRepeatCoverageComplete
        ? []
        : ["overall_repeat_measurement_incomplete"]),
    ],
  };
}
