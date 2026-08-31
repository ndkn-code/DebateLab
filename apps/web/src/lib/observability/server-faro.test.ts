import test from "node:test";
import assert from "node:assert/strict";

import {
  emitServerFaroException,
  getServerFaroConfig,
  SERVER_FARO_TIMEOUT_MS,
  type ServerFaroFetch,
} from "./server-faro";

const input = {
  requestId: "123e4567-e89b-12d3-a456-426614174000",
  stage: "coach_stream",
  featureArea: "ai-coach",
  route: "/api/chat",
  sourceHash: "chat-request-failed:COACH_STREAM_FAILED",
};

function env(overrides: Record<string, string | undefined> = {}) {
  return {
    NEXT_PUBLIC_GRAFANA_FARO_COLLECTOR_URL:
      "https://faro.example.test/collect",
    NEXT_PUBLIC_APP_RELEASE_SHA: "release-123",
    NEXT_PUBLIC_APP_ENV: "production",
    ...overrides,
  };
}

test("server Faro emits a sanitized exception with stable correlation metadata", async () => {
  let request: { url: string; init: RequestInit } | undefined;
  const fetchImpl: ServerFaroFetch = async (url, init) => {
    request = { url: String(url), init: init ?? {} };
    return new Response(null, { status: 202 });
  };

  await emitServerFaroException(
    {
      ...input,
      stage: "coach_stream?token=secret",
      route: "/api/chat?email=student@example.com",
    },
    env(),
    fetchImpl,
  );

  assert.ok(request);
  assert.equal(request.url, "https://faro.example.test/collect");
  assert.equal(request.init.method, "POST");
  const headers = request.init.headers as Record<string, string>;
  assert.equal(headers["Content-Type"], "application/json");
  const sessionId = headers["X-Faro-Session-Id"];
  assert.match(sessionId ?? "", /^[0-9a-f-]{36}$/i);

  const body = JSON.parse(String(request.init.body)) as {
    meta: {
      sdk: { name: string; version: string };
      app: Record<string, string>;
      service: Record<string, string>;
      session: { id: string };
    };
    exceptions: Array<{
      type: string;
      value: string;
      timestamp: string;
      fingerprint: string;
      context: Record<string, string>;
    }>;
  };
  assert.deepEqual(body.meta.sdk, {
    name: "thinkfy-server",
    version: "1.0.0",
  });
  assert.deepEqual(body.meta.app, {
    name: "thinkfy-web",
    environment: "production",
    version: "release-123",
    release: "release-123",
    gitHash: "release-123",
    bundleId: "release-123",
  });
  assert.deepEqual(body.meta.service, { name: "thinkfy-web" });
  assert.equal(body.meta.session.id, sessionId);
  assert.equal(body.exceptions.length, 1);
  assert.deepEqual(body.exceptions[0], {
    type: "chat_request",
    value: "Chat request failed",
    timestamp: body.exceptions[0].timestamp,
    fingerprint: input.sourceHash,
    context: {
      incidentFingerprint: input.sourceHash,
      requestId: input.requestId,
      stage: "coach_stream",
      featureArea: "ai-coach",
      route: "/api/chat",
    },
  });
  assert.deepEqual(Object.keys(body.exceptions[0].context).sort(), [
    "featureArea",
    "incidentFingerprint",
    "requestId",
    "route",
    "stage",
  ]);
  assert.doesNotMatch(JSON.stringify(body), /student@example\.com|secret|message|error/i);
});

test("server Faro requires an HTTPS collector without credentials or query data", async () => {
  assert.equal(
    getServerFaroConfig(env({ NEXT_PUBLIC_GRAFANA_FARO_COLLECTOR_URL: "http://faro.example.test" })),
    null,
  );
  assert.equal(
    getServerFaroConfig(env({ NEXT_PUBLIC_GRAFANA_FARO_COLLECTOR_URL: "https://user:pass@faro.example.test" })),
    null,
  );
  assert.equal(
    getServerFaroConfig(env({ NEXT_PUBLIC_GRAFANA_FARO_COLLECTOR_URL: "https://faro.example.test/collect?token=secret" })),
    null,
  );
  assert.deepEqual(getServerFaroConfig(env()), {
    url: "https://faro.example.test/collect",
    release: "release-123",
    environment: "production",
  });

  let calls = 0;
  const fetchImpl: ServerFaroFetch = async () => {
    calls += 1;
    return new Response(null, { status: 202 });
  };
  await emitServerFaroException(input, {
    ...env(),
    NEXT_PUBLIC_GRAFANA_FARO_COLLECTOR_URL: "http://faro.example.test",
  }, fetchImpl);
  assert.equal(calls, 0);
});

test("server Faro ignores malformed incident hashes", async () => {
  let calls = 0;
  const fetchImpl: ServerFaroFetch = async () => {
    calls += 1;
    return new Response(null, { status: 202 });
  };
  await emitServerFaroException(
    { ...input, sourceHash: "chat-request-failed:prompt=secret" },
    env(),
    fetchImpl,
  );
  assert.equal(calls, 0);
});

test("server Faro swallows collector failures and uses a short timeout", async () => {
  const fetchImpl: ServerFaroFetch = async () => {
    throw new Error("collector unavailable");
  };
  await assert.doesNotReject(emitServerFaroException(input, env(), fetchImpl));
  await assert.doesNotReject(
    emitServerFaroException(
      input,
      env(),
      async () => new Response(null, { status: 500 }),
    ),
  );
  assert.ok(SERVER_FARO_TIMEOUT_MS <= 2_000);
});
