import "server-only";

import type { DebateCorpusEmbeddingProvider } from "./config";
import { DEBATE_CORPUS_EMBEDDING_PROVIDER } from "./config";
import { createSelfHostedEmbedding } from "./self-hosted";
import { createVoyageEmbedding } from "./voyage";

type CorpusEmbeddingInputType = "document" | "query";

export async function createDebateCorpusEmbedding(input: {
  text: string;
  inputType: CorpusEmbeddingInputType;
  timeoutMs?: number;
}) {
  const provider = DEBATE_CORPUS_EMBEDDING_PROVIDER as DebateCorpusEmbeddingProvider;
  if (provider === "self_hosted") {
    return createSelfHostedEmbedding(input);
  }
  return createVoyageEmbedding(input);
}
