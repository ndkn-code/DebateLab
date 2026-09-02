import { createHash, createPublicKey, verify as verifySignature } from "node:crypto";

import { z } from "zod";

import {
  IELTS_BENCHMARK_REQUIREMENTS,
  normalizeIeltsCriterion,
  type IeltsBenchmarkSkill,
} from "./evaluate";
import {
  IELTS_BENCHMARK_STUDY_DESIGN_CURRENT,
  assertCurrentBenchmarkStudyDesignIdentity,
} from "./study-design";

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
  providerAttemptCountAtOutput: z.number().int().positive().nullable(),
  providerAttemptCountAtProvisional: z.number().int().positive().nullable(),
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
      const minimumProviderCalls =
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
      const isSuccessfulRecovery = expectedTerminalStatus === "completed";
      const stageFenceValid =
        value.graderVersion === "evidence-adjudicated-v1"
          ? scenario.providerAttemptCountAtProvisional !== null &&
            scenario.providerAttemptCountAtOutput !== null &&
            scenario.providerAttemptCountAtOutput >
              scenario.providerAttemptCountAtProvisional
          : scenario.providerAttemptCountAtProvisional === null;
      const countersMatch = isSuccessfulRecovery
        ? stageFenceValid &&
          scenario.expectedProviderCalls === minimumProviderCalls &&
          scenario.observedProviderCalls === scenario.actualProviderCalls &&
          scenario.providerAttemptCountAtOutput !== null &&
          scenario.actualProviderCalls ===
            scenario.providerAttemptCountAtOutput &&
          scenario.providerAttemptCountAtOutput >= minimumProviderCalls
        : scenario.expectedProviderCalls === minimumProviderCalls &&
          scenario.observedProviderCalls === scenario.actualProviderCalls &&
          scenario.actualProviderCalls === minimumProviderCalls &&
          scenario.providerAttemptCountAtOutput === null &&
          scenario.providerAttemptCountAtProvisional === null;
      if (
        !countersMatch ||
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

/**
 * Counts only provider work that happened after a validated output checkpoint.
 * Definite failures before that checkpoint are legitimate bounded retries, not
 * duplicate scoring. Failed scenarios have no output fence and are locked to
 * exact counters by the parser above.
 */
export function countDuplicatePaidScoringAttempts(
  evidence: OperationalSafetyEvidence | null,
): number {
  return (
    evidence?.scenarios.reduce((sum, scenario) => {
      const fence =
        scenario.providerAttemptCountAtOutput ?? scenario.expectedProviderCalls;
      return sum + Math.max(0, scenario.actualProviderCalls - fence);
    }, 0) ?? 0
  );
}

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
    "approved_for_benchmark_evaluation",
    "approved_for_derived_use",
    "approved_for_excerpt",
    "public_domain",
  ]),
  checksum: z.string().min(16).max(256),
  reviewedBy: z.string().min(1).max(200),
  reviewedAt: z.string().datetime({ offset: true }),
  reviewNotes: z.string().min(1).max(2_000),
});

const halfBandSchema = finiteBandSchema.refine(
  (value) => Number.isInteger(value * 2),
  { message: "Bands must use whole- or half-band increments" },
);

const sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, "Value must be a SHA-256 hex digest");

const studyKeySchema = z
  .string()
  .min(8)
  .max(128)
  .regex(
    /^[a-z0-9][a-z0-9._-]+$/,
    "Study keys must be pseudonymous lowercase identifiers",
  );

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function valueSha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function numericCriteria(value: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(value).map(([criterion, band]) => [
      normalizeIeltsCriterion(criterion),
      band,
    ]),
  );
}

function snapHalfBand(value: number): number {
  return Math.min(9, Math.max(0, Math.round(value * 2) / 2));
}

export function computeBenchmarkOverallBand(
  criteria: Record<string, number>,
): number {
  const bands = Object.values(criteria);
  if (bands.length !== 4 || bands.some((band) => !Number.isFinite(band))) {
    throw new Error("Exactly four finite criterion bands are required");
  }
  return snapHalfBand(
    bands.reduce((sum, band) => sum + band, 0) / bands.length,
  );
}

const protectedCriterionLabelSchema = z.object({
  band: halfBandSchema,
  labelLocator: z.string().min(1).max(500),
  examinerRationale: z.string().min(1).max(8_000).optional(),
});

