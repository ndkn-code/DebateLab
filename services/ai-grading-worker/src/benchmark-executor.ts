import "server-only";

import {
  AiExecutionError,
  generateStructured,
  type AiResult,
} from "@/lib/ai/core";
import {
  AI_GRADING_BENCHMARK_PRIVATE_BUCKET,
  parseGradingPrediction,
  protectedBenchmarkInputSchema,
  type ProtectedBenchmarkInput,
} from "@/lib/ai/benchmarks/contracts";
import {
  assertIeltsBenchmarkModelInputHash,
  buildIeltsBenchmarkRequest,
  ieltsBenchmarkValueSha256,
  type IeltsBenchmarkModelRequest,
} from "@/lib/ai/benchmarks/request";
import type { IeltsBenchmarkSkill } from "@/lib/ai/benchmarks/evaluate";
import {
  findIeltsBandExamples,
  getIeltsRubric,
  type KnowledgeResult,
} from "@/lib/ai/knowledge";
import {
  adjacentBands,
  buildSpeakingAdjudicationPrompt,
  buildWritingAdjudicationPrompt,
  IELTS_GRADING_VERSION,
  ieltsSpeakingAdjudicationOutputSchema,
  ieltsWritingAdjudicationOutputSchema,
  speakingBands,
  writingBands,
} from "@/lib/ielts/scoring-adjudication";
import { ieltsSpeakingModelOutputSchema } from "@/lib/scoring/ielts-speaking/result-schema";
import { ieltsWritingModelOutputSchema } from "@/lib/scoring/ielts-writing/result-schema";
import { getIeltsSpeakingScoringPolicy } from "@/lib/ielts/speaking-scorer/provider-policy";
import { getIeltsWritingScoringPolicy } from "@/lib/ielts/writing-scorer/provider-policy";
import { createAdminClient } from "@/lib/supabase/admin";

export const LOCKED_IELTS_BENCHMARK_GRADER_VERSION = IELTS_GRADING_VERSION;
const BUILTIN_IELTS_GROQ_MODELS = new Set([
  "openai/gpt-oss-120b",
  "qwen/qwen3.8-27b",
]);
export type BenchmarkRunKind = "primary" | "repeat";
export type BenchmarkPipelineStage = "provisional" | "adjudicated";
export interface BenchmarkProviderClaim {
  claimToken: string;
  claimAttempt: number;
}

export interface BenchmarkExecutionCase {
  id: string;
  benchmarkKey: string;
  skill: IeltsBenchmarkSkill;
  taskType: string;
  rubricVersion: string;
  artifactSha256: string;
  input: ProtectedBenchmarkInput;
}

export interface BenchmarkRunEvidence {
  prediction: unknown;
  providerRequestId: string;
}

export interface BenchmarkEvaluationIdentity {
  id: string;
}

export type BenchmarkClaimResult =
  | ({ outcome: "claimed" } & BenchmarkProviderClaim)
  | {
      outcome: "lease_active" | "outcome_unknown" | "exhausted" | "imported";
      providerRequestId?: string;
    }
  | { outcome: "provider_succeeded"; providerRequestId: string };

interface BenchmarkRunIdentity {
  benchmark: BenchmarkExecutionCase;
  graderVersion: string;
  corpusVersion: number;
  runKind: BenchmarkRunKind;
}

interface BenchmarkStageIdentity extends BenchmarkRunIdentity {
  pipelineStage: BenchmarkPipelineStage;
}

export interface PreparedBenchmarkRun {
  request: IeltsBenchmarkModelRequest;
  query: string;
  skill: "speaking" | "writing";
  version: string;
  baseEvidence: unknown;
  baseEvidenceSha256: string;
  runKey: string;
  admin: ReturnType<typeof createAdminClient>;
}

export interface PreparedBenchmarkAdjudication {
  prompt: string;
  evidenceSha256: string;
  provisional: BenchmarkRunEvidence;
}

export interface BenchmarkExecutorRepository {
  loadCases(params: {
    split: "evaluation" | "holdout";
    benchmarkKeys?: string[];
  }): Promise<BenchmarkExecutionCase[]>;
  loadAudioReport(
    benchmark: BenchmarkExecutionCase,
  ): Promise<Uint8Array | null>;
  findEvaluation(params: {
    benchmarkId: string;
    graderVersion: string;
    corpusVersion: number;
  }): Promise<BenchmarkEvaluationIdentity | null>;
  findRecordedRunKinds(evaluationId: string): Promise<Set<BenchmarkRunKind>>;
  findAttestedRun(
    params: BenchmarkStageIdentity & { providerRequestId?: string },
  ): Promise<BenchmarkRunEvidence | null>;
  claimRun(params: BenchmarkStageIdentity): Promise<BenchmarkClaimResult>;
  startProvider(
    params: BenchmarkStageIdentity & { claimToken: string },
  ): Promise<void>;
  completeProvider(
    params: BenchmarkStageIdentity & {
      claimToken: string;
      providerRequestId: string;
    },
  ): Promise<void>;
  failProvider(
    params: BenchmarkStageIdentity & {
      claimToken: string;
      providerRequestIds: string[];
    },
  ): Promise<"retryable" | "exhausted">;
  recoverProvider(
    params: BenchmarkStageIdentity & { providerRequestId: string },
  ): Promise<void>;
  markImported(
    params: BenchmarkRunIdentity & { providerRequestId: string },
  ): Promise<void>;
  createEvaluation(params: {
    benchmarkId: string;
    graderVersion: string;
    corpusVersion: number;
    primaryPrediction: unknown;
  }): Promise<BenchmarkEvaluationIdentity>;
  recordRun(params: {
    evaluationId: string;
    runKind: BenchmarkRunKind;
    prediction: unknown;
    providerRequestId: string;
  }): Promise<void>;
}

