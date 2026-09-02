import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { verifyOpsMcpCaller } from "./auth.js";
import { checkConfiguration, checkReadiness } from "./readiness.js";
import { syntheticSmokeEnabled } from "./config.js";
import type { OpsRepository } from "./repository.js";
import { runSyntheticModelSmoke } from "./smoke.js";
import {
  createOpsToolHandlers,
  resetSyntheticSmokeRateLimitForTest,
  reserveSyntheticSmoke,
  toolInputs,
} from "./tools.js";
import { handleHttpRequest, MAX_MCP_BODY_BYTES } from "./handler.js";

const RUN_ID = "11111111-1111-4111-8111-111111111111";
const COLLECTION_ID = "22222222-2222-4222-8222-222222222222";
const EVALUATION_ID = "33333333-3333-4333-8333-333333333333";
const environment = {
  CLOUD_RUN_SERVICE_URL: "https://debatelab-ops-mcp.example.run.app",
  GCP_OPS_MCP_CALLER_SERVICE_ACCOUNT_EMAIL:
    "ops-mcp-caller@thinkfy-debatelab-prod.iam.gserviceaccount.com",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  OPS_MCP_READER_TOKEN: "test-reader-token-that-is-long-enough-123456",
};

function fakeRepository(): OpsRepository {
  return {
    async ping() {},
    async getGradingRunStatus() {
      return {
        runId: RUN_ID,
        kind: "ielts_speaking_score",
        backend: "gcp",
        status: "running",
        phase: "provider",
        workflowAttemptCount: 1,
        providerAttemptCount: 1,
        manualRetryCount: 0,
        lastErrorCode: null,
        leaseExpiresAt: null,
        createdAt: "2026-09-02T00:00:00Z",
        updatedAt: "2026-09-02T00:01:00Z",
        completedAt: null,
        failedAt: null,
        userId: "must-be-stripped",
        transcript: "must-be-stripped",
      } as never;
    },
    async getModelHealth(windowHours) {
      return {
        windowHours,
        sampledRequestCount: 0,
        sampleLimited: false,
        models: [],
      };
    },
    async getFailedOrStaleJobs() {
      return { jobs: [] };
    },
    async getCorpusVersions() {
      return {
        collections: [
          {
            collectionId: COLLECTION_ID,
            slug: "ielts.speaking",
            domain: "ielts",
            language: "en",
            activeVersion: 2,
            active: true,
            embeddingProvider: "voyage",
            embeddingModel: "voyage-3",
            embeddingDimensions: 1024,
          },
        ],
      };
    },
    async getCorpusReviewReadiness(collectionSlug) {
      return {
        collectionSlug,
        collectionFound: true,
        activeVersion: 2,
        embeddingProvider: "voyage",
        embeddingModel: "voyage-4-large",
        embeddingDimensions: 1024,
        versions: [
          {
            version: 2,
            status: "draft",
            submittedAt: "2026-09-02T00:00:00Z",
            reviewedAt: null,
            publishedAt: null,
            itemCount: 2,
            approvedItemCount: 2,
            gradingItemCount: 1,
            approvedGradingItemCount: 1,
            sourceCount: 1,
            unapprovedItemCount: 0,
            unapprovedSourceCount: 0,
            unclearedRightsSourceCount: 0,
            gradingAuthorityViolationCount: 0,
            purposePolicyViolationCount: 0,
            answerKeyFlagCount: 0,
            reviewSeparationViolationCount: 0,
            missingEmbeddingCount: 0,
            readyToPublish: true,
          },
        ],
      };
    },
    async getBenchmarkResults() {
      return {
        activeCaseCount: 1,
        attestedActiveCaseCount: 1,
        coverageBySkill: { ielts_speaking: 1 },
        historicalEvaluations: [
          {
            evaluationId: EVALUATION_ID,
            graderVersion: "v1",
            corpusVersion: 2,
            createdAt: "2026-09-02T00:00:00Z",
            metrics: { withinHalfBandRate: 0.95 },
            authoritative: false,
            protected_label: { overallBand: 9 },
            prediction: { transcript: "secret" },
          } as never,
        ],
        historicalQueryLimited: false,
      };
    },
  };
}

