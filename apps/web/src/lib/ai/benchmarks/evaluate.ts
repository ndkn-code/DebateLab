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

export interface BenchmarkCoverageCell {
  skill: IeltsBenchmarkSkill;
  criterion: string;
  expectedBand: number;
  taskType: string;
  accentGroup: string | null;
}

export interface BenchmarkCoverageResult {
  passed: boolean;
  requiredCellCount: number;
  coveredCellCount: number;
  missingCells: BenchmarkCoverageCell[];
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
  metrics: BenchmarkMetrics;
  criterionKappas: Record<string, number>;
  coverage?: BenchmarkCoverageResult;
  repeatWithinHalfBandRate: number;
  schemaSuccessRate: number;
  invalidAuthoritativeCitationCount: number;
  duplicatePaidScoringCount: number;
  strandedWorkflowCount: number;
  invalidBenchmarkLabelCount: number;
}

export interface DerivedReleaseGateInputs {
  observations: BenchmarkObservation[];
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
  /** One paired repeat is required for every predicted criterion observation. */
  expectedRepeatPairCount: number;
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
  const observed = new Set<string>();
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
    observed.add(
      cellKey({
        skill: item.skill,
        criterion,
        expectedBand: snapBand(item.expectedBand),
        taskType: item.taskType,
        accentGroup,
      }),
    );
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
  const missingCells = required.filter((cell) => !observed.has(cellKey(cell)));
  return {
    passed:
      missingCells.length === 0 &&
      unknownCriteria.size === 0 &&
      unknownTaskTypes.size === 0,
    requiredCellCount: required.length,
    coveredCellCount: required.length - missingCells.length,
    missingCells,
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
  if (input.metrics.quadraticWeightedKappa < 0.8)
    failures.push("overall_kappa_below_0_80");
  for (const [criterion, kappa] of Object.entries(input.criterionKappas)) {
    if (kappa < 0.75) failures.push(`criterion_kappa_below_0_75:${criterion}`);
  }
  if (input.metrics.maxAbsoluteGroupBias >= 0.25)
    failures.push("group_bias_not_below_0_25");
  if (input.repeatWithinHalfBandRate < 0.95)
    failures.push("repeat_consistency_below_95pct");
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
  const metrics = evaluateBenchmark(input.observations);
  const repeatCoverageComplete =
    input.expectedRepeatPairCount > 0 &&
    input.repeatPairs.length >= input.expectedRepeatPairCount;
  const repeatWithinHalfBandRate =
    input.repeatPairs.length === 0
      ? 0
      : input.repeatPairs.filter(
          ({ first, second }) =>
            Math.abs(
              snapBand(first.predictedBand) - snapBand(second.predictedBand),
            ) <= 0.5,
        ).length / input.repeatPairs.length;
  const result = evaluateReleaseGate({
    metrics,
    criterionKappas: criterionKappasFromObservations(input.observations),
    coverage: input.coverage,
    repeatWithinHalfBandRate,
    schemaSuccessRate:
      input.expectedEvaluationCount <= 0
        ? 0
        : input.schemaValidPredictionCount / input.expectedEvaluationCount,
    invalidAuthoritativeCitationCount: input.invalidAuthoritativeCitationCount,
    duplicatePaidScoringCount: input.duplicatePaidScoringCount,
    strandedWorkflowCount: input.strandedWorkflowCount,
    invalidBenchmarkLabelCount: input.invalidBenchmarkLabelCount,
  });
  if (repeatCoverageComplete) return result;
  return {
    passed: false,
    failures: [...result.failures, "repeat_measurement_incomplete"],
  };
}
