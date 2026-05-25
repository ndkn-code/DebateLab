import "server-only";

import {
  DEBATE_CORPUS_EMBEDDING_DIMENSIONS,
  DEBATE_CORPUS_EMBEDDING_MODEL,
  DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS,
  DEBATE_CORPUS_EMBEDDING_URL,
} from "./config";

type SelfHostedInputType = "document" | "query";

interface SelfHostedEmbeddingResponse {
  embeddings?: unknown;
  usage?: unknown;
  dimensions?: number;
  model?: string;
  detail?: unknown;
}

function createAuthHeaders() {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const apiKey = process.env.DEBATE_CORPUS_EMBEDDING_API_KEY;
  if (apiKey) {
    headers["X-Thinkfy-Embedding-Key"] = apiKey;
  }
  const bearerToken = process.env.DEBATE_CORPUS_EMBEDDING_BEARER_TOKEN;
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  return headers;
}

function endpointUrl(pathname: string) {
  const baseUrl = DEBATE_CORPUS_EMBEDDING_URL.replace(/\/+$/, "");
  if (!baseUrl) {
    throw new Error("DEBATE_CORPUS_EMBEDDING_URL is not configured");
  }
  return `${baseUrl}${pathname}`;
}

function normalizeEmbeddings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (embedding): embedding is number[] =>
      Array.isArray(embedding) &&
      embedding.every((entry) => typeof entry === "number")
  );
}

export async function createSelfHostedEmbeddings(input: {
  texts: string[];
  inputType: SelfHostedInputType;
  timeoutMs?: number;
}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? DEBATE_CORPUS_EMBEDDING_TIMEOUT_MS
  );

  try {
    const response = await fetch(endpointUrl("/embed"), {
      method: "POST",
      headers: createAuthHeaders(),
      body: JSON.stringify({
        texts: input.texts,
        input_type: input.inputType,
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => ({}))) as
      | SelfHostedEmbeddingResponse
      | Record<string, unknown>;

    if (!response.ok) {
      throw new Error(
        `Self-hosted embedding failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`
      );
    }

    const embeddings = normalizeEmbeddings(
      (payload as SelfHostedEmbeddingResponse).embeddings
    );
    if (embeddings.length !== input.texts.length) {
      throw new Error(
        `Self-hosted embedding count mismatch: expected ${input.texts.length}, received ${embeddings.length}`
      );
    }
    for (const embedding of embeddings) {
      if (embedding.length !== DEBATE_CORPUS_EMBEDDING_DIMENSIONS) {
        throw new Error(
          `Self-hosted embedding dimension mismatch: expected ${DEBATE_CORPUS_EMBEDDING_DIMENSIONS}, received ${embedding.length}`
        );
      }
    }

    return {
      embeddings,
      usage: (payload as SelfHostedEmbeddingResponse).usage ?? null,
      model: (payload as SelfHostedEmbeddingResponse).model ?? DEBATE_CORPUS_EMBEDDING_MODEL,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function createSelfHostedEmbedding(input: {
  text: string;
  inputType: SelfHostedInputType;
  timeoutMs?: number;
}) {
  const result = await createSelfHostedEmbeddings({
    texts: [input.text],
    inputType: input.inputType,
    timeoutMs: input.timeoutMs,
  });

  return {
    embedding: result.embeddings[0],
    usage: result.usage,
  };
}
