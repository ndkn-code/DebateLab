import assert from "node:assert/strict";
import {
  readDebateCorpusEmbeddingTimeoutMs,
  readDebateCorpusRagRelevanceConfig,
} from "./config";

assert.equal(readDebateCorpusEmbeddingTimeoutMs({}), 20000);
assert.equal(
  readDebateCorpusEmbeddingTimeoutMs({
    DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS: "25000",
  }),
  25000
);
assert.equal(
  readDebateCorpusEmbeddingTimeoutMs({
    DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS: "not-a-number",
  }),
  20000
);

assert.deepEqual(readDebateCorpusRagRelevanceConfig({}), {
  enabled: true,
  minTopSimilarity: 0.45,
  minItemSimilarity: 0.4,
  minItemsAboveThreshold: 2,
});

assert.deepEqual(
  readDebateCorpusRagRelevanceConfig({
    AI_CORPUS_RAG_RELEVANCE_GATE_ENABLED: "false",
    AI_CORPUS_RAG_MIN_TOP_SIMILARITY: "1.4",
    AI_CORPUS_RAG_MIN_ITEM_SIMILARITY: "-0.2",
    AI_CORPUS_RAG_MIN_ITEMS_ABOVE_THRESHOLD: "0",
  }),
  {
    enabled: false,
    minTopSimilarity: 1,
    minItemSimilarity: 0,
    minItemsAboveThreshold: 1,
  }
);
