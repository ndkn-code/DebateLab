import assert from "node:assert/strict";
import type { AiProviderRequestInput } from "@/lib/ai/provider-requests";
import { EMPTY_PHONEME_REPORT } from "@/lib/scoring/ielts-pronunciation/phoneme-report";
import {
  assessPronunciation,
  type AssessPronunciationDeps,
  type AssessPronunciationOutcome,
} from "./service";

const CONFIG = { apiKey: "secret-key", region: "southeastasia" };
const AUDIO = new Uint8Array([1, 2, 3, 4]);
const BASE_INPUT = {
  audio: AUDIO,
  audioContentType: "audio/wav",
  referenceText: "a good answer",
  userId: "user-1",
  speakingResponseId: "sr-1",
};

const AZURE_OK = {
  RecognitionStatus: "Success",
  DisplayText: "a good answer",
  NBest: [
    {
      Display: "a good answer",
      PronunciationAssessment: {
        AccuracyScore: 90,
        FluencyScore: 88,
        CompletenessScore: 100,
        PronScore: 89,
        ProsodyScore: 85,
      },
      Words: [
        {
          Word: "good",
          PronunciationAssessment: { AccuracyScore: 92, ErrorType: "None" },
          Phonemes: [{ Phoneme: "ɡ", PronunciationAssessment: { AccuracyScore: 95 } }],
        },
      ],
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The non-"ok" reason, or "ok" — avoids `&&` narrowing in every assertion. */
function reasonOf(out: AssessPronunciationOutcome): string {
  return out.status === "ok" ? "ok" : out.reason;
}

/** A dep harness recording logged provider calls; override seams per case. */
function harness(over: Partial<AssessPronunciationDeps> = {}) {
  const recorded: AiProviderRequestInput[] = [];
  const logs: Array<{ level: "info" | "warn"; message: string; metadata: unknown }> = [];
  let fetchCalls = 0;
  const deps: Partial<AssessPronunciationDeps> = {
    getConfig: () => CONFIG,
    recordRequest: async (input) => {
      recorded.push(input);
      return "req-id";
    },
    now: () => 1000,
    fetchImpl: async () => {
      fetchCalls += 1;
      return jsonResponse(AZURE_OK);
    },
    logger: {
      info: (message, metadata) => logs.push({ level: "info", message, metadata }),
      warn: (message, metadata) => logs.push({ level: "warn", message, metadata }),
    },
    ...over,
  };
  return { deps, recorded, logs, fetchCalls: () => fetchCalls };
}

async function testNotConfigured() {
  const h = harness();
  let fetched = 0;
  const out = await assessPronunciation(BASE_INPUT, {
    getConfig: () => null,
    fetchImpl: async () => {
      fetched += 1;
      return jsonResponse(AZURE_OK);
    },
    recordRequest: async () => "x",
    now: () => 0,
    logger: h.deps.logger,
  });
  assert.equal(out.status, "skipped");
  assert.equal(reasonOf(out), "not_configured");
  assert.deepEqual(out.report, EMPTY_PHONEME_REPORT);
  assert.equal(fetched, 0); // no network when unconfigured
  assert.equal(h.logs[0]?.message, "IELTS pronunciation assessment skipped");
  assert.deepEqual(h.logs[0]?.metadata, {
    reason: "not_configured",
    speakingResponseId: "sr-1",
    practiceAttemptId: null,
    audioBytes: 4,
    hasReferenceText: true,
  });
}

async function testMissingAudio() {
  const h = harness();
  const out = await assessPronunciation(
    { ...BASE_INPUT, audio: new Uint8Array(0) },
    h.deps,
  );
  assert.equal(reasonOf(out), "missing_audio");
  assert.equal(h.fetchCalls(), 0);
}

async function testMissingReference() {
  const h = harness();
  const out = await assessPronunciation(
    { ...BASE_INPUT, referenceText: "   " },
    h.deps,
  );
  assert.equal(reasonOf(out), "missing_reference");
  assert.equal(h.fetchCalls(), 0);
}

async function testSuccess() {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const h = harness({
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init: init ?? {} });
      return jsonResponse(AZURE_OK);
    },
  });
  const out = await assessPronunciation(BASE_INPUT, h.deps);
  assert.equal(out.status, "ok");
  if (out.status !== "ok") throw new Error("unreachable");
  assert.equal(out.report.status, "scored");
  assert.equal(out.report.overall?.pronunciation, 89);
  assert.equal(out.pronunciationBand, 8); // 89/100*9 = 8.01 → 8.0
  assert.equal(out.providerRequestId, "req-id");

  const req = requests[0];
  if (!req) throw new Error("expected a captured request");
  assert.ok(req.url.includes("format=detailed"));
  const headers = req.init.headers as Record<string, string>;
  assert.equal(headers["Ocp-Apim-Subscription-Key"], "secret-key");
  assert.equal(req.init.body, AUDIO);

  const rec = h.recorded[0];
  if (!rec) throw new Error("expected a logged provider call");
  assert.equal(rec.provider, "azure");
  assert.equal(rec.model, "pronunciation-assessment");
  assert.equal(rec.status, "success");
  assert.equal(rec.sourceRoute, "ielts_speaking_pronunciation");
  assert.equal(rec.latencyMs, 0); // now() is constant
  const meta = rec.metadata as Record<string, unknown>;
  assert.equal(meta.speakingResponseId, "sr-1");
  assert.equal(meta.pronunciationBand, 8);
  assert.equal(meta.audioBytes, 4);
}

