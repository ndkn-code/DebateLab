import assert from "node:assert/strict";

import {
  canStartPaidScoring,
  getCaptureActionState,
} from "./capture-action-state";

assert.equal(
  getCaptureActionState({
    responseId: null,
    scored: false,
    failed: false,
    submitting: false,
  }),
  "draft",
);
assert.equal(
  getCaptureActionState({
    responseId: "response-1",
    scored: false,
    failed: false,
    submitting: false,
  }),
  "pending",
);
assert.equal(
  getCaptureActionState({
    responseId: "response-1",
    scored: false,
    failed: true,
    submitting: false,
  }),
  "retryable",
);
assert.equal(
  getCaptureActionState({
    responseId: "response-1",
    scored: true,
    failed: true,
    submitting: false,
  }),
  "complete",
);
assert.equal(
  getCaptureActionState({
    responseId: null,
    scored: false,
    failed: false,
    submitting: true,
  }),
  "pending",
);

assert.equal(canStartPaidScoring("draft"), true);
assert.equal(canStartPaidScoring("retryable"), true);
assert.equal(canStartPaidScoring("pending"), false);
assert.equal(canStartPaidScoring("complete"), false);

console.log("IELTS paid capture action-state tests passed");
