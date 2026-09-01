"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpenCheck,
  ChevronRight,
  CircleAlert,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import {
  EvidencePolicyBadge,
  getAiKnowledgeGovernance,
  useAiKnowledgeCopy,
  type AiKnowledgeRow,
} from "./AiKnowledgeGovernance";
import {
  getIeltsKnowledgeReleaseModel,
  IELTS_KNOWLEDGE_COLLECTIONS,
  IELTS_KNOWLEDGE_RELEASE_VERSION,
  isIeltsKnowledgeCollection,
  type IeltsKnowledgeReleasePayload,
} from "./IeltsKnowledgeReleaseReview";

const COLLECTIONS = [
  "ielts.speaking",
  "ielts.writing",
  "debate.en.competitive",
  "debate.vi.truong_teen",
] as const;

const REVIEW_STATUSES = [
  "candidate",
  "needs_review",
  "approved",
  "rejected",
] as const;

const AUTHORITY_TIERS = [
  "official",
  "qualified_examiner_or_adjudicator",
  "expert_educational",
  "community",
  "ai_derived",
] as const;

const RIGHTS_STATUSES = [
  "approved_for_derived_use",
  "approved_for_excerpt",
  "public_domain",
  "requires_review",
  "restricted",
  "unknown",
] as const;

type ReviewStatus = (typeof REVIEW_STATUSES)[number];

type KnowledgePayload = IeltsKnowledgeReleasePayload;

