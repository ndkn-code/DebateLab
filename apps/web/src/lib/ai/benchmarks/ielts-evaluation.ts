import {
  evaluateBenchmark,
  type BenchmarkObservation,
  type IeltsBenchmarkSkill,
} from "./evaluate";
import { parseGradingPrediction } from "./contracts";

/** The bounded confidence vocabulary emitted by staged IELTS grading metadata. */
export const IELTS_CONFIDENCE_LEVELS = ["limited", "medium", "high"] as const;
export type IeltsConfidenceLevel = (typeof IELTS_CONFIDENCE_LEVELS)[number];

/** Provider output types owned by the IELTS productive-skill scorer. */
export const IELTS_EVALUATION_OUTPUT_TYPES = [
  "ielts_writing_score",
  "ielts_writing_score_adjudication",
  "ielts_speaking_score",
  "ielts_speaking_score_adjudication",
] as const;

/** A deliberately structural view of provider telemetry. */
export interface IeltsProviderTelemetryRow {
  id: string;
  output_type: string | null;
  status: "success" | "error";
  latency_ms: number | null;
  estimated_cost_usd: number | string | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
}

/** A deliberately structural view of the durable workflow telemetry row. */
export interface IeltsWorkflowTelemetryRow {
  id: string;
  workflow_kind: string;
  status:
    | "queued"
    | "starting"
    | "running"
    | "core_completed"
    | "completed"
    | "failed"
    | "cancelled";
  workflow_attempt_count: number;
  provider_attempt_count: number;
  updated_at: string;
  last_error_code?: string | null;
}

export interface IeltsTeacherDeltaObservation {
  benchmarkId: string;
  skill: IeltsBenchmarkSkill;
  criterion: string;
  aiBand: number;
  teacherBand: number;
}

export interface IeltsEvaluationMetrics {
  benchmark: ReturnType<typeof evaluateBenchmark>;
  schema: {
    evaluatedCount: number;
    validCount: number;
    successRate: number;
  };
  workflow: {
    runCount: number;
    completedCount: number;
    retryCount: number;
    retryRate: number;
    terminalFailureCount: number;
    terminalFailureRate: number;
    strandedCount: number;
    strandedRate: number;
  };
  provider: {
    requestCount: number;
    successfulRequestCount: number;
    failedRequestCount: number;
    errorRate: number;
    totalCostUsd: number;
    averageCostUsd: number | null;
    medianLatencyMs: number | null;
    p95LatencyMs: number | null;
  };
  confidence: {
    count: number;
    byLevel: Record<IeltsConfidenceLevel, number>;
    limitedRate: number | null;
  };
  teacherDelta: {
    count: number;
    meanSignedDelta: number | null;
    meanAbsoluteDelta: number | null;
    withinHalfBandRate: number | null;
    byCriterion: Record<string, { count: number; meanSignedDelta: number }>;
  };
}

export interface IeltsEvaluationInput {
  observations: BenchmarkObservation[];
  /** Count of predictions passing the production Zod output contract. */
  schemaValidPredictionCount: number;
  workflowRuns: IeltsWorkflowTelemetryRow[];
  providerRequests: IeltsProviderTelemetryRow[];
  confidenceLevels?: IeltsConfidenceLevel[];
  teacherDeltas?: IeltsTeacherDeltaObservation[];
  /** Deterministic cutoff. A nonterminal run is stranded only when updated_at is earlier. */
  staleBefore: string;
}

function numeric(value: number | string | null | undefined): number {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : 0;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1]! + sorted[middle]!) / 2)
    : sorted[middle]!;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentileValue * sorted.length) - 1),
  );
  return sorted[index]!;
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function isIeltsSkill(skill: string | undefined): skill is IeltsBenchmarkSkill {
  return skill === "ielts_speaking" || skill === "ielts_writing";
}

function isIeltsWorkflow(row: IeltsWorkflowTelemetryRow): boolean {
  return (
    row.workflow_kind === "ielts_speaking_score" ||
    row.workflow_kind === "ielts_writing_score"
  );
}

export function isIeltsProviderOutputType(outputType: string | null): boolean {
  return (IELTS_EVALUATION_OUTPUT_TYPES as readonly string[]).includes(
    outputType ?? "",
  );
}

function isStaleNonterminal(
  row: IeltsWorkflowTelemetryRow,
  staleBeforeMs: number,
): boolean {
  if (
    row.status === "completed" ||
    row.status === "failed" ||
    row.status === "cancelled"
  )
    return false;
  const updatedAtMs = Date.parse(row.updated_at);
  return Number.isFinite(updatedAtMs) && updatedAtMs < staleBeforeMs;
}

