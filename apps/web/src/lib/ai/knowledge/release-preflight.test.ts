import assert from "node:assert/strict";
import test from "node:test";

import { summarizeKnowledgeReleasePreflight } from "./release-preflight";

const collection = {
  slug: "ielts.writing",
  embeddingProvider: "voyage",
  embeddingModel: "voyage-4-large",
  embeddingDimensions: 1024,
};
const item = {
  id: "item-1",
  sourceId: "source-1",
  itemKind: "practice_prompt",
  reviewStatus: "approved",
  usableFor: ["coaching"],
  contentHash: "content-hash",
  metadata: { answerKeyAvailable: false },
  submittedBy: "importer",
  reviewedBy: "reviewer",
};
const source = {
  id: "source-1",
  authorityTier: "ai_derived",
  reviewStatus: "approved",
  rightsStatus: "approved_for_derived_use",
  submittedBy: "importer",
  reviewedBy: "reviewer",
};
const embedding = {
  itemId: "item-1",
  provider: "voyage",
  model: "voyage-4-large",
  dimensions: 1024,
  inputType: "document",
  contentHash: "content-hash",
};

test("a coaching-only independently reviewed version is publishable", () => {
  const result = summarizeKnowledgeReleasePreflight({
    collection,
    version: 2,
    versionStatus: "draft",
    items: [item],
    sources: [source],
    embeddings: [embedding],
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test("approved official IELTS descriptors may serve grading and coaching", () => {
  const descriptor = {
    ...item,
    itemKind: "rubric_descriptor_candidate",
    usableFor: ["grading", "coaching"],
    metadata: { derivedOnly: true, answerKeyAvailable: false },
  };
  const result = summarizeKnowledgeReleasePreflight({
    collection,
    version: 4,
    versionStatus: "draft",
    items: [descriptor],
    sources: [{ ...source, authorityTier: "official" }],
    embeddings: [embedding],
  });
  assert.equal(result.ready, true);
  assert.equal(result.counts.gradingAndCoaching, 1);
  assert.equal(result.counts.purposePolicyViolations, 0);
});

test("IELTS examples and mock prompts cannot acquire grading authority", () => {
  for (const itemKind of [
    "practice_prompt",
    "scored_example_locator_candidate",
  ]) {
    const result = summarizeKnowledgeReleasePreflight({
      collection,
      version: 4,
      versionStatus: "draft",
      items: [{ ...item, itemKind, usableFor: ["grading", "coaching"] }],
      sources: [{ ...source, authorityTier: "official" }],
      embeddings: [embedding],
    });
    assert.equal(result.ready, false);
    assert.match(result.blockers.join(","), /purpose_policy_violation/);
  }
});

test("official descriptor authority is not inferred from item text", () => {
  const result = summarizeKnowledgeReleasePreflight({
    collection,
    version: 4,
    versionStatus: "draft",
    items: [
      {
        ...item,
        itemKind: "rubric_descriptor_candidate",
        usableFor: ["grading", "coaching"],
      },
    ],
    sources: [{ ...source, authorityTier: "community" }],
    embeddings: [embedding],
  });
  assert.equal(result.ready, false);
  assert.match(result.blockers.join(","), /purpose_policy_violation/);
});

test("review, answer-key, and embedding failures are explicit", () => {
  const result = summarizeKnowledgeReleasePreflight({
    collection,
    version: 2,
    versionStatus: "draft",
    items: [
      {
        ...item,
        reviewStatus: "needs_review",
        reviewedBy: null,
        metadata: { answerKeyAvailable: true },
      },
    ],
    sources: [{ ...source, reviewStatus: "candidate", reviewedBy: null }],
    embeddings: [],
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    "contains_answer_key_material",
    "items_need_independent_review",
    "sources_need_rights_and_independent_review",
    "missing_current_embeddings",
  ]);
});

test("review by the importer does not satisfy separation of duties", () => {
  const result = summarizeKnowledgeReleasePreflight({
    collection,
    version: 2,
    versionStatus: "draft",
    items: [{ ...item, reviewedBy: "importer" }],
    sources: [{ ...source, reviewedBy: "importer" }],
    embeddings: [embedding],
  });
  assert.equal(result.ready, false);
  assert.match(result.blockers.join(","), /independent_review/);
});
