"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  BookOpenCheck,
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

interface KnowledgePayload {
  collection: AiKnowledgeRow;
  versions: AiKnowledgeRow[];
  items: AiKnowledgeRow[];
}

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

function statusTone(status: string) {
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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center rounded-md border px-2 type-caption font-semibold",
        statusTone(status),
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
    useState<(typeof COLLECTIONS)[number]>("ielts.speaking");
  const [reviewStatus, setReviewStatus] = useState<"all" | ReviewStatus>("all");
  const [data, setData] = useState<KnowledgePayload | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams({ collection, limit: "250" });
    if (reviewStatus !== "all") params.set("reviewStatus", reviewStatus);
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
                className="h-8 rounded-[10px] border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
                className="h-8 rounded-[10px] border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
              className="mt-auto inline-flex h-8 items-center justify-center gap-2 rounded-[10px] border border-outline-variant bg-surface px-3 type-label font-semibold text-on-surface transition hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
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
          <div className="rounded-[10px] border border-secondary/20 bg-secondary/10 px-3 py-2 type-body-sm text-secondary">
            {notice}
          </div>
        ) : null}
        {error ? (
          <div
            role="alert"
            className="rounded-[10px] border border-error/20 bg-error-container px-3 py-2 type-body-sm text-error"
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
                    className="rounded-[10px] border border-outline-variant bg-surface-container-low p-3"
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
                          className="inline-flex h-8 items-center gap-2 rounded-[10px] bg-on-surface px-3 type-label font-semibold text-surface transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
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

          <section
            aria-labelledby="knowledge-items-title"
            className="rounded-xl border border-outline-variant/20 bg-surface p-4"
          >
            <div className="flex items-center gap-2">
              <BookOpenCheck className="h-4 w-4 text-primary" />
              <h3
                id="knowledge-items-title"
                className="type-title text-on-surface"
              >
                {copy.items}
              </h3>
            </div>
            {data.items.length === 0 ? (
              <p className="mt-3 rounded-[10px] bg-surface-container-low px-3 py-4 type-body-sm text-on-surface-variant">
                {copy.noItems}
              </p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-outline-variant rounded-[10px] border border-outline-variant bg-surface-container-low px-3">
                {data.items.map((item) => {
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
                      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_250px_220px] xl:items-start">
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
                              className="h-8 rounded-[10px] border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
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
                              className="h-8 rounded-[10px] border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
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
                              className="h-8 rounded-[10px] border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                            >
                              {REVIEW_STATUSES.map((status) => (
                                <option key={status} value={status}>
                                  {copy[status]}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

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
                            className="h-8 rounded-[10px] border border-outline-variant bg-surface px-3 type-label text-on-surface outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
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
        </>
      ) : null}
    </section>
  );
}
