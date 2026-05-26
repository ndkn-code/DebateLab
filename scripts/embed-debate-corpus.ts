import * as path from "node:path";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  estimateDebateCorpusTokens,
} from "../apps/web/src/lib/corpus/model";
import {
  DEBATE_CORPUS_EMBEDDING_DIMENSIONS,
  DEBATE_CORPUS_EMBEDDING_MODEL,
  DEBATE_CORPUS_EMBEDDING_PROVIDER,
  DEFAULT_SELF_HOSTED_EMBEDDING_URL,
} from "../apps/web/src/lib/corpus/config";

interface EmbedOptions {
  apply: boolean;
  limit: number | null;
  batchSize: number;
  delayMs: number | null;
}

interface CorpusItemRow {
  id: string;
  content_hash: string;
  embedding_text: string;
}

interface ExistingEmbeddingRow {
  item_id: string;
  content_hash: string;
}

function embeddingProvider() {
  return (
    process.env.DEBATE_CORPUS_EMBEDDING_PROVIDER ||
    DEBATE_CORPUS_EMBEDDING_PROVIDER
  );
}

function embeddingModel() {
  if (embeddingProvider() === "voyage") {
    return process.env.DEBATE_CORPUS_EMBEDDING_MODEL || "voyage-4-lite";
  }
  return process.env.DEBATE_CORPUS_EMBEDDING_MODEL || DEBATE_CORPUS_EMBEDDING_MODEL;
}

function embeddingDimensions() {
  return Number.parseInt(
    process.env.DEBATE_CORPUS_EMBEDDING_DIMENSIONS ||
      String(DEBATE_CORPUS_EMBEDDING_DIMENSIONS),
    10
  ) || DEBATE_CORPUS_EMBEDDING_DIMENSIONS;
}