const examinerAuthoritySchema = z.enum([
  "official_examiner",
  "qualified_examiner",
]);

const examinerCredentialSchema = z.object({
  proofSha256: z.string().regex(/^[a-f0-9]{64}$/i),
  verifiedAt: z.string().datetime({ offset: true }),
  verifiedByKey: studyKeySchema,
});

const examinerMarkSchema = z.object({
  raterKey: studyKeySchema,
  authority: examinerAuthoritySchema,
  credential: examinerCredentialSchema,
  rubricVersion: z.string().min(1).max(200),
  markedAt: z.string().datetime({ offset: true }),
  blindIndependentMark: z.literal(true),
  criteria: z.record(z.string(), halfBandSchema),
  overallBand: halfBandSchema,
  markLocator: z.string().min(1).max(500),
});

const adjudicationRecordSchema = z.object({
  adjudicatorKey: studyKeySchema,
  authority: examinerAuthoritySchema,
  credential: examinerCredentialSchema,
  rubricVersion: z.string().min(1).max(200),
  adjudicatedAt: z.string().datetime({ offset: true }),
  method: z.enum(["third_examiner", "documented_consensus"]),
  triggerReasons: z
    .array(
      z.enum([
        "criterion_disagreement_over_half",
        "overall_disagreement_over_half",
        "declared_boundary_crossing",
      ]),
    )
    .min(1)
    .max(3)
    .refine((reasons) => new Set(reasons).size === reasons.length, {
      message: "Adjudication trigger reasons must be unique",
    }),
  criteria: z.record(z.string(), halfBandSchema),
  overallBand: halfBandSchema,
  rationale: z.string().min(1).max(8_000),
  adjudicationLocator: z.string().min(1).max(500),
});

const benchmarkLabelProvenanceSchema = z.object({
  independentlyMarked: z.literal(true),
  raterRecords: z.array(examinerMarkSchema).min(2).max(20),
  declaredBoundaryCrossing: z.boolean(),
  adjudication: adjudicationRecordSchema.nullable(),
});

const protectedConsentReceiptSchema = z
  .object({
    receiptKey: studyKeySchema,
    receiptSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    consentVersion: z.string().min(1).max(100),
    consentedAt: z.string().datetime({ offset: true }),
    participantAgeGroup: z.enum(["adult", "minor"]),
    scopes: z.object({
      commercialAiEvaluation: z.literal(true),
      humanExaminerReview: z.literal(true),
      modelTraining: z.boolean(),
      futureVersionedReevaluation: z.boolean(),
      voiceProcessing: z.boolean(),
    }),
    guardianConsentReceiptSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .nullable(),
    learnerAssentReceiptSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .nullable(),
    retentionUntil: z.string().datetime({ offset: true }),
    withdrawal: z.object({
      status: z.literal("not_withdrawn"),
      checkedAt: z.string().datetime({ offset: true }),
      registryReceiptSha256: z.string().regex(/^[a-f0-9]{64}$/i),
    }),
  })
  .superRefine((consent, context) => {
    const isMinor = consent.participantAgeGroup === "minor";
    const consentedAt = new Date(consent.consentedAt);
    const retentionUntil = new Date(consent.retentionUntil);
    if (
      isMinor !== Boolean(consent.guardianConsentReceiptSha256) ||
      isMinor !== Boolean(consent.learnerAssentReceiptSha256)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["participantAgeGroup"],
        message:
          "Minor participants require guardian consent and learner assent; adults require neither",
      });
    }
    if (retentionUntil <= consentedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retentionUntil"],
        message: "Consent retention must end after consent was recorded",
      });
    }
    const minorRetentionLimit = new Date(consentedAt);
    minorRetentionLimit.setUTCFullYear(minorRetentionLimit.getUTCFullYear() + 1);
    if (isMinor && retentionUntil > minorRetentionLimit) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retentionUntil"],
        message:
          "Minor participant retention cannot exceed one year without renewed consent",
      });
    }
    if (new Date(consent.withdrawal.checkedAt) < new Date(consent.consentedAt)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["withdrawal", "checkedAt"],
        message: "Withdrawal registry check predates consent",
      });
    }
  });

const benchmarkStudyGroupingSchema = z.object({
  candidateKey: studyKeySchema,
  promptFamilyKey: studyKeySchema,
  sourceGroupKey: studyKeySchema,
  captureSessionKey: studyKeySchema,
});

