import assert from "node:assert/strict";
import {
  buildKnowledgeIngestionPlan,
  canonicalizeSourceUrl,
  KnowledgeItemSchema,
  resolveKnowledgeSourceIds,
} from "./ingestion";
import {
  getKnowledgeCollectionConfig,
  isKnowledgeCollectionKey,
} from "./collections";
import { getIeltsRubric, findIeltsBandExamples } from "./tools";
import { normalizeGenericKnowledgeRow } from "./runtime";
import { buildGenericKnowledgeRpcArgs } from "./runtime";

assert.equal(
  canonicalizeSourceUrl("HTTPS://Example.COM/guide/?utm_source=test#part"),
  "https://example.com/guide",
);
assert.equal(isKnowledgeCollectionKey("ielts.speaking"), true);
assert.equal(isKnowledgeCollectionKey("ielts.writing"), true);
assert.equal(isKnowledgeCollectionKey("debate.vi.truong_teen"), true);
assert.equal(isKnowledgeCollectionKey("ielts.unknown"), false);
assert.equal(getKnowledgeCollectionConfig("ielts.speaking").dimensions, 1024);
assert.equal(getKnowledgeCollectionConfig("ielts.speaking").provider, "voyage");
assert.equal(
  getKnowledgeCollectionConfig("debate.vi.truong_teen").provider,
  "self_hosted",
);

const rpcRow = normalizeGenericKnowledgeRow(
  {
    evidence_id: "11111111-1111-4111-8111-111111111111",
    source_id: "22222222-2222-4222-8222-222222222222",
    collection_slug: "ielts.speaking",
    collection_version: 3,
    item_kind: "band_descriptor",
    criterion: "fluencyCoherence",
    band_min: 5.5,
    band_max: 6.5,
    task_type: "speaking_part2",
    permitted_excerpt: "Official descriptor evidence",
    structured_insight: { criterion: "fluency" },
    relevance_score: 0.91,
    review_status: "approved",
  },
  "ielts.speaking",
);
assert.equal(rpcRow?.itemId, "11111111-1111-4111-8111-111111111111");
assert.equal(rpcRow?.corpusVersion, "3");
assert.equal(rpcRow?.metadata.criterion, "fluencyCoherence");
assert.equal(rpcRow?.metadata.bandMin, 5.5);

void (async () => {
  const rubric = await getIeltsRubric({
    purpose: "grading",
    language: "en",
    sourceRoute: "knowledge-runtime-test",
    skill: "speaking",
    rubricVersion: 1,
  });
  assert.equal(rubric.collection, "ielts_rubric");
  assert.equal(rubric.evidence[0]?.reviewStatus, "approved");

  const examples = await findIeltsBandExamples({
    purpose: "grading",
    language: "en",
    sourceRoute: "knowledge-runtime-test",
    skill: "writing",
    taskType: "writing_task2_essay",
    query: "cohesion band 8 versus band 9",
  });
  assert.equal(examples.collection, "ielts_exemplar");
})();

const source = {
  canonicalUrl:
    "https://ielts.org/organisations/ielts-for-organisations/understanding-ielts-scoring/resources-for-setting-your-ielts-scores?utm_campaign=x",
  publisher: "IELTS",
  authorityTier: "official" as const,
  rightsStatus: "approved_for_derived_use" as const,
  reviewStatus: "approved" as const,
};
const sourceId = "6af7e2c5-8a9b-4b3d-8af1-0e6a2aa02222";
const item = {
  collection: "ielts.speaking" as const,
  sourceId,
  itemType: "band_descriptor",
  insight: {
    skill: "speaking",
    taskType: "speaking_part2",
    criterion: "fluency",
    positiveEvidence: ["Ideas are developed coherently"],
    sourceAuthority: "official",
  },
  criterion: "fluency",
  bandMin: 8,
  bandMax: 9,
  taskType: "speaking_part2",
  permittedExcerpt: "Derived criterion guidance.",
  reviewStatus: "approved" as const,
  usableFor: ["grading"] as Array<"grading">,
};

const plan = buildKnowledgeIngestionPlan({
  collection: "ielts.speaking",
  collectionVersion: 2,
  sources: [source],
  items: [{ ...item, sourceId: undefined }],
});
assert.equal(plan.sources.length, 1);
assert.equal(plan.items.length, 1);
assert.equal(plan.items[0]?.collection, "ielts.speaking");
assert.ok(plan.items[0]?.contentHash);
assert.notEqual(
  plan.items[0]?.id,
  buildKnowledgeIngestionPlan({
    collection: "ielts.speaking",
    collectionVersion: 3,
    sources: [source],
    items: [{ ...item, sourceId: undefined }],
  }).items[0]?.id,
);
assert.equal(
  plan.importKey,
  buildKnowledgeIngestionPlan({
    collection: "ielts.speaking",
    collectionVersion: 2,
    sources: [source],
    items: [{ ...item, sourceId: undefined }],
  }).importKey,
);
const existingSourceId = "33333333-3333-4333-8333-333333333333";
assert.equal(
  resolveKnowledgeSourceIds(plan.sources, [
    {
      id: existingSourceId,
      canonical_url: plan.sources[0]!.canonicalUrl,
      checksum: plan.sources[0]!.checksum,
    },
  ]).get(plan.sources[0]!.id),
  existingSourceId,
);

assert.throws(
  () =>
    KnowledgeItemSchema.parse({
      ...item,
      collection: "ielts.writing",
      bandMin: 8,
      bandMax: 7,
    }),
  /bandMin/,
);
assert.throws(
  () =>
    buildKnowledgeIngestionPlan({
      collection: "ielts.speaking",
      collectionVersion: 2,
      sources: [],
      items: [{ ...item, sourceId: undefined, reviewStatus: "approved" }],
    }),
  /requires_source/,
);

const versionedArgs = buildGenericKnowledgeRpcArgs({
  collection: "ielts.writing",
  query: "Task response band descriptors",
  purpose: "grading",
  language: "en",
  sourceRoute: "knowledge-runtime-test",
  corpusVersion: "3",
});
assert.equal(versionedArgs.p_filters.collectionVersion, "3");

console.log("Knowledge runtime and ingestion tests passed.");