export interface BenchmarkExecutorGenerator {
  preflight(
    params: BenchmarkRunIdentity & {
      request: IeltsBenchmarkModelRequest;
      audioReportBytes?: Uint8Array;
    },
  ): Promise<PreparedBenchmarkRun>;
  generateProvisional(
    params: BenchmarkRunIdentity & {
      prepared: PreparedBenchmarkRun;
      claim: BenchmarkProviderClaim;
    },
  ): Promise<BenchmarkRunEvidence>;
  prepareAdjudication(
    params: BenchmarkRunIdentity & {
      prepared: PreparedBenchmarkRun;
      provisional: BenchmarkRunEvidence;
    },
  ): Promise<PreparedBenchmarkAdjudication>;
  generateAdjudication(
    params: BenchmarkRunIdentity & {
      prepared: PreparedBenchmarkRun;
      adjudication: PreparedBenchmarkAdjudication;
      claim: BenchmarkProviderClaim;
    },
  ): Promise<BenchmarkRunEvidence>;
}

export interface BenchmarkExecutionSummary {
  benchmarkCount: number;
  providerCalls: number;
  recoveredAttestedRuns: number;
  alreadyRecordedRuns: number;
  importedRuns: number;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function assertPrediction(skill: IeltsBenchmarkSkill, value: unknown) {
  if (!parseGradingPrediction(skill, value)) {
    throw new Error("Benchmark provider output failed the scoring contract");
  }
}

/**
 * The benchmark must not cross a spend fence unless every production policy
 * candidate can actually be dispatched. Operators may explicitly extend the
 * static Groq allowlist when rolling out a newly verified model.
 */
export function assertBenchmarkProviderConfiguration(
  skill: IeltsBenchmarkSkill,
): void {
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error("GROQ_API_KEY is not configured for IELTS benchmarks");
  }
  const supported = new Set(BUILTIN_IELTS_GROQ_MODELS);
  for (const model of (process.env.GROQ_IELTS_SUPPORTED_MODELS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)) {
    supported.add(model);
  }
  const policyFor =
    skill === "ielts_speaking"
      ? getIeltsSpeakingScoringPolicy
      : getIeltsWritingScoringPolicy;
  for (const stage of ["provisional", "adjudicated"] as const) {
    const candidates = policyFor(stage).candidates;
    if (candidates.length === 0) {
      throw new Error(`IELTS ${stage} scoring has no provider candidates`);
    }
    for (const candidate of candidates) {
      const model = candidate.model.trim();
      if (candidate.provider !== "groq" || !model || !supported.has(model)) {
        throw new Error(
          `Unsupported IELTS benchmark provider candidate: ${candidate.provider}/${model || "<empty>"}`,
        );
      }
    }
  }
}

function stopped(
  outcome: Exclude<BenchmarkClaimResult["outcome"], "claimed">,
): never {
  throw new Error(`Benchmark provider call blocked: ${outcome}`);
}

function definiteFailureAuditIds(error: unknown): string[] | null {
  if (!(error instanceof AiExecutionError)) return null;
  const failed = error.attempts.filter((attempt) => attempt.status === "error");
  if (failed.length === 0) return null;
  if (
    failed.some(
      (attempt) =>
        !attempt.providerRequestId ||
        (typeof attempt.responseStatus !== "number" &&
          attempt.failureKind !== "schema_invalid"),
    )
  ) {
    return null;
  }
  return [
    ...new Set(failed.map((attempt) => attempt.providerRequestId as string)),
  ];
}

async function verifiedRecovery(
  params: BenchmarkStageIdentity & {
    repository: BenchmarkExecutorRepository;
    providerRequestId?: string;
  },
): Promise<BenchmarkRunEvidence | null> {
  const recovered = await params.repository.findAttestedRun(params);
  if (!recovered) return null;
  assertPrediction(params.benchmark.skill, recovered.prediction);
  await params.repository.recoverProvider({
    benchmark: params.benchmark,
    graderVersion: params.graderVersion,
    corpusVersion: params.corpusVersion,
    runKind: params.runKind,
    pipelineStage: params.pipelineStage,
    providerRequestId: recovered.providerRequestId,
  });
  return recovered;
}

