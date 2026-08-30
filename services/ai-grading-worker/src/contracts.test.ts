import assert from "node:assert/strict";
import test from "node:test";
import {
  aiGradingJobSchema,
  parseAiGradingPubSubEnvelope,
} from "@/lib/ai/grading/contracts";
import { getAiGradingBackend } from "@/lib/ai/grading/backend";

const job = {
  schemaVersion: 1 as const,
  kind: "ielts_writing_score" as const,
  sourceId: "00000000-0000-4000-8000-000000000001",
  workflowRunId: "00000000-0000-4000-8000-000000000002",
};

test("AI grading messages are reference-only and strict", () => {
  assert.deepEqual(aiGradingJobSchema.parse(job), job);
  assert.throws(
    () => aiGradingJobSchema.parse({ ...job, essay: "student content" }),
    /unrecognized_keys/i,
  );
  assert.throws(
    () => aiGradingJobSchema.parse({ ...job, sourceId: "not-a-uuid" }),
    /uuid/i,
  );
});

test("Pub/Sub envelopes preserve delivery identity", () => {
  assert.deepEqual(
    parseAiGradingPubSubEnvelope({
      message: {
        messageId: "pubsub-123",
        data: Buffer.from(JSON.stringify(job)).toString("base64"),
      },
      deliveryAttempt: 2,
    }),
    { job, messageId: "pubsub-123", deliveryAttempt: 2 },
  );
});

test("backend selection is explicit and fail-closed", () => {
  const previous = process.env.AI_GRADING_BACKEND;
  try {
    delete process.env.AI_GRADING_BACKEND;
    assert.throws(() => getAiGradingBackend(), /must be set explicitly/);
    process.env.AI_GRADING_BACKEND = "unknown";
    assert.throws(() => getAiGradingBackend(), /must be set explicitly/);
    process.env.AI_GRADING_BACKEND = "legacy";
    assert.equal(getAiGradingBackend(), "legacy");
    process.env.AI_GRADING_BACKEND = "gcp";
    assert.equal(getAiGradingBackend(), "gcp");
  } finally {
    if (previous === undefined) delete process.env.AI_GRADING_BACKEND;
    else process.env.AI_GRADING_BACKEND = previous;
  }
});
