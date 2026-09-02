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
  authorityTier: string;
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
    /** Added in purpose-aware preflight; optional for older serialized admin fixtures. */
    gradingAndCoaching?: number;
    purposePolicyViolations?: number;
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

function purposes(item: KnowledgeReleaseItem) {
  return new Set(item.usableFor);
}

function hasOnlyPurposes(
  item: KnowledgeReleaseItem,
  expected: readonly string[],
) {
  const actual = purposes(item);
  return (
    actual.size === expected.length &&
    expected.every((value) => actual.has(value))
  );
}

function isPurposeEligible(params: {
  collection: string;
  item: KnowledgeReleaseItem;
  source: KnowledgeReleaseSource | undefined;
}) {
  const { collection, item, source } = params;
  const coachingOnly = hasOnlyPurposes(item, ["coaching"]);
  const gradingAndCoaching = hasOnlyPurposes(item, ["grading", "coaching"]);

  if (collection === "ielts.writing" || collection === "ielts.speaking") {
    if (
      item.itemKind === "practice_prompt" ||
      item.itemKind === "scored_example_locator_candidate"
    ) {
      return coachingOnly;
    }
    if (item.itemKind === "rubric_descriptor_candidate") {
      return gradingAndCoaching && source?.authorityTier === "official";
    }
    return false;
  }

  if (collection === "debate.en.competitive") {
    if (source?.authorityTier === "official") {
      return gradingAndCoaching && item.metadata.derivedOnly === true;
    }
    return (
      coachingOnly &&
      item.metadata.noTranscriptStored === true &&
      item.metadata.verified === true
    );
  }

  return false;
}

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
  const sourceById = new Map(
    params.sources.map((source) => [source.id, source]),
  );
  const embeddingKeys = new Set(
    params.embeddings.map(
      (embedding) =>
        `${embedding.itemId}:${embedding.provider}:${embedding.model}:${embedding.dimensions}:${embedding.inputType}:${embedding.contentHash}`,
    ),
  );
  const coachingOnly = params.items.filter((item) =>
    hasOnlyPurposes(item, ["coaching"]),
  ).length;
  const gradingAndCoaching = params.items.filter((item) =>
    hasOnlyPurposes(item, ["grading", "coaching"]),
  ).length;
  const purposePolicyViolations = params.items.filter(
    (item) =>
      !isPurposeEligible({
        collection: params.collection.slug,
        item,
        source: sourceById.get(item.sourceId),
      }),
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
  if (purposePolicyViolations > 0)
    blockers.push("contains_purpose_policy_violation");
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
      gradingAndCoaching,
      purposePolicyViolations,
      answerKeyFlags,
      approvedItems,
      approvedSources,
      currentEmbeddings,
    },
    blockers,
  };
}
