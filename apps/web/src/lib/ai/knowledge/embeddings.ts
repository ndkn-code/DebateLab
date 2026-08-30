import "server-only";

import {
  getKnowledgeCollectionConfig,
  type KnowledgeCollectionKey,
} from "./collections";
import { createSelfHostedEmbeddings } from "@/lib/corpus/self-hosted";
import { createVoyageEmbeddings } from "@/lib/corpus/voyage";

export async function createKnowledgeEmbeddings(input: {
  collection: KnowledgeCollectionKey;
  texts: string[];
  inputType: "document" | "query";
  timeoutMs?: number;
}) {
  const config = getKnowledgeCollectionConfig(input.collection);
  const result =
    config.provider === "voyage"
      ? await createVoyageEmbeddings({
          texts: input.texts,
          inputType: input.inputType,
          model: config.model,
          dimensions: config.dimensions,
          timeoutMs: input.timeoutMs,
        })
      : await createSelfHostedEmbeddings({
          texts: input.texts,
          inputType: input.inputType,
          timeoutMs: input.timeoutMs,
        });

  for (const embedding of result.embeddings) {
    if (embedding.length !== config.dimensions) {
      throw new Error(
        `knowledge_embedding_dimension_mismatch:${input.collection}:${config.dimensions}:${embedding.length}`,
      );
    }
  }
  return {
    ...result,
    provider: config.provider,
    model: config.model,
    dimensions: config.dimensions,
  };
}

export async function createKnowledgeEmbedding(input: {
  collection: KnowledgeCollectionKey;
  text: string;
  inputType: "document" | "query";
  timeoutMs?: number;
}) {
  const result = await createKnowledgeEmbeddings({
    ...input,
    texts: [input.text],
  });
  return {
    embedding: result.embeddings[0],
    provider: result.provider,
    model: result.model,
    dimensions: result.dimensions,
    usage: result.usage,
  };
}
