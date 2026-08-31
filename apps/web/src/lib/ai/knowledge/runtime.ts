import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  getKnowledgeCollectionConfig,
  type KnowledgeCollectionKey,
} from "./collections";
import { createKnowledgeEmbedding } from "./embeddings";
import type {
  KnowledgeEvidence,
  KnowledgePurpose,
  KnowledgeResult,
} from "./contracts";

export interface GenericKnowledgeSearchParams {
  collection: KnowledgeCollectionKey;
  query: string;
  purpose: KnowledgePurpose;
  language: "vi" | "en";
  sourceRoute: string;
  userId?: string | null;
  skill?: string;
  taskType?: string;
  criteria?: string[];
  targetBands?: number[];
  format?: string;
  motion?: string;
  side?: string;
  limit?: number;
  deadlineMs?: number;
  supabase?: SupabaseClient;
  /** Used by ingestion/benchmarks to pin a published corpus version. */
  corpusVersion?: string | null;
}

export interface GenericKnowledgeItem {
  itemId: string;
  sourceId: string | null;
  collection: KnowledgeCollectionKey;
  itemType: string;
  content: Record<string, unknown>;
  embeddingText: string;
  score: number;
  lexicalScore?: number;
  sourceLocator: string | null;
  authorityTier: string | null;
  rightsStatus: string | null;
  reviewStatus: string;
  usableFor: string[];
  corpusVersion: string | null;
  metadata: Record<string, unknown>;
}

const MAX_HIGHLIGHT = 700;
const DEFAULT_TIMEOUT = 12_000;

