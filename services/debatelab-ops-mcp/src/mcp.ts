import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type http from "node:http";
import {
  createOpsToolHandlers,
  toolInputs,
  type OpsToolDependencies,
} from "./tools.js";

function toolResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

export const OPS_TOOL_NAMES = [
  "get_grading_run_status",
  "get_model_health",
  "get_failed_or_stale_jobs",
  "get_corpus_versions",
  "get_corpus_review_readiness",
  "get_benchmark_results",
  "run_synthetic_model_smoke",
] as const;

export function createOpsMcpServer(
  dependencies: OpsToolDependencies,
): McpServer {
  const server = new McpServer({ name: "debatelab-ops", version: "1.0.0" });
  const handlers = createOpsToolHandlers(dependencies);
  server.registerTool(
    "get_grading_run_status",
    {
      description: "Return a sanitized durable grading run status by UUID.",
      inputSchema: toolInputs.getGradingRunStatus.shape,
    },
    async (input) => toolResult(await handlers.getGradingRunStatus(input)),
  );
  server.registerTool(
    "get_model_health",
    {
      description:
        "Return aggregated provider/model health for a bounded window.",
      inputSchema: toolInputs.getModelHealth.shape,
    },
    async (input) => toolResult(await handlers.getModelHealth(input)),
  );
  server.registerTool(
    "get_failed_or_stale_jobs",
    {
      description: "Return sanitized failed or stale durable grading jobs.",
      inputSchema: toolInputs.getFailedOrStaleJobs.shape,
    },
    async (input) => toolResult(await handlers.getFailedOrStaleJobs(input)),
  );
  server.registerTool(
    "get_corpus_versions",
    {
      description: "Return active corpus and embedding-space versions.",
      inputSchema: toolInputs.empty.shape,
    },
    async (input) => toolResult(await handlers.getCorpusVersions(input)),
  );
  server.registerTool(
    "get_corpus_review_readiness",
    {
      description: "Return aggregate source and item review readiness counts.",
      inputSchema: toolInputs.getCorpusReviewReadiness.shape,
    },
    async (input) => toolResult(await handlers.getCorpusReviewReadiness(input)),
  );
  server.registerTool(
    "get_benchmark_results",
    {
      description: "Return sanitized benchmark coverage and release metrics.",
      inputSchema: toolInputs.empty.shape,
    },
    async (input) => toolResult(await handlers.getBenchmarkResults(input)),
  );
  server.registerTool(
    "run_synthetic_model_smoke",
    {
      description:
        "Run a fixed-input synthetic Qwen or GPT-OSS availability probe.",
      inputSchema: toolInputs.runSyntheticModelSmoke.shape,
    },
    async (input) => toolResult(await handlers.runSyntheticModelSmoke(input)),
  );
  return server;
}

export async function handleStatelessMcpRequest(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  body: unknown,
  dependencies: OpsToolDependencies,
): Promise<void> {
  const server = createOpsMcpServer(dependencies);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(request, response, body);
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}
