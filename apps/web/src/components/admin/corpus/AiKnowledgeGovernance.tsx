"use client";

import { useLocale } from "next-intl";
import type { ReactNode } from "react";
import {
  BadgeCheck,
  BookOpenCheck,
  CircleAlert,
  Globe2,
  ShieldCheck,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";

export type AiKnowledgeRow = Record<string, unknown>;

type GovernanceTone = "success" | "warning" | "info" | "neutral" | "error";

const COPY = {
  en: {
    authority: "Authority",
    rights: "Rights",
    provenance: "Provenance",
    review: "Review",
    collection: "Collection",
    version: "Version",
    publication: "Publication",
    evidenceUse: "Evidence use",
    governance: "Knowledge governance",
    governedSources: "Governed sources",
    reviewNeeded: "Review needed",
    gradingReady: "Grading-authoritative",
    coachingOnly: "Coaching only",
    integrationPending: "Governed knowledge is not connected yet",
    integrationDescription:
      "This view is still receiving legacy corpus records. Authority, rights, collection version, and publication data will appear here when the admin API exposes the governed knowledge rows.",
    gradingAuthoritative: "Grading-authoritative",
    gradingDeclared: "Grading use declared",
    gradingBlocked: "Not grading-authoritative",
    coachingEvidence: "Coaching only",
    generalEvidence: "General knowledge",
    notSupplied: "Not supplied",
    legacyRecord: "Legacy record",
    unversioned: "Unversioned",
    activeRelease: "In active release",
    draftVersion: "Draft version",
    pausedCollection: "Collection paused",
    publicationUnavailable: "Publication unavailable",
    readOnly: "Read only",
    sourceLocator: "Source location",
    governanceUnavailable:
      "Governance data is unavailable for this legacy record.",
    gradingExplanation:
      "Approved evidence from an official or qualified source with permitted rights. It may support scoring.",
    gradingDeclaredExplanation:
      "This item declares grading use, but the source authority, rights, review, or active collection version is not fully available here.",
    gradingBlockedExplanation:
      "This item does not pass the authority, rights, and approval checks required for scoring.",
    coachingExplanation:
      "May support feedback, examples, or practice guidance. It must not determine an official score.",
    generalExplanation: "No grading or coaching use is declared for this item.",
  },
  vi: {
    authority: "Thẩm quyền",
    rights: "Quyền sử dụng",
    provenance: "Nguồn gốc",
    review: "Duyệt",
    collection: "Bộ dữ liệu",
    version: "Phiên bản",
    publication: "Xuất bản",
    evidenceUse: "Mục đích bằng chứng",
    governance: "Quản trị tri thức",
    governedSources: "Nguồn được quản trị",
    reviewNeeded: "Cần duyệt",
    gradingReady: "Có thẩm quyền chấm điểm",
    coachingOnly: "Chỉ dùng huấn luyện",
    integrationPending: "Tri thức được quản trị chưa được kết nối",
    integrationDescription:
      "Màn hình này vẫn đang nhận dữ liệu corpus cũ. Thẩm quyền, quyền sử dụng, phiên bản và trạng thái xuất bản sẽ hiển thị khi API quản trị cung cấp dữ liệu tri thức mới.",
    gradingAuthoritative: "Có thẩm quyền chấm điểm",
    gradingDeclared: "Đã khai báo dùng chấm điểm",
    gradingBlocked: "Không có thẩm quyền chấm điểm",
    coachingEvidence: "Chỉ dùng huấn luyện",
    generalEvidence: "Tri thức chung",
    notSupplied: "Chưa cung cấp",
    legacyRecord: "Dữ liệu cũ",
    unversioned: "Chưa có phiên bản",
    activeRelease: "Trong bản đang hoạt động",
    draftVersion: "Phiên bản nháp",
    pausedCollection: "Bộ dữ liệu tạm dừng",
    publicationUnavailable: "Chưa có trạng thái xuất bản",
    readOnly: "Chỉ xem",
    sourceLocator: "Vị trí trong nguồn",
    governanceUnavailable: "Dữ liệu quản trị chưa có cho bản ghi cũ này.",
    gradingExplanation:
      "Bằng chứng đã duyệt từ nguồn chính thức hoặc chuyên gia đủ điều kiện, với quyền sử dụng phù hợp. Có thể hỗ trợ chấm điểm.",
    gradingDeclaredExplanation:
      "Mục này khai báo dùng để chấm điểm, nhưng chưa có đủ thẩm quyền nguồn, quyền sử dụng, trạng thái duyệt hoặc phiên bản đang hoạt động.",
    gradingBlockedExplanation:
      "Mục này không đạt yêu cầu về thẩm quyền, quyền sử dụng và phê duyệt để dùng khi chấm điểm.",
    coachingExplanation:
      "Có thể hỗ trợ phản hồi, ví dụ hoặc hướng dẫn luyện tập. Không được quyết định điểm chính thức.",
    generalExplanation:
      "Mục này chưa khai báo mục đích chấm điểm hoặc huấn luyện.",
  },
} as const;

export function useAiKnowledgeCopy() {
  const locale = useLocale();
  return locale.toLowerCase().startsWith("vi") ? COPY.vi : COPY.en;
}

function objectValue(value: unknown): AiKnowledgeRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AiKnowledgeRow)
    : {};
}

