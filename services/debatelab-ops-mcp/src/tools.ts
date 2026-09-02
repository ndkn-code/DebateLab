import { z } from "zod";
import { syntheticSmokeEnabled, type OpsMcpEnvironment } from "./config.js";
import {
  benchmarkResultsSchema,
  corpusReviewReadinessSchema,
  corpusVersionsSchema,
  failedOrStaleJobsSchema,
  gradingRunStatusSchema,
  knowledgeCollectionSlugSchema,
  modelHealthSchema,
  syntheticSmokeResultSchema,
  uuidSchema,
} from "./contracts.js";
import type { OpsRepository } from "./repository.js";
import { runSyntheticModelSmoke, type SyntheticModel } from "./smoke.js";

export const toolInputs = {
  getGradingRunStatus: z.object({ runId: uuidSchema }),
  getModelHealth: z.object({ windowHours: z.number().int().min(1).max(168) }),
  getFailedOrStaleJobs: z.object({
    limit: z.number().int().min(1).max(100).default(25),
  }),
  empty: z.object({}).strict(),
  getCorpusReviewReadiness: z.object({
    collection: knowledgeCollectionSlugSchema,
  }),
  runSyntheticModelSmoke: z.object({
    model: z.enum(["qwen", "gpt-oss"]),
    confirm: z.literal(true),
  }),
};

const SYNTHETIC_SMOKE_COOLDOWN_MS = 60_000;
let nextSyntheticSmokeAt = 0;

export function reserveSyntheticSmoke(now = Date.now()): void {
  if (now < nextSyntheticSmokeAt) {
    throw new Error("SYNTHETIC_SMOKE_RATE_LIMITED");
  }
  nextSyntheticSmokeAt = now + SYNTHETIC_SMOKE_COOLDOWN_MS;
}

export function resetSyntheticSmokeRateLimitForTest(): void {
  nextSyntheticSmokeAt = 0;
}

export type OpsToolDependencies = {
  repository: OpsRepository;
  environment?: OpsMcpEnvironment;
  smoke?: (model: SyntheticModel) => ReturnType<typeof runSyntheticModelSmoke>;
};

export function createOpsToolHandlers(dependencies: OpsToolDependencies) {
  const environment = dependencies.environment ?? process.env;
  return {
    async getGradingRunStatus(input: unknown) {
      const { runId } = toolInputs.getGradingRunStatus.parse(input);
      const result = await dependencies.repository.getGradingRunStatus(runId);
      return result === null
        ? { found: false as const }
        : {
            found: true as const,
            run: gradingRunStatusSchema.parse(result),
          };
    },
    async getModelHealth(input: unknown) {
      const { windowHours } = toolInputs.getModelHealth.parse(input);
      return modelHealthSchema.parse(
        await dependencies.repository.getModelHealth(windowHours),
      );
    },
    async getFailedOrStaleJobs(input: unknown) {
      const { limit } = toolInputs.getFailedOrStaleJobs.parse(input);
      return failedOrStaleJobsSchema.parse(
        await dependencies.repository.getFailedOrStaleJobs(limit),
      );
    },
    async getCorpusVersions(input: unknown) {
      toolInputs.empty.parse(input);
      return corpusVersionsSchema.parse(
        await dependencies.repository.getCorpusVersions(),
      );
    },
    async getCorpusReviewReadiness(input: unknown) {
      const { collection } = toolInputs.getCorpusReviewReadiness.parse(input);
      return corpusReviewReadinessSchema.parse(
        await dependencies.repository.getCorpusReviewReadiness(collection),
      );
    },
    async getBenchmarkResults(input: unknown) {
      toolInputs.empty.parse(input);
      return benchmarkResultsSchema.parse(
        await dependencies.repository.getBenchmarkResults(),
      );
    },
    async runSyntheticModelSmoke(input: unknown) {
      if (!syntheticSmokeEnabled(environment)) {
        throw new Error("SYNTHETIC_SMOKE_DISABLED");
      }
      const { model } = toolInputs.runSyntheticModelSmoke.parse(input);
      reserveSyntheticSmoke();
      return syntheticSmokeResultSchema.parse(
        await (dependencies.smoke
          ? dependencies.smoke(model)
          : runSyntheticModelSmoke(model, environment)),
      );
    },
  };
}

export type OpsToolHandlers = ReturnType<typeof createOpsToolHandlers>;
