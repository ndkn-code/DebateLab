import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const knowledgeCollectionSlugSchema = z.enum([
  "debate.vi.truong_teen",
  "debate.en.competitive",
  "ielts.speaking",
  "ielts.writing",
]);

export const gradingRunStatusSchema = z.object({
  runId: uuidSchema,
  kind: z.enum([
    "practice_analysis",
    "ielts_speaking_score",
    "ielts_writing_score",
  ]),
  backend: z.string().max(32),
  status: z.string().max(32),
  phase: z.string().max(64),
  workflowAttemptCount: z.number().int().nonnegative(),
  providerAttemptCount: z.number().int().nonnegative(),
  manualRetryCount: z.number().int().nonnegative(),
  lastErrorCode: z.string().max(96).nullable(),
  leaseExpiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  completedAt: z.string().nullable(),
  failedAt: z.string().nullable(),
});

export const modelHealthSchema = z.object({
  windowHours: z.number().int().min(1).max(168),
  sampledRequestCount: z.number().int().nonnegative(),
  sampleLimited: z.boolean(),
  models: z.array(
    z.object({
      provider: z.string().max(32),
      model: z.string().max(128),
      requestCount: z.number().int().nonnegative(),
      successCount: z.number().int().nonnegative(),
      errorCount: z.number().int().nonnegative(),
      successRate: z.number().min(0).max(1),
      averageLatencyMs: z.number().nonnegative().nullable(),
      p95LatencyMs: z.number().nonnegative().nullable(),
      totalTokens: z.number().int().nonnegative(),
      estimatedCostUsd: z.number().nonnegative(),
    }),
  ),
});

export const failedOrStaleJobsSchema = z.object({
  jobs: z.array(
    z.object({
      runId: uuidSchema,
      kind: z.string().max(64),
      status: z.string().max(32),
      phase: z.string().max(64),
      workflowAttemptCount: z.number().int().nonnegative(),
      providerAttemptCount: z.number().int().nonnegative(),
      manualRetryCount: z.number().int().nonnegative(),
      lastErrorCode: z.string().max(96).nullable(),
      leaseExpiresAt: z.string().nullable(),
      updatedAt: z.string(),
      stale: z.boolean(),
      reconciliationCandidate: z.boolean(),
    }),
  ),
});

export const corpusVersionsSchema = z.object({
  collections: z.array(
    z.object({
      collectionId: uuidSchema,
      slug: z.string().max(128),
      domain: z.string().max(32),
      language: z.string().max(32),
      activeVersion: z.number().int().positive(),
      active: z.boolean(),
      embeddingProvider: z.string().max(64),
      embeddingModel: z.string().max(128),
      embeddingDimensions: z.number().int().positive(),
    }),
  ),
});

const countMap = z.record(z.string(), z.number().int().nonnegative());
export const corpusReviewReadinessSchema = z.object({
  collectionSlug: knowledgeCollectionSlugSchema,
  collectionFound: z.boolean(),
  activeVersion: z.number().int().positive().nullable(),
  embeddingProvider: z.string().max(64).optional(),
  embeddingModel: z.string().max(128).optional(),
  embeddingDimensions: z.number().int().positive().optional(),
  versions: z.array(
    z.object({
      version: z.number().int().positive(),
      status: z.enum(["draft", "published", "superseded", "rejected"]),
      submittedAt: z.string(),
      reviewedAt: z.string().nullable(),
      publishedAt: z.string().nullable(),
      itemCount: z.number().int().nonnegative(),
      approvedItemCount: z.number().int().nonnegative(),
      gradingItemCount: z.number().int().nonnegative(),
      approvedGradingItemCount: z.number().int().nonnegative(),
      sourceCount: z.number().int().nonnegative(),
      unapprovedItemCount: z.number().int().nonnegative(),
      unapprovedSourceCount: z.number().int().nonnegative(),
      unclearedRightsSourceCount: z.number().int().nonnegative(),
      gradingAuthorityViolationCount: z.number().int().nonnegative(),
      purposePolicyViolationCount: z.number().int().nonnegative(),
      answerKeyFlagCount: z.number().int().nonnegative(),
      reviewSeparationViolationCount: z.number().int().nonnegative(),
      missingEmbeddingCount: z.number().int().nonnegative(),
      readyToPublish: z.boolean(),
    }),
  ),
});

const safeBenchmarkMetricsSchema = z.object({
  sampleCount: z.number().int().nonnegative().optional(),
  withinHalfBandRate: z.number().min(0).max(1).optional(),
  overallWithinHalfBandRate: z.number().min(0).max(1).optional(),
  quadraticWeightedKappa: z.number().min(-1).max(1).optional(),
  overallQuadraticWeightedKappa: z.number().min(-1).max(1).optional(),
  meanSignedError: z.number().optional(),
  repeatConsistencyRate: z.number().min(0).max(1).optional(),
  schemaComplianceRate: z.number().min(0).max(1).optional(),
  approvedEvidenceRate: z.number().min(0).max(1).optional(),
  passed: z.boolean().optional(),
});

export const historicalBenchmarkEvaluationSchema = z.object({
  evaluationId: uuidSchema,
  graderVersion: z.string().max(128),
  corpusVersion: z.number().int().positive(),
  createdAt: z.string(),
  metrics: safeBenchmarkMetricsSchema,
  authoritative: z.literal(false),
});

export const benchmarkResultsSchema = z.object({
  activeCaseCount: z.number().int().nonnegative(),
  attestedActiveCaseCount: z.number().int().nonnegative(),
  coverageBySkill: countMap,
  historicalEvaluations: z.array(historicalBenchmarkEvaluationSchema),
  historicalQueryLimited: z.boolean(),
});

export const syntheticSmokeResultSchema = z.object({
  model: z.enum(["qwen", "gpt-oss"]),
  modelId: z.enum(["qwen/qwen3.8-27b", "openai/gpt-oss-120b"]),
  success: z.boolean(),
  responseStatus: z.number().int().min(100).max(599),
  latencyMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
});

export type GradingRunStatus = z.infer<typeof gradingRunStatusSchema>;
export type ModelHealth = z.infer<typeof modelHealthSchema>;
export type FailedOrStaleJobs = z.infer<typeof failedOrStaleJobsSchema>;
export type CorpusVersions = z.infer<typeof corpusVersionsSchema>;
export type CorpusReviewReadiness = z.infer<typeof corpusReviewReadinessSchema>;
export type BenchmarkResults = z.infer<typeof benchmarkResultsSchema>;
export type SyntheticSmokeResult = z.infer<typeof syntheticSmokeResultSchema>;
