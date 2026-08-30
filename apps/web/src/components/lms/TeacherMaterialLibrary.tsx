"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FileText,
  Filter,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
} from "@/components/ui/icons";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { materialCopy } from "@/components/materials/material-copy";
import { ThinkfyMaterialViewer } from "@/components/materials/ThinkfyMaterialViewer";
import type {
  LearnerMaterialProjection,
  MaterialPlacementTarget,
  TeacherMaterialSummary,
} from "@/components/materials/material-ui-model";
import type { MaterialProcessingStatus } from "@/lib/api/class-lms/material-contracts";
import {
  approveSharedMaterialRights,
  placeSharedLmsMaterial,
  prepareSharedMaterialUpload,
  publishSharedLmsMaterial,
  reviewSharedLmsMaterialContent,
  withdrawSharedLmsMaterial,
} from "@/app/actions/shared-lms-materials";
import { finalizeLmsMaterialUpload } from "@/app/actions/lms-material-pipeline";

type StatusFilter = "all" | "in_progress" | "review" | "published" | "failed";

function formatBytes(value: number | null, locale: string) {
  if (value == null) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(size)} ${units[unit]}`;
}

function processingLabel(status: MaterialProcessingStatus, vi: boolean) {
  const labels: Record<MaterialProcessingStatus, [string, string]> = {
    uploading: ["Uploading", "Đang tải lên"],
    queued: ["Queued", "Đang chờ"],
    scanning: ["Safety check", "Đang kiểm tra"],
    converting: ["Preparing preview", "Đang tạo bản xem"],
    ready: ["Ready", "Sẵn sàng"],
    rejected: ["Rejected", "Bị từ chối"],
    failed: ["Needs attention", "Cần xử lý"],
  };
  return labels[status][vi ? 1 : 0];
}

function processingTone(status: MaterialProcessingStatus) {
  if (status === "ready")
    return "bg-success-container text-on-success-container";
  if (status === "failed" || status === "rejected")
    return "bg-error-container text-on-error-container";
  return "bg-warning-container text-on-warning-container";
}

function matchesFilter(material: TeacherMaterialSummary, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "in_progress")
    return ["uploading", "queued", "scanning", "converting"].includes(
      material.processingStatus,
    );
  if (filter === "review")
    return (
      material.processingStatus === "ready" &&
      (!material.rightsApproved || material.contentReviewStatus !== "approved")
    );
  if (filter === "failed")
    return ["failed", "rejected"].includes(material.processingStatus);
  return material.placements.some(
    (placement) => placement.status === "published",
  );
}

export function TeacherMaterialLibrary({
  locale,
  materials,
  targets,
  learnerPreviews,
  loadFailed = false,
  onUploadRequest,
  onReviewRequest,
  onPlaceRequest,
  clubId,
  scopeClassId,
}: {
  locale: string;
  materials: TeacherMaterialSummary[];
  targets: MaterialPlacementTarget[];
  learnerPreviews: LearnerMaterialProjection[];
  loadFailed?: boolean;
  onUploadRequest?: () => void;
  onReviewRequest?: (materialId: string) => void;
  onPlaceRequest?: (materialId: string) => void;
  clubId?: string;
  scopeClassId?: string;
}) {
  const vi = locale === "vi";
  const router = useRouter();
  const copy = materialCopy(locale);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(
    materials[0]?.materialId ?? null,
  );
  const [preview, setPreview] = useState<LearnerMaterialProjection | null>(
    null,
  );
  const [dialog, setDialog] = useState<
    "upload" | "rights" | "place" | "withdraw" | null
  >(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rightsBasis, setRightsBasis] = useState("original");
  const [rightsSourceUrl, setRightsSourceUrl] = useState("");
  const [rightsHolder, setRightsHolder] = useState("");
  const [rightsLicenseUrl, setRightsLicenseUrl] = useState("");
  const [rightsNotes, setRightsNotes] = useState("");
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [placementMode, setPlacementMode] = useState<"draft" | "scheduled">(
    "draft",
  );
  const [placementRequired, setPlacementRequired] = useState(false);
  const [releaseAt, setReleaseAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [approvedMaterialIds, setApprovedMaterialIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [contentApprovedVersionIds, setContentApprovedVersionIds] = useState<
    Set<string>
  >(() => new Set());
  const visible = useMemo(
    () =>
      materials.filter(
        (material) =>
          matchesFilter(material, filter) &&
          material.title
            .toLocaleLowerCase(locale)
            .includes(query.trim().toLocaleLowerCase(locale)),
      ),
    [filter, locale, materials, query],
  );
  const selected =
    materials.find((material) => material.materialId === selectedId) ??
    visible[0] ??
    null;
  const workflowMaterial = selected as TeacherMaterialSummary;
  const selectedRightsApproved = selected
    ? (selected.rightsApproved ?? approvedMaterialIds.has(selected.materialId))
    : null;
  const selectedContentApproved = selected
    ? selected.contentReviewStatus === "approved" ||
      contentApprovedVersionIds.has(selected.versionId)
    : false;
  const counts = {
    inProgress: materials.filter((item) => matchesFilter(item, "in_progress"))
      .length,
    review: materials.filter((item) => matchesFilter(item, "review")).length,
    published: materials.filter((item) => matchesFilter(item, "published"))
      .length,
  };

  const openLearnerPreview = (material: TeacherMaterialSummary) => {
    const learnerProjection = learnerPreviews.find(
      (item) =>
        item.materialId === material.materialId &&
        item.placementStatus === "published",
    );
    if (learnerProjection) setPreview(learnerProjection);
  };

  return (
    <ProductPageShell>
      <PageContainer size="wide" className="py-5 lg:py-7">
        <header className="flex flex-col gap-4 border-b border-outline-variant pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link
              href="/dashboard/teacher"
              className="type-label font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              ← {copy.teacherWorkspace}
            </Link>
            <h1 className="mt-2 type-heading-lg font-semibold text-on-surface">
              {copy.library}
            </h1>
            <p className="mt-1 type-body-sm text-on-surface-variant">
              {copy.libraryDescription}
            </p>
          </div>
          <Button
            onClick={() => {
              onUploadRequest?.();
              if (!onUploadRequest && clubId) setDialog("upload");
            }}
            disabled={!onUploadRequest && !clubId}
          >
            <Plus aria-hidden="true" />
            {copy.upload}
          </Button>
        </header>

        <section
          aria-label={vi ? "Tổng quan tài liệu" : "Material overview"}
          className="mt-4 grid overflow-hidden rounded-[10px] border border-outline-variant bg-surface sm:grid-cols-4"
        >
          {[
            [materials.length, vi ? "Tất cả" : "All materials", FileText],
            [counts.inProgress, vi ? "Đang xử lý" : "In progress", Loader2],
            [
              counts.review,
              vi ? "Cần duyệt quyền" : "Rights review",
              ShieldCheck,
            ],
            [counts.published, copy.published, CheckCircle2],
          ].map(([value, label, Icon], index) => {
            const MetricIcon = Icon as typeof FileText;
            return (
              <div
                key={String(label)}
                className={`flex min-h-20 items-center gap-3 px-4 py-3 ${index ? "border-t border-outline-variant sm:border-l sm:border-t-0" : ""}`}
              >
                <MetricIcon
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <p className="type-title-sm font-semibold tabular-nums text-on-surface">
                    {String(value)}
                  </p>
                  <p className="type-caption text-on-surface-variant">
                    {String(label)}
                  </p>
                </div>
              </div>
            );
          })}
        </section>

        {loadFailed ? (
          <p
            role="alert"
            className="mt-3 rounded-[10px] border border-error/25 bg-error-container px-3 py-2 type-caption text-on-error-container"
          >
            {vi
              ? "Không thể tải thư viện tài liệu. Hãy thử lại sau."
              : "The material library could not be loaded. Please try again."}
          </p>
        ) : !onUploadRequest && !clubId ? (
          <p
            role="status"
            className="mt-3 rounded-[10px] border border-info/25 bg-info-container px-3 py-2 type-caption text-on-info-container"
          >
            {copy.uploadUnavailable}
          </p>
        ) : null}

        <div className="mt-4 grid min-h-[32rem] overflow-hidden rounded-[10px] border border-outline-variant bg-surface xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-label={copy.library} className="min-w-0">
            <div className="flex flex-col gap-2 border-b border-outline-variant p-3 sm:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">{copy.search}</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={copy.search}
                  className="h-10 w-full rounded-[10px] border border-outline-variant bg-background pl-9 pr-3 type-body-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                />
              </label>
              <label className="relative">
                <span className="sr-only">{copy.filters}</span>
                <Filter
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
                  aria-hidden="true"
                />
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as StatusFilter)
                  }
                  className="h-10 min-w-44 appearance-none rounded-[10px] border border-outline-variant bg-background pl-9 pr-3 type-body-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <option value="all">{copy.allStatuses}</option>
                  <option value="in_progress">
                    {vi ? "Đang xử lý" : "In progress"}
                  </option>
                  <option value="review">{copy.rightsReview}</option>
                  <option value="published">{copy.published}</option>
                  <option value="failed">
                    {vi ? "Cần xử lý" : "Needs attention"}
                  </option>
                </select>
              </label>
            </div>
            {visible.length ? (
              <ul className="divide-y divide-outline-variant">
                {visible.map((material) => {
                  const published = material.placements.some(
                    (placement) => placement.status === "published",
                  );
                  return (
                    <li key={material.materialId}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(material.materialId)}
                        aria-current={
                          selected?.materialId === material.materialId
                            ? "true"
                            : undefined
                        }
                        className="grid min-h-16 w-full gap-2 px-3 py-3 text-left hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary aria-[current=true]:bg-primary-container/45 sm:grid-cols-[minmax(0,1fr)_9rem_8rem] sm:items-center"
                      >
                        <span className="min-w-0">
                          <span className="block truncate type-label font-semibold text-on-surface">
                            {material.title}
                          </span>
                          <span className="mt-0.5 block truncate type-caption text-on-surface-variant">
                            {[
                              material.sourceFileName,
                              formatBytes(material.sizeBytes, locale),
                            ]
                              .filter((value) => value && value !== "—")
                              .join(" · ") || "—"}
                          </span>
                        </span>
                        <span
                          className={`w-fit rounded-md px-2 py-1 type-caption font-semibold ${processingTone(material.processingStatus)}`}
                        >
                          {processingLabel(material.processingStatus, vi)}
                        </span>
                        <span className="type-caption text-on-surface-variant">
                          {published
                            ? copy.published
                            : material.placements.length
                              ? copy.scheduled
                              : copy.draft}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-4 rounded-[10px] border border-dashed border-outline-variant p-8 text-center type-body-sm text-on-surface-variant">
                {materials.length ? copy.noMatches : copy.noMaterials}
              </p>
            )}
          </section>

          <aside
            aria-label={vi ? "Chi tiết tài liệu" : "Material details"}
            className="border-t border-outline-variant bg-surface-container-low p-4 xl:border-l xl:border-t-0"
          >
            {selected ? (
              <div className="space-y-5">
                <div>
                  <p className="type-caption font-semibold uppercase tracking-widest text-primary">
                    {copy.processingStatus}
                  </p>
                  <h2 className="mt-1 type-heading-sm font-semibold text-on-surface">
                    {selected.title}
                  </h2>
                  <p className="mt-1 type-caption text-on-surface-variant">
                    {selected.description ?? selected.sourceFileName}
                  </p>
                </div>
                <dl className="divide-y divide-outline-variant rounded-[10px] border border-outline-variant bg-surface">
                  <div className="flex justify-between gap-3 px-3 py-2.5">
                    <dt className="type-caption text-on-surface-variant">
                      {copy.processingStatus}
                    </dt>
                    <dd className="type-caption font-semibold">
                      {processingLabel(selected.processingStatus, vi)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 px-3 py-2.5">
                    <dt className="type-caption text-on-surface-variant">
                      {copy.rights}
                    </dt>
                    <dd className="type-caption font-semibold">
                      {selectedRightsApproved === true
                        ? copy.rightsApproved
                        : selectedRightsApproved === false
                          ? copy.rightsReview
                          : "—"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 px-3 py-2.5">
                    <dt className="type-caption text-on-surface-variant">
                      {copy.placement}
                    </dt>
                    <dd className="type-caption font-semibold tabular-nums">
                      {selected.placements.length}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 px-3 py-2.5">
                    <dt className="type-caption text-on-surface-variant">
                      {copy.updated}
                    </dt>
                    <dd className="type-caption font-semibold">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                      }).format(new Date(selected.updatedAt))}
                    </dd>
                  </div>
                </dl>
                {selected.placements.length ? (
                  <section>
                    <h3 className="type-label font-semibold text-on-surface">
                      {copy.placement}
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {selected.placements.map((placement) => (
                        <li
                          key={placement.id}
                          className="rounded-[10px] border border-outline-variant bg-surface p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="type-label font-semibold">
                              {placement.targetLabel}
                            </p>
                            <span className="rounded-md bg-surface-container px-2 py-0.5 type-caption font-semibold">
                              {placement.status === "published"
                                ? copy.published
                                : placement.status === "scheduled"
                                  ? copy.scheduled
                                  : copy.draft}
                            </span>
                          </div>
                          <p className="mt-1 type-caption text-on-surface-variant">
                            {placement.required ? copy.required : copy.optional}
                            {placement.audienceCount != null
                              ? ` · ${placement.audienceCount} ${copy.audience.toLocaleLowerCase(locale)}`
                              : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
                {selectedRightsApproved === false ? (
                  <div className="flex gap-2 rounded-[10px] border border-warning/25 bg-warning-container p-3 type-caption text-on-warning-container">
                    <AlertTriangle
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <p>
                      {vi
                        ? "Phải duyệt quyền sử dụng trước khi xuất bản."
                        : "Rights must be approved before this material can be published."}
                    </p>
                  </div>
                ) : null}
                {selected.processingStatus === "ready" &&
                !selectedContentApproved ? (
                  <div className="flex gap-2 rounded-[10px] border border-warning/25 bg-warning-container p-3 type-caption text-on-warning-container">
                    <AlertTriangle
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <p>
                      {vi
                        ? "Giáo viên phải kiểm tra và duyệt nội dung đã chuyển đổi trước khi xuất bản."
                        : "A teacher must review and approve the converted learner content before publishing."}
                    </p>
                  </div>
                ) : null}
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      onReviewRequest?.(selected.materialId);
                      if (!onReviewRequest) setDialog("rights");
                    }}
                    disabled={!onReviewRequest && !selected.versionId}
                  >
                    <ShieldCheck aria-hidden="true" />
                    {copy.review}
                  </Button>
                  {selected.processingStatus === "ready" ? (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        setBusy(true);
                        setMessage(null);
                        try {
                          await reviewSharedLmsMaterialContent({
                            materialId: selected.materialId,
                            versionId: selected.versionId,
                            decision: "approved",
                            note: vi
                              ? "Giáo viên đã duyệt nội dung chuyển đổi."
                              : "Teacher approved the converted learner content.",
                          });
                          setContentApprovedVersionIds((current) =>
                            new Set(current).add(selected.versionId),
                          );
                          setMessage(
                            vi
                              ? "Đã duyệt nội dung cho học sinh."
                              : "Learner content approved.",
                          );
                          router.refresh();
                        } catch {
                          setMessage(
                            vi
                              ? "Không thể duyệt nội dung."
                              : "Could not approve the learner content.",
                          );
                        } finally {
                          setBusy(false);
                        }
                      }}
                      disabled={busy || selectedContentApproved}
                    >
                      <CheckCircle2 aria-hidden="true" />
                      {selectedContentApproved
                        ? vi
                          ? "Nội dung đã duyệt"
                          : "Content approved"
                        : vi
                          ? "Duyệt nội dung chuyển đổi"
                          : "Approve converted content"}
                    </Button>
                  ) : null}
                  <Button
                    onClick={() => {
                      onPlaceRequest?.(selected.materialId);
                      if (!onPlaceRequest) setDialog("place");
                    }}
                    disabled={
                      (!onPlaceRequest && !targets.length) ||
                      selected.processingStatus !== "ready"
                    }
                  >
                    <Plus aria-hidden="true" />
                    {copy.place}
                  </Button>
                  {selected.placements
                    .filter(
                      (item) =>
                        item.status === "draft" || item.status === "scheduled",
                    )
                    .map((placement) => (
                      <Button
                        key={placement.id}
                        variant="outline"
                        onClick={async () => {
                          setBusy(true);
                          setMessage(null);
                          try {
                            await publishSharedLmsMaterial({
                              materialId: selected.materialId,
                              placementId: placement.id,
                            });
                            setMessage(vi ? "Đã xuất bản." : "Published.");
                            router.refresh();
                          } catch {
                            setMessage(
                              vi
                                ? "Không thể xuất bản tài liệu."
                                : "Could not publish this material.",
                            );
                          } finally {
                            setBusy(false);
                          }
                        }}
                        disabled={
                          busy ||
                          selectedRightsApproved !== true ||
                          !selectedContentApproved
                        }
                      >
                        <CheckCircle2 aria-hidden="true" />
                        {copy.release}
                      </Button>
                    ))}
                  {selected.placements.some(
                    (item) => item.status === "published",
                  ) ? (
                    <Button
                      variant="outline"
                      onClick={() => setDialog("withdraw")}
                      disabled={busy}
                    >
                      {copy.withdraw}
                    </Button>
                  ) : null}
                  <Button
                    variant="outline"
                    disabled={
                      !learnerPreviews.some(
                        (item) =>
                          item.materialId === selected.materialId &&
                          item.placementStatus === "published",
                      )
                    }
                    onClick={() => openLearnerPreview(selected)}
                  >
                    <Eye aria-hidden="true" />
                    {copy.viewStudent}
                  </Button>
                </div>
                {!targets.length ? (
                  <p className="type-caption text-on-surface-variant">
                    {vi
                      ? "Chưa có lớp hoặc bài học phù hợp để đặt tài liệu."
                      : "No eligible class or lesson targets are available."}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="type-body-sm text-on-surface-variant">
                {copy.noMaterials}
              </p>
            )}
          </aside>
        </div>
        <ThinkfyMaterialViewer
          material={preview}
          locale={locale}
          open={Boolean(preview)}
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
        />
        {dialog ? (
          <Dialog
            open={dialog !== null}
            onOpenChange={(open) => {
              if (!open && !busy) setDialog(null);
            }}
          >
            <DialogContent
              showCloseButton={!busy}
              className="w-[calc(100vw-2rem)] max-w-lg rounded-xl border border-outline-variant bg-surface p-5 shadow-xl motion-reduce:duration-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <DialogTitle className="type-title font-semibold text-on-surface">
                    {dialog === "upload"
                      ? copy.upload
                      : dialog === "rights"
                        ? copy.review
                        : dialog === "place"
                          ? copy.place
                          : copy.withdraw}
                  </DialogTitle>
                  <DialogDescription className="mt-1 type-caption text-on-surface-variant">
                    {message ??
                      (vi
                        ? "Kiểm tra thông tin trước khi tiếp tục."
                        : "Review the details before continuing.")}
                  </DialogDescription>
                </div>
              </div>
              {dialog === "upload" ? (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    if (!file || !clubId) return;
                    setBusy(true);
                    setMessage(null);
                    try {
                      const reservation = await prepareSharedMaterialUpload({
                        clubId,
                        scopeClassId: scopeClassId ?? null,
                        fileName: file.name,
                        mimeType: file.type,
                        sizeBytes: file.size,
                        idempotencyKey: crypto.randomUUID(),
                      });
                      const payload = new FormData();
                      payload.append("cacheControl", "3600");
                      payload.append("", file);
                      const response = await fetch(reservation.signedUrl, {
                        method: "PUT",
                        headers: { "x-upsert": "false" },
                        body: payload,
                      });
                      if (!response.ok) throw new Error("material_upload_failed");
                      await finalizeLmsMaterialUpload({
                        ingestionId: reservation.versionId,
                      });
                      setMessage(
                        vi
                          ? "Đã tải lên; tài liệu đang được xử lý."
                          : "Uploaded; the material is being prepared.",
                      );
                      setFile(null);
                      router.refresh();
                    } catch {
                      setMessage(
                        vi
                          ? "Không thể tải tệp lên. Hãy thử lại."
                          : "Upload failed. Please try again.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="block type-label font-medium text-on-surface">
                    <span>{vi ? "Tệp" : "File"}</span>
                    <input
                      autoFocus
                      required
                      type="file"
                      onChange={(event) =>
                        setFile(event.target.files?.[0] ?? null)
                      }
                      className="mt-2 block w-full type-body-sm"
                    />
                  </label>
                  <Button type="submit" disabled={busy || !file}>
                    {busy ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus aria-hidden="true" />
                    )}
                    {copy.upload}
                  </Button>
                </form>
              ) : dialog === "rights" ? (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setBusy(true);
                    setMessage(null);
                    try {
                      await approveSharedMaterialRights({
                        materialId: workflowMaterial.materialId,
                        versionId: workflowMaterial.versionId,
                        basis: rightsBasis,
                        sourceUrl: rightsSourceUrl || null,
                        rightsHolder: rightsHolder || null,
                        licenseUrl: rightsLicenseUrl || null,
                        notes: rightsNotes || null,
                      });
                      setMessage(
                        vi ? "Đã lưu quyền sử dụng." : "Rights review saved.",
                      );
                      setApprovedMaterialIds((current) =>
                        new Set(current).add(workflowMaterial.materialId),
                      );
                      router.refresh();
                    } catch {
                      setMessage(
                        vi
                          ? "Không thể lưu quyền sử dụng."
                          : "Rights review failed.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="block type-label font-medium text-on-surface">
                    {vi ? "Cơ sở quyền sử dụng" : "Rights basis"}
                    <select
                      autoFocus
                      value={rightsBasis}
                      onChange={(event) => setRightsBasis(event.target.value)}
                      className="mt-2 h-10 w-full rounded-[10px] border border-outline-variant bg-background px-3 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {[
                        "original",
                        "commercial_license",
                        "open_license",
                        "internal_adaptation",
                        "unknown",
                      ].map((value) => (
                        <option key={value} value={value}>
                          {
                            (
                              {
                                original: vi ? "Nội dung gốc" : "Original work",
                                commercial_license: vi
                                  ? "Giấy phép thương mại"
                                  : "Commercial license",
                                open_license: vi
                                  ? "Giấy phép mở"
                                  : "Open license",
                                internal_adaptation: vi
                                  ? "Bản điều chỉnh nội bộ"
                                  : "Internal adaptation",
                                unknown: vi ? "Chưa xác định" : "Unknown",
                              } as Record<string, string>
                            )[value]
                          }
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block type-label font-medium text-on-surface">
                    {vi ? "Chủ sở hữu quyền" : "Rights holder"}
                    <input
                      value={rightsHolder}
                      onChange={(event) => setRightsHolder(event.target.value)}
                      className="mt-2 h-10 w-full rounded-[10px] border border-outline-variant bg-background px-3 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                  <label className="block type-label font-medium text-on-surface">
                    {vi ? "Nguồn" : "Source URL"}
                    <input
                      type="url"
                      value={rightsSourceUrl}
                      onChange={(event) =>
                        setRightsSourceUrl(event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-[10px] border border-outline-variant bg-background px-3 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                  <label className="block type-label font-medium text-on-surface">
                    {vi ? "Liên kết giấy phép" : "License URL"}
                    <input
                      type="url"
                      value={rightsLicenseUrl}
                      onChange={(event) =>
                        setRightsLicenseUrl(event.target.value)
                      }
                      className="mt-2 h-10 w-full rounded-[10px] border border-outline-variant bg-background px-3 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                  <label className="block type-label font-medium text-on-surface">
                    {vi ? "Ghi chú duyệt" : "Review notes"}
                    <textarea
                      value={rightsNotes}
                      onChange={(event) => setRightsNotes(event.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-[10px] border border-outline-variant bg-background px-3 py-2 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                  <Button type="submit" disabled={busy}>
                    {busy ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <ShieldCheck aria-hidden="true" />
                    )}
                    {copy.review}
                  </Button>
                </form>
              ) : dialog === "place" ? (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const target = targets.find((item) => item.id === targetId);
                    if (!target) return;
                    setBusy(true);
                    setMessage(null);
                    try {
                      await placeSharedLmsMaterial({
                        materialId: workflowMaterial.materialId,
                        versionId: workflowMaterial.versionId,
                        targetType: target.type,
                        [`${target.type}Id`]: target.id,
                        status: placementMode,
                        releaseAt:
                          placementMode === "scheduled" && releaseAt
                            ? new Date(releaseAt).toISOString()
                            : null,
                        expiresAt: expiresAt
                          ? new Date(expiresAt).toISOString()
                          : null,
                        required: placementRequired,
                        orderIndex: 0,
                        audienceUserIds: [],
                        rules: [],
                      });
                      setMessage(
                        vi
                          ? placementMode === "scheduled"
                            ? "Đã lên lịch phát hành."
                            : "Đã tạo vị trí bản nháp."
                          : placementMode === "scheduled"
                            ? "Release scheduled."
                            : "Draft placement created.",
                      );
                      router.refresh();
                    } catch {
                      setMessage(
                        vi ? "Không thể đặt tài liệu." : "Placement failed.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="block type-label font-medium text-on-surface">
                    {vi ? "Lớp hoặc bài học" : "Class or lesson"}
                    <select
                      autoFocus
                      required
                      value={targetId}
                      onChange={(event) => setTargetId(event.target.value)}
                      className="mt-2 h-10 w-full rounded-[10px] border border-outline-variant bg-background px-3 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {targets.map((target) => (
                        <option key={target.id} value={target.id}>
                          {target.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block type-label font-medium text-on-surface">
                    {copy.placementStatus}
                    <select
                      value={placementMode}
                      onChange={(event) =>
                        setPlacementMode(
                          event.target.value as "draft" | "scheduled",
                        )
                      }
                      className="mt-2 h-10 w-full rounded-[10px] border border-outline-variant bg-background px-3 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <option value="draft">{copy.draft}</option>
                      <option value="scheduled">{copy.scheduled}</option>
                    </select>
                  </label>
                  {placementMode === "scheduled" ? (
                    <label className="block type-label font-medium text-on-surface">
                      {vi ? "Thời điểm phát hành" : "Release date and time"}
                      <input
                        required
                        type="datetime-local"
                        value={releaseAt}
                        onChange={(event) => setReleaseAt(event.target.value)}
                        className="mt-2 h-10 w-full rounded-[10px] border border-outline-variant bg-background px-3 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      />
                    </label>
                  ) : null}
                  <label className="block type-label font-medium text-on-surface">
                    {vi
                      ? "Thời điểm hết hạn (không bắt buộc)"
                      : "Expiry date and time (optional)"}
                    <input
                      type="datetime-local"
                      value={expiresAt}
                      onChange={(event) => setExpiresAt(event.target.value)}
                      className="mt-2 h-10 w-full rounded-[10px] border border-outline-variant bg-background px-3 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                  <label className="flex min-h-10 items-center gap-2 type-label font-medium text-on-surface">
                    <input
                      type="checkbox"
                      checked={placementRequired}
                      onChange={(event) =>
                        setPlacementRequired(event.target.checked)
                      }
                      className="size-4 rounded border-outline-variant accent-primary"
                    />
                    {copy.required}
                  </label>
                  <Button type="submit" disabled={busy}>
                    {busy ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus aria-hidden="true" />
                    )}
                    {copy.place}
                  </Button>
                </form>
              ) : (
                <form
                  className="mt-4 space-y-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const placement = workflowMaterial.placements.find(
                      (item) => item.status === "published",
                    );
                    if (!placement || !withdrawReason.trim()) return;
                    setBusy(true);
                    try {
                      await withdrawSharedLmsMaterial({
                        placementId: placement.id,
                        reason: withdrawReason,
                      });
                      setMessage(
                        vi ? "Đã rút tài liệu." : "Material withdrawn.",
                      );
                      router.refresh();
                    } catch {
                      setMessage(
                        vi
                          ? "Không thể rút tài liệu."
                          : "Could not withdraw material.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <label className="block type-label font-medium text-on-surface">
                    {vi ? "Lý do" : "Reason"}
                    <textarea
                      autoFocus
                      required
                      value={withdrawReason}
                      onChange={(event) =>
                        setWithdrawReason(event.target.value)
                      }
                      className="mt-2 min-h-24 w-full rounded-[10px] border border-outline-variant bg-background p-3 type-body-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    />
                  </label>
                  <Button
                    type="submit"
                    disabled={busy || !withdrawReason.trim()}
                  >
                    {busy ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <AlertTriangle aria-hidden="true" />
                    )}
                    {vi ? "Xác nhận" : "Confirm"}
                  </Button>
                </form>
              )}
            </DialogContent>
          </Dialog>
        ) : null}
      </PageContainer>
    </ProductPageShell>
  );
}