function parseArgs(argv: string[]): EmbedOptions {
  const options: EmbedOptions = {
    apply: false,
    limit: null,
    batchSize: 16,
    delayMs: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--limit") {
      options.limit = Number.parseInt(argv[index + 1] ?? "", 10);
      index += 1;
    } else if (arg === "--batch-size") {
      options.batchSize = Math.max(
        1,
        Math.min(128, Number.parseInt(argv[index + 1] ?? "32", 10))
      );
      index += 1;
    } else if (arg === "--delay-ms") {
      options.delayMs = Math.max(
        0,
        Number.parseInt(argv[index + 1] ?? "0", 10) || 0
      );
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: tsx scripts/embed-debate-corpus.ts [--apply] [--limit n] [--batch-size n] [--delay-ms n]

Default mode is a dry run that counts missing/stale embeddings. Pass --apply
to call the configured provider and upsert debate_corpus_embeddings.

The default live delay is conservative for Voyage free-account limits and 0ms
for self-hosted endpoints.`);
      process.exit(0);
    }
  }

  if (options.limit != null && (!Number.isFinite(options.limit) || options.limit <= 0)) {
    options.limit = null;
  }

  return options;
}

function createSupabaseAdminClient() {
  loadEnvConfig(path.resolve(process.cwd(), "apps/web"));
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."
    );
  }
  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readRetryAfterMs(response: Response) {
  const retryAfter = response.headers.get("retry-after");
  if (!retryAfter) return null;
  const seconds = Number.parseFloat(retryAfter);
  if (Number.isFinite(seconds)) return Math.ceil(seconds * 1000);
  const dateMs = Date.parse(retryAfter);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : null;
}

async function createVoyageEmbeddings(texts: string[], attempt = 1): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY is not configured.");
  }

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: embeddingModel(),
      input_type: "document",
      output_dimension: embeddingDimensions(),
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 429 && attempt <= 4) {
    const waitMs =
      readRetryAfterMs(response) ?? Math.min(90000, 20000 * attempt);
    console.warn(`Voyage rate limit hit; retrying batch in ${Math.round(waitMs / 1000)}s.`);
    await sleep(waitMs);
    return createVoyageEmbeddings(texts, attempt + 1);
  }
  if (!response.ok) {
    throw new Error(
      `Voyage embedding failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`
    );
  }
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data
    .sort((a: { index?: number }, b: { index?: number }) => (a.index ?? 0) - (b.index ?? 0))
    .map((item: { embedding?: number[] }) => item.embedding)
    .filter((embedding: unknown): embedding is number[] => Array.isArray(embedding));
}

function createSelfHostedHeaders() {
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

function selfHostedEmbeddingUrl() {
  const baseUrl = (
    process.env.DEBATE_CORPUS_EMBEDDING_URL ||
    DEFAULT_SELF_HOSTED_EMBEDDING_URL
  ).replace(/\/+$/, "");
  return `${baseUrl}/embed`;
}

async function createSelfHostedEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch(selfHostedEmbeddingUrl(), {
    method: "POST",
    headers: createSelfHostedHeaders(),
    body: JSON.stringify({
      texts,
      input_type: "document",
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `Self-hosted embedding failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`
    );
  }
  const embeddings = Array.isArray(payload.embeddings)
    ? payload.embeddings.filter((embedding: unknown): embedding is number[] =>
        Array.isArray(embedding) &&
        embedding.every((entry) => typeof entry === "number")
      )
    : [];
  if (embeddings.length !== texts.length) {
    throw new Error(
      `Self-hosted returned ${embeddings.length} embeddings for ${texts.length} inputs.`
    );
  }
  return embeddings;
}

async function createProviderEmbeddings(texts: string[]): Promise<number[][]> {
  if (embeddingProvider() === "self_hosted") {
    return createSelfHostedEmbeddings(texts);
  }
  return createVoyageEmbeddings(texts);
}

async function loadCorpusItems() {
  const supabase = createSupabaseAdminClient();
  const { data: items, error } = await supabase
    .from("debate_corpus_items")
    .select("id, content_hash, embedding_text")
    .in("review_status", ["candidate", "approved", "needs_review"])
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return {
    supabase,
    items: (items ?? []) as CorpusItemRow[],
  };
}

async function findMissingOrStale(items: CorpusItemRow[]) {
  const supabase = createSupabaseAdminClient();
  const embeddingsByItemId = new Map<string, ExistingEmbeddingRow>();
  const batchSize = 500;

  for (let index = 0; index < items.length; index += batchSize) {
    const ids = items.slice(index, index + batchSize).map((item) => item.id);
    const { data, error } = await supabase
      .from("debate_corpus_embeddings")
      .select("item_id, content_hash")
      .eq("provider", embeddingProvider())
      .eq("model", embeddingModel())
      .eq("dimensions", embeddingDimensions())
      .eq("input_type", "document")
      .in("item_id", ids);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as ExistingEmbeddingRow[]) {
      embeddingsByItemId.set(row.item_id, row);
    }
  }

  return items.filter((item) => {
    const existing = embeddingsByItemId.get(item.id);
    return !existing || existing.content_hash !== item.content_hash;
  });
}

async function embedCorpus(options: EmbedOptions) {
  loadEnvConfig(path.resolve(process.cwd(), "apps/web"));
  loadEnvConfig(process.cwd());
  const { supabase, items } = await loadCorpusItems();
  const effectiveDelayMs =
    options.delayMs ?? (embeddingProvider() === "voyage" ? 25000 : 0);
  let pending = await findMissingOrStale(items);
  if (options.limit != null) {
    pending = pending.slice(0, options.limit);
  }
  const estimatedTokens = pending.reduce(
    (sum, item) => sum + estimateDebateCorpusTokens(item.embedding_text),
    0
  );

  console.log(
    JSON.stringify(
      {
        mode: options.apply ? "apply" : "dry-run",
        provider: embeddingProvider(),
        model: embeddingModel(),
        dimensions: embeddingDimensions(),
        totalItems: items.length,
        missingOrStale: pending.length,
        estimatedTokens,
        batchSize: options.batchSize,
        delayMs: options.apply ? effectiveDelayMs : 0,
      },
      null,
      2
    )
  );

  if (!options.apply || pending.length === 0) {
    return;
  }

  for (let index = 0; index < pending.length; index += options.batchSize) {
    const batch = pending.slice(index, index + options.batchSize);
    const embeddings = await createProviderEmbeddings(
      batch.map((item) => item.embedding_text)
    );
    if (embeddings.length !== batch.length) {
      throw new Error(
        `${embeddingProvider()} returned ${embeddings.length} embeddings for ${batch.length} inputs.`
      );
    }

    const rows = batch.map((item, itemIndex) => {
      const embedding = embeddings[itemIndex];
      if (embedding.length !== embeddingDimensions()) {
        throw new Error(
          `Embedding dimension mismatch for ${item.id}: ${embedding.length}`
        );
      }
      return {
        item_id: item.id,
        provider: embeddingProvider(),
        model: embeddingModel(),
        dimensions: embeddingDimensions(),
        input_type: "document",
        content_hash: item.content_hash,
        embedding,
        token_count_estimate: estimateDebateCorpusTokens(item.embedding_text),
        embedded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { error } = await supabase
      .from("debate_corpus_embeddings")
      .upsert(rows, {
        onConflict: "item_id,provider,model,dimensions,input_type",
      });
    if (error) throw new Error(error.message);

    console.log(`Embedded ${Math.min(index + batch.length, pending.length)}/${pending.length}`);
    if (index + options.batchSize < pending.length && effectiveDelayMs > 0) {
      await sleep(effectiveDelayMs);
    }
  }
}

if (require.main === module) {
  embedCorpus(parseArgs(process.argv.slice(2))).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