/** Validates a model payload using the productive-skill benchmark contract. */
export function isIeltsPredictionSchemaValid(
  skill: string,
  value: unknown,
): boolean {
  return parseGradingPrediction(skill, value) !== null;
}

export function summarizeIeltsEvaluation(
  input: IeltsEvaluationInput,
): IeltsEvaluationMetrics {
  const observations = input.observations.filter((row) =>
    isIeltsSkill(row.skill),
  );
  const workflows = input.workflowRuns.filter(isIeltsWorkflow);
  const providerRequests = input.providerRequests.filter((row) =>
    isIeltsProviderOutputType(row.output_type),
  );
  const confidenceLevels = input.confidenceLevels ?? [];
  const teacherDeltas = (input.teacherDeltas ?? []).filter((row) =>
    isIeltsSkill(row.skill),
  );
  const staleBeforeMs = Date.parse(input.staleBefore);

  const latencies = providerRequests
    .map((row) => row.latency_ms)
    .filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value) && value >= 0,
    );
  const providerCost = providerRequests.reduce(
    (sum, row) => sum + Math.max(0, numeric(row.estimated_cost_usd)),
    0,
  );
  const completedCount = workflows.filter(
    (row) => row.status === "completed",
  ).length;
  const terminalFailureCount = workflows.filter(
    (row) => row.status === "failed" || row.status === "cancelled",
  ).length;
  const strandedCount = Number.isFinite(staleBeforeMs)
    ? workflows.filter((row) => isStaleNonterminal(row, staleBeforeMs)).length
    : 0;
  const retryCount = workflows.filter(
    (row) => row.workflow_attempt_count > 1,
  ).length;

  const byLevel: Record<IeltsConfidenceLevel, number> = {
    limited: 0,
    medium: 0,
    high: 0,
  };
  for (const level of confidenceLevels) byLevel[level] += 1;

  const signedDeltas = teacherDeltas.map((row) => row.teacherBand - row.aiBand);
  const byCriterion = new Map<string, number[]>();
  for (const row of teacherDeltas) {
    const values = byCriterion.get(row.criterion) ?? [];
    values.push(row.teacherBand - row.aiBand);
    byCriterion.set(row.criterion, values);
  }

  const validCount = Math.max(
    0,
    Math.min(observations.length, input.schemaValidPredictionCount),
  );
  return {
    benchmark: evaluateBenchmark(observations),
    schema: {
      evaluatedCount: observations.length,
      validCount,
      successRate: ratio(validCount, observations.length),
    },
    workflow: {
      runCount: workflows.length,
      completedCount,
      retryCount,
      retryRate: ratio(retryCount, workflows.length),
      terminalFailureCount,
      terminalFailureRate: ratio(terminalFailureCount, workflows.length),
      strandedCount,
      strandedRate: ratio(strandedCount, workflows.length),
    },
    provider: {
      requestCount: providerRequests.length,
      successfulRequestCount: providerRequests.filter(
        (row) => row.status === "success",
      ).length,
      failedRequestCount: providerRequests.filter(
        (row) => row.status === "error",
      ).length,
      errorRate: ratio(
        providerRequests.filter((row) => row.status === "error").length,
        providerRequests.length,
      ),
      totalCostUsd: Math.round(providerCost * 1_000_000) / 1_000_000,
      averageCostUsd: providerRequests.length
        ? Math.round((providerCost / providerRequests.length) * 1_000_000) /
          1_000_000
        : null,
      medianLatencyMs: median(latencies),
      p95LatencyMs: percentile(latencies, 0.95),
    },
    confidence: {
      count: confidenceLevels.length,
      byLevel,
      limitedRate: confidenceLevels.length
        ? byLevel.limited / confidenceLevels.length
        : null,
    },
    teacherDelta: {
      count: signedDeltas.length,
      meanSignedDelta: signedDeltas.length
        ? signedDeltas.reduce((sum, value) => sum + value, 0) /
          signedDeltas.length
        : null,
      meanAbsoluteDelta: signedDeltas.length
        ? signedDeltas.reduce((sum, value) => sum + Math.abs(value), 0) /
          signedDeltas.length
        : null,
      withinHalfBandRate: signedDeltas.length
        ? signedDeltas.filter((value) => Math.abs(value) <= 0.5).length /
          signedDeltas.length
        : null,
      byCriterion: Object.fromEntries(
        [...byCriterion].map(([criterion, values]) => [
          criterion,
          {
            count: values.length,
            meanSignedDelta:
              values.reduce((sum, value) => sum + value, 0) / values.length,
          },
        ]),
      ),
    },
  };
}