function firstString(...values: unknown[]) {
  return values.find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

function firstNumber(...values: unknown[]) {
  return values.find(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
}

function stringArray(...values: unknown[]) {
  const value = values.find(Array.isArray);
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function redactProtectedBenchmarkFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactProtectedBenchmarkFields);
  }
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as AiKnowledgeRow).flatMap(([key, entry]) =>
      /protected.?labels?|benchmark.?labels?|gold.?labels?/i.test(key)
        ? []
        : [[key, redactProtectedBenchmarkFields(entry)]],
    ),
  );
}

export interface AiKnowledgeGovernanceView {
  authorityTier: string | null;
  rightsStatus: string | null;
  provenanceLocator: string | null;
  collectionLabel: string | null;
  collectionVersion: number | null;
  activeVersion: number | null;
  collectionActive: boolean | null;
  publicationStatus: string | null;
  reviewStatus: string | null;
  itemReviewStatus: string | null;
  sourceReviewStatus: string | null;
  versionStatus: string | null;
  usableFor: string[];
  hasGovernanceData: boolean;
  evidencePolicy:
    | "grading_authoritative"
    | "grading_declared"
    | "grading_blocked"
    | "coaching_only"
    | "general";
}

export function getAiKnowledgeGovernance(
  row: AiKnowledgeRow,
): AiKnowledgeGovernanceView {
  const metadata = objectValue(row.metadata);
  const sourceRelation = row.ai_knowledge_sources;
  const source = objectValue(
    Array.isArray(sourceRelation)
      ? sourceRelation[0]
      : (sourceRelation ?? row.source),
  );
  const collection = objectValue(row.collection);
  const version = objectValue(
    row.collectionVersionRecord ?? row.collection_version_record,
  );
  const authorityTier =
    firstString(
      row.authority_tier,
      row.authorityTier,
      source.authority_tier,
      source.authorityTier,
      metadata.authority_tier,
      metadata.authorityTier,
    ) ?? null;
  const rightsStatus =
    firstString(
      row.rights_status,
      row.rightsStatus,
      source.rights_status,
      source.rightsStatus,
      metadata.rights_status,
      metadata.rightsStatus,
    ) ?? null;
  const provenanceLocator =
    firstString(
      row.source_locator,
      row.sourceLocator,
      row.provenance_locator,
      row.provenanceLocator,
      row.canonical_url,
      row.canonicalUrl,
      row.youtube_url,
      row.source_url,
      source.canonical_url,
      source.canonicalUrl,
    ) ?? null;
  const collectionLabel =
    firstString(
      row.collection_slug,
      row.collection_name,
      row.collection_key,
      collection.slug,
      collection.name,
      typeof row.collection === "string" ? row.collection : null,
    ) ?? null;
  const collectionVersion =
    firstNumber(row.collection_version, row.collectionVersion, row.version) ??
    null;
  const activeVersion =
    firstNumber(
      row.active_version,
      row.activeVersion,
      collection.active_version,
    ) ?? null;
  const collectionActive =
    typeof row.is_active === "boolean"
      ? row.is_active
      : typeof collection.is_active === "boolean"
        ? collection.is_active
        : null;
  const versionStatus =
    firstString(
      row.version_status,
      row.versionStatus,
      row.collection_version_status,
      row.collectionVersionStatus,
      version.status,
      row.publication_status,
      row.publicationStatus,
    ) ?? null;
  const itemReviewStatus =
    firstString(
      row.item_review_status,
      row.itemReviewStatus,
      row.review_status,
    ) ?? null;
  const sourceReviewStatus =
    firstString(
      row.source_review_status,
      row.sourceReviewStatus,
      source.review_status,
      source.reviewStatus,
    ) ?? null;
  const reviewStatus = itemReviewStatus ?? sourceReviewStatus;
  const usableFor = stringArray(row.usable_for, row.usableFor);
  const hasGovernanceData = Boolean(
    authorityTier ||
    rightsStatus ||
    collectionLabel ||
    collectionVersion ||
    activeVersion ||
    row.source_locator ||
    row.provenance_locator,
  );

  const gradingDeclared = usableFor.includes("grading");
  const coachingDeclared = usableFor.some((use) =>
    [
      "coaching",
      "opponent",
      "explanation",
      "rebuttal",
      "judging",
      "phrase_bank",
      "prep_helper",
    ].includes(use),
  );
  const authorityApproved = [
    "official",
    "qualified_examiner_or_adjudicator",
  ].includes(authorityTier ?? "");
  const rightsApproved = [
    "approved_for_derived_use",
    "approved_for_excerpt",
    "public_domain",
  ].includes(rightsStatus ?? "");
  const itemReviewApproved = itemReviewStatus === "approved";
  const sourceReviewApproved = sourceReviewStatus === "approved";
  const publicationApproved = versionStatus === "published";
  const hasCompleteGradingGate = Boolean(
    authorityTier &&
    rightsStatus &&
    itemReviewStatus &&
    sourceReviewStatus &&
    versionStatus,
  );

  let evidencePolicy: AiKnowledgeGovernanceView["evidencePolicy"] = "general";
  if (
    gradingDeclared &&
    authorityApproved &&
    rightsApproved &&
    itemReviewApproved &&
    sourceReviewApproved &&
    publicationApproved
  ) {
    evidencePolicy = "grading_authoritative";
  } else if (gradingDeclared && hasCompleteGradingGate) {
    evidencePolicy = "grading_blocked";
  } else if (gradingDeclared) {
    evidencePolicy = "grading_declared";
  } else if (coachingDeclared) {
    evidencePolicy = "coaching_only";
  }

  return {
    authorityTier,
    rightsStatus,
    provenanceLocator,
    collectionLabel,
    collectionVersion,
    activeVersion,
    collectionActive,
    publicationStatus: versionStatus,
    reviewStatus,
    itemReviewStatus,
    sourceReviewStatus,
    versionStatus,
    usableFor,
    hasGovernanceData,
    evidencePolicy,
  };
}