async function resolveStage(
  params: BenchmarkStageIdentity & {
    repository: BenchmarkExecutorRepository;
    invoke: (claim: BenchmarkProviderClaim) => Promise<BenchmarkRunEvidence>;
    summary: BenchmarkExecutionSummary;
  },
): Promise<BenchmarkRunEvidence> {
  const recovered = await verifiedRecovery(params);
  if (recovered) {
    params.summary.recoveredAttestedRuns += 1;
    return recovered;
  }

  const claim = await params.repository.claimRun(params);
  if (claim.outcome === "provider_succeeded") {
    const verified = await verifiedRecovery({
      ...params,
      providerRequestId: claim.providerRequestId,
    });
    if (!verified)
      throw new Error("Reserved provider result failed verification");
    params.summary.recoveredAttestedRuns += 1;
    return verified;
  }
  if (claim.outcome !== "claimed") return stopped(claim.outcome);

  // This is the atomic spend boundary. Once marked started, an expired lease
  // becomes outcome_unknown and is never automatically paid for again.
  await params.repository.startProvider({
    ...params,
    claimToken: claim.claimToken,
  });
  let generated: BenchmarkRunEvidence;
  try {
    generated = await params.invoke({
      claimToken: claim.claimToken,
      claimAttempt: claim.claimAttempt,
    });
  } catch (error) {
    const providerRequestIds = definiteFailureAuditIds(error);
    if (providerRequestIds) {
      await params.repository.failProvider({
        ...params,
        claimToken: claim.claimToken,
        providerRequestIds,
      });
    }
    // When there is no complete persisted proof of a definite response, the
    // provider_started lease remains intact and ages to outcome_unknown.
    throw error;
  }
  assertPrediction(params.benchmark.skill, generated.prediction);
  params.summary.providerCalls += 1;
  await params.repository.completeProvider({
    ...params,
    claimToken: claim.claimToken,
    providerRequestId: generated.providerRequestId,
  });
  return generated;
}

async function resolveRun(
  params: BenchmarkRunIdentity & {
    repository: BenchmarkExecutorRepository;
    generator: BenchmarkExecutorGenerator;
    request: IeltsBenchmarkModelRequest;
    audioReportBytes?: Uint8Array;
    summary: BenchmarkExecutionSummary;
  },
): Promise<BenchmarkRunEvidence> {
  const finalRecovery = await verifiedRecovery({
    ...params,
    pipelineStage: "adjudicated",
  });
  if (finalRecovery) {
    params.summary.recoveredAttestedRuns += 1;
    return finalRecovery;
  }

  // Secret, input and base retrieval validation all complete before a claim is
  // moved across a paid provider boundary.
  const prepared = await params.generator.preflight(params);
  const provisional = await resolveStage({
    ...params,
    pipelineStage: "provisional",
    invoke: (claim) =>
      params.generator.generateProvisional({ ...params, prepared, claim }),
  });

  // Adjacent-band retrieval is also completed before the adjudication stage's
  // independent spend fence is started.
  const adjudication = await params.generator.prepareAdjudication({
    ...params,
    prepared,
    provisional,
  });
  return resolveStage({
    ...params,
    pipelineStage: "adjudicated",
    invoke: (claim) =>
      params.generator.generateAdjudication({
        ...params,
        prepared,
        adjudication,
        claim,
      }),
  });
}

