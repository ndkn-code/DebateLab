import {
  parseGradingPrediction,
  parseOperationalSafetyEvidence,
  isReleaseEligibleStoredBenchmark,
} from "@/lib/ai/benchmarks/contracts";
import {
  evaluateBenchmark,
  evaluateDerivedReleaseGate,
  normalizeIeltsCriterion,
  validateIeltsBenchmarkCoverage,
  type BenchmarkCoverageObservation,
  type BenchmarkObservation,
  type ReleaseGateResult,
} from "@/lib/ai/benchmarks/evaluate";
import { createAdminClient } from "@/lib/supabase/admin";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function evaluationRows(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(record)
    : value
      ? [record(value)]
      : [];
}

function numericBand(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const candidate = record(value).band;
  return typeof candidate === "number" && Number.isFinite(candidate)
    ? candidate
    : null;
}

function coverageFromRow(row: JsonRecord): BenchmarkCoverageObservation[] {
  const expectedCriteria = record(record(row.protected_label).criteria);
  const skill = typeof row.skill === "string" ? row.skill : "";
  const taskType = typeof row.task_type === "string" ? row.task_type : "";
  const accentGroup =
    typeof row.accent_group === "string" ? row.accent_group : null;
  return Object.entries(expectedCriteria).flatMap(([criterion, label]) => {
    const expectedBand = numericBand(label);
    return expectedBand === null
      ? []
      : [
          {
            benchmarkId: String(row.id),
            skill,
            criterion,
            expectedBand,
            taskType,
            accentGroup,
          },
        ];
  });
}

function observationsFromPrediction(params: {
  row: JsonRecord;
  prediction: unknown;
}): BenchmarkObservation[] {
  const skill = typeof params.row.skill === "string" ? params.row.skill : "";
  const parsed = parseGradingPrediction(skill, params.prediction);
  if (!parsed) return [];
  const expectedCriteria = record(record(params.row.protected_label).criteria);
  return Object.entries(expectedCriteria).flatMap(([criterion, label]) => {
    const expectedBand = numericBand(label);
    const predictedBand = parsed.criteria[normalizeIeltsCriterion(criterion)];
    if (expectedBand === null || typeof predictedBand !== "number") return [];
    return [
      {
        benchmarkId: String(params.row.id),
        skill,
        criterion,
        expectedBand,
        predictedBand,
        taskType:
          typeof params.row.task_type === "string" ? params.row.task_type : "",
        accentGroup:
          typeof params.row.accent_group === "string"
            ? params.row.accent_group
            : null,
        l1Group:
          typeof record(params.row.metadata).l1Group === "string"
            ? String(record(params.row.metadata).l1Group)
            : null,
        audioQualityGroup:
          typeof record(params.row.metadata).audioQualityGroup === "string"
            ? String(record(params.row.metadata).audioQualityGroup)
            : null,
      },
    ];
  });
}

function matchingRepeatPairs(params: {
  row: JsonRecord;
  primary: BenchmarkObservation[];
  repeatPrediction: unknown;
}) {
  const repeated = observationsFromPrediction({
    row: params.row,
    prediction: params.repeatPrediction,
  });
  const repeatedByCriterion = new Map(
    repeated.map((item) => [item.criterion, item]),
  );
  return params.primary.flatMap((first) => {
    const second = repeatedByCriterion.get(first.criterion);
    return second ? [{ first, second }] : [];
  });
}

function operationalEvidence(rows: JsonRecord[]) {
  const evidence = rows
    .map((row) =>
      parseOperationalSafetyEvidence(
        record(row.run_metadata).operationalSafetyEvidence,
      ),
    )
    .filter((value): value is NonNullable<typeof value> => value !== null);
  if (evidence.length !== rows.length || rows.length === 0) return null;
  const unique = new Map(
    evidence.map((value) => [JSON.stringify(value), value]),
  );
  return unique.size === 1 ? [...unique.values()][0]! : null;
}

