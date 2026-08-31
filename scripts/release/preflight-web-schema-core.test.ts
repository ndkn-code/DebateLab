import assert from "node:assert/strict";
import test from "node:test";
import {
  hasRequiredChatContract,
  isRetryableSchemaProbeStatus,
} from "./preflight-web-schema-core";

test("accepts a ready public table-column contract", () => {
  assert.equal(hasRequiredChatContract(200), true);
});

test("rejects a missing product-context column or failed auth", () => {
  assert.equal(hasRequiredChatContract(400), false);
  assert.equal(hasRequiredChatContract(401), false);
  assert.equal(hasRequiredChatContract(500), false);
});

test("retries only transient schema probe failures", () => {
  assert.equal(isRetryableSchemaProbeStatus(408), true);
  assert.equal(isRetryableSchemaProbeStatus(429), true);
  assert.equal(isRetryableSchemaProbeStatus(503), true);
  assert.equal(isRetryableSchemaProbeStatus(400), false);
  assert.equal(isRetryableSchemaProbeStatus(401), false);
});
