import assert from "node:assert/strict";
import test from "node:test";

import { checkWorkerReadiness } from "./readiness";

const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role",
  GROQ_API_KEY: "groq",
  DEEPGRAM_API_KEY: "deepgram",
  GCP_PROJECT_ID: "test-project",
  GCP_AI_GRADING_TOPIC: "ai-grading-jobs",
  CLOUD_RUN_SERVICE_URL: "https://worker.example.run.app",
  GCP_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL: "push@example.iam.gserviceaccount.com",
  GCP_SCHEDULER_SERVICE_ACCOUNT_EMAIL:
    "scheduler@example.iam.gserviceaccount.com",
  K_REVISION: "ai-grading-worker-00001-abc",
  AI_GRADING_IMAGE_DIGEST: `sha256:${"a".repeat(64)}`,
};

test("readiness exposes no secret values and identifies missing runtime config", () => {
  const result = checkWorkerReadiness({ ...complete, GROQ_API_KEY: "" });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, ["GROQ_API_KEY"]);
  assert.equal(JSON.stringify(result).includes("service-role"), false);
});

test("release mode requires explicit Azure pronunciation region policy", () => {
  const missing = checkWorkerReadiness({
    ...complete,
    AI_GRADING_REQUIRE_AZURE_PRONUNCIATION: "true",
  });
  assert.equal(missing.ready, false);
  assert.deepEqual(missing.missing, [
    "AI_GRADING_AZURE_EXPECTED_REGION",
    "AZURE_SPEECH_KEY+AZURE_SPEECH_REGION",
  ]);

  const configured = checkWorkerReadiness({
    ...complete,
    AI_GRADING_REQUIRE_AZURE_PRONUNCIATION: "true",
    AI_GRADING_AZURE_EXPECTED_REGION: "centralus",
    AZURE_SPEECH_KEY: "azure",
    AZURE_SPEECH_REGION: "centralus",
  });
  assert.equal(configured.ready, true);
  assert.equal(configured.capabilities.azurePronunciation, true);
});

test("readiness rejects mutable runtime identity and expected-region mismatch", () => {
  const result = checkWorkerReadiness({
    ...complete,
    AI_GRADING_IMAGE_DIGEST: "latest",
    AI_GRADING_AZURE_EXPECTED_REGION: "centralus",
    AZURE_SPEECH_KEY: "azure",
    AZURE_SPEECH_REGION: "eastus",
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.invalid, [
    "AI_GRADING_IMAGE_DIGEST",
    "AZURE_SPEECH_REGION",
  ]);
});

test("readiness rejects a malformed Azure endpoint and endpoint-only release config", () => {
  const malformed = checkWorkerReadiness({
    ...complete,
    AI_GRADING_REQUIRE_AZURE_PRONUNCIATION: "true",
    AI_GRADING_AZURE_EXPECTED_REGION: "centralus",
    AZURE_SPEECH_KEY: "azure",
    AZURE_SPEECH_ENDPOINT: "not-a-url",
  });
  assert.equal(malformed.ready, false);
  assert.ok(malformed.invalid.includes("AZURE_SPEECH_CONFIGURATION"));

  const endpointOnly = checkWorkerReadiness({
    ...complete,
    AI_GRADING_REQUIRE_AZURE_PRONUNCIATION: "true",
    AI_GRADING_AZURE_EXPECTED_REGION: "centralus",
    AZURE_SPEECH_KEY: "azure",
    AZURE_SPEECH_ENDPOINT: "https://speech.example.azure.com",
  });
  assert.equal(endpointOnly.ready, false);
  assert.ok(
    endpointOnly.missing.includes("AZURE_SPEECH_KEY+AZURE_SPEECH_REGION"),
  );
});

test("required Azure config fails closed without expected region and stays secret-safe", () => {
  const result = checkWorkerReadiness({
    ...complete,
    AI_GRADING_REQUIRE_AZURE_PRONUNCIATION: "true",
    AZURE_SPEECH_KEY: "do-not-leak-this-key",
    AZURE_SPEECH_REGION: "centralus",
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.missing, ["AI_GRADING_AZURE_EXPECTED_REGION"]);
  assert.equal(JSON.stringify(result).includes("do-not-leak-this-key"), false);
});

test("an invalid expected Azure region is rejected by name only", () => {
  const result = checkWorkerReadiness({
    ...complete,
    AI_GRADING_REQUIRE_AZURE_PRONUNCIATION: "true",
    AI_GRADING_AZURE_EXPECTED_REGION: "https://centralus.example",
    AZURE_SPEECH_KEY: "azure",
    AZURE_SPEECH_REGION: "centralus",
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.invalid, ["AI_GRADING_AZURE_EXPECTED_REGION"]);
});
