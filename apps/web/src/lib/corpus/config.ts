export type DebateCorpusEmbeddingProvider = "voyage" | "self_hosted";

export const DEFAULT_SELF_HOSTED_EMBEDDING_URL =
  "https://ndknwork-thinkfy-embedding-api.hf.space";

export const DEBATE_CORPUS_EMBEDDING_PROVIDER: DebateCorpusEmbeddingProvider =
  "self_hosted";

export const DEBATE_CORPUS_EMBEDDING_MODEL =
  "AITeamVN/Vietnamese_Embedding";

export const DEBATE_CORPUS_EMBEDDING_DIMENSIONS = 1024;

export const DEBATE_CORPUS_EMBEDDING_URL =
  (
    process.env.DEBATE_CORPUS_EMBEDDING_URL ||
    DEFAULT_SELF_HOSTED_EMBEDDING_URL
  ).replace(/\/+$/, "");

export const DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS = 20_000;

export const AI_CORPUS_RAG_RELEVANCE_GATE_ENABLED = true;
export const AI_CORPUS_RAG_MIN_TOP_SIMILARITY = 0.45;
export const AI_CORPUS_RAG_MIN_ITEM_SIMILARITY = 0.4;
export const AI_CORPUS_RAG_MIN_ITEMS_ABOVE_THRESHOLD = 2;

export function isDebateCorpusRagEnabled() {
  return process.env.AI_CORPUS_RAG_ENABLED === "true";
}

export function getDebateCorpusRagReviewStatuses() {
  const raw = process.env.AI_CORPUS_RAG_REVIEW_STATUSES;
  const fallback = ["candidate", "approved", "needs_review"];
  if (!raw) return fallback;
  const allowed = new Set(["candidate", "approved", "needs_review"]);
  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => allowed.has(item));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : fallback;
}

export function hasDebateCorpusEmbeddingConfig() {
  if (DEBATE_CORPUS_EMBEDDING_PROVIDER === "self_hosted") {
    return Boolean(DEBATE_CORPUS_EMBEDDING_URL);
  }
  return Boolean(process.env.VOYAGE_API_KEY);
}

export function getDebateCorpusEmbeddingConfig() {
  return {
    provider: DEBATE_CORPUS_EMBEDDING_PROVIDER,
    model: DEBATE_CORPUS_EMBEDDING_MODEL,
    dimensions: DEBATE_CORPUS_EMBEDDING_DIMENSIONS,
  };
}

export function getDebateCorpusRagRelevanceConfig() {
  return {
    enabled: AI_CORPUS_RAG_RELEVANCE_GATE_ENABLED,
    minTopSimilarity: AI_CORPUS_RAG_MIN_TOP_SIMILARITY,
    minItemSimilarity: AI_CORPUS_RAG_MIN_ITEM_SIMILARITY,
    minItemsAboveThreshold: AI_CORPUS_RAG_MIN_ITEMS_ABOVE_THRESHOLD,
  };
}
