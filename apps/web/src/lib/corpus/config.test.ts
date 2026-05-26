import assert from "node:assert/strict";
import {
  AI_CORPUS_RAG_MIN_ITEM_SIMILARITY,
  AI_CORPUS_RAG_MIN_ITEMS_ABOVE_THRESHOLD,
  AI_CORPUS_RAG_MIN_TOP_SIMILARITY,
  AI_CORPUS_RAG_RELEVANCE_GATE_ENABLED,
  DEBATE_CORPUS_EMBEDDING_DIMENSIONS,
  DEBATE_CORPUS_EMBEDDING_MODEL,
  DEBATE_CORPUS_EMBEDDING_PROVIDER,
  DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS,
  getDebateCorpusRagRelevanceConfig,
} from "./config";

assert.equal(DEBATE_CORPUS_EMBEDDING_PROVIDER, "self_hosted");
assert.equal(DEBATE_CORPUS_EMBEDDING_MODEL, "AITeamVN/Vietnamese_Embedding");
assert.equal(DEBATE_CORPUS_EMBEDDING_DIMENSIONS, 1024);
assert.equal(DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS, 20000);

assert.equal(AI_CORPUS_RAG_RELEVANCE_GATE_ENABLED, true);
assert.equal(AI_CORPUS_RAG_MIN_TOP_SIMILARITY, 0.45);
assert.equal(AI_CORPUS_RAG_MIN_ITEM_SIMILARITY, 0.4);
assert.equal(AI_CORPUS_RAG_MIN_ITEMS_ABOVE_THRESHOLD, 2);

assert.deepEqual(getDebateCorpusRagRelevanceConfig(), {
  enabled: true,
  minTopSimilarity: 0.45,
  minItemSimilarity: 0.4,
  minItemsAboveThreshold: 2,
});
