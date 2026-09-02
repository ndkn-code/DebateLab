import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { OPS_TOOL_NAMES } from "./mcp.js";

const serviceRoot = resolve(import.meta.dirname, "..");
const repositorySource = readFileSync(
  resolve(import.meta.dirname, "repository.ts"),
  "utf8",
);
const serverSource = readFileSync(
  resolve(import.meta.dirname, "server.ts"),
  "utf8",
);
const migrationSource = readFileSync(
  resolve(
    serviceRoot,
    "../../supabase/migrations/20260902140000_debatelab_ops_mcp_reader.sql",
  ),
  "utf8",
);

test("the MCP publishes only the seven allowlisted operations tools", () => {
  assert.deepEqual(OPS_TOOL_NAMES, [
    "get_grading_run_status",
    "get_model_health",
    "get_failed_or_stale_jobs",
    "get_corpus_versions",
    "get_corpus_review_readiness",
    "get_benchmark_results",
    "run_synthetic_model_smoke",
  ]);
  const rpcNames = [...repositorySource.matchAll(/client\.rpc\("([^"]+)"/g)]
    .map((match) => match[1])
    .sort();
  assert.deepEqual(rpcNames, [
    "ops_mcp_benchmark_summary",
    "ops_mcp_corpus_readiness",
    "ops_mcp_corpus_versions",
    "ops_mcp_failed_or_stale_jobs",
    "ops_mcp_grading_run_status",
    "ops_mcp_model_health",
    "ops_mcp_ping",
  ]);
  assert.doesNotMatch(
    repositorySource,
    /\.(from|insert|update|upsert|delete)\s*\(/,
  );
  assert.doesNotMatch(repositorySource, /service.role|service_role/i);
  assert.doesNotMatch(
    repositorySource,
    /protected_label|transcript|essay|raw_prompt/i,
  );
});

test("the service adds no Vercel function, workflow, queue, or cron entrypoint", () => {
  const root = resolve(serviceRoot, "../..");
  const changed = execFileSync("git", ["status", "--short"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.doesNotMatch(changed, /apps\/web\/src\/app\/api\//);
  assert.doesNotMatch(changed, /vercel\.json/);
  assert.doesNotMatch(serverSource, /vercel|workflow|queue|cron/i);
});

test("the container is non-root and deployment artifacts remain Cloud Run only", () => {
  const dockerfile = readFileSync(resolve(serviceRoot, "Dockerfile"), "utf8");
  const cloudbuild = readFileSync(
    resolve(serviceRoot, "cloudbuild.yaml"),
    "utf8",
  );
  assert.match(dockerfile, /USER node/);
  assert.match(cloudbuild, /debatelab-ops-mcp/);
  assert.doesNotMatch(cloudbuild, /vercel/i);
  const gcloudIgnore = readFileSync(
    resolve(serviceRoot, "../../.gcloudignore"),
    "utf8",
  );
  assert.match(gcloudIgnore, /#!include:\.gitignore/);
  for (const sensitivePattern of [
    "*.pem",
    ".vercel",
    "qa-artifacts",
    ".codex",
  ]) {
    assert.match(
      gcloudIgnore,
      new RegExp(sensitivePattern.replace("*", "\\*")),
    );
  }
});

test("the database boundary grants only sanitized token-gated reads", () => {
  assert.match(migrationSource, /assert_debatelab_ops_mcp_token/);
  assert.match(
    migrationSource,
    /grant execute on function public\.ops_mcp_ping\(text\) to anon/,
  );
  assert.doesNotMatch(
    migrationSource,
    /grant\s+(select|insert|update|delete|all).*\s+to\s+anon/is,
  );
  assert.doesNotMatch(
    migrationSource,
    /insert\s+into\s+private\.debatelab_ops_mcp_credentials/i,
  );
  assert.doesNotMatch(repositorySource, /SUPABASE_SERVICE_ROLE_KEY/);
});
