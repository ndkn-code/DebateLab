import type { KnowledgeReleasePreflight } from "@/lib/ai/knowledge/release-preflight";

export const IELTS_KNOWLEDGE_RELEASE_VERSION = 2;
export const IELTS_KNOWLEDGE_COLLECTIONS = [
  "ielts.writing",
  "ielts.speaking",
] as const;

export type IeltsKnowledgeCollection =
  (typeof IELTS_KNOWLEDGE_COLLECTIONS)[number];
export type IeltsKnowledgeRow = Record<string, unknown>;

export interface IeltsKnowledgeReleasePayload {
  collection: IeltsKnowledgeRow;
  versions: IeltsKnowledgeRow[];
  items: IeltsKnowledgeRow[];
  preflight?: KnowledgeReleasePreflight | null;
}

export interface IeltsKnowledgeReleaseSource {
  id: string;
  row: IeltsKnowledgeRow;
  itemCount: number;
  approved: boolean;
}

export interface IeltsKnowledgeReleaseModel {
  collection: IeltsKnowledgeCollection;
  version: number;
  versionStatus: string | null;
  items: IeltsKnowledgeRow[];
  sources: IeltsKnowledgeReleaseSource[];
  counts: {
    items: number;
    coachingOnly: number;
    answerKeyFlags: number | null;
    approvedItems: number;
    approvedSources: number;
    currentEmbeddings: number | null;
  };
  blockers: string[];
  preflightAvailable: boolean;
  sourcesComplete: boolean;
  itemsComplete: boolean;
  canPublish: boolean;
}

const CLEARED_RIGHTS = new Set([
  "approved_for_derived_use",
  "approved_for_excerpt",
  "public_domain",
]);

function asRecord(value: unknown): IeltsKnowledgeRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as IeltsKnowledgeRow)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function sourceFor(item: IeltsKnowledgeRow) {
  const relation = item.ai_knowledge_sources;
  return asRecord(Array.isArray(relation) ? relation[0] : relation);
}

function independentlyApproved(row: IeltsKnowledgeRow) {
  const submittedBy = text(row.submitted_by);
  const reviewedBy = text(row.reviewed_by);
  return (
    row.review_status === "approved" &&
    reviewedBy !== null &&
    reviewedBy !== submittedBy
  );
}

function sourceApproved(row: IeltsKnowledgeRow) {
  return (
    independentlyApproved(row) &&
    CLEARED_RIGHTS.has(text(row.rights_status) ?? "")
  );
}

function isCoachingOnly(item: IeltsKnowledgeRow) {
  const usableFor = strings(item.usable_for);
  return (
    item.item_kind === "practice_prompt" &&
    usableFor.length === 1 &&
    usableFor[0] === "coaching"
  );
}

function isSafePreflight(
  value: KnowledgeReleasePreflight | null | undefined,
  collection: IeltsKnowledgeCollection,
  version: number,
): value is KnowledgeReleasePreflight {
  if (
    !value ||
    value.collection !== collection ||
    value.version !== version ||
    typeof value.ready !== "boolean" ||
    !Array.isArray(value.blockers) ||
    !value.blockers.every((blocker) => typeof blocker === "string")
  ) {
    return false;
  }
  const counts = value.counts;
  return (
    counts !== null &&
    typeof counts === "object" &&
    [
      counts.items,
      counts.coachingOnly,
      counts.answerKeyFlags,
      counts.approvedItems,
      counts.approvedSources,
      counts.currentEmbeddings,
    ].every((count) => Number.isInteger(count) && count >= 0)
  );
}

export function isIeltsKnowledgeCollection(
  value: string,
): value is IeltsKnowledgeCollection {
  return IELTS_KNOWLEDGE_COLLECTIONS.includes(
    value as IeltsKnowledgeCollection,
  );
}

/**
 * Builds the browser-safe review model from the existing admin read payload.
 * Hidden embedding and answer-key checks are accepted only from the sanitized
 * server preflight; the UI fails closed when that projection is unavailable.
 */
export function getIeltsKnowledgeReleaseModel(params: {
  collection: IeltsKnowledgeCollection;
  payload: IeltsKnowledgeReleasePayload;
  version?: number;
}): IeltsKnowledgeReleaseModel {
  const version = params.version ?? IELTS_KNOWLEDGE_RELEASE_VERSION;
  const items = params.payload.items.filter(
    (item) => item.collection_version === version,
  );
  const versionRow = params.payload.versions.find(
    (row) => row.version === version,
  );
  const versionStatus = text(versionRow?.status);

  const sourceMap = new Map<
    string,
    { row: IeltsKnowledgeRow; itemCount: number }
  >();
  for (const item of items) {
    const sourceId = text(item.source_id);
    if (!sourceId) continue;
    const current = sourceMap.get(sourceId);
    sourceMap.set(sourceId, {
      row: sourceFor(item),
      itemCount: (current?.itemCount ?? 0) + 1,
    });
  }
  const sources = [...sourceMap.entries()]
    .map(
      ([id, value]): IeltsKnowledgeReleaseSource => ({
        id,
        row: value.row,
        itemCount: value.itemCount,
        approved: sourceApproved(value.row),
      }),
    )
    .sort((left, right) => {
      const leftLabel =
        text(left.row.title) ?? text(left.row.publisher) ?? left.id;
      const rightLabel =
        text(right.row.title) ?? text(right.row.publisher) ?? right.id;
      return leftLabel.localeCompare(rightLabel);
    });

  const coachingOnly = items.filter(isCoachingOnly).length;
  const approvedItems = items.filter(independentlyApproved).length;
  const approvedSourceItems = items.filter((item) =>
    sourceApproved(sourceFor(item)),
  ).length;
  const preflight = isSafePreflight(
    params.payload.preflight,
    params.collection,
    version,
  )
    ? params.payload.preflight
    : null;

  const derivedBlockers: string[] = [];
  if (versionStatus !== "draft") derivedBlockers.push("version_not_draft");
  if (items.length === 0) derivedBlockers.push("empty_version");
  if (coachingOnly !== items.length)
    derivedBlockers.push("contains_non_coaching_material");
  if (approvedItems !== items.length)
    derivedBlockers.push("items_need_independent_review");
  if (approvedSourceItems !== items.length)
    derivedBlockers.push("sources_need_rights_and_independent_review");
  if (items.some((item) => !text(item.source_id)))
    derivedBlockers.push("missing_source_records");
  if (!preflight) derivedBlockers.push("safe_preflight_unavailable");

  const blockers = [...(preflight?.blockers ?? []), ...derivedBlockers].filter(
    (blocker, index, all) => all.indexOf(blocker) === index,
  );

  return {
    collection: params.collection,
    version,
    versionStatus,
    items,
    sources,
    counts: {
      items: preflight?.counts.items ?? items.length,
      coachingOnly: preflight?.counts.coachingOnly ?? coachingOnly,
      answerKeyFlags: preflight?.counts.answerKeyFlags ?? null,
      approvedItems: preflight?.counts.approvedItems ?? approvedItems,
      approvedSources: preflight?.counts.approvedSources ?? approvedSourceItems,
      currentEmbeddings: preflight?.counts.currentEmbeddings ?? null,
    },
    blockers,
    preflightAvailable: preflight !== null,
    sourcesComplete: items.length > 0 && approvedSourceItems === items.length,
    itemsComplete: items.length > 0 && approvedItems === items.length,
    canPublish: preflight?.ready === true && blockers.length === 0,
  };
}
