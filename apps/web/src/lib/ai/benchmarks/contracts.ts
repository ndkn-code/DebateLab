import { z } from "zod";

import {
  IELTS_BENCHMARK_REQUIREMENTS,
  normalizeIeltsCriterion,
  type IeltsBenchmarkSkill,
} from "./evaluate";

const finiteBandSchema = z.number().finite().min(0).max(9);
const criterionBandSchema = z.union([
  finiteBandSchema,
  z.object({ band: finiteBandSchema }).passthrough(),
]);

const predictionEnvelopeSchema = z
  .object({
    criteria: z.record(z.string(), criterionBandSchema),
  })
  .passthrough();

export interface ParsedGradingPrediction {
  criteria: Record<string, number>;
}

/**
 * Validates the same four criterion bands the production scorer is required to
 * emit. This is deliberately separate from the protected label schema: a
 * benchmark runner can validate and import model output without reading gold
 * answers into its process.
 */
export function parseGradingPrediction(
  skill: string,
  value: unknown,
): ParsedGradingPrediction | null {
  if (skill !== "ielts_speaking" && skill !== "ielts_writing") return null;
  const parsed = predictionEnvelopeSchema.safeParse(value);
  if (!parsed.success) return null;
  const criteria = Object.fromEntries(
    Object.entries(parsed.data.criteria).map(([criterion, band]) => [
      normalizeIeltsCriterion(criterion),
      typeof band === "number" ? band : band.band,
    ]),
  );
  const required =
    IELTS_BENCHMARK_REQUIREMENTS[skill as IeltsBenchmarkSkill].criteria;
  if (required.some((criterion) => criteria[criterion] === undefined))
    return null;
  return { criteria };
}

const operationalSafetyEvidenceSchema = z.object({
  runId: z.string().min(1).max(200),
  verifiedAt: z.string().datetime({ offset: true }),
  invalidAuthoritativeCitationCount: z.number().int().nonnegative(),
  duplicatePaidScoringCount: z.number().int().nonnegative(),
  strandedWorkflowCount: z.number().int().nonnegative(),
});

export type OperationalSafetyEvidence = z.infer<
  typeof operationalSafetyEvidenceSchema
>;

const evaluationImportEntrySchema = z.object({
  benchmarkKey: z.string().min(1).max(300),
  prediction: z.unknown(),
  /** A fresh re-run of the exact same benchmark, never a copied summary rate. */
  repeatPredictions: z.array(z.unknown()).max(10).default([]),
  /** Stored only as traceability; aggregate release rates are always derived. */
  runMetadata: z.record(z.string(), z.unknown()).default({}),
  operationalSafetyEvidence: operationalSafetyEvidenceSchema.optional(),
});

export const benchmarkEvaluationImportFileSchema = z.object({
  graderVersion: z.string().min(1).max(200),
  corpusVersion: z.number().int().positive(),
  evaluations: z.array(evaluationImportEntrySchema).min(1).max(100_000),
});

export type BenchmarkEvaluationImportFile = z.infer<
  typeof benchmarkEvaluationImportFileSchema
>;

/**
 * Parses an offline evaluation-output file. It makes no network or provider
 * calls; callers must resolve each benchmark key under the service role and
 * validate its skill with `parseGradingPrediction` before persisting.
 */
export function parseBenchmarkEvaluationImport(
  value: unknown,
): BenchmarkEvaluationImportFile {
  const parsed = benchmarkEvaluationImportFileSchema.parse(value);
  const seen = new Set<string>();
  for (const entry of parsed.evaluations) {
    if (seen.has(entry.benchmarkKey)) {
      throw new Error(
        `Duplicate benchmarkKey in evaluation import: ${entry.benchmarkKey}`,
      );
    }
    seen.add(entry.benchmarkKey);
  }
  return parsed;
}

export function parseOperationalSafetyEvidence(
  value: unknown,
): OperationalSafetyEvidence | null {
  const parsed = operationalSafetyEvidenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
