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

test("ClickUp get returns only an allow-listed evidence projection", async () => {
  const client = new ClickUpClient(
    { CLICKUP_API_TOKEN: "token", CLICKUP_BUG_LIST_ID: "list" },
    async (input) => {
      assert.match(String(input), /\/task\/task-1$/);
      return response({
        id: "task-1",
        name: "[P1] Chat request failed",
        status: { status: "Ready for Agent" },
        description: [
          "**Fingerprint:** `incident-hash-5678`",
          "**Source query hash:** `source-hash-1234`",
          "**Agent evidence complete:** yes",
          "**Route:** `/api/chat`",
          "Sensitive freeform text that must not be returned",
        ].join("\n"),
      });
    },
  );

  const task = await client.getEvidence("task-1");

  assert.equal(task.evidence.sourceHash, "source-hash-1234");
  assert.equal(task.evidence.route, "/api/chat");
  assert.equal(task.status, "Ready for Agent");
  assert.doesNotMatch(JSON.stringify(task), /Sensitive freeform/);
  assert.equal("description" in task, false);
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

test("ClickUp claim accepts lowercase API statuses and writes canonical statuses", async () => {
  let status = "ready for agent";
  let updateBody: unknown;
  const fetchImpl: FetchLike = async (_input, init) => {
    if (init?.method === "PUT") {
      updateBody = JSON.parse(String(init.body));
      status = "agent working";
    }
    return response({ id: "1", name: "Broken", status: { status } });
  };
  const client = new ClickUpClient(
    { CLICKUP_API_TOKEN: "token", CLICKUP_BUG_LIST_ID: "lowercase-status-list" },
    fetchImpl,
  );

  const claimed = await client.claim("1");

  assert.equal(claimed.status?.status, "agent working");
  assert.deepEqual(updateBody, { status: "Agent Working" });
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

test("Grafana incident queries the live Faro source hash labels", async () => {
  let body = "";
  const client = new GrafanaClient(
    {
      GRAFANA_URL: "https://example.grafana.net",
      GRAFANA_SERVICE_ACCOUNT_TOKEN: "grafana-secret",
      GRAFANA_LOKI_DATASOURCE_UID: "logs",
    },
    async (_input, init) => {
      body = String(init?.body ?? "");
      return response({ results: {} });
    },
  );

  await client.incident("source-hash-1234", 1, 2);

  assert.match(body, /deployment_environment/);
  assert.match(body, /kind=\\\"exception\\\"/);
  assert.match(body, /hash=\\\"source-hash-1234\\\"/);
  assert.doesNotMatch(body, /error_fingerprint/);
});

test("Grafana Chat incident retrieves both consented browser and backend evidence", async () => {
  const bodies: string[] = [];
  const client = new GrafanaClient(
    {
      GRAFANA_URL: "https://example.grafana.net",
      GRAFANA_SERVICE_ACCOUNT_TOKEN: "grafana-secret",
      GRAFANA_LOKI_DATASOURCE_UID: "logs",
    },
    async (_input, init) => {
      bodies.push(String(init?.body ?? ""));
      return response({ results: {} });
    },
  );

  const result = await client.incident("chat-request-failed:COACH_REQUEST_FAILED", 1, 2);

  assert.equal(bodies.length, 3);
  const queries = bodies.map((body) => JSON.parse(body));
  assert.equal(
    queries.find((body) => body.queries[0].datasource.type === "tempo")
      .queries[0].datasource.uid,
    "grafanacloud-traces",
  );
  assert.match(JSON.stringify(queries), /resource\.service\.name = \\\"thinkfy-web\\\"/);
  assert.match(JSON.stringify(queries), /span\.thinkfy\.chat\.incident_fingerprint/);
  assert.match(JSON.stringify(queries), /sdk_name=\\\"thinkfy-server\\\"/);
  assert.match(JSON.stringify(queries), /sdk_name!=\\\"thinkfy-server\\\"/);
  assert.match(JSON.stringify(queries), /context_incidentFingerprint/);
  assert.match(JSON.stringify(result), /server/);
  assert.match(JSON.stringify(result), /browser/);
  assert.match(JSON.stringify(result), /tempo/);
});

test("Grafana Chat incident keeps Tempo evidence when optional Faro query fails", async () => {
  const bodies: string[] = [];
  const client = new GrafanaClient(
    {
      GRAFANA_URL: "https://example.grafana.net",
      GRAFANA_SERVICE_ACCOUNT_TOKEN: "grafana-secret",
      GRAFANA_LOKI_DATASOURCE_UID: "logs",
      GRAFANA_TEMPO_DATASOURCE_UID: "traces",
    },
    async (_input, init) => {
      const body = String(init?.body ?? "");
      bodies.push(body);
      if (JSON.parse(body).queries[0].datasource.type === "tempo") {
        return response({ results: { traces: [{ traceId: "trace-1" }] } });
      }
      if (
        (JSON.parse(body).queries[0].expr as string).includes(
          'sdk_name="thinkfy-server"',
        )
      ) {
        return response({ results: { streams: [{ values: [["1", "server"]] }] } });
      }
      return response({ error: "Loki is unavailable" }, 503);
    },
  );

  const result = await client.incident("chat-request-failed:COACH_REQUEST_FAILED", 1, 2);

  assert.equal(bodies.length, 3);
  assert.match(JSON.stringify(result), /trace-1/);
  assert.ok((result as { server: unknown }).server);
  assert.equal((result as { browser: unknown }).browser, null);
});

test("Grafana Chat incident requires server Faro evidence", async () => {
  const client = new GrafanaClient(
    {
      GRAFANA_URL: "https://example.grafana.net",
      GRAFANA_SERVICE_ACCOUNT_TOKEN: "grafana-secret",
      GRAFANA_LOKI_DATASOURCE_UID: "logs",
    },
    async (_input, init) => {
      const body = JSON.parse(String(init?.body ?? ""));
      if (body.queries[0].datasource.type === "tempo") {
        return response({ results: { traces: [] } });
      }
      const expression = body.queries[0].expr as string;
      if (expression.includes('sdk_name="thinkfy-server"')) {
        return response({ error: "server Faro unavailable" }, 503);
      }
      return response({ results: {} });
    },
  );

  await assert.rejects(
    client.incident("chat-request-failed:COACH_REQUEST_FAILED", 1, 2),
    /Request failed \(503\)/,
  );
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