function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: GovernanceTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 max-w-full items-center rounded-md border px-2 type-caption font-semibold",
        tone === "success" &&
          "border-secondary/20 bg-secondary/10 text-secondary",
        tone === "warning" && "border-warning/25 bg-warning/10 text-warning",
        tone === "info" && "border-primary/20 bg-primary/8 text-primary",
        tone === "error" && "border-error/20 bg-error-container text-error",
        tone === "neutral" &&
          "border-outline-variant/25 bg-surface-container text-on-surface-variant",
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function authorityTone(authority: string | null): GovernanceTone {
  if (
    authority === "official" ||
    authority === "qualified_examiner_or_adjudicator"
  ) {
    return "success";
  }
  if (authority === "ai_derived" || authority === "community") return "warning";
  return authority ? "info" : "neutral";
}

function rightsTone(rights: string | null): GovernanceTone {
  if (
    [
      "approved_for_derived_use",
      "approved_for_excerpt",
      "public_domain",
    ].includes(rights ?? "")
  ) {
    return "success";
  }
  if (rights === "restricted") return "error";
  return rights ? "warning" : "neutral";
}

function publicationLabel(
  view: AiKnowledgeGovernanceView,
  copy: (typeof COPY)["en"] | (typeof COPY)["vi"],
) {
  if (view.publicationStatus) return humanize(view.publicationStatus);
  if (view.collectionActive === false) return copy.pausedCollection;
  if (view.collectionVersion != null && view.activeVersion != null) {
    return view.collectionVersion <= view.activeVersion
      ? copy.activeRelease
      : copy.draftVersion;
  }
  return copy.publicationUnavailable;
}

