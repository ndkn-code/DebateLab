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

const operationalScenarioSchema = z.object({
  workflowRunId: z.string().uuid(),
  scenario: z.enum([
    "duplicate_delivery",
    "provider_timeout",
    "stale_claim",
    "persistence_retry",
    "retry_exhaustion",
  ]),
  expectedProviderCalls: z.number().int().nonnegative(),
  observedProviderCalls: z.number().int().nonnegative(),
  actualProviderCalls: z.number().int().nonnegative(),
  terminalStatus: z.enum(["completed", "failed"]),
  actualWorkflowStatus: z.enum(["completed", "failed"]),
  invalidAuthoritativeCitationCount: z.number().int().nonnegative(),
  passed: z.literal(true),
  detailsHash: z.string().regex(/^[a-f0-9]{64}$/i),
});

const operationalSafetyEvidenceSchema = z
  .object({
    runId: z.string().min(1).max(200),
    graderVersion: z.enum(["provisional-v1", "evidence-adjudicated-v1"]),
    corpusVersion: z.number().int().positive(),
    environment: z.enum(["preview", "staging"]),
    deploymentId: z.string().regex(/^[a-z][a-z0-9-]{0,62}$/),
    imageDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    startedAt: z.string().datetime({ offset: true }),
    verifiedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
    evidenceHash: z.string().regex(/^[a-f0-9]{64}$/i),
    scenarios: z.array(operationalScenarioSchema).min(5).max(500),
  })
  .superRefine((value, context) => {
    const requiredScenarios = new Set([
      "duplicate_delivery",
      "provider_timeout",
      "stale_claim",
      "persistence_retry",
      "retry_exhaustion",
    ]);
    const suppliedScenarios = new Set(
      value.scenarios.map((scenario) => scenario.scenario),
    );
    for (const scenario of requiredScenarios) {
      if (!suppliedScenarios.has(scenario as never)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scenarios"],
          message: `Missing operational scenario: ${scenario}`,
        });
      }
    }
    if (new Date(value.verifiedAt) < new Date(value.startedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["verifiedAt"],
        message: "Operational evidence verification precedes its start",
      });
    }
    if (new Date(value.expiresAt) <= new Date(value.verifiedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message: "Operational evidence expiry must follow verification",
      });
    }
    value.scenarios.forEach((scenario, index) => {
      const expectedProviderCalls =
        scenario.scenario === "retry_exhaustion"
          ? 3
          : scenario.scenario === "provider_timeout"
            ? 1
            : value.graderVersion === "evidence-adjudicated-v1"
              ? 2
              : 1;
      const expectedTerminalStatus =
        scenario.scenario === "provider_timeout" ||
        scenario.scenario === "retry_exhaustion"
          ? "failed"
          : "completed";
      if (
        scenario.expectedProviderCalls !== expectedProviderCalls ||
        scenario.observedProviderCalls !== scenario.actualProviderCalls ||
        scenario.observedProviderCalls !== expectedProviderCalls ||
        scenario.terminalStatus !== expectedTerminalStatus
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scenarios", index],
          message:
            "Operational scenario does not match locked workflow counters",
        });
      }
      if (scenario.actualWorkflowStatus !== scenario.terminalStatus) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scenarios", index, "actualWorkflowStatus"],
          message: "Operational scenario no longer matches its workflow row",
        });
      }
    });
  });

export type OperationalSafetyEvidence = z.infer<
  typeof operationalSafetyEvidenceSchema
>;

const evaluationRunImportSchema = z.object({
  runKind: z.enum(["primary", "repeat"]),
  prediction: z.unknown(),
  providerRequestId: z.string().uuid(),
});