async function testHttpError() {
  const h = harness({
    fetchImpl: async () => new Response("unauthorized", { status: 401 }),
  });
  const out = await assessPronunciation(BASE_INPUT, h.deps);
  assert.equal(reasonOf(out), "azure_http_401");
  assert.deepEqual(out.report, EMPTY_PHONEME_REPORT);
  const rec = h.recorded[0];
  if (!rec) throw new Error("expected a logged error");
  assert.equal(rec.status, "error");
  assert.equal(rec.errorCode, "azure_http_error");
  assert.equal(rec.responseStatus, 401);
}

async function testNoAssessment() {
  const h = harness({
    fetchImpl: async () => jsonResponse({ RecognitionStatus: "NoMatch" }),
  });
  const out = await assessPronunciation(BASE_INPUT, h.deps);
  assert.equal(reasonOf(out), "azure_no_assessment");
  assert.deepEqual(out.report, EMPTY_PHONEME_REPORT);
  assert.equal(h.recorded[0]?.errorCode, "azure_no_assessment");
}

async function testNetworkThrow() {
  const h = harness({
    fetchImpl: async () => {
      throw new Error("ECONNRESET");
    },
  });
  const out = await assessPronunciation(BASE_INPUT, h.deps);
  assert.equal(reasonOf(out), "azure_request_failed");
  assert.deepEqual(out.report, EMPTY_PHONEME_REPORT);
  const rec = h.recorded[0];
  if (!rec) throw new Error("expected a logged error");
  assert.equal(rec.errorCode, "azure_request_failed");
  assert.match(String(rec.errorMessage), /ECONNRESET/);
  assert.equal(h.logs[0]?.level, "warn");
}

async function testLoggingFailureSwallowed() {
  // Even if logging itself throws on the catch path, the call never rejects.
  const out = await assessPronunciation(BASE_INPUT, {
    getConfig: () => CONFIG,
    now: () => 0,
    fetchImpl: async () => {
      throw new Error("boom");
    },
    recordRequest: async () => {
      throw new Error("db down");
    },
    logger: { info: () => {}, warn: () => {} },
  });
  assert.equal(reasonOf(out), "azure_request_failed");
}

async function testDefaultDepsNoEnv() {
  const prevKey = process.env.AZURE_SPEECH_KEY;
  const prevRegion = process.env.AZURE_SPEECH_REGION;
  const prevEndpoint = process.env.AZURE_SPEECH_ENDPOINT;
  const prevAliasKey = process.env.SPEECH_KEY;
  const prevAliasRegion = process.env.SPEECH_REGION;
  const prevAliasEndpoint = process.env.SPEECH_ENDPOINT;
  delete process.env.AZURE_SPEECH_KEY;
  delete process.env.AZURE_SPEECH_REGION;
  delete process.env.AZURE_SPEECH_ENDPOINT;
  delete process.env.SPEECH_KEY;
  delete process.env.SPEECH_REGION;
  delete process.env.SPEECH_ENDPOINT;
  try {
    const h = harness();
    const out = await assessPronunciation(BASE_INPUT, {
      logger: h.deps.logger,
    });
    assert.equal(reasonOf(out), "not_configured");
  } finally {
    if (prevKey !== undefined) process.env.AZURE_SPEECH_KEY = prevKey;
    if (prevRegion !== undefined) process.env.AZURE_SPEECH_REGION = prevRegion;
    if (prevEndpoint !== undefined) process.env.AZURE_SPEECH_ENDPOINT = prevEndpoint;
    if (prevAliasKey !== undefined) process.env.SPEECH_KEY = prevAliasKey;
    if (prevAliasRegion !== undefined) process.env.SPEECH_REGION = prevAliasRegion;
    if (prevAliasEndpoint !== undefined) process.env.SPEECH_ENDPOINT = prevAliasEndpoint;
  }
}

async function main() {
  await testNotConfigured();
  await testMissingAudio();
  await testMissingReference();
  await testSuccess();
  await testHttpError();
  await testNoAssessment();
  await testNetworkThrow();
  await testLoggingFailureSwallowed();
  await testDefaultDepsNoEnv();
}

main()
  .then(() => console.log("ielts/pronunciation/service tests passed"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
