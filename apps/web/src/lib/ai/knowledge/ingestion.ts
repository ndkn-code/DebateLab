import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createKnowledgeEmbeddings } from "./embeddings";
import {
  getKnowledgeCollectionConfig,
  isKnowledgeCollectionKey,
  type KnowledgeCollectionKey,
} from "./collections";

export const KNOWLEDGE_AUTHORITY_TIERS = [
  "official",
  "qualified_examiner_or_adjudicator",
  "expert_educational",
  "community",
  "ai_derived",
] as const;
export const KNOWLEDGE_RIGHTS_STATUSES = [
  "approved_for_derived_use",
  "approved_for_excerpt",
  "public_domain",
  "requires_review",
  "restricted",
  "unknown",
] as const;
export const KNOWLEDGE_REVIEW_STATUSES = [
  "candidate",
  "needs_review",
  "approved",
  "rejected",
] as const;

const SourceSchema = z.object({
  canonicalUrl: z.string().url(),
  publisher: z.string().trim().min(1).max(200),
  authorityTier: z.enum(KNOWLEDGE_AUTHORITY_TIERS),
  rightsStatus: z.enum(KNOWLEDGE_RIGHTS_STATUSES),
  checksum: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
  capturedAt: z.string().datetime().optional(),
  reviewStatus: z.enum(KNOWLEDGE_REVIEW_STATUSES).default("candidate"),
  title: z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const DebateInsightSchema = z.object({
  format: z.string().trim().max(100).optional(),
  motion: z.string().trim().max(500).optional(),
  side: z.string().trim().max(40).optional(),
  speakerRole: z.string().trim().max(100).optional(),
  argument: z.string().trim().max(5000).optional(),
  mechanism: z.string().trim().max(5000).optional(),
  rebuttalTarget: z.string().trim().max(5000).optional(),
  concession: z.string().trim().max(5000).optional(),
  weighing: z.string().trim().max(5000).optional(),
  clash: z.string().trim().max(5000).optional(),
  judgeReasoning: z.string().trim().max(5000).optional(),
  timestamp: z.string().trim().max(80).optional(),
  qualityNotes: z.array(z.string().trim().max(1000)).max(20).default([]),
});

const IeltsInsightSchema = z.object({
  skill: z.enum(["speaking", "writing"]),
  taskType: z.string().trim().max(120),
  criterion: z.string().trim().max(80),
  assignedBand: z.number().min(0).max(9).optional(),
  responseSegment: z.string().trim().max(5000).optional(),
  examinerRationale: z.string().trim().max(5000).optional(),
  positiveEvidence: z.array(z.string().trim().max(1000)).max(20).default([]),
  limitingEvidence: z.array(z.string().trim().max(1000)).max(20).default([]),
  adjacentBandDistinction: z.string().trim().max(5000).optional(),
  accent: z.string().trim().max(80).optional(),
  sourceAuthority: z.enum(KNOWLEDGE_AUTHORITY_TIERS),
});

export const KnowledgeItemSchema = z
  .object({
    collection: z
      .string()
      .refine(isKnowledgeCollectionKey, "unknown knowledge collection"),
    sourceId: z.string().uuid().optional(),
    itemType: z.string().trim().min(1).max(100),
    insight: z.record(z.string(), z.unknown()),
    criterion: z.string().trim().max(100).optional(),
    bandMin: z.number().min(0).max(9).optional(),
    bandMax: z.number().min(0).max(9).optional(),
    taskType: z.string().trim().max(120).optional(),
    sourceLocator: z.string().trim().max(500).optional(),
    permittedExcerpt: z.string().trim().max(1200).optional(),
    reviewStatus: z.enum(KNOWLEDGE_REVIEW_STATUSES).default("candidate"),
    usableFor: z
      .array(z.enum(["grading", "coaching", "opponent", "explanation"]))
      .min(1),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((item, ctx) => {
    if (
      item.bandMin !== undefined &&
      item.bandMax !== undefined &&
      item.bandMin > item.bandMax
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["bandMin"],
        message: "bandMin must not exceed bandMax",
      });
    }
  });

export type KnowledgeSourceInput = z.input<typeof SourceSchema>;
export type KnowledgeItemInput = z.input<typeof KnowledgeItemSchema>;
/** Human-friendly source reference accepted by JSON manifests. */
export type KnowledgeManifestItemInput = KnowledgeItemInput & {
  sourceCanonicalUrl?: string;
};
export type ValidatedKnowledgeSource = z.infer<typeof SourceSchema>;
export type ValidatedKnowledgeItem = z.infer<typeof KnowledgeItemSchema> & {
  embeddingText: string;
  contentHash: string;
};
type PreparedKnowledgeItem = Omit<ValidatedKnowledgeItem, "contentHash">;

export interface CanonicalKnowledgeItemIdentity {
  schema: "ai_knowledge_item_identity_v2";
  collection: KnowledgeCollectionKey;
  collectionVersion: number;
  sourceRevision:
    | { canonicalUrl: string; checksum: string }
    | { sourceId: string };
  itemType: string;
  criterion: string | null;
  bandMin: number | null;
  bandMax: number | null;
  taskType: string | null;
  sourceLocator: string | null;
  insight: Record<string, unknown>;
  permittedExcerpt: string | null;
}

export interface KnowledgeIngestionPlan {
  importKey: string;
  /** Explicit future collection version. Active versions are never mutable. */
  collectionVersion: number;
  sources: Array<
    ValidatedKnowledgeSource & {
      id: string;
      canonicalUrl: string;
      checksum: string;
    }
  >;
  items: Array<
    Omit<ValidatedKnowledgeItem, "sourceId"> & {
      id: string;
      sourceId: string | null;
    }
  >;
}

export function resolveKnowledgeSourceIds(
  plannedSources: KnowledgeIngestionPlan["sources"],
  persistedSources: Array<{
    id: string;
    canonical_url: string;
    checksum: string;
  }>,
) {
  const revisionKey = (canonicalUrl: string, checksum: string) =>
    `${canonicalUrl}\u0000${checksum}`;
  const actualIdByRevision = new Map(
    persistedSources.map((row) => [
      revisionKey(row.canonical_url, row.checksum),
      row.id,
    ]),
  );
  return new Map(
    plannedSources.map((source) => {
      const actualId = actualIdByRevision.get(
        revisionKey(source.canonicalUrl, source.checksum),
      );
      if (!actualId)
        throw new Error(
          `knowledge_source_id_unresolved:${source.canonicalUrl}`,
        );
      return [source.id, actualId];
    }),
  );
}

export function canonicalizeSourceUrl(value: string) {
  const url = new URL(value.trim());
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

function canonicalizeHashValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalizeHashValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nested]) => nested !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalizeHashValue(nested)]),
    );
  }
  return value;
}

