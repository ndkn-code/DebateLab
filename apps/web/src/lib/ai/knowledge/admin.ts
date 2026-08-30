import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  KNOWLEDGE_AUTHORITY_TIERS,
  KNOWLEDGE_REVIEW_STATUSES,
  KNOWLEDGE_RIGHTS_STATUSES,
} from "./ingestion";
import {
  isKnowledgeCollectionKey,
  type KnowledgeCollectionKey,
} from "./collections";

type AdminClient = SupabaseClient;
type ReviewStatus = (typeof KNOWLEDGE_REVIEW_STATUSES)[number];

const REVIEWABLE_STATUSES = new Set<ReviewStatus>([
  "candidate",
  "needs_review",
  "approved",
  "rejected",
]);

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
  return {
    collection,
    versions: versionsResult.data ?? [],
    items: itemsResult.data ?? [],
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
