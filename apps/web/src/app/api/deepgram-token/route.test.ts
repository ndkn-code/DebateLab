import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routeSource = readFileSync(
  new URL("./route.ts", import.meta.url),
  "utf8",
);

test("Gemini benchmark reuses the token route without changing Deepgram grant shape", () => {
  assert.match(
    routeSource,
    /searchParams\.get\("provider"\) ===\s*"gemini_live_benchmark"/,
  );
  assert.match(
    routeSource,
    /return NextResponse\.json\(\{\s*key: data\.access_token,\s*accessToken: data\.access_token,\s*expiresIn: data\.expires_in \?\? 60,\s*authScheme: "bearer",\s*requestId,\s*\}\);/,
  );
});

test("route checks every benchmark gate before provisioning and never reads Gemini keys", () => {
  const gateAt = routeSource.indexOf("authorizeGeminiLiveBenchmark({");
  const provisionAt = routeSource.indexOf(
    "provisionGeminiLiveBenchmarkToken({",
  );
  assert.ok(gateAt > 0);
  assert.ok(provisionAt > gateAt);
  assert.match(routeSource, /GEMINI_LIVE_TRANSCRIPTION_BENCHMARK_ENABLED/);
  assert.match(routeSource, /GEMINI_LIVE_TRANSCRIPTION_BENCHMARK_ALLOWLIST/);
  assert.doesNotMatch(routeSource, /process\.env\.GEMINI_API_KEY/);
});