const benchmarkStudyGroupingReceiptSchema = z.object({
  candidateReceiptSha256: sha256Schema,
  promptFamilyReceiptSha256: sha256Schema,
  sourceGroupReceiptSha256: sha256Schema,
  captureSessionReceiptSha256: sha256Schema,
});

/**
 * Signed by the study lead's offline Ed25519 key. The importer and release
 * runner receive only the public key, so service-role access cannot manufacture
 * examiner credentials, consent, withdrawal status, or split identities.
 */
export const benchmarkReleaseAttestationEnvelopeSchema = z
  .object({
    envelopeVersion: z.literal(1),
    benchmarkKey: z.string().min(1).max(300),
    artifactSha256: sha256Schema,
    consentReceiptSha256: sha256Schema,
    consentRetentionUntil: z.string().datetime({ offset: true }),
    withdrawalRegistryReceiptSha256: sha256Schema,
    withdrawalCheckedAt: z.string().datetime({ offset: true }),
    grouping: benchmarkStudyGroupingSchema,
    groupingReceipts: benchmarkStudyGroupingReceiptSchema,
    captureIdentityReceiptSha256: sha256Schema,
    examinerCredentialProofsSha256: z
      .array(sha256Schema)
      .min(2)
      .max(20)
      .refine(
        (proofs) =>
          new Set(proofs.map((proof) => proof.toLowerCase())).size ===
          proofs.length,
        { message: "Examiner credential proofs must be distinct" },
      ),
    verifiedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .superRefine((envelope, context) => {
    const verifiedAt = new Date(envelope.verifiedAt).getTime();
    const checkedAt = new Date(envelope.withdrawalCheckedAt).getTime();
    const expiresAt = new Date(envelope.expiresAt).getTime();
    const retentionUntil = new Date(envelope.consentRetentionUntil).getTime();
    if (checkedAt > verifiedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["withdrawalCheckedAt"],
        message: "Withdrawal status must be checked before study-lead verification",
      });
    }
    if (verifiedAt - checkedAt > 24 * 60 * 60 * 1_000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["withdrawalCheckedAt"],
        message: "Withdrawal registry snapshot is older than 24 hours",
      });
    }
    if (
      expiresAt <= verifiedAt ||
      expiresAt > retentionUntil ||
      expiresAt - checkedAt > 24 * 60 * 60 * 1_000
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiresAt"],
        message:
          "Release attestation must expire after verification, within 24 hours of the withdrawal check, and before retention ends",
      });
    }
  });

export const benchmarkReleaseAttestationSchema = z.object({
  keyId: studyKeySchema,
  envelope: benchmarkReleaseAttestationEnvelopeSchema,
  signatureBase64: z
    .string()
    .min(80)
    .max(200)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, "Expected a base64 Ed25519 signature"),
});

export type BenchmarkReleaseAttestation = z.infer<
  typeof benchmarkReleaseAttestationSchema
>;

export function benchmarkReleaseAttestationPayload(
  envelope: z.infer<typeof benchmarkReleaseAttestationEnvelopeSchema>,
): Buffer {
  return Buffer.from(canonicalJson(envelope), "utf8");
}

export function verifyBenchmarkReleaseAttestation(params: {
  attestation: unknown;
  publicKeyPem: string;
  now?: Date;
}): BenchmarkReleaseAttestation {
  const attestation = benchmarkReleaseAttestationSchema.parse(
    params.attestation,
  );
  const now = (params.now ?? new Date()).getTime();
  if (
    now < new Date(attestation.envelope.verifiedAt).getTime() ||
    now >= new Date(attestation.envelope.expiresAt).getTime() ||
    now >= new Date(attestation.envelope.consentRetentionUntil).getTime()
  ) {
    throw new Error("Benchmark release attestation is not currently valid");
  }
  const verified = verifySignature(
    null,
    benchmarkReleaseAttestationPayload(attestation.envelope),
    createPublicKey(params.publicKeyPem),
    Buffer.from(attestation.signatureBase64, "base64"),
  );
  if (!verified) {
    throw new Error("Benchmark release attestation signature is invalid");
  }
  return attestation;
}

const benchmarkPronunciationSignalSchema = z.object({
  pronunciationScore: z.number().finite().min(0).max(100),
  accuracyScore: z.number().finite().min(0).max(100),
  fluencyScore: z.number().finite().min(0).max(100),
  completenessScore: z.number().finite().min(0).max(100).nullable(),
  prosodyScore: z.number().finite().min(0).max(100),
  mispronouncedWords: z.array(z.string().min(1).max(200)).max(25),
});

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

