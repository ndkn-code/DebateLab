import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  KNOWLEDGE_AUTHORITY_TIERS,
  KNOWLEDGE_REVIEW_STATUSES,
  KNOWLEDGE_RIGHTS_STATUSES,
} from "./ingestion";
import {
  isKnowledgeCollectionKey,
  type KnowledgeCollectionKey,
} from "./collections";
import {
  summarizeKnowledgeReleasePreflight,
  type KnowledgeReleaseEmbedding,
  type KnowledgeReleaseItem,
  type KnowledgeReleasePreflight,
  type KnowledgeReleaseSource,
} from "./release-preflight";

type AdminClient = SupabaseClient;
type ReviewStatus = (typeof KNOWLEDGE_REVIEW_STATUSES)[number];
export type KnowledgeVersionStatusRow = Pick<
  Database["public"]["Tables"]["ai_knowledge_collection_versions"]["Row"],
  "version" | "status"
>;

const REVIEWABLE_STATUSES = new Set<ReviewStatus>([
  "candidate",
  "needs_review",
  "approved",
  "rejected",
]);

const SAFE_RELEASE_COLLECTIONS = new Set([
  "ielts.writing",
  "ielts.speaking",
  "debate.en.competitive",
]);

/** Prefer the latest draft under review; otherwise inspect the active release. */
export function resolveKnowledgePreflightVersion(params: {
  activeVersion: number;
  versions: readonly KnowledgeVersionStatusRow[];
}): KnowledgeVersionStatusRow | null {
  const drafts = params.versions
    .filter((row) => row.status === "draft")
    .sort((a, b) => b.version - a.version);
  if (drafts[0]) return drafts[0];
  return (
    params.versions.find((row) => row.version === params.activeVersion) ?? null
  );
}

function assertCollection(
  value: string,
): asserts value is KnowledgeCollectionKey {
  if (!isKnowledgeCollectionKey(value)) {
    throw new Error("unknown_ai_knowledge_collection");
  }
}

function assertReviewStatus(value: string): asserts value is ReviewStatus {
  if (!REVIEWABLE_STATUSES.has(value as ReviewStatus)) {
    throw new Error("invalid_ai_knowledge_review_status");
  }
}