const evaluationImportEntrySchema = z
  .object({
    benchmarkKey: z.string().min(1).max(300),
    runs: z.array(evaluationRunImportSchema).length(2),
  })
  .superRefine((entry, context) => {
    const byKind = new Map(entry.runs.map((run) => [run.runKind, run]));
    if (byKind.size !== 2 || !byKind.has("primary") || !byKind.has("repeat")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["runs"],
        message:
          "Evaluation requires one primary and one independent repeat run",
      });
    }
    const [first, second] = entry.runs;
    if (
      first &&
      second &&
      first.providerRequestId === second.providerRequestId
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["runs"],
        message: "Primary and repeat runs require distinct provider requests",
      });
    }
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
  const providerRequestIds = new Set<string>();
  for (const entry of parsed.evaluations) {
    if (seen.has(entry.benchmarkKey)) {
      throw new Error(
        `Duplicate benchmarkKey in evaluation import: ${entry.benchmarkKey}`,
      );
    }
    seen.add(entry.benchmarkKey);
    for (const run of entry.runs) {
      if (providerRequestIds.has(run.providerRequestId)) {
        throw new Error("Evaluation run identity is reused across benchmarks");
      }
      providerRequestIds.add(run.providerRequestId);
    }
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

const benchmarkPronunciationSignalSchema = z.object({
  pronunciationScore: z.number().finite().min(0).max(100),
  accuracyScore: z.number().finite().min(0).max(100),
  fluencyScore: z.number().finite().min(0).max(100),
  completenessScore: z.number().finite().min(0).max(100).nullable(),
  prosodyScore: z.number().finite().min(0).max(100),
  mispronouncedWords: z.array(z.string().min(1).max(200)).max(25),
});

const sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "Value must be a SHA-256 hex digest");

const EMPTY_TEXT_SHA256 =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export const AI_GRADING_BENCHMARK_PRIVATE_BUCKET =
  "ai-grading-benchmarks-private" as const;

const protectedBenchmarkObjectPathSchema = z
  .string()
  .min(AI_GRADING_BENCHMARK_PRIVATE_BUCKET.length + 2)
  .max(1_000)
  .refine(
    (value) =>
      value.startsWith(`${AI_GRADING_BENCHMARK_PRIVATE_BUCKET}/`) &&
      !value.includes("//") &&
      !value.split("/").some((segment) => segment === "." || segment === ".."),
    `Protected benchmark objects must be stored in ${AI_GRADING_BENCHMARK_PRIVATE_BUCKET}`,
  );

const benchmarkGroundingSchema = z.object({
  questionReferenceAnswer: z.string().min(1).max(100_000).nullable(),
  examinerNotes: z.array(z.string().min(1).max(10_000)).max(100),
  peerReferenceAnswers: z.array(z.string().min(1).max(100_000)).max(50),
});

const benchmarkAcousticAttestationEnvelopeSchema = z.object({
  envelopeVersion: z.literal(1),
  benchmarkKey: z.string().min(1).max(300),
  captureId: z.string().uuid(),
  audioObjectPath: protectedBenchmarkObjectPathSchema,
  reportObjectPath: protectedBenchmarkObjectPathSchema,
  audioArtifactSha256: sha256Schema,
  transcriptSha256: sha256Schema,
  configSha256: sha256Schema,
  reportSha256: sha256Schema,
  provider: z.literal("azure"),
  model: z.literal("pronunciation-assessment"),
  apiVersion: z.literal("speech-sdk/1.51.0"),
  assessmentMode: z.literal("unscripted"),
});

const benchmarkAudioPreprocessingSchema = z.object({
  audioArtifactSha256: sha256Schema,
  stt: z.object({
    provider: z.string().min(1).max(100),
    model: z.string().min(1).max(200),
    transcriptSha256: sha256Schema,
  }),
  pronunciation: z.object({
    provider: z.literal("azure"),
    model: z.literal("pronunciation-assessment"),
    apiVersion: z.literal("speech-sdk/1.51.0"),
    // Production IELTS Speaking always uses spontaneous continuous assessment.
    assessmentMode: z.literal("unscripted"),
    config: z.object({
      locale: z.string().min(2).max(20),
      gradingSystem: z.literal("HundredMark"),
      granularity: z.literal("Phoneme"),
      dimension: z.literal("Comprehensive"),
      phonemeAlphabet: z.literal("IPA"),
      enableProsodyAssessment: z.literal(true),
      enableMiscue: z.literal(false),
      audioFormat: z.object({
        container: z.literal("wav"),
        encoding: z.literal("pcm_s16le"),
        sampleRateHertz: z.literal(16_000),
        bitsPerSample: z.literal(16),
        channels: z.literal(1),
      }),
      referenceTextSha256: z.literal(EMPTY_TEXT_SHA256),
    }),
    configSha256: sha256Schema,
    reportObjectPath: protectedBenchmarkObjectPathSchema,
    reportStorageVersion: z.string().min(1).max(500),
    reportEtag: z.string().min(1).max(500),
    reportSha256: sha256Schema,
    completenessLimitationReason: z.string().min(1).max(500).nullable(),
  }),
  acousticAttestation: z.object({
    envelope: benchmarkAcousticAttestationEnvelopeSchema,
    signature: sha256Schema,
  }),
});

