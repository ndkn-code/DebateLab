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

export const DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS =
  Number.parseInt(process.env.DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS || "12000", 10) ||
  12000;

export function isDebateCorpusRagEnabled() {
  return process.env.AI_CORPUS_RAG_ENABLED === "true";
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