const WORKBENCH_COPY = {
  en: {
    title: "Governed knowledge",
    description:
      "Review source rights and scoring authority separately from each knowledge item, then publish one exact collection version.",
    collection: "Collection",
    reviewFilter: "Review filter",
    allStatuses: "All statuses",
    refresh: "Refresh",
    versions: "Collection versions",
    version: "Version",
    published: "Published",
    draft: "Draft",
    superseded: "Superseded",
    rejected: "Rejected",
    publish: "Publish v{version}",
    publishing: "Publishing",
    publishHint: "Publishing makes this exact reviewed version active.",
    items: "Evidence items",
    source: "Source",
    itemReview: "Item review",
    sourceReview: "Source review",
    rights: "Rights",
    authority: "Authority",
    locator: "Source location",
    noItems: "No governed items match this filter.",
    unavailable:
      "The governed knowledge API is not available in this worktree yet.",
    unavailableBody:
      "The interface is ready for the isolated backend contract and will activate when the two branches are integrated.",
    loadError: "Unable to load governed knowledge.",
    updateError: "Unable to save the review state.",
    publishError: "Unable to publish this collection version.",
    updated: "Review state saved.",
    publishedNotice: "Collection version published.",
    notSupplied: "Not supplied",
    candidate: "Candidate",
    needs_review: "Needs review",
    approved: "Approved",
    readOnlyBenchmarks: "Protected benchmark labels never appear in this view.",
    rolloutTitle: "IELTS mock collection v2",
    rolloutDescription:
      "Approve coaching-only practice evidence in order. This collection never becomes grading-authoritative.",
    writing: "Writing",
    speaking: "Speaking",
    coachingOnlyNotice: "Coaching only · not an official IELTS score source",
    preflightTitle: "Release preflight",
    preflightReady: "Ready to publish",
    preflightBlocked: "Blocked",
    preflightPending: "Waiting for a verified server preflight",
    itemsCount: "Items",
    coachingOnlyCount: "Coaching-only",
    answerKeyCount: "Answer-key flags",
    approvedItemsCount: "Approved items",
    approvedSourcesCount: "Items with approved sources",
    embeddingsCount: "Current embeddings",
    unknownCount: "Pending",
    stepSources: "Review sources",
    stepItems: "Review items",
    stepPublish: "Publish",
    stepSourcesHint: "Confirm authority, rights, and an independent reviewer.",
    stepItemsHint: "Approve each coaching item with an independent reviewer.",
    stepPublishHint: "Publish only after every safe check passes.",
    complete: "Complete",
    incomplete: "Needs attention",
    blockers: "Release blockers",
    noBlockers: "Every release check has passed.",
    publishV2: "Publish IELTS v2",
    sourcesForV2: "Sources for version 2",
    itemsForV2: "Items for version 2",
    sourceItems: "{count} items",
    safePreflightUnavailable:
      "The admin API does not yet provide the learner-safe release preflight. Publishing stays locked.",
    versionNotDraft: "Version 2 must be a draft.",
    emptyVersion: "Version 2 has no items.",
    nonCoachingMaterial: "Remove any item that is not coaching-only practice.",
    answerKeyMaterial: "Remove answer-key material before publishing.",
    itemsNeedReview: "Every item needs an independent approval.",
    sourcesNeedReview:
      "Every source needs cleared rights and an independent approval.",
    embeddingsMissing: "Generate current embeddings for every item.",
    sourcesMissing: "Every item must reference a reviewed source.",
  },
  vi: {
    title: "Tri thức được quản trị",
    description:
      "Duyệt quyền sử dụng và thẩm quyền chấm điểm của nguồn tách biệt với từng mục tri thức, sau đó xuất bản đúng một phiên bản bộ dữ liệu.",
    collection: "Bộ dữ liệu",
    reviewFilter: "Bộ lọc duyệt",
    allStatuses: "Tất cả trạng thái",
    refresh: "Làm mới",
    versions: "Phiên bản bộ dữ liệu",
    version: "Phiên bản",
    published: "Đã xuất bản",
    draft: "Bản nháp",
    superseded: "Đã thay thế",
    rejected: "Đã từ chối",
    publish: "Xuất bản v{version}",
    publishing: "Đang xuất bản",
    publishHint: "Xuất bản sẽ kích hoạt đúng phiên bản đã được duyệt này.",
    items: "Mục bằng chứng",
    source: "Nguồn",
    itemReview: "Duyệt mục",
    sourceReview: "Duyệt nguồn",
    rights: "Quyền sử dụng",
    authority: "Thẩm quyền",
    locator: "Vị trí trong nguồn",
    noItems: "Không có mục tri thức phù hợp với bộ lọc.",
    unavailable: "API tri thức được quản trị chưa có trong worktree này.",
    unavailableBody:
      "Giao diện đã sẵn sàng cho hợp đồng backend tách biệt và sẽ hoạt động khi hai nhánh được tích hợp.",
    loadError: "Không thể tải tri thức được quản trị.",
    updateError: "Không thể lưu trạng thái duyệt.",
    publishError: "Không thể xuất bản phiên bản bộ dữ liệu này.",
    updated: "Đã lưu trạng thái duyệt.",
    publishedNotice: "Đã xuất bản phiên bản bộ dữ liệu.",
    notSupplied: "Chưa cung cấp",
    candidate: "Ứng viên",
    needs_review: "Cần duyệt",
    approved: "Đã duyệt",
    readOnlyBenchmarks:
      "Nhãn benchmark được bảo vệ không bao giờ xuất hiện ở đây.",
    rolloutTitle: "Bộ đề IELTS thử nghiệm v2",
    rolloutDescription:
      "Duyệt bằng chứng luyện tập chỉ dành cho huấn luyện theo đúng thứ tự. Bộ này không bao giờ trở thành nguồn chấm điểm chính thức.",
    writing: "Writing",
    speaking: "Speaking",
    coachingOnlyNotice:
      "Chỉ dùng để huấn luyện · không phải nguồn điểm IELTS chính thức",
    preflightTitle: "Kiểm tra trước khi phát hành",
    preflightReady: "Sẵn sàng xuất bản",
    preflightBlocked: "Đang bị chặn",
    preflightPending: "Đang chờ kiểm tra máy chủ đã xác minh",
    itemsCount: "Mục",
    coachingOnlyCount: "Chỉ huấn luyện",
    answerKeyCount: "Cờ đáp án",
    approvedItemsCount: "Mục đã duyệt",
    approvedSourcesCount: "Mục có nguồn đã duyệt",
    embeddingsCount: "Embedding hiện tại",
    unknownCount: "Đang chờ",
    stepSources: "Duyệt nguồn",
    stepItems: "Duyệt mục",
    stepPublish: "Xuất bản",
    stepSourcesHint:
      "Xác nhận thẩm quyền, quyền sử dụng và người duyệt độc lập.",
    stepItemsHint: "Duyệt từng mục huấn luyện bằng người duyệt độc lập.",
    stepPublishHint: "Chỉ xuất bản khi mọi kiểm tra an toàn đều đạt.",
    complete: "Hoàn tất",
    incomplete: "Cần xử lý",
    blockers: "Điểm chặn phát hành",
    noBlockers: "Tất cả kiểm tra phát hành đã đạt.",
    publishV2: "Xuất bản IELTS v2",
    sourcesForV2: "Nguồn cho phiên bản 2",
    itemsForV2: "Mục cho phiên bản 2",
    sourceItems: "{count} mục",
    safePreflightUnavailable:
      "API quản trị chưa cung cấp bản kiểm tra phát hành an toàn cho người học. Chức năng xuất bản vẫn bị khóa.",
    versionNotDraft: "Phiên bản 2 phải ở trạng thái bản nháp.",
    emptyVersion: "Phiên bản 2 chưa có mục nào.",
    nonCoachingMaterial:
      "Xóa mọi mục không phải bài luyện tập chỉ để huấn luyện.",
    answerKeyMaterial: "Xóa nội dung đáp án trước khi xuất bản.",
    itemsNeedReview: "Mọi mục cần được duyệt độc lập.",
    sourcesNeedReview:
      "Mọi nguồn cần có quyền sử dụng rõ ràng và được duyệt độc lập.",
    embeddingsMissing: "Tạo embedding hiện tại cho mọi mục.",
    sourcesMissing: "Mọi mục phải liên kết đến một nguồn đã duyệt.",
  },
} as const;

