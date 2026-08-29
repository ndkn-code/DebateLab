import assert from "node:assert/strict";

import { fuseDebateResults, searchKnowledge } from "./service";

async function run() {
  const known = await searchKnowledge({
    collection: "ielts_rubric",
    purpose: "grading",
    language: "en",
    sourceRoute: "knowledge-test",
    rubricKey: "ielts_speaking_v1",
    rubricVersion: 1,
  });
  assert.equal(known.skippedReason, undefined);
  assert.equal(known.evidence.length, 1);
  assert.equal(known.evidence[0]?.reviewStatus, "approved");
  assert.match(known.context, /ielts_speaking_v1@1/);

  const unknown = await searchKnowledge({
    collection: "ielts_rubric",
    purpose: "grading",
    language: "en",
    sourceRoute: "knowledge-test",
    rubricKey: "unknown_rubric",
    rubricVersion: 1,
  });
  assert.equal(unknown.skippedReason, "unknown_rubric");
  assert.deepEqual(unknown.evidence, []);

  const anonymous = await searchKnowledge({
    collection: "learner_history",
    purpose: "coaching",
    language: "en",
    sourceRoute: "knowledge-test",
    query: "What should I improve?",
  });
  assert.equal(anonymous.skippedReason, "missing_user_id");

  const semanticItem = {
    item_id: "semantic",
    canonical_match_key: "match-1",
    motion_vi: "Motion",
    item_type: "debate_moment" as const,
    side: "proposition" as const,
    usable_for: ["judging" as const],
    evidence_status: "not_applicable" as const,
    confidence: 0.9,
    review_status: "approved",
    embedding_text: "semantic evidence",
    content: {},
    similarity: 0.8,
  };
  const lexicalItem = {
    ...semanticItem,
    item_id: "lexical",
    embedding_text: "lexical evidence",
    similarity: 0,
    lexical_rank: 1,
    lexical_score: 0.7,
  };
  const fused = fuseDebateResults(
    {
      enabled: true,
      contextBlock: "",
      items: [semanticItem],
      candidateItems: [semanticItem],
      logId: null,
      latencyMs: 3,
      topSimilarity: 0.8,
      avgTop3Similarity: 0.8,
      itemsAboveThresholdCount: 1,
      relevanceGatePassed: true,
      relevanceGateConfig: null,
      cacheKey: "semantic-cache",
      cacheHit: true,
    },
    [lexicalItem],
    "judging",
    8,
  );
  assert.deepEqual(
    new Set(fused.items.map((item) => item.item_id)),
    new Set(["semantic", "lexical"]),
  );
  assert.match(fused.contextBlock, /Truong Teen Retrieved Context/);
  assert.equal(fused.cacheHit, false);
}

void run();