async function main() {
  const graderVersion = process.env.AI_GRADING_GATE_VERSION;
  const corpusVersion = Number(process.env.AI_GRADING_GATE_CORPUS_VERSION);
  if (
    !graderVersion ||
    !Number.isInteger(corpusVersion) ||
    corpusVersion <= 0
  ) {
    throw new Error(
      "AI_GRADING_GATE_VERSION and a positive AI_GRADING_GATE_CORPUS_VERSION are required",
    );
  }
  const client = createAdminClient();
  // The service-role process is the only component allowed to read these gold
  // labels. Nothing below emits a label or benchmark response to stdout.
  const { data, error } = await client
    .from("ai_grading_benchmarks")
    .select(
      "id, skill, task_type, accent_group, protected_label, metadata, ai_grading_evaluations(prediction, grader_version, corpus_version, run_metadata)",
    )
    .eq("split", "holdout")
    .eq("is_active", true);
  if (error) throw new Error(`grading gate query failed: ${error.message}`);

  const benchmarkRows = (data ?? []).map(record);
  const coverage = validateIeltsBenchmarkCoverage(
    benchmarkRows.flatMap(coverageFromRow),
  );
  const observations: BenchmarkObservation[] = [];
  const repeats: Array<{
    first: BenchmarkObservation;
    second: BenchmarkObservation;
  }> = [];
  const selectedEvaluations: JsonRecord[] = [];
  let schemaValidPredictionCount = 0;

  for (const row of benchmarkRows) {
    const evaluation = evaluationRows(row.ai_grading_evaluations).find(
      (candidate) =>
        candidate.grader_version === graderVersion &&
        candidate.corpus_version === corpusVersion,
    );
    if (!evaluation) continue;
    selectedEvaluations.push(evaluation);
    const primary = observationsFromPrediction({
      row,
      prediction: evaluation.prediction,
    });
    // A complete criterion-level set is the schema-success denominator. A
    // malformed/incomplete stored JSON document counts as a failed output.
    if (primary.length === coverageFromRow(row).length && primary.length > 0) {
      schemaValidPredictionCount += 1;
    }
    observations.push(...primary);
    const repeatPredictions = record(evaluation.run_metadata).repeatPredictions;
    if (Array.isArray(repeatPredictions)) {
      for (const repeatPrediction of repeatPredictions) {
        repeats.push(
          ...matchingRepeatPairs({ row, primary, repeatPrediction }),
        );
      }
    }
  }

  const safety = operationalEvidence(selectedEvaluations);
  const base = evaluateDerivedReleaseGate({
    observations,
    coverage,
    expectedEvaluationCount: benchmarkRows.length,
    schemaValidPredictionCount,
    repeatPairs: repeats,
    expectedRepeatPairCount: observations.length,
    invalidAuthoritativeCitationCount:
      safety?.invalidAuthoritativeCitationCount ?? 0,
    duplicatePaidScoringCount: safety?.duplicatePaidScoringCount ?? 0,
    strandedWorkflowCount: safety?.strandedWorkflowCount ?? 0,
    invalidBenchmarkLabelCount: benchmarkRows.filter(
      (row) =>
        !isReleaseEligibleStoredBenchmark({
          skill: row.skill,
          accentGroup: row.accent_group,
          protectedLabel: row.protected_label,
          metadata: row.metadata,
        }),
    ).length,
  });
  const result: ReleaseGateResult = safety
    ? base
    : {
        passed: false,
        failures: [
          ...base.failures,
          "operational_safety_evidence_missing_or_inconsistent",
        ],
      };
  const metrics = evaluateBenchmark(observations);
  process.stdout.write(
    `${JSON.stringify(
      {
        graderVersion,
        corpusVersion,
        metrics,
        coverage: {
          passed: coverage.passed,
          requiredCellCount: coverage.requiredCellCount,
          coveredCellCount: coverage.coveredCellCount,
          missingCellCount: coverage.missingCells.length,
          unknownCriteria: coverage.unknownCriteria,
          unknownTaskTypes: coverage.unknownTaskTypes,
        },
        evaluationCount: benchmarkRows.length,
        schemaValidPredictionCount,
        repeatPairCount: repeats.length,
        ...result,
      },
      null,
      2,
    )}\n`,
  );
  if (!result.passed) process.exitCode = 1;
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