export function EvidencePolicyBadge({ row }: { row: AiKnowledgeRow }) {
  const copy = useAiKnowledgeCopy();
  const view = getAiKnowledgeGovernance(row);
  const config = {
    grading_authoritative: {
      label: copy.gradingAuthoritative,
      tone: "success" as const,
    },
    grading_declared: { label: copy.gradingDeclared, tone: "warning" as const },
    grading_blocked: { label: copy.gradingBlocked, tone: "error" as const },
    coaching_only: { label: copy.coachingEvidence, tone: "info" as const },
    general: { label: copy.generalEvidence, tone: "neutral" as const },
  }[view.evidencePolicy];
  return <Pill tone={config.tone}>{config.label}</Pill>;
}

export function SourceAuthorityCell({ row }: { row: AiKnowledgeRow }) {
  const copy = useAiKnowledgeCopy();
  const view = getAiKnowledgeGovernance(row);
  return (
    <td className="px-4 py-3 align-top">
      <Pill tone={authorityTone(view.authorityTier)}>
        {view.authorityTier ? humanize(view.authorityTier) : copy.notSupplied}
      </Pill>
    </td>
  );
}

export function SourceRightsCell({ row }: { row: AiKnowledgeRow }) {
  const copy = useAiKnowledgeCopy();
  const view = getAiKnowledgeGovernance(row);
  return (
    <td className="px-4 py-3 align-top">
      <Pill tone={rightsTone(view.rightsStatus)}>
        {view.rightsStatus ? humanize(view.rightsStatus) : copy.notSupplied}
      </Pill>
    </td>
  );
}

export function ProvenanceCell({ row }: { row: AiKnowledgeRow }) {
  const copy = useAiKnowledgeCopy();
  const locator = getAiKnowledgeGovernance(row).provenanceLocator;
  const isUrl =
    locator?.startsWith("http://") || locator?.startsWith("https://");
  return (
    <td className="max-w-[240px] px-4 py-3 align-top">
      {locator ? (
        isUrl ? (
          <a
            href={locator}
            target="_blank"
            rel="noreferrer"
            className="block truncate type-body-sm font-medium text-primary underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            title={locator}
          >
            {locator}
          </a>
        ) : (
          <span
            className="block truncate type-body-sm text-on-surface-variant"
            title={locator}
          >
            {locator}
          </span>
        )
      ) : (
        <span className="type-body-sm text-on-surface-variant">
          {copy.notSupplied}
        </span>
      )}
    </td>
  );
}

export function CollectionVersionCell({ row }: { row: AiKnowledgeRow }) {
  const copy = useAiKnowledgeCopy();
  const view = getAiKnowledgeGovernance(row);
  const publication = publicationLabel(view, copy);
  return (
    <td className="px-4 py-3 align-top">
      <div className="type-label text-on-surface">
        {view.collectionLabel ?? copy.legacyRecord}
        {view.collectionVersion != null ? ` · v${view.collectionVersion}` : ""}
      </div>
      <div className="mt-1 type-caption text-on-surface-variant">
        {view.collectionVersion == null ? copy.unversioned : publication}
      </div>
    </td>
  );
}

