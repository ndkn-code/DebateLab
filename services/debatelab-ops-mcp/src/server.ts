import http from "node:http";
import { handleHttpRequest } from "./handler.js";
import { createOpsRepository, type OpsRepository } from "./repository.js";

function unavailableRepository(): OpsRepository {
  const unavailable = async (): Promise<never> => {
    throw new Error("OPS_MCP_REPOSITORY_UNAVAILABLE");
  };
  return {
    ping: unavailable,
    getGradingRunStatus: unavailable,
    getModelHealth: unavailable,
    getFailedOrStaleJobs: unavailable,
    getCorpusVersions: unavailable,
    getCorpusReviewReadiness: unavailable,
    getBenchmarkResults: unavailable,
  };
}

let repository: OpsRepository;
try {
  repository = createOpsRepository();
} catch {
  // Keep the process alive so /readyz can report missing configuration without
  // exposing secret values. MCP calls still fail closed.
  repository = unavailableRepository();
}
const port = Number(process.env.PORT ?? 8080);
const server = http.createServer((request, response) => {
  void handleHttpRequest(request, response, { repository });
});

server.listen(port, "0.0.0.0", () => {
  console.info(`DebateLab ops MCP listening on ${port}`);
});

function shutdown(signal: string): void {
  console.info(`Received ${signal}; shutting down.`);
  server.close(() => process.exit(0));
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
