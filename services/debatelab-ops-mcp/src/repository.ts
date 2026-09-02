import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requiredEnvironment, type OpsMcpEnvironment } from "./config.js";
import {
  benchmarkResultsSchema,
  corpusReviewReadinessSchema,
  corpusVersionsSchema,
  failedOrStaleJobsSchema,
  gradingRunStatusSchema,
  historicalBenchmarkEvaluationSchema,
  knowledgeCollectionSlugSchema,
  modelHealthSchema,
  type BenchmarkResults,
  type CorpusReviewReadiness,
  type CorpusVersions,
  type FailedOrStaleJobs,
  type GradingRunStatus,
  type ModelHealth,
} from "./contracts.js";
import type { z } from "zod";

export type KnowledgeCollectionSlug = z.infer<
  typeof knowledgeCollectionSlugSchema
>;

export interface OpsRepository {
  ping(): Promise<void>;
  getGradingRunStatus(runId: string): Promise<GradingRunStatus | null>;
  getModelHealth(windowHours: number): Promise<ModelHealth>;
  getFailedOrStaleJobs(limit: number): Promise<FailedOrStaleJobs>;
  getCorpusVersions(): Promise<CorpusVersions>;
  getCorpusReviewReadiness(
    collectionSlug: KnowledgeCollectionSlug,
  ): Promise<CorpusReviewReadiness>;
  getBenchmarkResults(): Promise<BenchmarkResults>;
}

function assertNoError(error: { message?: string } | null): void {
  if (error) throw new Error("OPS_MCP_DATABASE_QUERY_FAILED");
}

export function createOpsRepository(
  environment: OpsMcpEnvironment = process.env,
  suppliedClient?: SupabaseClient,
): OpsRepository {
  const client =
    suppliedClient ??
    createClient(
      requiredEnvironment(environment, "NEXT_PUBLIC_SUPABASE_URL"),
      requiredEnvironment(environment, "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  const token = requiredEnvironment(environment, "OPS_MCP_READER_TOKEN");

  return {
    async ping() {
      const { data, error } = await client.rpc("ops_mcp_ping", {
        p_token: token,
      });
      assertNoError(error);
      if ((data as { ready?: unknown } | null)?.ready !== true) {
        throw new Error("OPS_MCP_DATABASE_NOT_READY");
      }
    },

    async getGradingRunStatus(runId) {
      const { data, error } = await client.rpc("ops_mcp_grading_run_status", {
        p_token: token,
        p_run_id: runId,
      });
      assertNoError(error);
      return data === null ? null : gradingRunStatusSchema.parse(data);
    },

    async getModelHealth(windowHours) {
      const { data, error } = await client.rpc("ops_mcp_model_health", {
        p_token: token,
        p_window_hours: windowHours,
      });
      assertNoError(error);
      return modelHealthSchema.parse(data);
    },

    async getFailedOrStaleJobs(limit) {
      const { data, error } = await client.rpc("ops_mcp_failed_or_stale_jobs", {
        p_token: token,
        p_limit: limit,
      });
      assertNoError(error);
      return failedOrStaleJobsSchema.parse(data);
    },

    async getCorpusVersions() {
      const { data, error } = await client.rpc("ops_mcp_corpus_versions", {
        p_token: token,
      });
      assertNoError(error);
      return corpusVersionsSchema.parse(data);
    },

    async getCorpusReviewReadiness(collectionSlug) {
      const { data, error } = await client.rpc("ops_mcp_corpus_readiness", {
        p_token: token,
        p_collection_slug: collectionSlug,
      });
      assertNoError(error);
      return corpusReviewReadinessSchema.parse(data);
    },

    async getBenchmarkResults() {
      const { data, error } = await client.rpc("ops_mcp_benchmark_summary", {
        p_token: token,
      });
      assertNoError(error);
      const raw = data as
        | (Record<string, unknown> & { historicalEvaluations?: unknown })
        | null;
      const evaluations = Array.isArray(raw?.historicalEvaluations)
        ? raw.historicalEvaluations.flatMap((candidate) => {
            const parsed =
              historicalBenchmarkEvaluationSchema.safeParse(candidate);
            return parsed.success ? [parsed.data] : [];
          })
        : [];
      return benchmarkResultsSchema.parse({
        ...raw,
        historicalEvaluations: evaluations,
      });
    },
  };
}