export const protectedBenchmarkInputSchema = z
  .object({
    prompt: z.string().min(1).max(20_000),
    responseText: z.string().min(1).max(100_000).optional(),
    /** Private object-storage path for a scanned or otherwise non-text response. */
    responseObjectPath: protectedBenchmarkObjectPathSchema.optional(),
    audioObjectPath: protectedBenchmarkObjectPathSchema.optional(),
    /**
     * Locked deterministic preprocessing of a non-text artifact. For audio,
     * this is the examiner-approved transcript; for scans, it is the reviewed
     * OCR transcription. The raw artifact remains the checksum authority.
     */
    scoringResponseText: z.string().min(1).max(100_000).optional(),
    scoringContext: z
      .object({
        durationSeconds: z.number().finite().positive().max(7_200).optional(),
        sttWarnings: z.array(z.string().min(1).max(500)).max(20).optional(),
        pronunciation: benchmarkPronunciationSignalSchema.nullable().optional(),
      })
      .optional(),
    grounding: benchmarkGroundingSchema,
    cueCardBullets: z.array(z.string().min(1).max(2_000)).max(20),
    audioPreprocessing: benchmarkAudioPreprocessingSchema.optional(),
    artifactSha256: z
      .string()
      .regex(
        /^[a-f0-9]{64}$/i,
        "Artifact checksum must be a SHA-256 hex digest",
      ),
    /** Canonical SHA-256 of the exact `{task,messages}` model request. */
    modelInputSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i, "Model input must have a SHA-256 digest"),
    artifactContentType: z.string().min(1).max(200).optional(),
    artifactStorageVersion: z.string().min(1).max(500).optional(),
    artifactEtag: z.string().min(1).max(500).optional(),
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
    if (hasObjectArtifact && !input.scoringResponseText) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["scoringResponseText"],
        message:
          "Protected non-text benchmark artifacts require locked scoring text",
      });
    }
    if (
      hasObjectArtifact &&
      (!input.artifactContentType ||
        !input.artifactStorageVersion ||
        !input.artifactEtag)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["artifactContentType"],
        message:
          "Protected benchmark artifacts require content type, storage version, and ETag",
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
    if (input.audioObjectPath) {
      const signal = input.scoringContext?.pronunciation;
      if (!signal || !input.audioPreprocessing) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["audioPreprocessing"],
          message:
            "Speaking audio requires complete acoustic evidence and preprocessing provenance",
        });
      } else if (
        signal.completenessScore === null &&
        !input.audioPreprocessing.pronunciation.completenessLimitationReason
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [
            "audioPreprocessing",
            "pronunciation",
            "completenessLimitationReason",
          ],
          message:
            "Unscripted assessment requires an explicit completeness limitation reason",
        });
      } else if (
        signal.completenessScore !== null &&
        input.audioPreprocessing.pronunciation.assessmentMode === "unscripted"
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["scoringContext", "pronunciation", "completenessScore"],
          message: "Unscripted assessment cannot claim completeness",
        });
      }
      if (input.audioPreprocessing) {
        const preprocessing = input.audioPreprocessing;
        const envelope = preprocessing.acousticAttestation.envelope;
        const pronunciation = preprocessing.pronunciation;
        const mismatched =
          envelope.audioObjectPath !== input.audioObjectPath ||
          envelope.reportObjectPath !== pronunciation.reportObjectPath ||
          envelope.audioArtifactSha256.toLowerCase() !==
            input.artifactSha256.toLowerCase() ||
          envelope.audioArtifactSha256.toLowerCase() !==
            preprocessing.audioArtifactSha256.toLowerCase() ||
          envelope.transcriptSha256.toLowerCase() !==
            preprocessing.stt.transcriptSha256.toLowerCase() ||
          envelope.configSha256.toLowerCase() !==
            pronunciation.configSha256.toLowerCase() ||
          envelope.reportSha256.toLowerCase() !==
            pronunciation.reportSha256.toLowerCase() ||
          envelope.provider !== pronunciation.provider ||
          envelope.model !== pronunciation.model ||
          envelope.apiVersion !== pronunciation.apiVersion ||
          envelope.assessmentMode !== pronunciation.assessmentMode;
        if (mismatched) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["audioPreprocessing", "acousticAttestation"],
            message:
              "Acoustic attestation must bind the exact audio, transcript, Azure config, and report",
          });
        }
      }
    }
  });

