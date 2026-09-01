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

const approvedBenchmarkSourceSchema = z.object({
  canonicalUrl: z.string().url(),
  publisher: z.string().min(1).max(300),
  title: z.string().min(1).max(500),
  authorityTier: z.enum(["official", "qualified_examiner_or_adjudicator"]),
  rightsStatus: z.enum([
    "approved_for_derived_use",
    "approved_for_excerpt",
    "public_domain",
  ]),
  checksum: z.string().min(16).max(256),
  reviewedBy: z.string().min(1).max(200),
  reviewedAt: z.string().datetime({ offset: true }),
  reviewNotes: z.string().min(1).max(2_000),
});

const protectedCriterionLabelSchema = z.object({
  band: finiteBandSchema.refine((value) => Number.isInteger(value * 2), {
    message: "Criterion bands must use whole- or half-band increments",
  }),
  labelLocator: z.string().min(1).max(500),
  examinerRationale: z.string().min(1).max(8_000).optional(),
});

const benchmarkLabelProvenanceSchema = z
  .object({
    /** Release labels require two independently produced examiner marks. */
    raterCount: z.number().int().min(2).max(20),
    independentlyMarked: z.literal(true),
    raterAuthorities: z
      .array(z.enum(["official_examiner", "qualified_examiner"]))
      .min(2)
      .max(20),
    adjudicationMethod: z.enum([
      "third_examiner",
      "documented_consensus",
      "official_published_adjudication",
    ]),
    adjudicationLocator: z.string().min(1).max(500),
  })
  .superRefine((value, context) => {
    if (value.raterAuthorities.length !== value.raterCount) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["raterAuthorities"],
        message: "Rater authority count must equal raterCount",
      });
    }
  });

const protectedBenchmarkInputSchema = z
  .object({
    prompt: z.string().min(1).max(20_000),
    responseText: z.string().min(1).max(100_000).optional(),
    /** Private object-storage path for a scanned or otherwise non-text response. */
    responseObjectPath: z.string().min(1).max(1_000).optional(),
    audioObjectPath: z.string().min(1).max(1_000).optional(),
    artifactSha256: z
      .string()
      .regex(
        /^[a-f0-9]{64}$/i,
        "Artifact checksum must be a SHA-256 hex digest",
      )
      .optional(),
    artifactContentType: z.string().min(1).max(200).optional(),
    responseLocator: z.string().min(1).max(500),
  })
  .superRefine((input, context) => {
    const modalities = [
      Boolean(input.responseText),
      Boolean(input.responseObjectPath),
      Boolean(input.audioObjectPath),
    ].filter(Boolean).length;
    if (modalities !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A benchmark input needs exactly one of responseText, responseObjectPath, or audioObjectPath",
      });
    }
    const hasObjectArtifact = Boolean(
      input.responseObjectPath || input.audioObjectPath,
    );
    if (hasObjectArtifact && !input.artifactSha256) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["artifactSha256"],
        message: "Protected benchmark artifacts require a SHA-256 checksum",
      });
    }
    if (hasObjectArtifact && !input.artifactContentType) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["artifactContentType"],
        message: "Protected benchmark artifacts require a content type",
      });
    }
    if (
      input.audioObjectPath &&
      input.artifactContentType &&
      !input.artifactContentType.startsWith("audio/")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["artifactContentType"],
        message: "An audio benchmark artifact must use an audio content type",
      });
    }
  });

const protectedBenchmarkLabelSchema = z.object({
  criteria: z.record(z.string(), protectedCriterionLabelSchema),
  /** Protected input is service-role only and never returned to learners/admin UI. */
  input: protectedBenchmarkInputSchema,
  rubricVersion: z.string().min(1).max(200),
  labelAuthority: z.enum(["official_examiner", "qualified_examiner"]),
  provenance: benchmarkLabelProvenanceSchema,
});

const benchmarkCaseSchema = z.object({
  benchmarkKey: z.string().min(1).max(300),
  collectionSlug: z.enum(["ielts.speaking", "ielts.writing"]),
  sourceUrl: z.string().url(),
  skill: z.enum(["ielts_speaking", "ielts_writing"]),
  taskType: z.string().min(1).max(200),
  bandOrScoreRange: z.string().min(1).max(100),
  accentGroup: z.string().min(1).max(100).nullable().default(null),
  split: z.enum(["development", "evaluation", "holdout"]),
  protectedLabel: protectedBenchmarkLabelSchema,
  metadata: z
    .object({
      /** Required for Speaking slice analysis and accent-bias checks. */
      l1Group: z.string().min(1).max(100).optional(),
      audioQualityGroup: z
        .enum(["studio", "quiet_room", "typical_device", "degraded"])
        .optional(),
    })
    .catchall(z.unknown())
    .default({}),
});

