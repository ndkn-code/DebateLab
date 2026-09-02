import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  AiGradingConfigurationError,
  AiGradingPausedError,
  requireGcpAiGradingForSubmission,
} from "./backend";

const originalBackend = process.env.AI_GRADING_BACKEND;

afterEach(() => {
  if (originalBackend === undefined) delete process.env.AI_GRADING_BACKEND;
  else process.env.AI_GRADING_BACKEND = originalBackend;
});

test("the legacy kill switch rejects a new job explicitly", () => {
  process.env.AI_GRADING_BACKEND = "legacy";
  assert.throws(
    requireGcpAiGradingForSubmission,
    (error) =>
      error instanceof AiGradingPausedError &&
      /no new scoring job was created/.test(error.message),
  );
});

test("missing backend configuration fails closed", () => {
  delete process.env.AI_GRADING_BACKEND;
  assert.throws(requireGcpAiGradingForSubmission, AiGradingConfigurationError);
});

test("the GCP backend accepts submissions", () => {
  process.env.AI_GRADING_BACKEND = "gcp";
  assert.doesNotThrow(requireGcpAiGradingForSubmission);
});
