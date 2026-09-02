import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { buildKnowledgeIngestionPlan } from "./ingestion";

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
