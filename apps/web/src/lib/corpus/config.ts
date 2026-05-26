export type DebateCorpusEmbeddingProvider = "voyage" | "self_hosted";

export const DEBATE_CORPUS_EMBEDDING_PROVIDER = (
  process.env.DEBATE_CORPUS_EMBEDDING_PROVIDER || "voyage"
) as DebateCorpusEmbeddingProvider;

export const DEBATE_CORPUS_EMBEDDING_MODEL =
  process.env.DEBATE_CORPUS_EMBEDDING_MODEL || "voyage-4-lite";

export const DEBATE_CORPUS_EMBEDDING_DIMENSIONS = Number.parseInt(
  process.env.DEBATE_CORPUS_EMBEDDING_DIMENSIONS || "1024",
  10
) || 1024;

export const DEBATE_CORPUS_EMBEDDING_URL =
  process.env.DEBATE_CORPUS_EMBEDDING_URL || "";

function parseNumberEnv(value: string | undefined, fallback: number) {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseIntegerEnv(value: string | undefined, fallback: number) {
  if (value == null || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readDebateCorpusEmbeddingTimeoutMs(
  env: Record<string, string | undefined>
) {
  return parseIntegerEnv(env.DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS, 20000);
}

export function readDebateCorpusRagRelevanceConfig(
  env: Record<string, string | undefined>
) {
  return {
    enabled: env.AI_CORPUS_RAG_RELEVANCE_GATE_ENABLED !== "false",
    minTopSimilarity: Math.max(
      0,
      Math.min(1, parseNumberEnv(env.AI_CORPUS_RAG_MIN_TOP_SIMILARITY, 0.45))
    ),
    minItemSimilarity: Math.max(
      0,
      Math.min(1, parseNumberEnv(env.AI_CORPUS_RAG_MIN_ITEM_SIMILARITY, 0.4))
    ),
    minItemsAboveThreshold: Math.max(
      1,
      parseIntegerEnv(env.AI_CORPUS_RAG_MIN_ITEMS_ABOVE_THRESHOLD, 2)
    ),
  };
}

export const DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS =
  readDebateCorpusEmbeddingTimeoutMs(process.env);

const relevanceConfig = readDebateCorpusRagRelevanceConfig(process.env);

export const AI_CORPUS_RAG_RELEVANCE_GATE_ENABLED = relevanceConfig.enabled;

export const AI_CORPUS_RAG_MIN_TOP_SIMILARITY =
  relevanceConfig.minTopSimilarity;

export const AI_CORPUS_RAG_MIN_ITEM_SIMILARITY =
  relevanceConfig.minItemSimilarity;

export const AI_CORPUS_RAG_MIN_ITEMS_ABOVE_THRESHOLD =
  relevanceConfig.minItemsAboveThreshold;

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
