import assert from "node:assert/strict";

import {
  sanitizeTelemetryItem,
  sanitizeTelemetryString,
  stripUrlQuery,
} from "./faro-sanitize";

assert.equal(
  stripUrlQuery("https://thinkfy.net/en/practice?attempt=secret#result"),
  "https://thinkfy.net/en/practice#result"
);
assert.equal(
  sanitizeTelemetryString('Scoring failed: transcript="student speech"'),
  "Scoring failed: transcript= [redacted]"
);
assert.equal(stripUrlQuery("/en/dashboard?tab=private"), "/en/dashboard");

assert.equal(
  sanitizeTelemetryString(
    "Failed for learner@example.com at https://thinkfy.net/en?a=secret"
  ),
  "Failed for [redacted-email] at https://thinkfy.net/en"
);

const sanitized = sanitizeTelemetryItem({
  payload: { essay: "student work" },
  requestBody: "private request",
  context: {
    route: "/en/practice?answer=private",
    debugId: "debug-safe",
    authorization: "Bearer secret-token",
    nested: { transcript: "private speech", status: "failed" },
  },
});

assert.deepEqual(sanitized, {
  payload: "[redacted]",
  requestBody: "[redacted]",
  context: {
    route: "/en/practice",
    debugId: "debug-safe",
    authorization: "[redacted]",
    nested: { transcript: "[redacted]", status: "failed" },
  },
});

console.log("Faro telemetry sanitizer tests passed");
