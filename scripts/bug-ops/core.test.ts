import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import test from "node:test";
import os from "node:os";
import path from "node:path";

import { ClickUpClient, GrafanaClient, parseDuration, type FetchLike } from "./core";

function response(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("ClickUp list filters the configured list without leaking its token", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetchImpl: FetchLike = async (input, init) => {
    calls.push({ url: String(input), init });
    return response({ tasks: [{ id: "1", name: "Broken", status: { status: "Ready for Agent" } }] });
  };
  const client = new ClickUpClient(
    { CLICKUP_API_TOKEN: "secret-token", CLICKUP_BUG_LIST_ID: "list-1" },
    fetchImpl,
  );
  const tasks = await client.list("Ready for Agent", 1);
  assert.equal(tasks.length, 1);
  assert.match(calls[0].url, /\/list\/list-1\/task/);
  const calledUrl = new URL(calls[0].url);
  assert.equal(calledUrl.searchParams.get("statuses[]"), "Ready for Agent");
  assert.equal(calledUrl.search.includes("secret-token"), false);
});

test("ClickUp claim rejects a task that another worker already claimed", async () => {
  const fetchImpl: FetchLike = async () =>
    response({ id: "1", name: "Broken", status: { status: "Agent Working" } });
  const client = new ClickUpClient(
    { CLICKUP_API_TOKEN: "token", CLICKUP_BUG_LIST_ID: "list" },
    fetchImpl,
  );
  await assert.rejects(client.claim("1"), /not claimable/);
});

test("ClickUp claims serialize local clients and only one wins", async () => {
  const lockDir = mkdtempSync(path.join(os.tmpdir(), "thinkfy-bugops-claim-test-"));
  let status = "Ready for Agent";
  let updateCount = 0;
  const fetchImpl: FetchLike = async (input, init) => {
    if (init?.method === "PUT") {
      updateCount += 1;
      status = "Agent Working";
      // Keep the first transaction open while the second client waits on the
      // same OS-level lock, exercising process-like concurrency in one test.
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    return response({ id: "1", name: "Broken", status: { status } });
  };
  const env = {
    CLICKUP_API_TOKEN: "token",
    CLICKUP_BUG_LIST_ID: "list",
    BUGOPS_CLAIM_LOCK_DIR: lockDir,
  };
  const first = new ClickUpClient(env, fetchImpl);
  const second = new ClickUpClient(env, fetchImpl);

  try {
    const results = await Promise.allSettled([first.claim("1"), second.claim("1")]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 1);
    const rejection = results.find((result) => result.status === "rejected");
    assert.match(String(rejection?.status === "rejected" ? rejection.reason : ""), /not claimable/);
    assert.equal(updateCount, 1);
    assert.deepEqual(readdirSync(lockDir), []);
  } finally {
    rmSync(lockDir, { recursive: true, force: true });
  }
});

test("Grafana query uses a bearer header and POST body", async () => {
  let captured: { url?: string; init?: RequestInit } = {};
  const fetchImpl: FetchLike = async (input, init) => {
    captured = { url: String(input), init };
    return response({ results: {} });
  };
  const client = new GrafanaClient(
    {
      GRAFANA_URL: "https://example.grafana.net",
      GRAFANA_SERVICE_ACCOUNT_TOKEN: "grafana-secret",
      GRAFANA_LOKI_DATASOURCE_UID: "logs",
    },
    fetchImpl,
  );
  await client.query({ expression: "{service_name=\"web\"}", fromMs: 1, toMs: 2 });
  assert.equal(captured.url, "https://example.grafana.net/api/ds/query");
  assert.equal(captured.init?.method, "POST");
  assert.equal((captured.init?.headers as Record<string, string>).Authorization, "Bearer grafana-secret");
  assert.match(String(captured.init?.body), /service_name/);
});

test("Grafana rejects non-HTTPS remote URLs", () => {
  assert.throws(
    () =>
      new GrafanaClient({
        GRAFANA_URL: "http://example.com",
        GRAFANA_SERVICE_ACCOUNT_TOKEN: "token",
        GRAFANA_LOKI_DATASOURCE_UID: "logs",
      }),
    /must use HTTPS/,
  );
});

test("parseDuration accepts relative windows and epoch milliseconds", () => {
  assert.equal(parseDuration("30m", 2_000_000), 200_000);
  assert.equal(parseDuration("123", 2_000_000), 123);
  assert.throws(() => parseDuration("yesterday"), /Invalid duration/);
});
