import assert from "node:assert/strict";
import test from "node:test";

import { __resetGeminiKeyPoolForTests } from "@/lib/gemini/key-pool";
import { provisionGeminiLiveBenchmarkToken } from "./gemini-live-token";

const FIXED_NOW = Date.parse("2026-09-02T12:00:00.000Z");

test("requests a single-use, short-lived, model-locked VERBATIM token", async () => {
  const originalKeys = process.env.GEMINI_API_KEYS;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEYS = "server-api-key";
  delete process.env.GEMINI_API_KEY;
  __resetGeminiKeyPoolForTests();
  let capturedInit: RequestInit | undefined;
  let capturedUrl = "";
  try {
    const result = await provisionGeminiLiveBenchmarkToken({
      seed: "admin-user:request-id",
      now: () => FIXED_NOW,
      fetchImpl: async (url, init) => {
        capturedUrl = String(url);
        capturedInit = init;
        return new Response(JSON.stringify({ name: "ephemeral-live-token" }), {
          status: 200,
        });
      },
    });

    assert.equal(
      capturedUrl,
      "https://generativelanguage.googleapis.com/v1beta/auth_tokens",
    );
    assert.equal(capturedInit?.method, "POST");
    assert.equal(
      new Headers(capturedInit?.headers).get("x-goog-api-key"),
      "server-api-key",
    );
    assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
      uses: 1,
      expireTime: "2026-09-02T12:11:00.000Z",
      newSessionExpireTime: "2026-09-02T12:01:00.000Z",
      liveConnectConstraints: {
        model: "models/gemini-3.5-transcribe-live",
        config: {
          responseModalities: ["TEXT"],
          inputAudioTranscription: {
            languageCodes: [],
            mode: "VERBATIM",
          },
        },
      },
    });
    assert.deepEqual(result, {
      accessToken: "ephemeral-live-token",
      authScheme: "token",
      model: "gemini-3.5-transcribe-live",
      expiresAt: "2026-09-02T12:11:00.000Z",
      newSessionExpiresAt: "2026-09-02T12:01:00.000Z",
    });
    assert.equal(JSON.stringify(result).includes("server-api-key"), false);
  } finally {
    if (originalKeys === undefined) delete process.env.GEMINI_API_KEYS;
    else process.env.GEMINI_API_KEYS = originalKeys;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    __resetGeminiKeyPoolForTests();
  }
});

test("rotates Gemini key slots on a retryable auth-token failure", async () => {
  const originalKeys = process.env.GEMINI_API_KEYS;
  const originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEYS = "server-key-a,server-key-b";
  delete process.env.GEMINI_API_KEY;
  __resetGeminiKeyPoolForTests();
  const attemptedKeys: string[] = [];
  try {
    const result = await provisionGeminiLiveBenchmarkToken({
      seed: "retryable-token-request",
      now: () => FIXED_NOW,
      fetchImpl: async (_url, init) => {
        attemptedKeys.push(
          new Headers(init?.headers).get("x-goog-api-key") ?? "",
        );
        return attemptedKeys.length === 1
          ? new Response("quota metadata must not escape", { status: 429 })
          : new Response(JSON.stringify({ name: "rotated-ephemeral-token" }), {
              status: 200,
            });
      },
    });
    assert.equal(attemptedKeys.length, 2);
    assert.notEqual(attemptedKeys[0], attemptedKeys[1]);
    assert.equal(result.accessToken, "rotated-ephemeral-token");
  } finally {
    if (originalKeys === undefined) delete process.env.GEMINI_API_KEYS;
    else process.env.GEMINI_API_KEYS = originalKeys;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKey;
    __resetGeminiKeyPoolForTests();
  }
});