export type ProtectedBenchmarkInput = z.infer<
  typeof protectedBenchmarkInputSchema
>;

const protectedBenchmarkLabelSchema = z.object({
  criteria: z.record(z.string(), protectedCriterionLabelSchema),
  /** Protected input is service-role only and never returned to learners/admin UI. */
  input: protectedBenchmarkInputSchema,
  rubricVersion: z.string().min(1).max(200),
  labelAuthority: z.enum(["official_examiner", "qualified_examiner"]),
  provenance: benchmarkLabelProvenanceSchema,
});

const benchmarkCaseSchema = z
  .object({
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
  })
  .superRefine((benchmark, context) => {
    const envelope =
      benchmark.protectedLabel.input.audioPreprocessing?.acousticAttestation
        .envelope;
    if (envelope && envelope.benchmarkKey !== benchmark.benchmarkKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [
          "protectedLabel",
          "input",
          "audioPreprocessing",
          "acousticAttestation",
          "envelope",
          "benchmarkKey",
        ],
        message: "Acoustic attestation benchmark identity mismatch",
      });
    }
  });

const storedBenchmarkReleaseSchema = z
  .object({
    benchmarkKey: z.string().min(1).max(300),
    skill: z.enum(["ielts_speaking", "ielts_writing"]),
    taskType: z.string().min(1).max(200),
    accentGroup: z.string().min(1).max(100).nullable().default(null),
    protectedLabel: protectedBenchmarkLabelSchema,
    metadata: benchmarkCaseSchema.shape.metadata,
    source: z.object({
      canonicalUrl: z.string().url(),
      authorityTier: z.enum(["official", "qualified_examiner_or_adjudicator"]),
      rightsStatus: z.enum([
        "approved_for_derived_use",
        "approved_for_excerpt",
        "public_domain",
      ]),
      reviewStatus: z.literal("approved"),
      checksum: z.string().min(16).max(256),
      submittedBy: z.string().uuid(),
      reviewedBy: z.string().uuid(),
    }),
  })
  .superRefine((benchmark, context) => {
    if (benchmark.source.submittedBy === benchmark.source.reviewedBy) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["source", "reviewedBy"],
        message: "Benchmark source requires an independent reviewer",
      });
    }
    const requirements = IELTS_BENCHMARK_REQUIREMENTS[benchmark.skill];
    if (!requirements.taskTypes.includes(benchmark.taskType)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["taskType"],
        message: "Stored benchmark task type is not release eligible",
      });
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
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["protectedLabel", "criteria"],
        message: "Stored benchmark criterion labels are incomplete",
      });
    }
    if (benchmark.skill !== "ielts_speaking") return;
    if (!benchmark.protectedLabel.input.audioObjectPath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["protectedLabel", "input", "audioObjectPath"],
        message: "Speaking release benchmark requires audio",
      });
    }
    const envelope =
      benchmark.protectedLabel.input.audioPreprocessing?.acousticAttestation
        .envelope;
    if (!envelope || envelope.benchmarkKey !== benchmark.benchmarkKey) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["protectedLabel", "input", "audioPreprocessing"],
        message: "Speaking release benchmark acoustic identity is invalid",
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

/**
 * Re-validates stored labels and rejects repeated artifacts. Reusing one
 * response under several benchmark keys would otherwise inflate accuracy and
 * coverage without adding any independent evidence.
 */