const POLICY_LABELS = {
  en: {
    official: "Official source",
    qualified_examiner_or_adjudicator: "Qualified examiner or adjudicator",
    expert_educational: "Education expert",
    community: "Community source",
    ai_derived: "AI-derived",
    approved_for_derived_use: "Approved for derived use",
    approved_for_excerpt: "Approved for excerpts",
    public_domain: "Public domain",
    requires_review: "Rights need review",
    restricted: "Restricted",
    unknown: "Rights unknown",
  },
  vi: {
    official: "Nguồn chính thức",
    qualified_examiner_or_adjudicator: "Giám khảo đủ điều kiện",
    expert_educational: "Chuyên gia giáo dục",
    community: "Nguồn cộng đồng",
    ai_derived: "Do AI tổng hợp",
    approved_for_derived_use: "Được phép sử dụng phái sinh",
    approved_for_excerpt: "Được phép trích dẫn",
    public_domain: "Phạm vi công cộng",
    requires_review: "Cần duyệt quyền sử dụng",
    restricted: "Bị hạn chế",
    unknown: "Chưa rõ quyền sử dụng",
  },
} as const;

function asRecord(value: unknown): AiKnowledgeRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AiKnowledgeRow)
    : {};
}

function sourceFor(item: AiKnowledgeRow) {
  const relation = item.ai_knowledge_sources;
  return asRecord(Array.isArray(relation) ? relation[0] : relation);
}

function textValue(value: unknown, fallback = "—") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function humanize(value: unknown, fallback: string) {
  const text = textValue(value, fallback);
  return text
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function versionNumber(row: AiKnowledgeRow) {
  return typeof row.version === "number" && Number.isFinite(row.version)
    ? row.version
    : null;
}

function statusTone(status: string, tone?: "success" | "warning" | "neutral") {
  if (tone === "success") {
    return "border-secondary/20 bg-secondary/10 text-secondary";
  }
  if (tone === "warning") {
    return "border-warning/25 bg-warning/10 text-on-warning-container";
  }
  if (tone === "neutral") {
    return "border-outline-variant/25 bg-surface-container text-on-surface-variant";
  }
  if (status === "published" || status === "approved") {
    return "border-secondary/20 bg-secondary/10 text-secondary";
  }
  if (status === "rejected")
    return "border-error/20 bg-error-container text-error";
  if (status === "draft" || status === "needs_review") {
    return "border-warning/25 bg-warning/10 text-on-warning-container";
  }
  return "border-outline-variant/25 bg-surface-container text-on-surface-variant";
}

function StatusBadge({
  status,
  tone,
}: {
  status: string;
  tone?: "success" | "warning" | "neutral";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center rounded-md border px-2 type-caption font-semibold",
        statusTone(status, tone),
      )}
    >
      {humanize(status, "Unknown")}
    </span>
  );
}