test("OIDC verification requires the exact configured service account and audience", async () => {
  let observedAudience = "";
  await verifyOpsMcpCaller(
    "Bearer signed-token",
    environment,
    async (params) => {
      observedAudience = params.audience;
      return {
        email_verified: true,
        email: environment.GCP_OPS_MCP_CALLER_SERVICE_ACCOUNT_EMAIL,
      };
    },
  );
  assert.equal(observedAudience, environment.CLOUD_RUN_SERVICE_URL);
  await assert.rejects(
    verifyOpsMcpCaller("Bearer signed-token", environment, async () => ({
      email_verified: true,
      email: "other@thinkfy-debatelab-prod.iam.gserviceaccount.com",
    })),
    /OPS_MCP_CALLER_IDENTITY_MISMATCH/,
  );
  await assert.rejects(
    verifyOpsMcpCaller(undefined, environment, async () => ({})),
    /OPS_MCP_CALLER_TOKEN_MISSING/,
  );
});

test("tool schemas are bounded and outputs strip protected or learner fields", async () => {
  assert.throws(() => toolInputs.getModelHealth.parse({ windowHours: 169 }));
  assert.throws(() => toolInputs.getFailedOrStaleJobs.parse({ limit: 101 }));
  assert.throws(() =>
    toolInputs.getGradingRunStatus.parse({ runId: "not-uuid" }),
  );
  assert.throws(() =>
    toolInputs.getCorpusReviewReadiness.parse({ collection: "unknown" }),
  );
  const tools = createOpsToolHandlers({
    repository: fakeRepository(),
    environment,
  });
  const run = await tools.getGradingRunStatus({ runId: RUN_ID });
  const benchmark = await tools.getBenchmarkResults({});
  const serialized = JSON.stringify({ run, benchmark });
  for (const forbidden of [
    "userId",
    "sourceId",
    "transcript",
    "essay",
    "protected_label",
    "prediction",
    "rawPrompt",
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test("readiness is secret-safe and fails closed on configuration or database errors", async () => {
  assert.deepEqual(checkConfiguration(environment), {
    ready: true,
    missing: [],
    invalid: [],
  });
  const missing = checkConfiguration({});
  assert.equal(missing.ready, false);
  assert.ok(missing.missing.includes("OPS_MCP_READER_TOKEN"));
  assert.equal(JSON.stringify(missing).includes("test-reader-token"), false);
  const unavailable = await checkReadiness(
    {
      async ping() {
        throw new Error("database secret detail");
      },
    },
    environment,
  );
  assert.deepEqual(unavailable, {
    ready: false,
    missing: [],
    invalid: [],
    database: "unavailable",
  });
});

test("synthetic smoke uses only fixed input and returns no provider content", async () => {
  let requestBody = "";
  const result = await runSyntheticModelSmoke(
    "qwen",
    { ...environment, GROQ_API_KEY: "secret-key" },
    async (_url, init) => {
      requestBody = String(init?.body);
      return new Response(
        JSON.stringify({
          choices: [
            { message: { content: "provider-content-must-not-return" } },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );
  assert.match(requestBody, /Synthetic health check/);
  assert.equal(requestBody.includes("learner"), false);
  assert.equal(JSON.stringify(result).includes("provider-content"), false);
  assert.equal(result.success, false);
  assert.equal(result.modelId, "qwen/qwen3.8-27b");
});

test("synthetic GPT-OSS probe targets 120B and validates the fixed OK response", async () => {
  let requestBody = "";
  const result = await runSyntheticModelSmoke(
    "gpt-oss",
    { ...environment, GROQ_API_KEY: "secret-key" },
    async (_url, init) => {
      requestBody = String(init?.body);
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "OK" } }],
          usage: { prompt_tokens: 8, completion_tokens: 1 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  );
  assert.match(requestBody, /openai\/gpt-oss-120b/);
  assert.equal(result.modelId, "openai/gpt-oss-120b");
  assert.equal(result.success, true);
});

async function withServer(
  repository: OpsRepository,
  callback: (url: string) => Promise<void>,
  realMcp = false,
): Promise<void> {
  const server = http.createServer((request, response) => {
    void handleHttpRequest(request, response, {
      repository,
      environment,
      verifyCaller: async (authorization) => {
        if (authorization !== "Bearer valid") throw new Error("bad auth");
      },
      handleMcp: realMcp
        ? undefined
        : async (_request, response, body) => {
            response.writeHead(200, { "content-type": "application/json" });
            response.end(JSON.stringify({ received: body !== null }));
          },
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test("HTTP surface is POST-only, authenticated, bounded, and has health routes", async () => {
  await withServer(fakeRepository(), async (url) => {
    assert.equal((await fetch(`${url}/healthz`)).status, 200);
    assert.equal((await fetch(`${url}/readyz`)).status, 200);
    assert.equal((await fetch(`${url}/mcp`)).status, 405);
    assert.equal(
      (await fetch(`${url}/mcp`, { method: "POST", body: "{}" })).status,
      401,
    );
    assert.equal(
      (
        await fetch(`${url}/mcp`, {
          method: "POST",
          headers: { authorization: "Bearer valid" },
          body: JSON.stringify({ jsonrpc: "2.0" }),
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(`${url}/mcp`, {
          method: "POST",
          headers: {
            authorization: "Bearer valid",
            "content-type": "application/json",
          },
          body: "x".repeat(MAX_MCP_BODY_BYTES + 1),
        })
      ).status,
      413,
    );
  });
});

test("synthetic smoke tool is disabled unless explicitly enabled", async () => {
  const tools = createOpsToolHandlers({
    repository: fakeRepository(),
    environment,
    smoke: async () => ({
      model: "qwen",
      modelId: "qwen/qwen3.8-27b",
      success: true,
      responseStatus: 200,
      latencyMs: 1,
      inputTokens: 1,
      outputTokens: 1,
    }),
  });
  await assert.rejects(
    tools.runSyntheticModelSmoke({ model: "qwen", confirm: true }),
    /SYNTHETIC_SMOKE_DISABLED/,
  );
});

test("synthetic smoke requires confirmation and is rate limited", () => {
  assert.throws(() =>
    toolInputs.runSyntheticModelSmoke.parse({ model: "qwen" }),
  );
  resetSyntheticSmokeRateLimitForTest();
  reserveSyntheticSmoke(1_000);
  assert.throws(
    () => reserveSyntheticSmoke(1_001),
    /SYNTHETIC_SMOKE_RATE_LIMITED/,
  );
  reserveSyntheticSmoke(61_000);
  resetSyntheticSmokeRateLimitForTest();
});

test("synthetic provider calls can be enabled only in staging", () => {
  assert.equal(
    syntheticSmokeEnabled({
      OPS_MCP_ENVIRONMENT: "production",
      MCP_ALLOW_SYNTHETIC_SMOKE: "true",
    }),
    false,
  );
  assert.equal(
    syntheticSmokeEnabled({
      OPS_MCP_ENVIRONMENT: "staging",
      MCP_ALLOW_SYNTHETIC_SMOKE: "true",
    }),
    true,
  );
});

test("the real MCP endpoint negotiates the stateless Streamable HTTP transport", async () => {
  await withServer(
    fakeRepository(),
    async (url) => {
      const response = await fetch(`${url}/mcp`, {
        method: "POST",
        headers: {
          authorization: "Bearer valid",
          accept: "application/json, text/event-stream",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2025-06-18",
            capabilities: {},
            clientInfo: { name: "contract-test", version: "1" },
          },
        }),
      });
      assert.equal(response.status, 200);
      const body = (await response.json()) as {
        result: { serverInfo: { name: string } };
      };
      assert.equal(body.result.serverInfo.name, "debatelab-ops");
      assert.equal(response.headers.get("mcp-session-id"), null);
    },
    true,
  );
});