export const benchmarkAcousticAttestationEnvelopeSchema = z.object({
  envelopeVersion: z.literal(1),
  benchmarkKey: z.string().min(1).max(300),
  captureId: z.string().uuid(),
  audioObjectPath: protectedBenchmarkObjectPathSchema,
  reportObjectPath: protectedBenchmarkObjectPathSchema,
  audioArtifactSha256: sha256Schema,
  transcriptSha256: sha256Schema,
  transcriptReviewSha256: sha256Schema,
  configSha256: sha256Schema,
  reportSha256: sha256Schema,
  audioStorageVersion: z.string().min(1).max(500),
  audioEtag: z.string().min(1).max(500),
  reportStorageVersion: z.string().min(1).max(500),
  reportEtag: z.string().min(1).max(500),
  provider: z.literal("azure"),
  model: z.literal("pronunciation-assessment"),
  apiVersion: z.literal("speech-sdk/1.51.0"),
  assessmentMode: z.literal("unscripted"),
});

export type BenchmarkAcousticAttestationEnvelope = z.infer<
  typeof benchmarkAcousticAttestationEnvelopeSchema
>;

export const benchmarkTranscriptReviewSchema = z.object({
  reviewVersion: z.literal(1),
  reviewerKey: studyKeySchema,
  reviewedAt: z.string().datetime({ offset: true }),
  status: z.literal("verified_against_audio"),
  transcriptVersion: z.number().int().positive(),
  transcriptSha256: sha256Schema,
});

export type BenchmarkTranscriptReview = z.infer<
  typeof benchmarkTranscriptReviewSchema
>;

export function benchmarkTranscriptReviewSha256(
  review: BenchmarkTranscriptReview,
): string {
  return valueSha256(benchmarkTranscriptReviewSchema.parse(review));
}