function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeHashValue(value)))
    .digest("hex");
}

function deterministicUuid(value: unknown) {
  const hex = digest(value).slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8).join("")}-${hex.slice(8, 12).join("")}-${hex.slice(12, 16).join("")}-${hex.slice(16, 20).join("")}-${hex.slice(20).join("")}`;
}

function insightText(insight: Record<string, unknown>, excerpt?: string) {
  const values = Object.entries(insight).flatMap(([key, value]) => {
    if (Array.isArray(value))
      return value
        .filter((item) => typeof item === "string")
        .map((item) => `${key}: ${item}`);
    return typeof value === "string" ? [`${key}: ${value}`] : [];
  });
  return [values.join("\n"), excerpt ? `Permitted excerpt: ${excerpt}` : ""]
    .filter(Boolean)
    .join("\n")
    .slice(0, 12000);
}

function validateSource(input: KnowledgeSourceInput) {
  const parsed = SourceSchema.parse(input);
  const canonicalUrl = canonicalizeSourceUrl(parsed.canonicalUrl);
  const checksum =
    parsed.checksum ??
    digest({
      canonicalUrl,
      title: parsed.title ?? null,
      metadata: parsed.metadata,
    });
  return { ...parsed, canonicalUrl, checksum };
}

function validateItem(input: KnowledgeItemInput) {
  const parsed = KnowledgeItemSchema.parse(input);
  const insightSchema = parsed.collection.startsWith("ielts.")
    ? IeltsInsightSchema
    : DebateInsightSchema;
  const insightResult = insightSchema.safeParse(parsed.insight);
  if (!insightResult.success) {
    throw new Error(
      `knowledge_insight_schema_invalid:${insightResult.error.issues[0]?.path.join(".") ?? "unknown"}`,
    );
  }
  const embeddingText = insightText(parsed.insight, parsed.permittedExcerpt);
  if (!embeddingText) throw new Error("knowledge_item_empty_insight");
  return {
    ...parsed,
    embeddingText,
  } as PreparedKnowledgeItem;
}

function normalizeIdentityText(value: string | undefined) {
  const normalized = value?.normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized || null;
}

export function buildCanonicalKnowledgeItemIdentity(params: {
  item: PreparedKnowledgeItem;
  collectionVersion: number;
  source: { canonicalUrl: string; checksum: string } | { sourceId: string };
}): CanonicalKnowledgeItemIdentity {
  return {
    schema: "ai_knowledge_item_identity_v2",
    collection: params.item.collection,
    collectionVersion: params.collectionVersion,
    sourceRevision:
      "canonicalUrl" in params.source
        ? {
            canonicalUrl: canonicalizeSourceUrl(params.source.canonicalUrl),
            checksum: params.source.checksum.toLowerCase(),
          }
        : { sourceId: params.source.sourceId },
    itemType: params.item.itemType,
    criterion: normalizeIdentityText(params.item.criterion),
    bandMin: params.item.bandMin ?? null,
    bandMax: params.item.bandMax ?? null,
    taskType: normalizeIdentityText(params.item.taskType),
    sourceLocator: normalizeIdentityText(params.item.sourceLocator),
    insight: params.item.insight,
    permittedExcerpt: normalizeIdentityText(params.item.permittedExcerpt),
  };
}

export function assertUniqueKnowledgePlanItemIds(
  plan: Pick<KnowledgeIngestionPlan, "items">,
) {
  const counts = new Map<string, number>();
  for (const item of plan.items) {
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  }
  const duplicateGroups = [...counts.values()].filter((count) => count > 1);
  if (duplicateGroups.length > 0) {
    const duplicateRows = duplicateGroups.reduce(
      (total, count) => total + count,
      0,
    );
    throw new Error(
      `knowledge_plan_duplicate_item_ids:groups=${duplicateGroups.length}:rows=${duplicateRows}`,
    );
  }
}

export function buildKnowledgeIngestionPlan(input: {
  collection: KnowledgeCollectionKey;
  /** Must be greater than the currently published version when persisted. */
  collectionVersion: number;
  sources: KnowledgeSourceInput[];
  items: KnowledgeManifestItemInput[];
  importKey?: string;
}): KnowledgeIngestionPlan {
  if (
    !Number.isInteger(input.collectionVersion) ||
    input.collectionVersion < 1
  ) {
    throw new Error("knowledge_collection_version_invalid");
  }
  const sources = input.sources.map(validateSource);
  const byUrl = new Map<
    string,
    ValidatedKnowledgeSource & {
      id: string;
      canonicalUrl: string;
      checksum: string;
    }
  >();
  for (const source of sources) {
    const id = deterministicUuid({ canonicalUrl: source.canonicalUrl });
    byUrl.set(source.canonicalUrl, { ...source, id });
  }
  const knownIds = new Set([...byUrl.values()].map((source) => source.id));
  const items = input.items.map((rawItem) => {
    const item = validateItem(rawItem);
    if (item.collection !== input.collection)
      throw new Error(`knowledge_collection_mismatch:${item.collection}`);
    const referencedSource = rawItem.sourceCanonicalUrl
      ? byUrl.get(canonicalizeSourceUrl(rawItem.sourceCanonicalUrl))
      : undefined;
    if (rawItem.sourceCanonicalUrl && !referencedSource) {
      throw new Error(
        `knowledge_source_not_in_plan:${rawItem.sourceCanonicalUrl}`,
      );
    }
    const sourceId =
      item.sourceId ??
      referencedSource?.id ??
      (byUrl.size === 1 ? [...byUrl.values()][0]!.id : null);
    if (sourceId && !knownIds.has(sourceId)) {
      // Existing source UUIDs are valid; new planned sources use deterministic ids.
      if (![...byUrl.values()].some((source) => source.id === sourceId))
        throw new Error(`knowledge_source_not_in_plan:${sourceId}`);
    }
    if (item.reviewStatus === "approved" && !sourceId)
      throw new Error("knowledge_approved_item_requires_source");
    const linkedSource = [...byUrl.values()].find(
      (source) => source.id === sourceId,
    );
    const claimedAuthority = item.insight.sourceAuthority;
    if (
      typeof claimedAuthority === "string" &&
      linkedSource &&
      claimedAuthority !== linkedSource.authorityTier
    ) {
      throw new Error("knowledge_item_source_authority_mismatch");
    }
    const identity = buildCanonicalKnowledgeItemIdentity({
      item,
      collectionVersion: input.collectionVersion,
      source: linkedSource
        ? {
            canonicalUrl: linkedSource.canonicalUrl,
            checksum: linkedSource.checksum,
          }
        : { sourceId: sourceId ?? "missing" },
    });
    const contentHash = digest(identity);
    const id = deterministicUuid(identity);
    return { ...item, contentHash, id, sourceId };
  });
  assertUniqueKnowledgePlanItemIds({ items });
  const importKey =
    input.importKey ??
    digest({
      collection: input.collection,
      collectionVersion: input.collectionVersion,
      sources: [...byUrl.values()].map((source) => source.checksum).sort(),
      items: items.map((item) => item.contentHash).sort(),
    });
  return {
    importKey,
    collectionVersion: input.collectionVersion,
    sources: [...byUrl.values()],
    items,
  };
}

/**
 * Persists a validated plan. Upserts are deliberately keyed by deterministic ids
 * and content hashes, so retries never create duplicate source/item rows. The
 * generic migration owns the unique constraints and RLS; this function remains
 * usable before generated Supabase types are refreshed.
 */
export async function ingestKnowledgePlan(params: {
  supabase: SupabaseClient;
  plan: KnowledgeIngestionPlan;
  embed?: boolean;
  /** Limits provider request size for low-quota or large batch imports. */
  embeddingBatchSize?: number;
  /** Optional spacing between embedding batches to respect provider RPM. */
  embeddingBatchDelayMs?: number;
  /** Bounded retries for transient embedding-provider rate limits. */
  embeddingBatchRetryAttempts?: number;
  /** Delay before retrying a rate-limited embedding batch. */
  embeddingBatchRetryDelayMs?: number;
  /** Audit identity of the person/import process that created the draft. */
  submittedBy?: string | null;
  /** Optional independent reviewer for an already-reviewed manifest. */
  reviewedBy?: string | null;
}) {
  assertUniqueKnowledgePlanItemIds(params.plan);
  if (
    params.reviewedBy &&
    params.submittedBy &&
    params.reviewedBy === params.submittedBy
  ) {
    throw new Error("knowledge_importer_must_not_self_review");
  }
  const hasApprovedContent = [
    ...params.plan.sources,
    ...params.plan.items,
  ].some((record) => record.reviewStatus === "approved");
  if (hasApprovedContent && !params.reviewedBy) {
    throw new Error("knowledge_approved_manifest_requires_reviewer");
  }
  const client = params.supabase as SupabaseClient;
  const collectionKey = params.plan.items[0]?.collection;
  if (!collectionKey) throw new Error("knowledge_manifest_has_no_items");
  const draftResult = await client.rpc(
    "prepare_ai_knowledge_collection_draft",
    {
      p_collection_slug: collectionKey,
      p_version: params.plan.collectionVersion,
      p_import_key: params.plan.importKey,
      p_submitted_by: params.submittedBy ?? null,
    },
  );
  if (
    draftResult.error ||
    !Array.isArray(draftResult.data) ||
    !draftResult.data[0]
  ) {
    throw new Error(
      `knowledge_draft:${draftResult.error?.message ?? "not_created"}`,
    );
  }
  const draft = draftResult.data[0] as {
    collection_id: string;
    version: number;
    language: string;
  };
  const sourceRows = params.plan.sources.map((source) => ({
    canonical_url: source.canonicalUrl,
    publisher: source.publisher,
    authority_tier: source.authorityTier,
    rights_status: source.rightsStatus,
    checksum: source.checksum,
    captured_at: source.capturedAt ?? new Date().toISOString(),
    review_status: source.reviewStatus,
    submitted_by: params.submittedBy ?? null,
    reviewed_by:
      source.reviewStatus === "approved" ? (params.reviewedBy ?? null) : null,
    reviewed_at:
      source.reviewStatus === "approved" && params.reviewedBy
        ? new Date().toISOString()
        : null,
    title: source.title ?? null,
    metadata: source.metadata,
  }));
  // A source is shared across collection versions. Never upsert mutable rights,
  // authority, or review fields by canonical URL: doing so could change the
  // evidence used by the currently published corpus before this draft is
  // reviewed. Reuse existing sources unchanged and insert only missing URLs.
  const existingSources = await client
    .from("ai_knowledge_sources")
    .select("id, canonical_url, checksum")
    .in(
      "canonical_url",
      sourceRows.map((source) => source.canonical_url),
    );
  if (existingSources.error) {
    throw new Error(`knowledge_sources:${existingSources.error.message}`);
  }
  const existingRevisions = new Set(
    (existingSources.data ?? []).map(
      (source) => `${source.canonical_url}\u0000${source.checksum}`,
    ),
  );
  const missingSourceRows = sourceRows.filter(
    (source) =>
      !existingRevisions.has(`${source.canonical_url}\u0000${source.checksum}`),
  );
  const insertedSources =
    missingSourceRows.length > 0
      ? await client.from("ai_knowledge_sources").upsert(missingSourceRows, {
          onConflict: "canonical_url,checksum",
          ignoreDuplicates: true,
        })
      : { error: null };
  if (insertedSources.error) {
    throw new Error(`knowledge_sources:${insertedSources.error.message}`);
  }
  // Re-select after the insert so a concurrent importer that won the canonical
  // URL race is resolved to the same authoritative source id.
  const resolvedSources = await client
    .from("ai_knowledge_sources")
    .select("id, canonical_url, checksum")
    .in(
      "canonical_url",
      sourceRows.map((source) => source.canonical_url),
    );
  if (resolvedSources.error) {
    throw new Error(`knowledge_sources:${resolvedSources.error.message}`);
  }
  const plannedIdToActualId = resolveKnowledgeSourceIds(
    params.plan.sources,
    resolvedSources.data ?? [],
  );

  const embeddings: number[][] = [];
  if (params.embed && params.plan.items.length > 0) {
    const collection = params.plan.items[0]!.collection;
    const texts = params.plan.items.map((item) => item.embeddingText);
    const requestedBatchSize = params.embeddingBatchSize ?? texts.length;
    if (!Number.isInteger(requestedBatchSize) || requestedBatchSize < 1) {
      throw new Error("knowledge_embedding_batch_size_invalid");
    }
    const batchSize = Math.min(requestedBatchSize, texts.length);
    const batchDelayMs = Math.max(params.embeddingBatchDelayMs ?? 0, 0);
    const retryAttempts = Math.max(
      Math.min(params.embeddingBatchRetryAttempts ?? 0, 3),
      0,
    );
    const retryDelayMs = Math.max(
      params.embeddingBatchRetryDelayMs ?? 60_000,
      0,
    );
    for (let index = 0; index < texts.length; index += batchSize) {
      let retry = 0;
      let result: Awaited<ReturnType<typeof createKnowledgeEmbeddings>>;
      while (true) {
        try {
          result = await createKnowledgeEmbeddings({
            collection,
            texts: texts.slice(index, index + batchSize),
            inputType: "document",
          });
          break;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const rateLimited = /\b429\b|rate.?limit|too many requests/i.test(
            message,
          );
          if (!rateLimited || retry >= retryAttempts) throw error;
          retry += 1;
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
      embeddings.push(...result.embeddings);
      if (index + batchSize < texts.length && batchDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, batchDelayMs));
      }
    }
  }
  if (params.plan.items.some((item) => !item.sourceId))
    throw new Error("knowledge_item_missing_source");
  const language =
    draft.language === "multilingual" ? "multilingual" : draft.language;
  const itemRows = params.plan.items.map((item) => {
    const sourceId = item.sourceId
      ? plannedIdToActualId.get(item.sourceId)
      : undefined;
    if (!sourceId)
      throw new Error(
        `knowledge_source_id_unresolved:${item.sourceId ?? "missing"}`,
      );
    return {
      id: item.id,
      collection_id: draft.collection_id,
      source_id: sourceId,
      external_key: item.id,
      collection_version: draft.version,
      item_kind: item.itemType,
      language,
      structured_insight: item.insight,
      criterion: item.criterion ?? null,
      band_min: item.bandMin ?? null,
      band_max: item.bandMax ?? null,
      task_type: item.taskType ?? null,
      format:
        typeof item.insight.format === "string" ? item.insight.format : null,
      source_locator: item.sourceLocator ?? null,
      permitted_excerpt: item.permittedExcerpt ?? null,
      review_status: item.reviewStatus,
      submitted_by: params.submittedBy ?? null,
      reviewed_by:
        item.reviewStatus === "approved" ? (params.reviewedBy ?? null) : null,
      reviewed_at:
        item.reviewStatus === "approved" && params.reviewedBy
          ? new Date().toISOString()
          : null,
      usable_for: item.usableFor.map((purpose) =>
        purpose === "opponent" || purpose === "explanation"
          ? "coaching"
          : purpose,
      ),
      metadata: item.metadata,
      embedding_text: item.embeddingText,
      content_hash: item.contentHash,
    };
  });
  const itemResult =
    itemRows.length > 0
      ? await client
          .from("ai_knowledge_items")
          .upsert(itemRows, { onConflict: "id" })
      : { error: null };
  if (itemResult.error)
    throw new Error(`knowledge_items:${itemResult.error.message}`);
  if (embeddings.length > 0) {
    const embeddingConfig = getKnowledgeCollectionConfig(
      params.plan.items[0]!.collection,
    );
    const embeddingRows = itemRows.map((item, index) => ({
      item_id: item.id,
      collection_id: draft.collection_id,
      provider: embeddingConfig.provider,
      model: embeddingConfig.model,
      dimensions: embeddingConfig.dimensions,
      input_type: "document",
      content_hash: item.content_hash,
      embedding: embeddings[index],
    }));
    const embeddingResult = await client
      .from("ai_knowledge_embeddings")
      .upsert(embeddingRows, {
        onConflict: "item_id,provider,model,dimensions,input_type",
      });
    if (embeddingResult.error)
      throw new Error(`knowledge_embeddings:${embeddingResult.error.message}`);
  }
  return {
    importKey: params.plan.importKey,
    sourceCount: sourceRows.length,
    itemCount: itemRows.length,
    embeddedCount: embeddings.length,
  };
}

export { DebateInsightSchema, IeltsInsightSchema, SourceSchema };