/** Runs protected benchmarks without exposing gold labels to the model. */
export async function executeIeltsBenchmarks(
  params: {
    graderVersion: string;
    corpusVersion: number;
    split: "evaluation" | "holdout";
    benchmarkKeys?: string[];
  },
  dependencies: {
    repository: BenchmarkExecutorRepository;
    generator: BenchmarkExecutorGenerator;
  },
): Promise<BenchmarkExecutionSummary> {
  if (
    params.graderVersion !== LOCKED_IELTS_BENCHMARK_GRADER_VERSION ||
    !Number.isInteger(params.corpusVersion) ||
    params.corpusVersion < 1
  ) {
    throw new Error(
      "The locked benchmark grader and corpus version are required",
    );
  }
  const cases = await dependencies.repository.loadCases({
    split: params.split,
    benchmarkKeys: params.benchmarkKeys,
  });
  const summary: BenchmarkExecutionSummary = {
    benchmarkCount: cases.length,
    providerCalls: 0,
    recoveredAttestedRuns: 0,
    alreadyRecordedRuns: 0,
    importedRuns: 0,
  };

  for (const benchmark of cases) {
    const audioReportBytes =
      await dependencies.repository.loadAudioReport(benchmark);
    const request = assertIeltsBenchmarkModelInputHash(
      {
        skill: benchmark.skill,
        taskType: benchmark.taskType,
        rubricVersion: benchmark.rubricVersion,
        input: benchmark.input,
      },
      { audioReportBytes: audioReportBytes ?? undefined },
    );
    let evaluation = await dependencies.repository.findEvaluation({
      benchmarkId: benchmark.id,
      graderVersion: params.graderVersion,
      corpusVersion: params.corpusVersion,
    });
    let recorded = evaluation
      ? await dependencies.repository.findRecordedRunKinds(evaluation.id)
      : new Set<BenchmarkRunKind>();

    let primary: BenchmarkRunEvidence | null = null;
    if (recorded.has("primary")) summary.alreadyRecordedRuns += 1;
    else {
      primary = await resolveRun({
        ...params,
        repository: dependencies.repository,
        generator: dependencies.generator,
        benchmark,
        request,
        audioReportBytes: audioReportBytes ?? undefined,
        runKind: "primary",
        summary,
      });
    }

    if (!evaluation) {
      if (!primary)
        throw new Error("Benchmark primary prediction is unavailable");
      evaluation = await dependencies.repository.createEvaluation({
        benchmarkId: benchmark.id,
        graderVersion: params.graderVersion,
        corpusVersion: params.corpusVersion,
        primaryPrediction: primary.prediction,
      });
      recorded = await dependencies.repository.findRecordedRunKinds(
        evaluation.id,
      );
    }
    if (!recorded.has("primary") && primary) {
      await dependencies.repository.recordRun({
        evaluationId: evaluation.id,
        runKind: "primary",
        prediction: primary.prediction,
        providerRequestId: primary.providerRequestId,
      });
      await dependencies.repository.markImported({
        benchmark,
        graderVersion: params.graderVersion,
        corpusVersion: params.corpusVersion,
        runKind: "primary",
        providerRequestId: primary.providerRequestId,
      });
      summary.importedRuns += 1;
    }

    if (recorded.has("repeat")) {
      summary.alreadyRecordedRuns += 1;
      continue;
    }
    const repeat = await resolveRun({
      ...params,
      repository: dependencies.repository,
      generator: dependencies.generator,
      benchmark,
      request,
      audioReportBytes: audioReportBytes ?? undefined,
      runKind: "repeat",
      summary,
    });
    await dependencies.repository.recordRun({
      evaluationId: evaluation.id,
      runKind: "repeat",
      prediction: repeat.prediction,
      providerRequestId: repeat.providerRequestId,
    });
    await dependencies.repository.markImported({
      benchmark,
      graderVersion: params.graderVersion,
      corpusVersion: params.corpusVersion,
      runKind: "repeat",
      providerRequestId: repeat.providerRequestId,
    });
    summary.importedRuns += 1;
  }
  return summary;
}

function successfulProviderRequestId(result: AiResult<unknown>): string {
  const attempt = [...result.attempts]
    .reverse()
    .find(
      (candidate) =>
        candidate.status === "success" && candidate.providerRequestId,
    );
  if (!attempt?.providerRequestId) {
    throw new Error("Benchmark provider audit was not persisted");
  }
  return attempt.providerRequestId;
}

function collectionVersion(result: KnowledgeResult): string | null {
  const data = record(result.data);
  return typeof data.collectionVersion === "string"
    ? data.collectionVersion
    : null;
}

function assertPinnedEvidence(
  result: KnowledgeResult,
  expectedVersion: string,
  stage: string,
) {
  if (
    result.evidence.length === 0 ||
    collectionVersion(result) !== expectedVersion ||
    result.evidence.some((item) => item.version !== expectedVersion)
  ) {
    throw new Error(
      `${stage} lacks approved evidence from corpus ${expectedVersion}`,
    );
  }
}

function criteria(skill: IeltsBenchmarkSkill) {
  return skill === "ielts_speaking"
    ? [
        "fluencyCoherence",
        "lexicalResource",
        "grammaticalRangeAccuracy",
        "pronunciation",
      ]
    : [
        "taskResponse",
        "coherenceCohesion",
        "lexicalResource",
        "grammaticalRangeAccuracy",
      ];
}

function benchmarkMetadata(
  params: BenchmarkRunIdentity,
  extra: {
    stage: "provisional" | "adjudicated";
    baseInputSha256: string;
    evidenceSha256: string;
    provisionalRequestId?: string;
    provisionalOutputSha256?: string;
    claim: BenchmarkProviderClaim;
  },
) {
  return {
    benchmarkEvaluationRun: true,
    benchmarkKey: params.benchmark.benchmarkKey,
    graderVersion: params.graderVersion,
    corpusVersion: params.corpusVersion,
    evaluationRunKind: params.runKind,
    benchmarkArtifactSha256: params.benchmark.artifactSha256,
    benchmarkBaseInputSha256: extra.baseInputSha256,
    benchmarkPipelineVersion: LOCKED_IELTS_BENCHMARK_GRADER_VERSION,
    benchmarkPipelineStage: extra.stage,
    benchmarkProvisionalRequestId: extra.provisionalRequestId ?? null,
    benchmarkProvisionalOutputSha256: extra.provisionalOutputSha256 ?? null,
    benchmarkEvidenceSha256: extra.evidenceSha256,
    benchmarkClaimToken: extra.claim.claimToken,
    benchmarkClaimAttempt: extra.claim.claimAttempt,
  };
}