function compact(value: string, max = MAX_HIGHLIGHT) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > max
    ? `${normalized.slice(0, max - 1)}…`
    : normalized;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function withDeadline<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label}_deadline_exceeded`)),
        timeoutMs,
      );
    }),
  ]).finally(() => timer && clearTimeout(timer));
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(...values: unknown[]) {
  return (
    values.find(
      (value): value is string =>
        typeof value === "string" && value.trim() !== "",
    ) ?? null
  );
}

function numberValue(...values: unknown[]) {
  return (
    values.find(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    ) ?? 0
  );
}

function nullableNumberValue(...values: unknown[]) {
  return (
    values.find(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    ) ?? null
  );
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function normalizeRow(
  value: unknown,
  expectedCollection: KnowledgeCollectionKey,
): GenericKnowledgeItem | null {
  const row = record(value);
  const source = record(row.source);
  const itemId = stringValue(row.evidence_id, row.item_id, row.itemId, row.id);
  const collection = stringValue(
    row.collection_slug,
    row.collection_key,
    row.collection,
    row.collectionKey,
  );
  const structuredInsight = record(row.structured_insight ?? row.content);
  const embeddingText = stringValue(
    row.embedding_text,
    row.embeddingText,
    row.content_text,
    row.highlight,
    row.permitted_excerpt,
    Object.entries(structuredInsight)
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
      )
      .join("\n"),
  );
  // search_ai_knowledge_hybrid only returns approved records by contract.
  const reviewStatus =
    stringValue(row.review_status, row.reviewStatus) ?? "approved";
  if (
    !itemId ||
    !embeddingText ||
    (collection && collection !== expectedCollection)
  )
    return null;
  return {
    itemId,
    sourceId: stringValue(row.source_id, row.sourceId, source.id),
    collection: expectedCollection,
    itemType:
      stringValue(row.item_kind, row.item_type, row.itemType) ??
      "knowledge_item",
    content: structuredInsight,
    embeddingText,
    score: numberValue(row.relevance_score, row.similarity, row.score),
    lexicalScore: numberValue(row.lexical_score) || undefined,
    sourceLocator: stringValue(
      row.source_locator,
      row.sourceLocator,
      row.page_reference,
      row.timestamp,
      source.canonical_url,
    ),
    authorityTier: stringValue(
      row.authority_tier,
      row.authorityTier,
      source.authority_tier,
    ),
    rightsStatus:
      stringValue(row.rights_status, row.rightsStatus, source.rights_status) ??
      "approved_for_derived_use",
    reviewStatus,
    usableFor: stringArray(row.usable_for ?? row.usableFor),
    corpusVersion:
      typeof row.collection_version === "number"
        ? String(row.collection_version)
        : stringValue(
            row.collection_version,
            row.corpus_version,
            row.corpusVersion,
          ),
    metadata: {
      ...record(row.metadata),
      retrievalLimitations: row.retrieval_limitations,
      canonicalUrl: row.canonical_url,
      criterion: stringValue(row.criterion),
      bandMin: nullableNumberValue(row.band_min, row.bandMin),
      bandMax: nullableNumberValue(row.band_max, row.bandMax),
      taskType: stringValue(row.task_type, row.taskType),
      format: stringValue(row.format),
      source,
    },
  };
}

/** Exported for contract tests that pin the database RPC wire shape. */
export function normalizeGenericKnowledgeRow(
  value: unknown,
  expectedCollection: KnowledgeCollectionKey,
): GenericKnowledgeItem | null {
  return normalizeRow(value, expectedCollection);
}

function allowed(
  item: GenericKnowledgeItem,
  params: GenericKnowledgeSearchParams,
) {
  // Retrieval is defense in depth: the SQL function also enforces these gates.
  if (!item.collection.startsWith(params.collection)) return false;
  if (params.purpose === "grading" && item.reviewStatus !== "approved")
    return false;
  if (
    params.purpose === "grading" &&
    item.rightsStatus &&
    ["unknown", "restricted", "unlicensed"].includes(item.rightsStatus)
  )
    return false;
  if (
    params.purpose === "grading" &&
    item.authorityTier &&
    ![
      "official",
      "qualified_examiner_or_adjudicator",
      "qualified_adjudicator",
    ].includes(item.authorityTier)
  )
    return false;
  if (item.usableFor.length > 0 && !item.usableFor.includes(params.purpose))
    return false;
  return true;
}

export function buildGenericKnowledgeRpcArgs(
  params: GenericKnowledgeSearchParams,
  embedding?: number[],
) {
  const config = getKnowledgeCollectionConfig(params.collection);
  const filters: Record<string, unknown> = {
    forGrading: params.purpose === "grading",
    usage: params.purpose === "opponent" ? "coaching" : params.purpose,
    language: params.language,
    taskType: params.taskType ?? "",
    format: params.format ?? "",
    minBand: params.targetBands?.length ? Math.min(...params.targetBands) : "",
    maxBand: params.targetBands?.length ? Math.max(...params.targetBands) : "",
    // The database defaults to the active version when absent. Supplying this
    // value pins a grading/benchmark replay to one immutable publication.
    collectionVersion: params.corpusVersion ?? "",
  };
  if (params.criteria?.length === 1) filters.criterion = params.criteria[0];
  return {
    p_query_embedding: embedding ?? null,
    p_query_text: params.query,
    p_collection_slug: params.collection,
    p_provider: config.provider,
    p_model: config.model,
    p_match_count: Math.min(Math.max(params.limit ?? 8, 1), 24),
    p_filters: filters,
  };
}

function rrf(items: GenericKnowledgeItem[], weight = 1) {
  return items.map((item, index) => ({
    item,
    rankScore: weight / (60 + index + 1),
  }));
}

function fuse(
  semantic: GenericKnowledgeItem[],
  lexical: GenericKnowledgeItem[],
  limit: number,
) {
  const byId = new Map<string, GenericKnowledgeItem>();
  const scores = new Map<string, number>();
  for (const ranked of [...rrf(semantic), ...rrf(lexical)]) {
    byId.set(ranked.item.itemId, ranked.item);
    scores.set(
      ranked.item.itemId,
      (scores.get(ranked.item.itemId) ?? 0) + ranked.rankScore,
    );
  }
  return [...byId.values()]
    .sort((a, b) => (scores.get(b.itemId) ?? 0) - (scores.get(a.itemId) ?? 0))
    .slice(0, limit)
    .map((item) => ({ ...item, score: scores.get(item.itemId) ?? item.score }));
}

function evidence(items: GenericKnowledgeItem[]): KnowledgeEvidence[] {
  return items.map((item) => ({
    sourceId: item.itemId,
    version: item.corpusVersion ?? "unversioned",
    itemType: item.itemType,
    highlight: compact(item.embeddingText),
    score: item.score,
    reviewStatus: item.reviewStatus,
    sourceLocator: item.sourceLocator,
    authorityTier: item.authorityTier,
    rightsStatus: item.rightsStatus,
    usableFor: item.usableFor,
    metadata: item.metadata,
  }));
}

async function rpcRows(
  client: SupabaseClient,
  name: string,
  args: Record<string, unknown>,
) {
  const result = await (client as SupabaseClient).rpc(name, args);
  if (result.error) throw new Error(`${name}:${result.error.message}`);
  return Array.isArray(result.data) ? result.data : [];
}

const QUERY_EMBEDDING_CACHE_TTL_MS = 5_000;
const QUERY_EMBEDDING_CACHE_LIMIT = 128;
const queryEmbeddingPromises = new Map<
  string,
  {
    expiresAt: number;
    promise: ReturnType<typeof createKnowledgeEmbedding>;
  }
>();

async function hasApprovedActiveKnowledge(
  client: SupabaseClient,
  collectionSlug: KnowledgeCollectionKey,
) {
  const collection = await client
    .from("ai_knowledge_collections")
    .select("id, active_version")
    .eq("slug", collectionSlug)
    .eq("is_active", true)
    .maybeSingle();
  if (collection.error) {
    throw new Error(`knowledge_collection_state:${collection.error.message}`);
  }
  if (!collection.data?.id) return false;
  const items = await client
    .from("ai_knowledge_items")
    .select("id", { count: "exact", head: true })
    .eq("collection_id", collection.data.id)
    .eq("collection_version", collection.data.active_version)
    .eq("review_status", "approved")
    .limit(1);
  if (items.error) {
    throw new Error(`knowledge_collection_items:${items.error.message}`);
  }
  return (items.count ?? 0) > 0;
}

function cachedQueryEmbedding(params: {
  collection: KnowledgeCollectionKey;
  query: string;
  timeoutMs: number;
}) {
  const now = Date.now();
  const cacheKey = hash({
    collection: params.collection,
    query: params.query,
  });
  const cached = queryEmbeddingPromises.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.promise;
  if (queryEmbeddingPromises.size >= QUERY_EMBEDDING_CACHE_LIMIT) {
    for (const [key, value] of queryEmbeddingPromises) {
      if (value.expiresAt <= now) queryEmbeddingPromises.delete(key);
    }
    if (queryEmbeddingPromises.size >= QUERY_EMBEDDING_CACHE_LIMIT) {
      queryEmbeddingPromises.clear();
    }
  }
  const promise = createKnowledgeEmbedding({
    collection: params.collection,
    text: params.query,
    inputType: "query",
    timeoutMs: params.timeoutMs,
  });
  queryEmbeddingPromises.set(cacheKey, {
    expiresAt: now + QUERY_EMBEDDING_CACHE_TTL_MS,
    promise,
  });
  void promise.catch(() => queryEmbeddingPromises.delete(cacheKey));
  return promise;
}

async function logRetrieval(
  client: SupabaseClient,
  params: GenericKnowledgeSearchParams,
  items: GenericKnowledgeItem[],
  latencyMs: number,
) {
  try {
    const typed = client as SupabaseClient;
    const { data: collection } = await typed
      .from("ai_knowledge_collections")
      .select("id")
      .eq("slug", params.collection)
      .maybeSingle();
    if (!collection?.id) return null;
    const { data } = await typed
      .from("ai_knowledge_retrieval_logs")
      .insert({
        collection_id: collection.id,
        user_id: params.userId ?? null,
        source_route: params.sourceRoute,
        query_hash: hash(params.query),
        query_preview: compact(params.query, 500),
        provider: getKnowledgeCollectionConfig(params.collection).provider,
        model: getKnowledgeCollectionConfig(params.collection).model,
        dimensions: 1024,
        filters: {
          purpose: params.purpose,
          language: params.language,
          skill: params.skill ?? null,
          taskType: params.taskType ?? null,
          criteria: params.criteria ?? [],
        },
        returned_evidence: items.map((item) => ({
          evidenceId: item.itemId,
          score: item.score,
          sourceLocator: item.sourceLocator,
        })),
        relevance_measurements: {
          topScore: items[0]?.score ?? null,
          count: items.length,
        },
        latency_ms: latencyMs,
      })
      .select("id")
      .maybeSingle();
    return data?.id ?? null;
  } catch {
    // Observability must never block a learner-facing response.
    return null;
  }
}

export async function searchGenericKnowledge(
  params: GenericKnowledgeSearchParams,
): Promise<
  KnowledgeResult<{
    items: GenericKnowledgeItem[];
    collectionVersion: string | null;
  }>
> {
  const startedAt = Date.now();
  const client = params.supabase ?? tryCreateAdminClient();
  if (!client)
    return {
      collection: "knowledge",
      context: "",
      evidence: [],
      data: { items: [], collectionVersion: null },
      cacheKey: null,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      skippedReason: "missing_supabase_service_role",
    };
  const config = getKnowledgeCollectionConfig(params.collection);
  const cacheKey = hash({ ...params, supabase: undefined, config });
  try {
    // Avoid spending an embedding request when a collection has no published,
    // approved evidence yet. This is especially important during rollout and
    // keeps the bundled rubric fallback fast and quota-independent.
    if (!(await hasApprovedActiveKnowledge(client, params.collection))) {
      return {
        collection: "knowledge",
        context: "",
        evidence: [],
        data: { items: [], collectionVersion: null },
        cacheKey,
        cacheHit: false,
        latencyMs: Date.now() - startedAt,
        skippedReason: "no_approved_knowledge",
      };
    }
    const embedding = await withDeadline(
      cachedQueryEmbedding({
        collection: params.collection,
        query: params.query,
        timeoutMs: params.deadlineMs ?? DEFAULT_TIMEOUT,
      }),
      params.deadlineMs ?? DEFAULT_TIMEOUT,
      "knowledge_embedding",
    );
    const criteria =
      params.criteria && params.criteria.length > 1
        ? params.criteria
        : [undefined];
    const rows = (
      await withDeadline(
        Promise.all(
          criteria.map((criterion) =>
            rpcRows(
              client,
              "search_ai_knowledge_hybrid",
              buildGenericKnowledgeRpcArgs(
                { ...params, criteria: criterion ? [criterion] : undefined },
                embedding.embedding,
              ),
            ),
          ),
        ),
        params.deadlineMs ?? DEFAULT_TIMEOUT,
        "knowledge_hybrid_retrieval",
      )
    ).flat();
    const semantic = rows
      .map((row) => normalizeRow(row, params.collection))
      .filter((row): row is GenericKnowledgeItem =>
        Boolean(row && allowed(row, params)),
      );
    const items = fuse(semantic, [], params.limit ?? 8);
    const version =
      items.find((item) => item.corpusVersion)?.corpusVersion ??
      params.corpusVersion ??
      null;
    await logRetrieval(client, params, items, Date.now() - startedAt);
    return {
      collection: "knowledge",
      context: items
        .map((item) => `[${item.itemId}] ${compact(item.embeddingText)}`)
        .join("\n\n"),
      evidence: evidence(items),
      data: { items, collectionVersion: version },
      cacheKey,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      skippedReason: items.length === 0 ? "no_approved_knowledge" : undefined,
    };
  } catch (error) {
    return {
      collection: "knowledge",
      context: "",
      evidence: [],
      data: { items: [], collectionVersion: null },
      cacheKey,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
      skippedReason:
        error instanceof Error
          ? `generic_retrieval_failed:${error.message}`
          : "generic_retrieval_failed",
    };
  }
}