export function countInvalidStoredBenchmarkRows(values: unknown[]): number {
  const artifactHashes = new Set<string>();
  const artifactLocators = new Set<string>();
  const normalizedTexts = new Set<string>();
  const acousticReportPaths = new Set<string>();
  const acousticReportHashes = new Set<string>();
  const acousticEnvelopes = new Set<string>();
  let invalid = 0;
  for (const value of values) {
    const parsed = storedBenchmarkReleaseSchema.safeParse(value);
    if (!parsed.success) {
      invalid += 1;
      continue;
    }
    const artifactHash =
      parsed.data.protectedLabel.input.artifactSha256.toLowerCase();
    const input = parsed.data.protectedLabel.input;
    const locator =
      input.audioObjectPath ??
      input.responseObjectPath ??
      input.responseLocator;
    const normalizedText = (input.responseText ?? input.scoringResponseText)
      ?.normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");
    const acoustic = input.audioPreprocessing;
    const acousticEnvelope = acoustic
      ? JSON.stringify(acoustic.acousticAttestation.envelope)
      : null;
    if (
      artifactHashes.has(artifactHash) ||
      artifactLocators.has(locator) ||
      (normalizedText ? normalizedTexts.has(normalizedText) : false) ||
      (acoustic
        ? acousticReportPaths.has(acoustic.pronunciation.reportObjectPath) ||
          acousticReportHashes.has(acoustic.pronunciation.reportSha256) ||
          acousticEnvelopes.has(acousticEnvelope!)
        : false)
    ) {
      invalid += 1;
    }
    artifactHashes.add(artifactHash);
    artifactLocators.add(locator);
    if (normalizedText) normalizedTexts.add(normalizedText);
    if (acoustic) {
      acousticReportPaths.add(acoustic.pronunciation.reportObjectPath);
      acousticReportHashes.add(acoustic.pronunciation.reportSha256);
      acousticEnvelopes.add(acousticEnvelope!);
    }
  }
  return invalid;
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
  const artifactHashes = new Set<string>();
  const artifactLocators = new Set<string>();
  const normalizedTexts = new Set<string>();
  const acousticReportPaths = new Set<string>();
  const acousticReportHashes = new Set<string>();
  const acousticEnvelopes = new Set<string>();
  const splitBySource = new Map<string, string>();
  for (const benchmark of parsed.benchmarks) {
    if (keys.has(benchmark.benchmarkKey)) {
      throw new Error(`Duplicate benchmarkKey: ${benchmark.benchmarkKey}`);
    }
    keys.add(benchmark.benchmarkKey);
    const artifactHash =
      benchmark.protectedLabel.input.artifactSha256.toLowerCase();
    if (artifactHashes.has(artifactHash)) {
      throw new Error(
        `Duplicate benchmark artifact: ${benchmark.benchmarkKey}`,
      );
    }
    artifactHashes.add(artifactHash);
    const input = benchmark.protectedLabel.input;
    const artifactLocator =
      input.audioObjectPath ??
      input.responseObjectPath ??
      input.responseLocator;
    const normalizedText = (input.responseText ?? input.scoringResponseText)
      ?.normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ");
    const acoustic = input.audioPreprocessing;
    const acousticEnvelope = acoustic
      ? JSON.stringify(acoustic.acousticAttestation.envelope)
      : null;
    if (
      artifactLocators.has(artifactLocator) ||
      (normalizedText ? normalizedTexts.has(normalizedText) : false) ||
      (acoustic
        ? acousticReportPaths.has(acoustic.pronunciation.reportObjectPath) ||
          acousticReportHashes.has(acoustic.pronunciation.reportSha256) ||
          acousticEnvelopes.has(acousticEnvelope!)
        : false)
    ) {
      throw new Error(
        `Duplicate benchmark artifact locator/content: ${benchmark.benchmarkKey}`,
      );
    }
    artifactLocators.add(artifactLocator);
    if (normalizedText) normalizedTexts.add(normalizedText);
    if (acoustic) {
      acousticReportPaths.add(acoustic.pronunciation.reportObjectPath);
      acousticReportHashes.add(acoustic.pronunciation.reportSha256);
      acousticEnvelopes.add(acousticEnvelope!);
    }
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