export function AiKnowledgeGovernanceWorkbench() {
  const governanceCopy = useAiKnowledgeCopy();
  const isVietnamese = governanceCopy.governance === "Quản trị tri thức";
  const copy = isVietnamese ? WORKBENCH_COPY.vi : WORKBENCH_COPY.en;
  const [collection, setCollection] =
    useState<(typeof COLLECTIONS)[number]>("ielts.writing");
  const [reviewStatus, setReviewStatus] = useState<"all" | ReviewStatus>("all");
  const [data, setData] = useState<KnowledgePayload | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ collection, limit: "250" });
    if (reviewStatus !== "all" && !isIeltsKnowledgeCollection(collection)) {
      params.set("reviewStatus", reviewStatus);
    }
    try {
      const response = await fetch(`/api/admin/ai-knowledge?${params}`, {
        cache: "no-store",
      });
      if (response.status === 404) {
        setUnavailable(true);
        setData(null);
        return;
      }
      const body = (await response.json().catch(() => ({}))) as
        | KnowledgePayload
        | { error?: string };
      if (!response.ok || !("collection" in body)) {
        throw new Error(
          "error" in body ? body.error || copy.loadError : copy.loadError,
        );
      }
      setUnavailable(false);
      setData(body);
    } catch (nextError) {
      setData(null);
      setError(nextError instanceof Error ? nextError.message : copy.loadError);
    }
  }, [collection, copy.loadError, reviewStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const versionsByNumber = useMemo(
    () =>
      new Map(
        (data?.versions ?? []).flatMap((row) => {
          const number = versionNumber(row);
          return number === null ? [] : [[number, row] as const];
        }),
      ),
    [data?.versions],
  );

  const ieltsReleaseModel = useMemo(
    () =>
      data && isIeltsKnowledgeCollection(collection)
        ? getIeltsKnowledgeReleaseModel({ collection, payload: data })
        : null,
    [collection, data],
  );

  const visibleItems = useMemo(() => {
    const items = ieltsReleaseModel?.items ?? data?.items ?? [];
    return reviewStatus === "all"
      ? items
      : items.filter((item) => item.review_status === reviewStatus);
  }, [data?.items, ieltsReleaseModel?.items, reviewStatus]);

  const blockerLabels = useMemo(
    () => ({
      safe_preflight_unavailable: copy.safePreflightUnavailable,
      version_not_draft: copy.versionNotDraft,
      empty_version: copy.emptyVersion,
      contains_non_coaching_material: copy.nonCoachingMaterial,
      contains_answer_key_material: copy.answerKeyMaterial,
      items_need_independent_review: copy.itemsNeedReview,
      sources_need_rights_and_independent_review: copy.sourcesNeedReview,
      missing_current_embeddings: copy.embeddingsMissing,
      missing_source_records: copy.sourcesMissing,
    }),
    [copy],
  );

  const updateReview = async (
    kind: "source" | "item",
    id: string,
    nextStatus: ReviewStatus,
    policy?: { authorityTier?: string; rightsStatus?: string },
  ) => {
    const actionKey = `${kind}:${id}:${nextStatus}`;
    setBusyAction(actionKey);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/ai-knowledge", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, reviewStatus: nextStatus, ...policy }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || copy.updateError);
      setNotice(copy.updated);
      await load();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : copy.updateError,
      );
    } finally {
      setBusyAction(null);
    }
  };

  const publishVersion = async (version: number) => {
    const actionKey = `publish:${version}`;
    setBusyAction(actionKey);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/ai-knowledge/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection, version }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || copy.publishError);
      setNotice(copy.publishedNotice);
      await load();
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : copy.publishError,
      );
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <section aria-labelledby="governed-knowledge-title" className="space-y-4">
      <div className="rounded-xl border border-outline-variant/20 bg-surface p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <h2
                id="governed-knowledge-title"
                className="type-title text-on-surface"
              >
                {copy.title}
              </h2>
            </div>
            <p className="mt-1 max-w-3xl type-body-sm text-on-surface-variant">
              {copy.description}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="flex flex-col gap-1">
              <span className="type-caption text-on-surface-variant">
                {copy.collection}
              </span>
              <select
                value={collection}
                onChange={(event) =>
                  setCollection(
                    event.target.value as (typeof COLLECTIONS)[number],
                  )
                }
                className="h-8 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {COLLECTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="type-caption text-on-surface-variant">
                {copy.reviewFilter}
              </span>
              <select
                value={reviewStatus}
                onChange={(event) =>
                  setReviewStatus(event.target.value as "all" | ReviewStatus)
                }
                className="h-8 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="all">{copy.allStatuses}</option>
                {REVIEW_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {copy[status]}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-auto inline-flex h-8 items-center justify-center gap-2 rounded-control border border-outline-variant bg-surface px-3 type-label font-semibold text-on-surface transition hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <RefreshCw className="h-4 w-4" />
              {copy.refresh}
            </button>
          </div>
        </div>
        <p className="mt-3 type-caption text-on-surface-variant">
          {copy.readOnlyBenchmarks}
        </p>
      </div>

      <div aria-live="polite" className="space-y-3">
        {notice ? (
          <div className="rounded-control border border-secondary/20 bg-secondary/10 px-3 py-2 type-body-sm text-secondary">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-control border border-error/20 bg-error-container px-3 py-2 type-body-sm text-error"
          >
            {error}
          </div>
        ) : null}
      </div>

      {unavailable ? (
        <div className="rounded-xl border border-warning/25 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <h3 className="type-title text-on-surface">{copy.unavailable}</h3>
              <p className="mt-1 type-body-sm text-on-surface-variant">
                {copy.unavailableBody}
              </p>
            </div>
          </div>
        </div>
      ) : !data && !error ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-outline-variant/20 bg-surface">
          <Loader2 className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none" />
        </div>
      ) : data ? (
        <>
          {ieltsReleaseModel ? (
            <section
              aria-labelledby="ielts-release-title"
              className="rounded-xl border border-outline-variant/20 bg-surface p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      id="ielts-release-title"
                      className="type-title text-on-surface"
                    >
                      {copy.rolloutTitle}
                    </h3>
                    <span className="inline-flex min-h-5 items-center rounded-md border border-primary/20 bg-primary/10 px-2 type-caption font-semibold text-primary">
                      {copy.coachingOnlyNotice}
                    </span>
                    <StatusBadge
                      status={ieltsReleaseModel.versionStatus ?? "draft"}
                    />
                  </div>
                  <p className="mt-1 max-w-3xl type-body-sm text-on-surface-variant">
                    {copy.rolloutDescription}
                  </p>
                </div>
                <div
                  aria-label={copy.collection}
                  className="inline-flex w-fit rounded-control border border-outline-variant bg-surface-container-low p-0.5"
                  role="group"
                >
                  {IELTS_KNOWLEDGE_COLLECTIONS.map((option) => {
                    const selected = option === collection;
                    return (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCollection(option)}
                        className={cn(
                          "h-8 rounded-lg px-3 type-label font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                          selected
                            ? "bg-on-surface text-surface"
                            : "text-on-surface-variant hover:bg-surface-container",
                        )}
                      >
                        {option === "ielts.writing"
                          ? copy.writing
                          : copy.speaking}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
                {[
                  [copy.itemsCount, ieltsReleaseModel.counts.items],
                  [
                    copy.coachingOnlyCount,
                    ieltsReleaseModel.counts.coachingOnly,
                  ],
                  [
                    copy.answerKeyCount,
                    ieltsReleaseModel.counts.answerKeyFlags,
                  ],
                  [
                    copy.approvedItemsCount,
                    ieltsReleaseModel.counts.approvedItems,
                  ],
                  [
                    copy.approvedSourcesCount,
                    ieltsReleaseModel.counts.approvedSources,
                  ],
                  [
                    copy.embeddingsCount,
                    ieltsReleaseModel.counts.currentEmbeddings,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    role="group"
                    aria-label={`${label}: ${
                      typeof value === "number" ? value : copy.preflightPending
                    }`}
                    className="rounded-control border border-outline-variant/70 bg-surface-container-low px-3 py-2"
                  >
                    <p className="type-caption text-on-surface-variant">
                      {label}
                    </p>
                    <p className="mt-0.5 type-title text-on-surface">
                      {typeof value === "number" ? value : copy.unknownCount}
                    </p>
                  </div>
                ))}
              </div>

              <ol className="mt-4 grid overflow-hidden rounded-control border border-outline-variant md:grid-cols-3">
                {[
                  {
                    href: "#ielts-release-sources",
                    label: copy.stepSources,
                    hint: copy.stepSourcesHint,
                    complete: ieltsReleaseModel.sourcesComplete,
                  },
                  {
                    href: "#ielts-release-items",
                    label: copy.stepItems,
                    hint: copy.stepItemsHint,
                    complete: ieltsReleaseModel.itemsComplete,
                  },
                  {
                    href: "#ielts-release-publish",
                    label: copy.stepPublish,
                    hint: copy.stepPublishHint,
                    complete: ieltsReleaseModel.canPublish,
                  },
                ].map((step, index) => (
                  <li
                    key={step.href}
                    className="border-outline-variant p-3 md:border-l md:first:border-l-0"
                  >
                    <a
                      href={step.href}
                      className="group flex items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md type-caption font-semibold",
                          step.complete
                            ? "bg-secondary/15 text-secondary"
                            : "bg-surface-container-high text-on-surface-variant",
                        )}
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 type-label font-semibold text-on-surface">
                          {step.label}
                          <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                        </span>
                        <span className="mt-0.5 block type-caption text-on-surface-variant">
                          {step.hint}
                        </span>
                        <span
                          className={cn(
                            "mt-1 block type-caption font-semibold",
                            step.complete ? "text-secondary" : "text-warning",
                          )}
                        >
                          {step.complete ? copy.complete : copy.incomplete}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {!ieltsReleaseModel ? (
            <section
              aria-labelledby="knowledge-versions-title"
              className="rounded-xl border border-outline-variant/20 bg-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <h3
                  id="knowledge-versions-title"
                  className="type-title text-on-surface"
                >
                  {copy.versions}
                </h3>
                <span className="type-caption text-on-surface-variant">
                  {textValue(data.collection.slug, collection)}
                </span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {data.versions.map((versionRow) => {
                  const version = versionNumber(versionRow);
                  const status = textValue(versionRow.status, "draft");
                  const publishing = busyAction === `publish:${version}`;
                  return (
                    <div
                      key={`${version}-${status}`}
                      className="rounded-control border border-outline-variant bg-surface-container-low p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="type-label font-semibold text-on-surface">
                          {copy.version} {version ?? "—"}
                        </span>
                        <StatusBadge status={status} />
                      </div>
                      {status === "draft" && version !== null ? (
                        <div className="mt-3">
                          <button
                            type="button"
                            disabled={publishing}
                            onClick={() => void publishVersion(version)}
                            className="inline-flex h-8 items-center gap-2 rounded-control bg-on-surface px-3 type-label font-semibold text-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {publishing ? (
                              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                            ) : (
                              <BadgeCheck className="h-4 w-4" />
                            )}
                            {publishing
                              ? copy.publishing
                              : copy.publish.replace(
                                  "{version}",
                                  String(version),
                                )}
                          </button>
                          <p className="mt-1 type-caption text-on-surface-variant">
                            {copy.publishHint}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          {ieltsReleaseModel ? (
            <section
              id="ielts-release-sources"
              aria-labelledby="ielts-release-sources-title"
              className="scroll-mt-4 rounded-xl border border-outline-variant/20 bg-surface p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h3
                    id="ielts-release-sources-title"
                    className="type-title text-on-surface"
                  >
                    {copy.sourcesForV2}
                  </h3>
                </div>
                <StatusBadge
                  status={
                    ieltsReleaseModel.sourcesComplete
                      ? copy.complete
                      : copy.incomplete
                  }
                  tone={
                    ieltsReleaseModel.sourcesComplete ? "success" : "warning"
                  }
                />
              </div>
              {ieltsReleaseModel.sources.length === 0 ? (
                <p className="mt-3 rounded-control bg-surface-container-low px-3 py-4 type-body-sm text-on-surface-variant">
                  {copy.noItems}
                </p>
              ) : (
                <ul className="mt-3 divide-y divide-outline-variant overflow-hidden rounded-control border border-outline-variant bg-surface-container-low">
                  {ieltsReleaseModel.sources.map((source) => {
                    const sourceReviewStatus = textValue(
                      source.row.review_status,
                      "candidate",
                    ) as ReviewStatus;
                    const policyLabels = isVietnamese
                      ? POLICY_LABELS.vi
                      : POLICY_LABELS.en;
                    const sourceBusy = busyAction?.startsWith(
                      `source:${source.id}:`,
                    );
                    return (
                      <li
                        key={source.id}
                        className="grid gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_220px_220px_180px] xl:items-end"
                      >
                        <div className="min-w-0 self-center">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="type-label font-semibold text-on-surface">
                              {textValue(
                                source.row.title,
                                textValue(
                                  source.row.publisher,
                                  copy.notSupplied,
                                ),
                              )}
                            </p>
                            <span className="rounded-md bg-surface-container-high px-2 py-0.5 type-caption text-on-surface-variant">
                              {copy.sourceItems.replace(
                                "{count}",
                                String(source.itemCount),
                              )}
                            </span>
                            <StatusBadge
                              status={
                                source.approved
                                  ? copy.complete
                                  : sourceReviewStatus
                              }
                              tone={source.approved ? "success" : "warning"}
                            />
                          </div>
                          <p className="mt-1 type-caption text-on-surface-variant">
                            {textValue(source.row.publisher, copy.notSupplied)}
                          </p>
                        </div>
                        <label className="flex flex-col gap-1">
                          <span className="type-caption text-on-surface-variant">
                            {copy.authority}
                          </span>
                          <select
                            value={textValue(
                              source.row.authority_tier,
                              "community",
                            )}
                            disabled={sourceBusy}
                            onChange={(event) =>
                              void updateReview(
                                "source",
                                source.id,
                                sourceReviewStatus,
                                { authorityTier: event.target.value },
                              )
                            }
                            className="h-8 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                          >
                            {AUTHORITY_TIERS.map((value) => (
                              <option key={value} value={value}>
                                {policyLabels[value]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="type-caption text-on-surface-variant">
                            {copy.rights}
                          </span>
                          <select
                            value={textValue(
                              source.row.rights_status,
                              "unknown",
                            )}
                            disabled={sourceBusy}
                            onChange={(event) =>
                              void updateReview(
                                "source",
                                source.id,
                                sourceReviewStatus,
                                { rightsStatus: event.target.value },
                              )
                            }
                            className="h-8 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                          >
                            {RIGHTS_STATUSES.map((value) => (
                              <option key={value} value={value}>
                                {policyLabels[value]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="type-caption text-on-surface-variant">
                            {copy.sourceReview}
                          </span>
                          <select
                            value={sourceReviewStatus}
                            disabled={sourceBusy}
                            onChange={(event) =>
                              void updateReview(
                                "source",
                                source.id,
                                event.target.value as ReviewStatus,
                              )
                            }
                            className="h-8 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                          >
                            {REVIEW_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {copy[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : null}

          <section
            id={ieltsReleaseModel ? "ielts-release-items" : undefined}
            aria-labelledby="knowledge-items-title"
            className="scroll-mt-4 rounded-xl border border-outline-variant/20 bg-surface p-4"
          >
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-primary" />
              <h3
                id="knowledge-items-title"
                className="type-title text-on-surface"
              >
                {ieltsReleaseModel ? copy.itemsForV2 : copy.items}
              </h3>
            </div>
            {visibleItems.length === 0 ? (
              <p className="mt-3 rounded-control bg-surface-container-low px-3 py-4 type-body-sm text-on-surface-variant">
                {copy.noItems}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-outline-variant rounded-control border border-outline-variant bg-surface-container-low px-3">
                {visibleItems.map((item) => {
                  const source = sourceFor(item);
                  const version =
                    typeof item.collection_version === "number"
                      ? item.collection_version
                      : null;
                  const versionRow =
                    version === null
                      ? undefined
                      : versionsByNumber.get(version);
                  const governedRow: AiKnowledgeRow = {
                    ...item,
                    collection: data.collection,
                    collection_version_status: versionRow?.status,
                  };
                  const view = getAiKnowledgeGovernance(governedRow);
                  const itemId = textValue(item.id, "");
                  const sourceId = textValue(item.source_id, "");
                  const sourceReviewStatus = (view.sourceReviewStatus ??
                    "candidate") as ReviewStatus;
                  const policyLabels = isVietnamese
                    ? POLICY_LABELS.vi
                    : POLICY_LABELS.en;
                  return (
                    <li key={itemId} className="py-3">
                      <div
                        className={cn(
                          "grid gap-3 xl:items-start",
                          ieltsReleaseModel
                            ? "xl:grid-cols-[minmax(0,1fr)_220px]"
                            : "xl:grid-cols-[minmax(0,1fr)_250px_220px]",
                        )}
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="type-label font-semibold text-on-surface">
                              {humanize(item.item_kind, copy.notSupplied)}
                            </span>
                            <EvidencePolicyBadge row={governedRow} />
                            {version !== null ? (
                              <StatusBadge status={`v${version}`} />
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 type-body-sm text-on-surface-variant">
                            {textValue(
                              item.permitted_excerpt,
                              textValue(item.criterion, copy.notSupplied),
                            )}
                          </p>
                          <dl className="mt-2 grid gap-x-4 gap-y-1 type-caption text-on-surface-variant sm:grid-cols-2">
                            <div>
                              <dt className="inline font-semibold">
                                {copy.source}:{" "}
                              </dt>
                              <dd className="inline">
                                {textValue(
                                  source.title,
                                  textValue(source.publisher, copy.notSupplied),
                                )}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold">
                                {copy.authority}:{" "}
                              </dt>
                              <dd className="inline">
                                {view.authorityTier
                                  ? (policyLabels[
                                      view.authorityTier as keyof typeof policyLabels
                                    ] ??
                                    humanize(
                                      view.authorityTier,
                                      copy.notSupplied,
                                    ))
                                  : copy.notSupplied}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold">
                                {copy.rights}:{" "}
                              </dt>
                              <dd className="inline">
                                {view.rightsStatus
                                  ? (policyLabels[
                                      view.rightsStatus as keyof typeof policyLabels
                                    ] ??
                                    humanize(
                                      view.rightsStatus,
                                      copy.notSupplied,
                                    ))
                                  : copy.notSupplied}
                              </dd>
                            </div>
                            <div>
                              <dt className="inline font-semibold">
                                {copy.locator}:{" "}
                              </dt>
                              <dd className="inline break-all">
                                {view.provenanceLocator ?? copy.notSupplied}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        {!ieltsReleaseModel ? (
                          <div className="grid gap-2">
                            <label className="flex flex-col gap-1">
                              <span className="type-caption text-on-surface-variant">
                                {copy.authority}
                              </span>
                              <select
                                value={view.authorityTier ?? "community"}
                                disabled={
                                  !sourceId ||
                                  busyAction?.startsWith(`source:${sourceId}:`)
                                }
                                onChange={(event) =>
                                  void updateReview(
                                    "source",
                                    sourceId,
                                    sourceReviewStatus,
                                    { authorityTier: event.target.value },
                                  )
                                }
                                className="h-8 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                              >
                                {AUTHORITY_TIERS.map((value) => (
                                  <option key={value} value={value}>
                                    {policyLabels[value]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="type-caption text-on-surface-variant">
                                {copy.rights}
                              </span>
                              <select
                                value={view.rightsStatus ?? "unknown"}
                                disabled={
                                  !sourceId ||
                                  busyAction?.startsWith(`source:${sourceId}:`)
                                }
                                onChange={(event) =>
                                  void updateReview(
                                    "source",
                                    sourceId,
                                    sourceReviewStatus,
                                    { rightsStatus: event.target.value },
                                  )
                                }
                                className="h-8 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                              >
                                {RIGHTS_STATUSES.map((value) => (
                                  <option key={value} value={value}>
                                    {policyLabels[value]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="flex flex-col gap-1">
                              <span className="type-caption text-on-surface-variant">
                                {copy.sourceReview}
                              </span>
                              <select
                                value={sourceReviewStatus}
                                disabled={
                                  !sourceId ||
                                  busyAction?.startsWith(`source:${sourceId}:`)
                                }
                                onChange={(event) =>
                                  void updateReview(
                                    "source",
                                    sourceId,
                                    event.target.value as ReviewStatus,
                                  )
                                }
                                className="h-8 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                              >
                                {REVIEW_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {copy[status]}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ) : null}

                        <label className="flex flex-col gap-1">
                          <span className="type-caption text-on-surface-variant">
                            {copy.itemReview}
                          </span>
                          <select
                            value={view.itemReviewStatus ?? "candidate"}
                            disabled={
                              !itemId ||
                              busyAction?.startsWith(`item:${itemId}:`)
                            }
                            onChange={(event) =>
                              void updateReview(
                                "item",
                                itemId,
                                event.target.value as ReviewStatus,
                              )
                            }
                            className="h-8 rounded-control border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                          >
                            {REVIEW_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {copy[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {ieltsReleaseModel ? (
            <section
              id="ielts-release-publish"
              aria-labelledby="ielts-release-publish-title"
              className="scroll-mt-4 rounded-xl border border-outline-variant/20 bg-surface p-4"
            >
              <div className="grid gap-3 rounded-control border border-outline-variant bg-surface-container-low p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      id="ielts-release-publish-title"
                      className="type-title text-on-surface"
                    >
                      {copy.preflightTitle}
                    </h3>
                    <StatusBadge
                      status={
                        ieltsReleaseModel.canPublish
                          ? copy.preflightReady
                          : copy.preflightBlocked
                      }
                      tone={
                        ieltsReleaseModel.canPublish ? "success" : "warning"
                      }
                    />
                  </div>
                  {ieltsReleaseModel.blockers.length > 0 ? (
                    <div className="mt-2">
                      <p className="type-caption font-semibold text-on-surface-variant">
                        {copy.blockers}
                      </p>
                      <ul className="mt-1 grid gap-1 sm:grid-cols-2">
                        {ieltsReleaseModel.blockers.map((blocker) => (
                          <li
                            key={blocker}
                            className="flex items-start gap-2 type-caption text-on-surface-variant"
                          >
                            <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                            <span>
                              {blockerLabels[
                                blocker as keyof typeof blockerLabels
                              ] ?? humanize(blocker, copy.incomplete)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="mt-1 type-caption text-secondary">
                      {copy.noBlockers}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={
                    !ieltsReleaseModel.canPublish ||
                    busyAction === `publish:${IELTS_KNOWLEDGE_RELEASE_VERSION}`
                  }
                  onClick={() =>
                    void publishVersion(IELTS_KNOWLEDGE_RELEASE_VERSION)
                  }
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-control bg-on-surface px-3 type-label font-semibold text-surface transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busyAction ===
                  `publish:${IELTS_KNOWLEDGE_RELEASE_VERSION}` ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <BadgeCheck className="h-4 w-4" />
                  )}
                  {busyAction === `publish:${IELTS_KNOWLEDGE_RELEASE_VERSION}`
                    ? copy.publishing
                    : copy.publishV2}
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
