import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildKnowledgeIngestionPlan } from "./ingestion";
import { buildEnglishDebateCombinedDraftManifest } from "./english-debate-release-manifest";
import { summarizeKnowledgeReleasePreflight } from "./release-preflight";

function readManifest(name: string) {
  return JSON.parse(
    readFileSync(
      fileURLToPath(
        new URL(`../../../scripts/manifests/${name}`, import.meta.url),
      ),
      "utf8",
    ),
  ) as {
    collection: "debate.en.competitive";
    collectionVersion: number;
    sources: Parameters<typeof buildKnowledgeIngestionPlan>[0]["sources"];
    items: Parameters<typeof buildKnowledgeIngestionPlan>[0]["items"];
  };
}

test("official English debate knowledge is provenance-bound and review-gated", () => {
  const manifest = readManifest("ai-knowledge-english-debate-official.v2.json");
  const plan = buildKnowledgeIngestionPlan(manifest);

  assert.equal(plan.collectionVersion, 2);
  assert.equal(plan.sources.length, 5);
  assert.equal(plan.items.length, 15);
  for (const source of plan.sources) {
    assert.equal(source.authorityTier, "official");
    assert.equal(source.rightsStatus, "requires_review");
    assert.equal(source.reviewStatus, "needs_review");
  }
  for (const item of plan.items) {
    assert.equal(item.reviewStatus, "needs_review");
    assert.deepEqual(item.usableFor, ["grading", "coaching"]);
    assert.ok(item.sourceId);
    assert.equal(item.permittedExcerpt, undefined);
  }
});

test("Gemini video research remains coaching-only until human verification", () => {
  const manifest = readManifest(
    "ai-knowledge-english-debate-video-candidates.v3.json",
  );
  const plan = buildKnowledgeIngestionPlan(manifest);

  assert.equal(plan.collectionVersion, 3);
  assert.equal(plan.sources.length, 2);
  assert.equal(plan.items.length, 13);
  for (const source of plan.sources) {
    assert.equal(source.authorityTier, "community");
    assert.equal(source.rightsStatus, "requires_review");
    assert.equal(source.reviewStatus, "candidate");
    assert.equal(source.metadata.noFullTranscript, true);
    assert.equal(source.metadata.verificationStatus, "blocked_user_control");
  }
  for (const item of plan.items) {
    assert.equal(item.reviewStatus, "candidate");
    assert.deepEqual(item.usableFor, ["coaching"]);
    assert.equal(item.permittedExcerpt, undefined);
    assert.equal(item.metadata.verified, false);
    assert.equal(item.metadata.noTranscriptStored, true);
  }
});

test("future v4 combines official derivations and video candidates without copied text", () => {
  const manifest = buildEnglishDebateCombinedDraftManifest();
  const plan = buildKnowledgeIngestionPlan(manifest);

  assert.equal(plan.collectionVersion, 4);
  assert.equal(plan.sources.length, 7);
  assert.equal(plan.items.length, 28);
  assert.equal(
    plan.items.some((item) => Boolean(item.permittedExcerpt)),
    false,
  );
  assert.equal(
    plan.items.some((item) =>
      Object.keys(item.insight).some((key) =>
        ["transcript", "excerpt", "fullText", "rawText"].includes(key),
      ),
    ),
    false,
  );
  assert.equal(
    plan.items.filter((item) => item.metadata.noTranscriptStored === true)
      .length,
    13,
  );
});

test("English combined draft preflight remains blocked until video verification and review", () => {
  const plan = buildKnowledgeIngestionPlan(
    buildEnglishDebateCombinedDraftManifest(),
  );
  const result = summarizeKnowledgeReleasePreflight({
    collection: {
      slug: "debate.en.competitive",
      embeddingProvider: "voyage",
      embeddingModel: "voyage-4-large",
      embeddingDimensions: 1024,
    },
    version: 4,
    versionStatus: "draft",
    items: plan.items.map((item) => ({
      id: item.id,
      sourceId: item.sourceId!,
      itemKind: item.itemType,
      reviewStatus: item.reviewStatus,
      usableFor: item.usableFor,
      contentHash: item.contentHash,
      metadata: item.metadata,
      submittedBy: "importer",
      reviewedBy: null,
    })),
    sources: plan.sources.map((source) => ({
      id: source.id,
      authorityTier: source.authorityTier,
      reviewStatus: source.reviewStatus,
      rightsStatus: source.rightsStatus,
      submittedBy: "importer",
      reviewedBy: null,
    })),
    embeddings: [],
  });
  assert.equal(result.ready, false);
  assert.match(result.blockers.join(","), /purpose_policy_violation/);
  assert.match(result.blockers.join(","), /independent_review/);
  assert.match(result.blockers.join(","), /missing_current_embeddings/);
});

test("verified English candidates still require every standard release gate", () => {
  const plan = buildKnowledgeIngestionPlan(
    buildEnglishDebateCombinedDraftManifest(),
  );
  const sources = plan.sources.map((source) => ({
    id: source.id,
    authorityTier: source.authorityTier,
    reviewStatus: "approved",
    rightsStatus: "approved_for_derived_use",
    submittedBy: "importer",
    reviewedBy: "reviewer",
  }));
  const items = plan.items.map((item) => ({
    id: item.id,
    sourceId: item.sourceId!,
    itemKind: item.itemType,
    reviewStatus: "approved",
    usableFor: item.usableFor,
    contentHash: item.contentHash,
    metadata:
      item.metadata.noTranscriptStored === true
        ? { ...item.metadata, verified: true }
        : item.metadata,
    submittedBy: "importer",
    reviewedBy: "reviewer",
  }));
  const embeddings = items.map((item) => ({
    itemId: item.id,
    provider: "voyage",
    model: "voyage-4-large",
    dimensions: 1024,
    inputType: "document",
    contentHash: item.contentHash,
  }));
  const result = summarizeKnowledgeReleasePreflight({
    collection: {
      slug: "debate.en.competitive",
      embeddingProvider: "voyage",
      embeddingModel: "voyage-4-large",
      embeddingDimensions: 1024,
    },
    version: 4,
    versionStatus: "draft",
    items,
    sources,
    embeddings,
  });
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});