async function loadKnowledgeReleasePreflight(params: {
  client: AdminClient;
  collection: {
    id: string;
    slug: string;
    embedding_provider: string;
    embedding_model: string;
    embedding_dimensions: number;
    active_version: number;
  };
  versions: readonly KnowledgeVersionStatusRow[];
}): Promise<KnowledgeReleasePreflight | null> {
  if (!SAFE_RELEASE_COLLECTIONS.has(params.collection.slug)) return null;
  const target = resolveKnowledgePreflightVersion({
    activeVersion: params.collection.active_version,
    versions: params.versions,
  });
  if (!target) return null;

  const itemResult = await params.client
    .from("ai_knowledge_items")
    .select(
      "id,source_id,item_kind,review_status,usable_for,content_hash,metadata,submitted_by,reviewed_by",
    )
    .eq("collection_id", params.collection.id)
    .eq("collection_version", target.version);
  if (itemResult.error) {
    throw new Error(`knowledge_item_lookup:${itemResult.error.message}`);
  }

  const itemRows = itemResult.data ?? [];
  const itemIds = itemRows.map((row) => row.id);
  const sourceIds = [...new Set(itemRows.map((row) => row.source_id))];
  const [sourceResult, embeddingResult] = await Promise.all([
    sourceIds.length
      ? params.client
          .from("ai_knowledge_sources")
          .select(
            "id,authority_tier,review_status,rights_status,submitted_by,reviewed_by",
          )
          .in("id", sourceIds)
      : Promise.resolve({ data: [], error: null }),
    itemIds.length
      ? params.client
          .from("ai_knowledge_embeddings")
          .select("item_id,provider,model,dimensions,input_type,content_hash")
          .in("item_id", itemIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sourceResult.error) {
    throw new Error(`knowledge_source_lookup:${sourceResult.error.message}`);
  }
  if (embeddingResult.error) {
    throw new Error(
      `knowledge_embedding_lookup:${embeddingResult.error.message}`,
    );
  }

  return summarizeKnowledgeReleasePreflight({
    collection: {
      slug: params.collection.slug,
      embeddingProvider: params.collection.embedding_provider,
      embeddingModel: params.collection.embedding_model,
      embeddingDimensions: params.collection.embedding_dimensions,
    },
    version: target.version,
    versionStatus: target.status,
    items: itemRows.map(
      (row): KnowledgeReleaseItem => ({
        id: row.id,
        sourceId: row.source_id,
        itemKind: row.item_kind,
        reviewStatus: row.review_status,
        usableFor: row.usable_for,
        contentHash: row.content_hash,
        metadata:
          row.metadata && typeof row.metadata === "object"
            ? (row.metadata as Record<string, unknown>)
            : {},
        submittedBy: row.submitted_by,
        reviewedBy: row.reviewed_by,
      }),
    ),
    sources: (sourceResult.data ?? []).map(
      (row): KnowledgeReleaseSource => ({
        id: row.id,
        authorityTier: row.authority_tier,
        reviewStatus: row.review_status,
        rightsStatus: row.rights_status,
        submittedBy: row.submitted_by,
        reviewedBy: row.reviewed_by,
      }),
    ),
    embeddings: (embeddingResult.data ?? []).map(
      (row): KnowledgeReleaseEmbedding => ({
        itemId: row.item_id,
        provider: row.provider,
        model: row.model,
        dimensions: row.dimensions,
        inputType: row.input_type,
        contentHash: row.content_hash,
      }),
    ),
  });
}

/**
 * Safe admin read model. It deliberately excludes benchmark labels and raw
 * embedding vectors; reviewers only receive the fields needed for provenance,
 * rights and approval decisions.
 */
export async function listAiKnowledgeForAdmin(params: {
  supabase: SupabaseClient;
  collection: string;
  reviewStatus?: string | null;
  limit?: number;
}) {
  assertCollection(params.collection);
  const client = params.supabase as AdminClient;
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 250);
  const { data: collection, error: collectionError } = await client
    .from("ai_knowledge_collections")
    .select(
      "id, slug, domain, language, embedding_provider, embedding_model, embedding_dimensions, active_version, retrieval_thresholds, is_active, updated_at",
    )
    .eq("slug", params.collection)
    .single();
  if (collectionError || !collection) {
    throw new Error(
      `ai_knowledge_collection:${collectionError?.message ?? "not_found"}`,
    );
  }

  let itemsQuery = client
    .from("ai_knowledge_items")
    .select(
      "id, source_id, collection_version, item_kind, language, criterion, band_min, band_max, task_type, format, source_locator, permitted_excerpt, structured_insight, usable_for, review_status, submitted_by, reviewed_by, reviewed_at, created_at, updated_at, ai_knowledge_sources(canonical_url, publisher, title, authority_tier, rights_status, review_status, submitted_by, reviewed_by, reviewed_at)",
    )
    .eq("collection_id", collection.id)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (params.reviewStatus && params.reviewStatus !== "all") {
    assertReviewStatus(params.reviewStatus);
    itemsQuery = itemsQuery.eq("review_status", params.reviewStatus);
  }
  const [itemsResult, versionsResult] = await Promise.all([
    itemsQuery,
    client
      .from("ai_knowledge_collection_versions")
      .select(
        "version, status, import_key, submitted_by, submitted_at, reviewed_by, reviewed_at, published_by, published_at, review_notes, updated_at",
      )
      .eq("collection_id", collection.id)
      .order("version", { ascending: false })
      .limit(50),
  ]);
  if (itemsResult.error || versionsResult.error) {
    throw new Error(
      `ai_knowledge_list:${itemsResult.error?.message ?? versionsResult.error?.message ?? "unknown"}`,
    );
  }
  let preflight: KnowledgeReleasePreflight | null = null;
  try {
    preflight = await loadKnowledgeReleasePreflight({
      client,
      collection,
      versions: (versionsResult.data ?? []).map((row) => ({
        version: row.version,
        status: row.status,
      })),
    });
  } catch (error) {
    // Review remains available if the hidden safety projection cannot be
    // computed, but the browser contract fails closed and disables publish.
    console.error(
      "[ai-knowledge] unable to compute IELTS release preflight",
      error,
    );
  }
  return {
    collection,
    versions: versionsResult.data ?? [],
    items: itemsResult.data ?? [],
    preflight,
  };
}

/** Reviews one candidate source or item and records the independent reviewer. */
export async function reviewAiKnowledgeRecord(params: {
  supabase: SupabaseClient;
  kind: "source" | "item";
  id: string;
  reviewStatus: string;
  reviewerId: string;
  reviewNotes?: string | null;
  authorityTier?: (typeof KNOWLEDGE_AUTHORITY_TIERS)[number];
  rightsStatus?: (typeof KNOWLEDGE_RIGHTS_STATUSES)[number];
}) {
  assertReviewStatus(params.reviewStatus);
  const client = params.supabase as AdminClient;
  const table =
    params.kind === "source" ? "ai_knowledge_sources" : "ai_knowledge_items";
  const { data: existing, error: existingError } = await client
    .from(table)
    .select("id, submitted_by, review_status, authority_tier, rights_status")
    .eq("id", params.id)
    .maybeSingle();
  if (existingError || !existing) {
    throw new Error(
      `ai_knowledge_review_target:${existingError?.message ?? "not_found"}`,
    );
  }
  if (existing.submitted_by && existing.submitted_by === params.reviewerId) {
    throw new Error("ai_knowledge_importer_must_not_self_review");
  }
  const patch: Record<string, unknown> = {
    review_status: params.reviewStatus,
    reviewed_by: params.reviewerId,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (params.kind === "source") {
    if (params.authorityTier) patch.authority_tier = params.authorityTier;
    if (params.rightsStatus) patch.rights_status = params.rightsStatus;
    const effectiveRights = params.rightsStatus ?? existing.rights_status;
    if (
      params.reviewStatus === "approved" &&
      ![
        "approved_for_derived_use",
        "approved_for_excerpt",
        "public_domain",
      ].includes(effectiveRights)
    ) {
      throw new Error("ai_knowledge_approved_source_requires_cleared_rights");
    }
  }
  if (params.kind === "source" && params.reviewNotes !== undefined) {
    patch.review_notes = params.reviewNotes || null;
  }
  const { data, error } = await client
    .from(table)
    .update(patch)
    .eq("id", params.id)
    .select(
      "id, review_status, submitted_by, reviewed_by, reviewed_at, updated_at",
    )
    .single();
  if (error) throw new Error(`ai_knowledge_review:${error.message}`);
  return data;
}

/** Calls the database transaction that validates and atomically publishes a draft. */
export async function publishAiKnowledgeVersion(params: {
  supabase: SupabaseClient;
  collection: string;
  version: number;
  reviewerId: string;
  reviewNotes?: string | null;
}) {
  assertCollection(params.collection);
  if (!Number.isInteger(params.version) || params.version < 1) {
    throw new Error("invalid_ai_knowledge_collection_version");
  }
  const client = params.supabase as AdminClient;
  const { data, error } = await client.rpc(
    "publish_ai_knowledge_collection_version",
    {
      p_collection_slug: params.collection,
      p_version: params.version,
      p_reviewer_id: params.reviewerId,
      p_review_notes: params.reviewNotes ?? null,
    },
  );
  if (error) throw new Error(`ai_knowledge_publish:${error.message}`);
  return Array.isArray(data) ? (data[0] ?? null) : data;
}
