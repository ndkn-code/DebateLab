import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeServerSpanAttributes } from "./server-otel-sanitize";

test("server span attributes only keep bounded categorical values", () => {
  assert.deepEqual(
    sanitizeServerSpanAttributes({
      "feature.area": "practice-analysis",
      attempt: 2,
      enabled: true,
      transcript: "do not send this",
      authorization: "Bearer secret",
      "request body": "do not send this",
      long: "x".repeat(300),
      missing: undefined,
    }),
    {
      "feature.area": "practice-analysis",
      attempt: 2,
      enabled: true,
      long: "x".repeat(200),
    },
  );
});
