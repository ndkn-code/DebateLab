export interface KnowledgeReleaseCollection {
  slug: string;
  embeddingProvider: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

export interface KnowledgeReleaseItem {
  id: string;
  sourceId: string;
  itemKind: string;
  reviewStatus: string;
  usableFor: string[];
  contentHash: string;
  metadata: Record<string, unknown>;
  submittedBy: string | null;
  reviewedBy: string | null;
}

export interface KnowledgeReleaseSource {
  id: string;
  reviewStatus: string;
  rightsStatus: string;
  submittedBy: string | null;
  reviewedBy: string | null;
}

export interface KnowledgeReleaseEmbedding {
  itemId: string;
  provider: string;
  model: string;
  dimensions: number;
  inputType: string;
  contentHash: string;
}

export interface KnowledgeReleasePreflight {
  ready: boolean;
  collection: string;
  version: number;
  versionStatus: string | null;
  counts: {
    items: number;
    coachingOnly: number;
    answerKeyFlags: number;
    approvedItems: number;
    approvedSources: number;
    currentEmbeddings: number;
  };
  blockers: string[];
}

const CLEARED_RIGHTS = new Set([
  "approved_for_derived_use",
  "approved_for_excerpt",
  "public_domain",
]);

/**
 * Mirrors the database publication invariants while returning actionable,
 * learner-safe counts. It never returns prompts, source URLs, or embeddings.
 */
export function summarizeKnowledgeReleasePreflight(params: {
  collection: KnowledgeReleaseCollection;
  version: number;
  versionStatus: string | null;
  items: KnowledgeReleaseItem[];
  sources: KnowledgeReleaseSource[];
  embeddings: KnowledgeReleaseEmbedding[];
}): KnowledgeReleasePreflight {
  const sourceById = new Map(params.sources.map((source) => [source.id, source]));
  const embeddingKeys = new Set(
    params.embeddings.map(
      (embedding) =>
        `${embedding.itemId}:${embedding.provider}:${embedding.model}:${embedding.dimensions}:${embedding.inputType}:${embedding.contentHash}`,
    ),
  );
  const coachingOnly = params.items.filter(
    (item) =>
      item.itemKind === "practice_prompt" &&
      item.usableFor.length === 1 &&
      item.usableFor[0] === "coaching",
  ).length;
  const answerKeyFlags = params.items.filter(
    (item) => item.metadata.answerKeyAvailable === true,
  ).length;
  const approvedItems = params.items.filter(
    (item) =>
      item.reviewStatus === "approved" &&
      Boolean(item.reviewedBy) &&
      item.reviewedBy !== item.submittedBy,
  ).length;
  const approvedSourceIds = new Set(
    params.sources
      .filter(
        (source) =>
          source.reviewStatus === "approved" &&
          CLEARED_RIGHTS.has(source.rightsStatus) &&
          Boolean(source.reviewedBy) &&
          source.reviewedBy !== source.submittedBy,
      )
      .map((source) => source.id),
  );
  const approvedSources = params.items.filter((item) =>
    approvedSourceIds.has(item.sourceId),
  ).length;
  const currentEmbeddings = params.items.filter((item) =>
    embeddingKeys.has(
      `${item.id}:${params.collection.embeddingProvider}:${params.collection.embeddingModel}:${params.collection.embeddingDimensions}:document:${item.contentHash}`,
    ),
  ).length;

  const blockers: string[] = [];
  if (params.versionStatus !== "draft") blockers.push("version_not_draft");
  if (params.items.length === 0) blockers.push("empty_version");
  if (coachingOnly !== params.items.length)
    blockers.push("contains_non_coaching_material");
  if (answerKeyFlags > 0) blockers.push("contains_answer_key_material");
  if (approvedItems !== params.items.length)
    blockers.push("items_need_independent_review");
  if (approvedSources !== params.items.length)
    blockers.push("sources_need_rights_and_independent_review");
  if (currentEmbeddings !== params.items.length)
    blockers.push("missing_current_embeddings");
  if (params.items.some((item) => !sourceById.has(item.sourceId)))
    blockers.push("missing_source_records");

  return {
    ready: blockers.length === 0,
    collection: params.collection.slug,
    version: params.version,
    versionStatus: params.versionStatus,
    counts: {
      items: params.items.length,
      coachingOnly,
      answerKeyFlags,
      approvedItems,
      approvedSources,
      currentEmbeddings,
    },
    blockers,
  };
}