export function AiKnowledgeGovernanceOverview({
  sources,
  items,
}: {
  sources: AiKnowledgeRow[];
  items: AiKnowledgeRow[];
}) {
  const copy = useAiKnowledgeCopy();
  const sourceViews = sources.map(getAiKnowledgeGovernance);
  const itemViews = items.map(getAiKnowledgeGovernance);
  const governedSources = sourceViews.filter(
    (view) => view.hasGovernanceData,
  ).length;
  const governedItems = itemViews.filter(
    (view) => view.hasGovernanceData,
  ).length;

  if (governedSources === 0 && governedItems === 0) {
    return (
      <section
        aria-labelledby="ai-knowledge-integration-title"
        className="rounded-xl border border-warning/25 bg-warning/10 p-4"
      >
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <h2
              id="ai-knowledge-integration-title"
              className="type-title text-on-surface"
            >
              {copy.integrationPending}
            </h2>
            <p className="mt-1 max-w-3xl type-body-sm text-on-surface-variant">
              {copy.integrationDescription}
            </p>
          </div>
        </div>
      </section>
    );
  }

  const metrics = [
    {
      label: copy.governedSources,
      value: governedSources,
      icon: Globe2,
      tone: "text-primary",
    },
    {
      label: copy.reviewNeeded,
      value: [...sourceViews, ...itemViews].filter((view) =>
        ["candidate", "needs_review"].includes(view.reviewStatus ?? ""),
      ).length,
      icon: CircleAlert,
      tone: "text-warning",
    },
    {
      label: copy.gradingReady,
      value: itemViews.filter(
        (view) => view.evidencePolicy === "grading_authoritative",
      ).length,
      icon: ShieldCheck,
      tone: "text-secondary",
    },
    {
      label: copy.coachingOnly,
      value: itemViews.filter((view) => view.evidencePolicy === "coaching_only")
        .length,
      icon: BookOpenCheck,
      tone: "text-primary",
    },
  ];

  return (
    <section aria-labelledby="ai-knowledge-governance-title">
      <h2 id="ai-knowledge-governance-title" className="sr-only">
        {copy.governance}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, tone }) => (
          <div
            key={label}
            className="rounded-xl border border-outline-variant/20 bg-surface px-4 py-3"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="type-label text-on-surface-variant">
                {label}
              </span>
              <Icon className={cn("h-4 w-4", tone)} />
            </div>
            <div className="mt-2 type-title tabular-nums text-on-surface">
              {value}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AiKnowledgeGovernanceDetail({ row }: { row: AiKnowledgeRow }) {
  const copy = useAiKnowledgeCopy();
  const view = getAiKnowledgeGovernance(row);
  const policyCopy = {
    grading_authoritative: copy.gradingExplanation,
    grading_declared: copy.gradingDeclaredExplanation,
    grading_blocked: copy.gradingBlockedExplanation,
    coaching_only: copy.coachingExplanation,
    general: copy.generalExplanation,
  }[view.evidencePolicy];

  if (!view.hasGovernanceData && view.usableFor.length === 0) {
    return (
      <section className="mt-6 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4">
        <h3 className="type-title text-on-surface">{copy.governance}</h3>
        <p className="mt-1 type-body-sm text-on-surface-variant">
          {copy.governanceUnavailable}
        </p>
      </section>
    );
  }

  const details = [
    [
      copy.authority,
      view.authorityTier ? humanize(view.authorityTier) : copy.notSupplied,
    ],
    [
      copy.rights,
      view.rightsStatus ? humanize(view.rightsStatus) : copy.notSupplied,
    ],
    [
      copy.collection,
      view.collectionLabel
        ? `${view.collectionLabel}${view.collectionVersion != null ? ` · v${view.collectionVersion}` : ""}`
        : copy.legacyRecord,
    ],
    [copy.publication, publicationLabel(view, copy)],
    [copy.sourceLocator, view.provenanceLocator ?? copy.notSupplied],
  ];

  return (
    <section
      aria-labelledby="ai-knowledge-detail-heading"
      className="mt-6 rounded-xl border border-outline-variant/20 bg-surface-container-low p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          id="ai-knowledge-detail-heading"
          className="type-title text-on-surface"
        >
          {copy.governance}
        </h3>
        <EvidencePolicyBadge row={row} />
      </div>
      <p className="mt-2 type-body-sm text-on-surface-variant">{policyCopy}</p>
      <dl className="mt-4 divide-y divide-outline-variant/20 rounded-lg border border-outline-variant/20 bg-surface px-3">
        {details.map(([label, value]) => (
          <div
            key={label}
            className="grid gap-1 py-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4"
          >
            <dt className="type-label text-on-surface-variant">{label}</dt>
            <dd className="break-words type-body-sm font-medium text-on-surface">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {view.evidencePolicy === "grading_authoritative" ? (
        <div className="mt-3 flex items-center gap-2 type-caption font-semibold text-secondary">
          <BadgeCheck className="h-4 w-4" />
          {copy.gradingAuthoritative}
        </div>
      ) : null}
    </section>
  );
}