/** Uses production retrieval, scoring, adjacent-band retrieval and adjudication. */
export function createProductionBenchmarkGenerator(): BenchmarkExecutorGenerator {
  return {
    async generateProvisional(params) {
      const { prepared } = params;
      const baseContext = {
        traceId: crypto.randomUUID(),
        sourceRoute: "gcp:ai-grading-worker/benchmark-executor",
        userId: null,
      };
      const result =
        params.benchmark.skill === "ielts_speaking"
          ? await generateStructured({
              task: "ielts_speaking_score",
              prompt: prepared.request.messages[0]!.content,
              messages: prepared.request.messages,
              schema: ieltsSpeakingModelOutputSchema,
              context: {
                ...baseContext,
                task: "ielts_speaking_score",
                outputType: "ielts_speaking_score_benchmark_provisional",
                idempotencyKey: `${prepared.runKey}:provisional`,
                metadata: benchmarkMetadata(params, {
                  stage: "provisional",
                  baseInputSha256: params.benchmark.input.modelInputSha256,
                  evidenceSha256: prepared.baseEvidenceSha256,
                  claim: params.claim,
                }),
              },
              policy: getIeltsSpeakingScoringPolicy("provisional"),
            })
          : await generateStructured({
              task: "ielts_writing_score",
              prompt: prepared.request.messages[0]!.content,
              messages: prepared.request.messages,
              schema: ieltsWritingModelOutputSchema,
              context: {
                ...baseContext,
                task: "ielts_writing_score",
                outputType: "ielts_writing_score_benchmark_provisional",
                idempotencyKey: `${prepared.runKey}:provisional`,
                metadata: benchmarkMetadata(params, {
                  stage: "provisional",
                  baseInputSha256: params.benchmark.input.modelInputSha256,
                  evidenceSha256: prepared.baseEvidenceSha256,
                  claim: params.claim,
                }),
              },
              policy: getIeltsWritingScoringPolicy("provisional"),
            });
      return {
        prediction: result.output,
        providerRequestId: successfulProviderRequestId(result),
      };
    },
    async prepareAdjudication(params) {
      const { prepared, provisional } = params;
      const targetBands =
        params.benchmark.skill === "ielts_speaking"
          ? adjacentBands(
              speakingBands(
                ieltsSpeakingModelOutputSchema.parse(provisional.prediction),
              ),
            )
          : adjacentBands(
              writingBands(
                ieltsWritingModelOutputSchema.parse(provisional.prediction),
              ),
            );
      const adjacent = await findIeltsBandExamples({
        purpose: "grading",
        language: "en",
        userId: null,
        supabase: prepared.admin,
        corpusVersion: prepared.version,
        sensitiveQuery: true,
        skill: prepared.skill,
        taskType: params.benchmark.taskType,
        criteria: criteria(params.benchmark.skill),
        targetBands,
        query: prepared.query,
        limit: 12,
        sourceRoute: "gcp:ai-grading-worker/benchmark-executor/adjudication",
      });
      assertPinnedEvidence(
        adjacent,
        prepared.version,
        "adjacent-band retrieval",
      );
      const evidenceSha256 = ieltsBenchmarkValueSha256({
        ...(prepared.baseEvidence as Record<string, unknown>),
        adjacent: adjacent.evidence,
        targetBands,
      });
      const prompt =
        params.benchmark.skill === "ielts_speaking"
          ? buildSpeakingAdjudicationPrompt({
              originalPrompt: prepared.request.messages[0]!.content,
              provisionalOutput: ieltsSpeakingModelOutputSchema.parse(
                provisional.prediction,
              ),
              evidenceContext: adjacent.context,
            })
          : buildWritingAdjudicationPrompt({
              originalPrompt: prepared.request.messages[0]!.content,
              provisionalOutput: ieltsWritingModelOutputSchema.parse(
                provisional.prediction,
              ),
              evidenceContext: adjacent.context,
            });
      return { prompt, evidenceSha256, provisional };
    },
    async generateAdjudication(params) {
      const { prepared, adjudication } = params;
      const metadata = benchmarkMetadata(params, {
        stage: "adjudicated",
        baseInputSha256: params.benchmark.input.modelInputSha256,
        evidenceSha256: adjudication.evidenceSha256,
        provisionalRequestId: adjudication.provisional.providerRequestId,
        provisionalOutputSha256: ieltsBenchmarkValueSha256(
          adjudication.provisional.prediction,
        ),
        claim: params.claim,
      });
      const baseContext = {
        traceId: crypto.randomUUID(),
        sourceRoute: "gcp:ai-grading-worker/benchmark-executor/adjudication",
        userId: null,
      };
      const result =
        params.benchmark.skill === "ielts_speaking"
          ? await generateStructured({
              task: "ielts_speaking_adjudication",
              prompt: adjudication.prompt,
              schema: ieltsSpeakingAdjudicationOutputSchema,
              context: {
                ...baseContext,
                task: "ielts_speaking_adjudication",
                outputType: "ielts_speaking_score_benchmark_adjudication",
                idempotencyKey: `${prepared.runKey}:adjudication`,
                metadata,
              },
              policy: getIeltsSpeakingScoringPolicy("adjudicated"),
            })
          : await generateStructured({
              task: "ielts_writing_adjudication",
              prompt: adjudication.prompt,
              schema: ieltsWritingAdjudicationOutputSchema,
              context: {
                ...baseContext,
                task: "ielts_writing_adjudication",
                outputType: "ielts_writing_score_benchmark_adjudication",
                idempotencyKey: `${prepared.runKey}:adjudication`,
                metadata,
              },
              policy: getIeltsWritingScoringPolicy("adjudicated"),
            });
      return {
        prediction: result.output,
        providerRequestId: successfulProviderRequestId(result),
      };
    },
    async preflight(params) {
      assertBenchmarkProviderConfiguration(params.benchmark.skill);
      if (!process.env.AI_GRADING_BENCHMARK_ATTESTATION_SECRET?.trim()) {
        throw new Error("Benchmark attestation is not configured");
      }
      const admin = createAdminClient();
      const version = String(params.corpusVersion);
      const response =
        params.benchmark.input.responseText ??
        params.benchmark.input.scoringResponseText;
      if (!response?.trim())
        throw new Error("Benchmark scoring text is unavailable");
      const query = `${params.benchmark.input.prompt}\n${response}`;
      const skill: "speaking" | "writing" =
        params.benchmark.skill === "ielts_speaking" ? "speaking" : "writing";
      const shared = {
        purpose: "grading" as const,
        language: "en" as const,
        sourceRoute: "gcp:ai-grading-worker/benchmark-executor",
        userId: null,
        supabase: admin,
        corpusVersion: version,
        sensitiveQuery: true,
      };
      const [rubric, broad] = await Promise.all([
        getIeltsRubric({
          ...shared,
          skill,
          query: `Official IELTS ${skill} descriptors for ${params.benchmark.taskType}`,
          limit: 8,
        }),
        findIeltsBandExamples({
          ...shared,
          skill,
          taskType: params.benchmark.taskType,
          criteria: criteria(params.benchmark.skill),
          query,
          limit: 8,
        }),
      ]);
      assertPinnedEvidence(rubric, version, "rubric retrieval");
      assertPinnedEvidence(broad, version, "broad exemplar retrieval");
      const baseEvidence = {
        corpusVersion: version,
        rubric: rubric.evidence,
        broad: broad.evidence,
      };
      const baseEvidenceSha256 = ieltsBenchmarkValueSha256(baseEvidence);
      const provisionalRequest = buildIeltsBenchmarkRequest(
        {
          skill: params.benchmark.skill,
          taskType: params.benchmark.taskType,
          rubricVersion: params.benchmark.rubricVersion,
          input: params.benchmark.input,
        },
        {
          evidenceContext: [rubric.context, broad.context]
            .filter(Boolean)
            .join("\n\n"),
          audioReportBytes: params.audioReportBytes,
        },
      );
      const runKey = [
        "benchmark",
        params.benchmark.id,
        params.graderVersion,
        params.corpusVersion,
        params.runKind,
      ].join(":");
      const prepared = {
        request: provisionalRequest,
        query,
        skill,
        version,
        baseEvidence,
        baseEvidenceSha256,
        runKey,
        admin,
      };
      return prepared;
    },
  };
}

