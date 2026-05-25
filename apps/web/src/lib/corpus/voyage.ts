import "server-only";

import {
  DEBATE_CORPUS_EMBEDDING_DIMENSIONS,
  DEBATE_CORPUS_EMBEDDING_MODEL,
} from "./config";

type VoyageInputType = "document" | "query";

interface VoyageEmbeddingResponse {
  data?: Array<{
    embedding?: number[];
    index?: number;
  }>;
  usage?: {
    total_tokens?: number;
  };
  detail?: unknown;
  error?: unknown;
}

export async function createVoyageEmbeddings(input: {
  texts: string[];
  inputType: VoyageInputType;
  model?: string;
  dimensions?: number;
  timeoutMs?: number;
}) {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 30000
  );

  try {
    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: input.texts,
        model: input.model ?? DEBATE_CORPUS_EMBEDDING_MODEL,
        input_type: input.inputType,
        output_dimension:
          input.dimensions ?? DEBATE_CORPUS_EMBEDDING_DIMENSIONS,
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => ({}))) as
      | VoyageEmbeddingResponse
      | Record<string, unknown>;

    if (!response.ok) {
      throw new Error(
        `Voyage embedding failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`
      );
    }

    const data = Array.isArray((payload as VoyageEmbeddingResponse).data)
      ? (payload as VoyageEmbeddingResponse).data!
      : [];
    const embeddings = data
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((item) => item.embedding)
      .filter((embedding): embedding is number[] => Array.isArray(embedding));

    if (embeddings.length !== input.texts.length) {
      throw new Error(
        `Voyage embedding count mismatch: expected ${input.texts.length}, received ${embeddings.length}`
      );
    }

    return {
      embeddings,
      usage: (payload as VoyageEmbeddingResponse).usage ?? null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function createVoyageEmbedding(input: {
  text: string;
  inputType: VoyageInputType;
  timeoutMs?: number;
}) {
  const result = await createVoyageEmbeddings({
    texts: [input.text],
    inputType: input.inputType,
    timeoutMs: input.timeoutMs,
  });

  return {
    embedding: result.embeddings[0],
    usage: result.usage,
  };
}
