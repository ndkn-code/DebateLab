import assert from "node:assert/strict";
import test from "node:test";
import {
  chatFailureFingerprint,
  parseChatErrorDetails,
  sanitizeChatErrorDetails,
  shouldCaptureChatHttpFailure,
} from "./chat-error";

test("extracts only bounded correlation fields from an API error", () => {
  assert.deepEqual(
    parseChatErrorDetails(
      JSON.stringify({
        code: "COACH_REQUEST_FAILED",
        requestId: "123e4567-e89b-12d3-a456-426614174000",
        error: "student message must never be surfaced as diagnostics",
      }),
    ),
    {
      code: "COACH_REQUEST_FAILED",
      requestId: "123e4567-e89b-12d3-a456-426614174000",
    },
  );
  assert.deepEqual(
    parseChatErrorDetails(
      JSON.stringify({
        code: "not safe to log: student content",
        requestId: "not-a-uuid",
      }),
    ),
    {},
  );
});

test("sanitizes streamed correlation fields before telemetry", () => {
  assert.deepEqual(
    sanitizeChatErrorDetails({
      code: "COACH_STREAM_FAILED",
      requestId: "123e4567-e89b-12d3-a456-426614174000",
    }),
    {
      code: "COACH_STREAM_FAILED",
      requestId: "123e4567-e89b-12d3-a456-426614174000",
    },
  );
  assert.deepEqual(
    sanitizeChatErrorDetails({
      code: "unsafe user text with spaces",
      requestId: "not-a-uuid",
    }),
    {},
  );
  assert.equal(
    chatFailureFingerprint({ code: "unsafe user text with spaces" }),
    "chat-request-failed:network",
  );
});

test("only server failures are captured as handled chat failures", () => {
  assert.equal(shouldCaptureChatHttpFailure(400), false);
  assert.equal(shouldCaptureChatHttpFailure(429), false);
  assert.equal(shouldCaptureChatHttpFailure(500), true);
  assert.equal(shouldCaptureChatHttpFailure(503), true);
});

test("chat failure fingerprints separate failure classes", () => {
  assert.equal(
    chatFailureFingerprint({ status: 500, code: "COACH_REQUEST_FAILED" }),
    "chat-request-failed:COACH_REQUEST_FAILED",
  );
  assert.equal(chatFailureFingerprint({ status: 503 }), "chat-request-failed:503");
  assert.equal(chatFailureFingerprint({}), "chat-request-failed:network");
});