interface QueryResult {
  data: unknown;
  error: { message: string; code?: string } | null;
}

function rpcRow(data: unknown): Record<string, unknown> {
  return record(Array.isArray(data) ? data[0] : data);
}

function claimOutcome(data: unknown): BenchmarkClaimResult {
  const row = rpcRow(data);
  const outcome = row.outcome;
  const providerRequestId =
    typeof row.provider_request_id === "string"
      ? row.provider_request_id
      : undefined;
  if (
    outcome === "claimed" &&
    typeof row.claim_token === "string" &&
    typeof row.claim_attempt === "number" &&
    Number.isInteger(row.claim_attempt) &&
    row.claim_attempt >= 1 &&
    row.claim_attempt <= 3
  ) {
    return {
      outcome,
      claimToken: row.claim_token,
      claimAttempt: row.claim_attempt,
    };
  }
  if (outcome === "provider_succeeded" && providerRequestId) {
    return { outcome, providerRequestId };
  }
  if (
    outcome === "lease_active" ||
    outcome === "outcome_unknown" ||
    outcome === "exhausted" ||
    outcome === "imported"
  ) {
    return { outcome, providerRequestId };
  }
  throw new Error("Benchmark claim RPC returned an invalid outcome");
}

/** Service-role repository. Protected labels never leave this worker. */
export function createProductionBenchmarkRepository(): BenchmarkExecutorRepository {
  const client = createAdminClient() as unknown as {
    from(table: string): any;
    rpc(name: string, args: Record<string, unknown>): PromiseLike<QueryResult>;
    storage: {
      from(bucket: string): {
        download(path: string): PromiseLike<{
          data: Blob | null;
          error: { message: string } | null;
        }>;
      };
    };
    schema(name: "storage"): {
      from(table: "objects" | "buckets"): { select(columns: string): any };
    };
  };
  const rpc = async (name: string, args: Record<string, unknown>) => {
    const { data, error } = await client.rpc(name, args);
    if (error) throw new Error(`${name} failed: ${error.message}`);
    return data;
  };
  return {
    async loadCases(params) {
      let query = client
        .from("ai_grading_benchmarks")
        .select(
          "id,benchmark_key,skill,task_type,protected_label,split,is_active",
        )
        .eq("is_active", true)
        .eq("split", params.split)
        .order("benchmark_key", { ascending: true });
      if (params.benchmarkKeys?.length) {
        query = query.in("benchmark_key", params.benchmarkKeys);
      }
      const { data, error } = (await query) as QueryResult;
      if (error) throw new Error(`Benchmark lookup failed: ${error.message}`);
      return (Array.isArray(data) ? data : []).map((value) => {
        const row = record(value);
        const label = record(row.protected_label);
        const input = protectedBenchmarkInputSchema.parse(label.input);
        const skill = row.skill;
        if (skill !== "ielts_speaking" && skill !== "ielts_writing") {
          throw new Error("Unsupported protected benchmark skill");
        }
        if (
          typeof row.id !== "string" ||
          typeof row.benchmark_key !== "string" ||
          typeof row.task_type !== "string" ||
          typeof label.rubricVersion !== "string"
        ) {
          throw new Error("Protected benchmark row is incomplete");
        }
        return {
          id: row.id,
          benchmarkKey: row.benchmark_key,
          skill,
          taskType: row.task_type,
          rubricVersion: label.rubricVersion,
          artifactSha256: input.artifactSha256.toLowerCase(),
          input,
        };
      });
    },
    async loadAudioReport(benchmark) {
      if (!benchmark.input.audioObjectPath) return null;
      const provenance = benchmark.input.audioPreprocessing?.pronunciation;
      const attestation =
        benchmark.input.audioPreprocessing?.acousticAttestation;
      if (!provenance)
        throw new Error("Benchmark Azure report provenance missing");
      if (!attestation)
        throw new Error("Benchmark acoustic attestation missing");
      const verified = await rpc(
        "verify_ai_grading_benchmark_acoustic_attestation",
        {
          p_benchmark_key: benchmark.benchmarkKey,
          p_envelope: attestation.envelope,
          p_signature: attestation.signature,
        },
      );
      if (verified !== true) {
        throw new Error("Benchmark acoustic attestation verification failed");
      }
      const [bucket, ...pathParts] = provenance.reportObjectPath.split("/");
      const path = pathParts.join("/");
      if (bucket !== AI_GRADING_BENCHMARK_PRIVATE_BUCKET || !path) {
        throw new Error("Benchmark Azure report path must be bucket/object");
      }
      const { data: bucketRow, error: bucketError } = (await client
        .schema("storage")
        .from("buckets")
        .select("id,public")
        .eq("id", AI_GRADING_BENCHMARK_PRIVATE_BUCKET)
        .maybeSingle()) as QueryResult;
      const privateBucket = record(bucketRow);
      if (
        bucketError ||
        !bucketRow ||
        privateBucket.id !== AI_GRADING_BENCHMARK_PRIVATE_BUCKET ||
        privateBucket.public !== false
      ) {
        throw new Error("Benchmark private storage bucket is unavailable");
      }
      const { data: objectRow, error: objectError } = (await client
        .schema("storage")
        .from("objects")
        .select("version,metadata")
        .eq("bucket_id", bucket)
        .eq("name", path)
        .maybeSingle()) as QueryResult;
      const object = record(objectRow);
      const metadata = record(object.metadata);
      const etag = metadata.eTag ?? metadata.etag;
      if (
        objectError ||
        !objectRow ||
        String(object.version ?? "") !== provenance.reportStorageVersion ||
        String(etag ?? "") !== provenance.reportEtag
      ) {
        throw new Error("Benchmark Azure report object identity mismatch");
      }
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error || !data)
        throw new Error("Benchmark Azure report download failed");
      return new Uint8Array(await data.arrayBuffer());
    },
    async findEvaluation(params) {
      const { data, error } = (await client
        .from("ai_grading_evaluations")
        .select("id")
        .eq("benchmark_id", params.benchmarkId)
        .eq("grader_version", params.graderVersion)
        .eq("corpus_version", params.corpusVersion)
        .maybeSingle()) as QueryResult;
      if (error) throw new Error(`Evaluation lookup failed: ${error.message}`);
      const row = record(data);
      return typeof row.id === "string" ? { id: row.id } : null;
    },
    async findRecordedRunKinds(evaluationId) {
      const { data, error } = (await client
        .from("ai_grading_evaluation_runs")
        .select("run_kind")
        .eq("evaluation_id", evaluationId)) as QueryResult;
      if (error)
        throw new Error(`Evaluation run lookup failed: ${error.message}`);
      return new Set(
        (Array.isArray(data) ? data : [])
          .map((value) => record(value).run_kind)
          .filter(
            (kind): kind is BenchmarkRunKind =>
              kind === "primary" || kind === "repeat",
          ),
      );
    },
    async findAttestedRun(params) {
      let candidateIds: string[] = [];
      if (params.providerRequestId) candidateIds = [params.providerRequestId];
      else {
        const { data, error } = (await client
          .from("ai_provider_requests")
          .select("id,created_at")
          .eq("status", "success")
          .contains("metadata", {
            benchmarkEvaluationRun: true,
            benchmarkKey: params.benchmark.benchmarkKey,
            graderVersion: params.graderVersion,
            corpusVersion: params.corpusVersion,
            evaluationRunKind: params.runKind,
            benchmarkPipelineStage: params.pipelineStage,
          })
          .order("created_at", { ascending: false })
          .limit(20)) as QueryResult;
        if (error)
          throw new Error(`Provider audit recovery failed: ${error.message}`);
        candidateIds = (Array.isArray(data) ? data : [])
          .map((value) => record(value).id)
          .filter((id): id is string => typeof id === "string");
      }
      for (const providerRequestId of candidateIds) {
        const { data, error } = await client.rpc(
          "verify_ai_grading_benchmark_provider_request",
          {
            p_benchmark_id: params.benchmark.id,
            p_grader_version: params.graderVersion,
            p_corpus_version: params.corpusVersion,
            p_run_kind: params.runKind,
            p_pipeline_stage: params.pipelineStage,
            p_provider_request_id: providerRequestId,
          },
        );
        if (error) continue;
        const prediction = rpcRow(data).prediction;
        if (parseGradingPrediction(params.benchmark.skill, prediction)) {
          return { prediction, providerRequestId };
        }
      }
      return null;
    },
    async claimRun(params) {
      return claimOutcome(
        await rpc("claim_ai_grading_benchmark_run", {
          p_benchmark_id: params.benchmark.id,
          p_grader_version: params.graderVersion,
          p_corpus_version: params.corpusVersion,
          p_run_kind: params.runKind,
          p_pipeline_stage: params.pipelineStage,
          p_lease_seconds: 1200,
        }),
      );
    },
    async startProvider(params) {
      await rpc("start_ai_grading_benchmark_provider", {
        p_benchmark_id: params.benchmark.id,
        p_grader_version: params.graderVersion,
        p_corpus_version: params.corpusVersion,
        p_run_kind: params.runKind,
        p_pipeline_stage: params.pipelineStage,
        p_claim_token: params.claimToken,
      });
    },
    async completeProvider(params) {
      await rpc("complete_ai_grading_benchmark_provider", {
        p_benchmark_id: params.benchmark.id,
        p_grader_version: params.graderVersion,
        p_corpus_version: params.corpusVersion,
        p_run_kind: params.runKind,
        p_pipeline_stage: params.pipelineStage,
        p_claim_token: params.claimToken,
        p_provider_request_id: params.providerRequestId,
      });
    },
    async failProvider(params) {
      const data = await rpc("fail_ai_grading_benchmark_provider", {
        p_benchmark_id: params.benchmark.id,
        p_grader_version: params.graderVersion,
        p_corpus_version: params.corpusVersion,
        p_run_kind: params.runKind,
        p_pipeline_stage: params.pipelineStage,
        p_claim_token: params.claimToken,
        p_provider_request_ids: params.providerRequestIds,
      });
      const outcome = rpcRow(data).outcome;
      if (outcome !== "retryable" && outcome !== "exhausted") {
        throw new Error("Benchmark failure RPC returned an invalid outcome");
      }
      return outcome;
    },
    async recoverProvider(params) {
      await rpc("recover_ai_grading_benchmark_provider", {
        p_benchmark_id: params.benchmark.id,
        p_grader_version: params.graderVersion,
        p_corpus_version: params.corpusVersion,
        p_run_kind: params.runKind,
        p_pipeline_stage: params.pipelineStage,
        p_provider_request_id: params.providerRequestId,
      });
    },
    async markImported(params) {
      await rpc("import_ai_grading_benchmark_provider", {
        p_benchmark_id: params.benchmark.id,
        p_grader_version: params.graderVersion,
        p_corpus_version: params.corpusVersion,
        p_run_kind: params.runKind,
        p_provider_request_id: params.providerRequestId,
      });
    },
    async createEvaluation(params) {
      const { data, error } = (await client
        .from("ai_grading_evaluations")
        .insert({
          benchmark_id: params.benchmarkId,
          grader_version: params.graderVersion,
          corpus_version: params.corpusVersion,
          prediction: params.primaryPrediction,
          metrics: {},
          run_metadata: { executor: "gcp_ai_grading_worker_v2" },
        })
        .select("id")
        .single()) as QueryResult;
      if (!error) {
        const id = record(data).id;
        if (typeof id === "string") return { id };
      }
      const existing = await this.findEvaluation(params);
      if (existing) return existing;
      throw new Error(`Evaluation insert failed: ${error?.message ?? "no id"}`);
    },
    async recordRun(params) {
      await rpc("record_ai_grading_evaluation_run", {
        p_evaluation_id: params.evaluationId,
        p_run_kind: params.runKind,
        p_prediction: params.prediction,
        p_provider_request_id: params.providerRequestId,
      });
    },
  };
}

export async function executeStoredIeltsBenchmarks(params: {
  graderVersion: string;
  corpusVersion: number;
  split: "evaluation" | "holdout";
  benchmarkKeys?: string[];
}) {
  return executeIeltsBenchmarks(params, {
    repository: createProductionBenchmarkRepository(),
    generator: createProductionBenchmarkGenerator(),
  });
}