const storedBenchmarkReleaseSchema = z
  .object({
    skill: z.enum(["ielts_speaking", "ielts_writing"]),
    accentGroup: z.string().min(1).max(100).nullable().default(null),
    protectedLabel: protectedBenchmarkLabelSchema,
    metadata: benchmarkCaseSchema.shape.metadata,
  })
  .superRefine((benchmark, context) => {
    if (benchmark.skill !== "ielts_speaking") return;
    if (!benchmark.protectedLabel.input.audioObjectPath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["protectedLabel", "input", "audioObjectPath"],
        message: "Speaking release benchmark requires audio",
      });
    }
    if (
      !benchmark.accentGroup ||
      !benchmark.metadata.l1Group ||
      !benchmark.metadata.audioQualityGroup
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metadata"],
        message: "Speaking release benchmark requires slice metadata",
      });
    }
  });

/** Re-validates stored DB JSON and slice metadata at release time. */
export function isReleaseEligibleStoredBenchmark(value: unknown): boolean {
  return storedBenchmarkReleaseSchema.safeParse(value).success;
}

export const gradingBenchmarkImportFileSchema = z.object({
  manifestVersion: z.literal(1),
  createdAt: z.string().datetime({ offset: true }),
  sources: z.array(approvedBenchmarkSourceSchema).min(1).max(10_000),
  benchmarks: z.array(benchmarkCaseSchema).min(1).max(100_000),
});

export type GradingBenchmarkImportFile = z.infer<
  typeof gradingBenchmarkImportFileSchema
>;

/**
 * Fails closed unless every benchmark has approved provenance, an exact
 * productive-skill criterion set, a valid task family, and source-separated
 * splits. It deliberately returns protected labels only to the offline
 * service-role importer.
 */
export function parseGradingBenchmarkImport(
  value: unknown,
): GradingBenchmarkImportFile {
  const parsed = gradingBenchmarkImportFileSchema.parse(value);
  const sourceUrls = new Set(
    parsed.sources.map((source) => source.canonicalUrl),
  );
  if (sourceUrls.size !== parsed.sources.length) {
    throw new Error("Duplicate canonicalUrl in benchmark source manifest");
  }
  const keys = new Set<string>();
  const splitBySource = new Map<string, string>();
  for (const benchmark of parsed.benchmarks) {
    if (keys.has(benchmark.benchmarkKey)) {
      throw new Error(`Duplicate benchmarkKey: ${benchmark.benchmarkKey}`);
    }
    keys.add(benchmark.benchmarkKey);
    if (!sourceUrls.has(benchmark.sourceUrl)) {
      throw new Error(
        `Benchmark source is missing from approved manifest: ${benchmark.sourceUrl}`,
      );
    }
    if (benchmark.skill === "ielts_speaking") {
      if (!benchmark.protectedLabel.input.audioObjectPath) {
        throw new Error(
          `Speaking benchmark requires examiner-labelled audio: ${benchmark.benchmarkKey}`,
        );
      }
      if (
        !benchmark.accentGroup ||
        !benchmark.metadata.l1Group ||
        !benchmark.metadata.audioQualityGroup
      ) {
        throw new Error(
          `Speaking benchmark requires accent, L1, and audio-quality groups: ${benchmark.benchmarkKey}`,
        );
      }
    }
    const expectedCollection =
      benchmark.skill === "ielts_speaking" ? "ielts.speaking" : "ielts.writing";
    if (benchmark.collectionSlug !== expectedCollection) {
      throw new Error(
        `Collection/skill mismatch for ${benchmark.benchmarkKey}`,
      );
    }
    const requirements = IELTS_BENCHMARK_REQUIREMENTS[benchmark.skill];
    if (!requirements.taskTypes.includes(benchmark.taskType)) {
      throw new Error(
        `Unsupported taskType for ${benchmark.benchmarkKey}: ${benchmark.taskType}`,
      );
    }
    const suppliedCriteria = Object.keys(benchmark.protectedLabel.criteria)
      .map(normalizeIeltsCriterion)
      .sort();
    const requiredCriteria = [...requirements.criteria].sort();
    if (
      suppliedCriteria.length !== requiredCriteria.length ||
      suppliedCriteria.some(
        (criterion, index) => criterion !== requiredCriteria[index],
      )
    ) {
      throw new Error(
        `Incomplete or unknown criterion labels for ${benchmark.benchmarkKey}`,
      );
    }
    const previousSplit = splitBySource.get(benchmark.sourceUrl);
    if (previousSplit && previousSplit !== benchmark.split) {
      throw new Error(
        `Source leakage across benchmark splits: ${benchmark.sourceUrl}`,
      );
    }
    splitBySource.set(benchmark.sourceUrl, benchmark.split);
  }
  return parsed;
}
