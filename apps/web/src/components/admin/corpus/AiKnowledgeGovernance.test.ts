import assert from "node:assert/strict";

import {
  getAiKnowledgeGovernance,
  redactProtectedBenchmarkFields,
} from "./AiKnowledgeGovernance";

const authoritative = {
  collection_version: 4,
  collection_version_status: "published",
  review_status: "approved",
  usable_for: ["grading"],
  ai_knowledge_sources: {
    authority_tier: "official",
    rights_status: "approved_for_derived_use",
    review_status: "approved",
  },
};

assert.equal(
  getAiKnowledgeGovernance(authoritative).evidencePolicy,
  "grading_authoritative",
);
assert.equal(
  getAiKnowledgeGovernance({
    ...authoritative,
    ai_knowledge_sources: {
      ...authoritative.ai_knowledge_sources,
      review_status: "needs_review",
    },
  }).evidencePolicy,
  "grading_blocked",
);
assert.equal(
  getAiKnowledgeGovernance({
    ...authoritative,
    collection_version_status: "superseded",
  }).evidencePolicy,
  "grading_blocked",
);
assert.equal(
  getAiKnowledgeGovernance({
    ...authoritative,
    collection_version_status: undefined,
  }).evidencePolicy,
  "grading_declared",
);

const redacted = redactProtectedBenchmarkFields({
  title: "Visible title",
  protectedBenchmarkLabel: "secret",
  nested: { gold_labels: ["secret"], allowed: true },
}) as Record<string, unknown>;
assert.equal(redacted.title, "Visible title");
assert.equal("protectedBenchmarkLabel" in redacted, false);
assert.deepEqual(redacted.nested, { allowed: true });

console.log("AI knowledge governance tests passed");