const benchmarkAudioPreprocessingSchema = z.object({
  audioArtifactSha256: sha256Schema,
  stt: z.object({
    provider: z.string().min(1).max(100),
    model: z.string().min(1).max(200),
    transcriptSha256: sha256Schema,
  }),
  transcriptReview: benchmarkTranscriptReviewSchema,
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
          envelope.transcriptReviewSha256.toLowerCase() !==
            benchmarkTranscriptReviewSha256(preprocessing.transcriptReview) ||
          preprocessing.transcriptReview.transcriptSha256.toLowerCase() !==
            preprocessing.stt.transcriptSha256.toLowerCase() ||
          envelope.configSha256.toLowerCase() !==
            pronunciation.configSha256.toLowerCase() ||
          envelope.reportSha256.toLowerCase() !==
            pronunciation.reportSha256.toLowerCase() ||
          envelope.audioStorageVersion !== input.artifactStorageVersion ||
          envelope.audioEtag !== input.artifactEtag ||
          envelope.reportStorageVersion !== pronunciation.reportStorageVersion ||
          envelope.reportEtag !== pronunciation.reportEtag ||
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

const protectedBenchmarkLabelSchema = z
  .object({
    criteria: z.record(z.string(), protectedCriterionLabelSchema),
    overallBand: halfBandSchema,
    /** Protected input is service-role only and never returned to learners/admin UI. */
    input: protectedBenchmarkInputSchema,
    rubricVersion: z.string().min(1).max(200),
    labelAuthority: z.enum(["official_examiner", "qualified_examiner"]),
    provenance: benchmarkLabelProvenanceSchema,
    consent: protectedConsentReceiptSchema,
  })
  .superRefine((label, context) => {
    const finalCriteria = numericCriteria(
      Object.fromEntries(
        Object.entries(label.criteria).map(([criterion, value]) => [
          criterion,
          value.band,
        ]),
      ),
    );
    const finalCriterionKeys = Object.keys(finalCriteria).sort();
    const raterKeys = new Set<string>();
    for (const [index, rater] of label.provenance.raterRecords.entries()) {
      if (raterKeys.has(rater.raterKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance", "raterRecords", index, "raterKey"],
          message: "Independent examiner rater keys must be distinct",
        });
      }
      raterKeys.add(rater.raterKey);
      const criteria = numericCriteria(rater.criteria);
      if (
        Object.keys(criteria).sort().join("|") !== finalCriterionKeys.join("|")
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance", "raterRecords", index, "criteria"],
          message: "Examiner mark criteria must match the final criterion set",
        });
      }
      if (rater.rubricVersion !== label.rubricVersion) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance", "raterRecords", index, "rubricVersion"],
          message: "Examiner mark rubric version differs from the locked rubric",
        });
      }
      if (
        Object.keys(criteria).length === 4 &&
        computeBenchmarkOverallBand(criteria) !== rater.overallBand
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance", "raterRecords", index, "overallBand"],
          message: "Examiner overall band is inconsistent with criterion marks",
        });
      }
    }

    const criterionDisagreement = finalCriterionKeys.some((criterion) => {
      const values = label.provenance.raterRecords
        .map((rater) => numericCriteria(rater.criteria)[criterion])
        .filter((band): band is number => typeof band === "number");
      return values.length >= 2 && Math.max(...values) - Math.min(...values) > 0.5;
    });
    const overallValues = label.provenance.raterRecords.map(
      (rater) => rater.overallBand,
    );
    const overallDisagreement =
      Math.max(...overallValues) - Math.min(...overallValues) > 0.5;
    const requiredReasons = [
      ...(criterionDisagreement
        ? (["criterion_disagreement_over_half"] as const)
        : []),
      ...(overallDisagreement
        ? (["overall_disagreement_over_half"] as const)
        : []),
      ...(label.provenance.declaredBoundaryCrossing
        ? (["declared_boundary_crossing"] as const)
        : []),
    ];
    const adjudication = label.provenance.adjudication;
    if (requiredReasons.length > 0 && !adjudication) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provenance", "adjudication"],
        message:
          "Examiner disagreement or a declared boundary crossing requires adjudication",
      });
      return;
    }

    if (requiredReasons.length === 0 && adjudication) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["provenance", "adjudication"],
        message: "Adjudication must be absent when no adjudication trigger exists",
      });
      return;
    }

    if (adjudication) {
      const adjudicatedCriteria = numericCriteria(adjudication.criteria);
      if (raterKeys.has(adjudication.adjudicatorKey)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance", "adjudication", "adjudicatorKey"],
          message: "The adjudicator must be distinct from independent raters",
        });
      }
      if (adjudication.rubricVersion !== label.rubricVersion) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance", "adjudication", "rubricVersion"],
          message: "Adjudication rubric version differs from the locked rubric",
        });
      }
      const actualReasons = [...adjudication.triggerReasons].sort();
      const expectedReasons = [...requiredReasons].sort();
      if (actualReasons.join("|") !== expectedReasons.join("|")) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["provenance", "adjudication", "triggerReasons"],
          message: "Adjudication trigger reasons must exactly match the observed triggers",
        });
      }
      if (
        Object.keys(adjudicatedCriteria).sort().join("|") !==
          finalCriterionKeys.join("|") ||
        finalCriterionKeys.some(
          (criterion) =>
            adjudicatedCriteria[criterion] !== finalCriteria[criterion],
        )
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria"],
          message: "Final criterion labels differ from adjudicated labels",
        });
      }
      if (
        Object.keys(adjudicatedCriteria).length === 4 &&
        (computeBenchmarkOverallBand(adjudicatedCriteria) !==
          adjudication.overallBand ||
          adjudication.overallBand !== label.overallBand)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["overallBand"],
          message: "Final overall band differs from adjudicated criterion marks",
        });
      }
      return;
    }

    for (const criterion of finalCriterionKeys) {
      const values = label.provenance.raterRecords.map(
        (rater) => numericCriteria(rater.criteria)[criterion]!,
      );
      const expected = snapHalfBand(
        values.reduce((sum, band) => sum + band, 0) / values.length,
      );
      if (finalCriteria[criterion] !== expected) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["criteria", criterion, "band"],
          message: "Final criterion label differs from the independent-mark mean",
        });
      }
    }
    if (
      finalCriterionKeys.length === 4 &&
      computeBenchmarkOverallBand(finalCriteria) !== label.overallBand
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["overallBand"],
        message: "Final overall band is inconsistent with final criterion labels",
      });
    }
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
  releaseAttestation: benchmarkReleaseAttestationSchema,
  metadata: z
    .object({
      candidateKey: studyKeySchema,
      promptFamilyKey: studyKeySchema,
      sourceGroupKey: studyKeySchema,
      captureSessionKey: studyKeySchema,
      studyDesignId: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.id),
      studyDesignVersion: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.version),
      /** Required for Speaking slice analysis and accent-bias checks. */
      l1Group: z.string().min(1).max(100).optional(),
      audioQualityGroup: z
        .enum(["studio", "quiet_room", "typical_device", "degraded"])
        .optional(),
    })
    .catchall(z.unknown()),
  })
  .superRefine((benchmark, context) => {
    const attestation = benchmark.releaseAttestation.envelope;
    const credentialProofs = benchmark.protectedLabel.provenance.raterRecords
      .map((rater) => rater.credential.proofSha256.toLowerCase())
      .sort();
    const attestedCredentialProofs = attestation.examinerCredentialProofsSha256
      .map((proof) => proof.toLowerCase())
      .sort();
    const bindingMismatch =
      attestation.benchmarkKey !== benchmark.benchmarkKey ||
      attestation.artifactSha256.toLowerCase() !==
        benchmark.protectedLabel.input.artifactSha256.toLowerCase() ||
      attestation.consentReceiptSha256.toLowerCase() !==
        benchmark.protectedLabel.consent.receiptSha256.toLowerCase() ||
      attestation.withdrawalRegistryReceiptSha256.toLowerCase() !==
        benchmark.protectedLabel.consent.withdrawal.registryReceiptSha256.toLowerCase() ||
      attestation.consentRetentionUntil !==
        benchmark.protectedLabel.consent.retentionUntil ||
      attestation.grouping.candidateKey !== benchmark.metadata.candidateKey ||
      attestation.grouping.promptFamilyKey !== benchmark.metadata.promptFamilyKey ||
      attestation.grouping.sourceGroupKey !== benchmark.metadata.sourceGroupKey ||
      attestation.grouping.captureSessionKey !== benchmark.metadata.captureSessionKey ||
      credentialProofs.join("|") !== attestedCredentialProofs.join("|");
    if (bindingMismatch) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["releaseAttestation"],
        message:
          "Study-lead attestation does not bind the benchmark artifact, consent, credentials, and grouping identity",
      });
    }
    if (
      benchmark.split !== "development" &&
      !benchmark.protectedLabel.consent.scopes.futureVersionedReevaluation
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["protectedLabel", "consent", "scopes", "futureVersionedReevaluation"],
        message: "Evaluation and holdout cases require future re-evaluation consent",
      });
    }
    if (
      benchmark.skill === "ielts_speaking" &&
      !benchmark.protectedLabel.consent.scopes.voiceProcessing
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["protectedLabel", "consent", "scopes", "voiceProcessing"],
        message: "Speaking benchmarks require voice-processing consent",
      });
    }
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
    releaseAttestation: benchmarkReleaseAttestationSchema,
    metadata: benchmarkCaseSchema.shape.metadata,
    source: z.object({
      canonicalUrl: z.string().url(),
      authorityTier: z.enum(["official", "qualified_examiner_or_adjudicator"]),
      rightsStatus: z.enum([
        "approved_for_benchmark_evaluation",
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
    const attestation = benchmark.releaseAttestation.envelope;
    const credentialProofs = benchmark.protectedLabel.provenance.raterRecords
      .map((rater) => rater.credential.proofSha256.toLowerCase())
      .sort();
    const attestedCredentialProofs = attestation.examinerCredentialProofsSha256
      .map((proof) => proof.toLowerCase())
      .sort();
    if (
      attestation.benchmarkKey !== benchmark.benchmarkKey ||
      attestation.artifactSha256.toLowerCase() !==
        benchmark.protectedLabel.input.artifactSha256.toLowerCase() ||
      attestation.consentReceiptSha256.toLowerCase() !==
        benchmark.protectedLabel.consent.receiptSha256.toLowerCase() ||
      attestation.consentRetentionUntil !==
        benchmark.protectedLabel.consent.retentionUntil ||
      attestation.grouping.candidateKey !== benchmark.metadata.candidateKey ||
      attestation.grouping.promptFamilyKey !== benchmark.metadata.promptFamilyKey ||
      attestation.grouping.sourceGroupKey !== benchmark.metadata.sourceGroupKey ||
      attestation.grouping.captureSessionKey !== benchmark.metadata.captureSessionKey ||
      credentialProofs.join("|") !== attestedCredentialProofs.join("|")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["releaseAttestation"],
        message: "Stored benchmark study-lead attestation binding is invalid",
      });
    }
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
  studyDesign: z.object({
    id: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.id),
    version: z.literal(IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.version),
  }),
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
  assertCurrentBenchmarkStudyDesignIdentity(parsed.studyDesign);
  const manifestCreatedAt = new Date(parsed.createdAt).getTime();
  for (const benchmark of parsed.benchmarks) {
    const consent = benchmark.protectedLabel.consent;
    const withdrawalCheckedAt = new Date(
      benchmark.releaseAttestation.envelope.withdrawalCheckedAt,
    ).getTime();
    const retentionUntil = new Date(consent.retentionUntil).getTime();
    const attestation = benchmark.releaseAttestation.envelope;
    if (retentionUntil <= manifestCreatedAt) {
      throw new Error(
        `Consent retention expires before import: ${benchmark.benchmarkKey}`,
      );
    }
    if (
      withdrawalCheckedAt > manifestCreatedAt ||
      manifestCreatedAt - withdrawalCheckedAt > 24 * 60 * 60 * 1_000
    ) {
      throw new Error(
        `Withdrawal registry check is not fresh for import: ${benchmark.benchmarkKey}`,
      );
    }
    if (
      manifestCreatedAt < new Date(attestation.verifiedAt).getTime() ||
      manifestCreatedAt >= new Date(attestation.expiresAt).getTime()
    ) {
      throw new Error(
        `Study-lead release attestation is not valid at import: ${benchmark.benchmarkKey}`,
      );
    }
  }
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
  const splitByGroup = {
    sourceUrl: new Map<string, string>(),
    candidateKey: new Map<string, string>(),
    promptFamilyKey: new Map<string, string>(),
    sourceGroupKey: new Map<string, string>(),
    captureSessionKey: new Map<string, string>(),
  };
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
    for (const [index, rater] of benchmark.protectedLabel.provenance.raterRecords.entries()) {
      const raterCriteria = Object.keys(rater.criteria)
        .map(normalizeIeltsCriterion)
        .sort();
      if (
        raterCriteria.length !== requiredCriteria.length ||
        raterCriteria.some(
          (criterion, criterionIndex) =>
            criterion !== requiredCriteria[criterionIndex],
        )
      ) {
        throw new Error(
          `Incomplete examiner ${index + 1} criterion marks for ${benchmark.benchmarkKey}`,
        );
      }
    }
    const adjudication = benchmark.protectedLabel.provenance.adjudication;
    if (adjudication) {
      const adjudicatedCriteria = Object.keys(adjudication.criteria)
        .map(normalizeIeltsCriterion)
        .sort();
      if (
        adjudicatedCriteria.length !== requiredCriteria.length ||
        adjudicatedCriteria.some(
          (criterion, index) => criterion !== requiredCriteria[index],
        )
      ) {
        throw new Error(
          `Incomplete adjudicated criterion marks for ${benchmark.benchmarkKey}`,
        );
      }
    }
    const groups = {
      sourceUrl: benchmark.sourceUrl,
      candidateKey: benchmark.metadata.candidateKey,
      promptFamilyKey: benchmark.metadata.promptFamilyKey,
      sourceGroupKey: benchmark.metadata.sourceGroupKey,
      captureSessionKey: benchmark.metadata.captureSessionKey,
    };
    for (const [kind, key] of Object.entries(groups)) {
      const map = splitByGroup[kind as keyof typeof splitByGroup];
      const previousSplit = map.get(key);
      if (previousSplit && previousSplit !== benchmark.split) {
        throw new Error(`${kind} leakage across benchmark splits: ${key}`);
      }
      map.set(key, benchmark.split);
    }
    if (
      benchmark.accentGroup &&
      !IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.strata.accentGroups.includes(
        benchmark.accentGroup as never,
      )
    ) {
      throw new Error(
        `Unknown controlled accent group: ${benchmark.accentGroup}`,
      );
    }
    if (
      benchmark.metadata.l1Group &&
      !IELTS_BENCHMARK_STUDY_DESIGN_CURRENT.strata.l1Groups.includes(
        benchmark.metadata.l1Group as never,
      )
    ) {
      throw new Error(
        `Unknown controlled L1 group: ${benchmark.metadata.l1Group}`,
      );
    }
  }
  return parsed;
}
