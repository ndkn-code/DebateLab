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
