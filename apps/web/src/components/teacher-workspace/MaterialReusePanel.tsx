"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
} from "@/components/ui/icons";
import type { TeacherWorkspacePresentation } from "@/lib/teacher-workspace/presentation";
import type { ManagerMaterialRow } from "@/lib/api/class-lms/materials-repository";
import {
  loadReusableClassMaterials,
  publishReusableClassMaterial,
} from "@/app/actions/class-lms";
import { newTeacherWorkspaceIdempotencyKey } from "@/lib/teacher-workspace/write-seam";

/**
 * Source provenance: adapted from Lumist's ClassMaterialList; placement and
 * publishing use Thinkfy's existing shared-material contracts. Compact
 * selectable rows and an explicit release action replace the source brand,
 * native controls, and copy with Thinkfy's semantic workbench system.
 */

const DEMO_MATERIALS: ManagerMaterialRow[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    versionId: "22222222-2222-4222-8222-222222222222",
    title: "Argument map worksheet",
    description: "A short planning sheet for the next class debate.",
    processingStatus: "ready",
    contentReviewStatus: "approved",
    rightsApproved: true,
    nativeDocument: null,
    versionNumber: 1,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    placements: [],
  },
];

const DEMO_MATERIALS_VI: ManagerMaterialRow[] = DEMO_MATERIALS.map(
  (material) => ({
    ...material,
    title: "Phiếu lập luận",
    description: "Phiếu ngắn để chuẩn bị cho buổi tranh biện tiếp theo.",
  }),
);

type Props = {
  locale: string;
  classes: TeacherWorkspacePresentation["classes"];
  defaultClassId?: string;
  demo?: boolean;
};

function isEligible(material: ManagerMaterialRow) {
  return (
    material.processingStatus === "ready" &&
    material.rightsApproved &&
    material.contentReviewStatus === "approved"
  );
}

export function MaterialReusePanel({
  locale,
  classes,
  defaultClassId,
  demo = false,
}: Props) {
  const vi = locale === "vi";
  const router = useRouter();
  const [destinationId, setDestinationId] = useState(
    defaultClassId ?? classes[0]?.id ?? "",
  );
  const [materials, setMaterials] = useState<ManagerMaterialRow[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(!demo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [existingPlacement, setExistingPlacement] = useState<string | null>(
    null,
  );
  const [existingPlacementStatus, setExistingPlacementStatus] = useState<
    ManagerMaterialRow["placements"][number]["status"] | null
  >(null);
  const [demoPublished, setDemoPublished] = useState(false);
  const requestSequence = useRef(0);
  const saveGuard = useRef<string | null>(null);
  const idempotencyKeys = useRef(new Map<string, string>());

  const destination = classes.find((item) => item.id === destinationId);

  const load = useCallback(
    async (cursor: string | null = null) => {
      const sequence = ++requestSequence.current;
      if (demo) {
        if (sequence !== requestSequence.current) return;
        const demoMaterials = vi ? DEMO_MATERIALS_VI : DEMO_MATERIALS;
        setMaterials((current) => (cursor ? current : demoMaterials));
        setSelectedId((current) => current || demoMaterials[0]?.id || "");
        setNextCursor(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      if (!cursor) setError(null);
      try {
        const result = await loadReusableClassMaterials({
          classId: destinationId,
          locale,
          cursor,
        });
        if (sequence !== requestSequence.current) return;
        if (!result.ok) {
          setError(result.message);
          return;
        }
        const eligible = result.data.rows.filter(isEligible);
        setMaterials((current) =>
          cursor ? [...current, ...eligible] : eligible,
        );
        setNextCursor(result.data.nextCursor);
        if (!cursor) {
          setSelectedId((current) =>
            eligible.some((item) => item.id === current)
              ? current
              : (eligible[0]?.id ?? ""),
          );
        }
      } catch {
        if (sequence === requestSequence.current)
          setError(
            vi
              ? "Mất kết nối. Hãy thử tải lại thư viện."
              : "Connection lost. Retry loading the library.",
          );
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [demo, destinationId, locale, vi],
  );

  useEffect(() => {
    setMaterials([]);
    setSelectedId("");
    setNextCursor(null);
    setNotice(null);
    setError(null);
    setExistingPlacement(null);
    setExistingPlacementStatus(null);
    setDemoPublished(false);
    saveGuard.current = null;
    void load();
  }, [load]);

  useEffect(() => {
    const material = materials.find((item) => item.id === selectedId);
    const placement = material?.placements.find(
      (item) => item.targetType === "class" && item.targetId === destinationId,
    );
    setExistingPlacement(
      demo && demoPublished ? "demo-published" : (placement?.id ?? null),
    );
    setExistingPlacementStatus(
      demo && demoPublished ? "published" : (placement?.status ?? null),
    );
  }, [demo, demoPublished, destinationId, materials, selectedId]);

  useEffect(() => {
    setNotice(null);
    setError(null);
    saveGuard.current = null;
  }, [destinationId, selectedId]);

  const visibleMaterials = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(locale);
    return materials.filter((item) =>
      needle ? item.title.toLocaleLowerCase(locale).includes(needle) : true,
    );
  }, [locale, materials, query]);

  const selected = materials.find((item) => item.id === selectedId) ?? null;

  async function publish() {
    if (!selected || !destination || busy) return;
    if (
      existingPlacementStatus === "published" ||
      existingPlacementStatus === "scheduled" ||
      existingPlacementStatus === "withdrawn"
    )
      return;
    const saveScope = `${destination.id}:${selected.id}:${selected.versionId}`;
    if (saveGuard.current === saveScope) return;
    saveGuard.current = saveScope;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (demo) {
        setDemoPublished(true);
        setExistingPlacement("demo-published");
        setExistingPlacementStatus("published");
      } else {
        const key =
          idempotencyKeys.current.get(saveScope) ??
          newTeacherWorkspaceIdempotencyKey("reuse-material");
        idempotencyKeys.current.set(saveScope, key);
        const result = await publishReusableClassMaterial({
          classId: destination.id,
          materialId: selected.id,
          versionId: selected.versionId,
          locale,
          idempotencyKey: key,
        });
        if (!result.ok) {
          setError(result.message);
          return;
        }
        setExistingPlacement(result.data.placementId);
        setExistingPlacementStatus(result.data.status);
        if (result.data.alreadyPublished) {
          setNotice(
            vi
              ? "Tài liệu này đã được đăng cho lớp."
              : "This material is already published to the class.",
          );
        } else {
          setNotice(
            vi
              ? `Đã xuất bản “${selected.title}” cho tất cả học viên trong lớp.`
              : `“${selected.title}” is published for every learner in the class.`,
          );
        }
      }
      if (demo) {
        setNotice(
          vi
            ? `Đã xuất bản “${selected.title}” cho tất cả học viên trong lớp.`
            : `“${selected.title}” is published for every learner in the class.`,
        );
      }
      if (!demo) {
        await load();
        router.refresh();
      }
    } catch {
      setError(
        vi
          ? "Mất kết nối. Hãy thử lại để kiểm tra trạng thái xuất bản."
          : "Connection lost. Retry to check the publishing status.",
      );
    } finally {
      setBusy(false);
      saveGuard.current = null;
    }
  }

  return (
    <section
      className="mt-4 rounded-control border border-outline-variant bg-surface p-4"
      aria-labelledby="material-reuse-title"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="type-eyebrow text-primary">
            {vi ? "THƯ VIỆN" : "LIBRARY"}
          </p>
          <h2
            id="material-reuse-title"
            className="mt-1 type-title text-on-surface"
          >
            {vi ? "Dùng lại tài liệu dạy học" : "Reuse a teaching material"}
          </h2>
          <p className="mt-1 type-body-sm text-on-surface-variant">
            {vi
              ? "Chọn tài liệu đã được duyệt và lớp nhận tài liệu."
              : "Choose an approved material and the class that should receive it."}
          </p>
        </div>
        {notice ? (
          <div
            className="flex items-start gap-2 rounded-md bg-success-container px-3 py-2 type-caption text-on-success-container"
            role="status"
          >
            <CheckCircle2 aria-hidden="true" />
            <span>{notice}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)]">
        <label className="block type-label text-on-surface">
          {vi ? "Tìm tài liệu" : "Find a material"}
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            disabled={busy}
            placeholder={vi ? "Tên tài liệu" : "Material title"}
            className="mt-1 h-9 w-full rounded-control border border-outline-variant bg-surface-container-lowest px-3 type-body-sm text-on-surface outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="block type-label text-on-surface">
          {vi ? "Lớp nhận tài liệu" : "Destination class"}
          <Select
            value={destinationId}
            onChange={(event) => setDestinationId(event.target.value)}
            disabled={busy}
            className="mt-1 h-9"
            aria-label={
              vi ? "Chọn lớp nhận tài liệu" : "Choose a destination class"
            }
          >
            {classes.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </Select>
        </label>
      </div>

      {loading ? (
        <div
          className="mt-4 flex items-center gap-2 type-body-sm text-on-surface-variant"
          role="status"
        >
          <Loader2 className="animate-spin" aria-hidden="true" />
          {vi ? "Đang tải tài liệu…" : "Loading materials…"}
        </div>
      ) : error && materials.length === 0 ? (
        <div
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-error bg-error-container px-3 py-3 type-body-sm text-on-error-container"
          role="alert"
        >
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load()}
            disabled={busy}
          >
            <RefreshCw aria-hidden="true" />
            {vi ? "Thử lại" : "Retry"}
          </Button>
        </div>
      ) : visibleMaterials.length === 0 ? (
        <div className="mt-4 rounded-md border border-outline-variant bg-surface-container-low px-3 py-4 type-body-sm text-on-surface-variant">
          {vi
            ? "Chưa có tài liệu đủ điều kiện để dùng lại."
            : "No approved, ready materials are available to reuse."}
        </div>
      ) : (
        <div
          className="mt-4 grid gap-2"
          role="listbox"
          aria-label={vi ? "Tài liệu đủ điều kiện" : "Eligible materials"}
        >
          {visibleMaterials.map((material) => {
            const active = material.id === selectedId;
            const placement = material.placements.find(
              (item) =>
                item.targetType === "class" && item.targetId === destinationId,
            );
            return (
              <button
                key={material.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => setSelectedId(material.id)}
                disabled={busy}
                className={`flex min-w-0 items-start gap-3 rounded-md border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary bg-primary-container" : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low"}`}
              >
                <FileText
                  className="mt-0.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-body font-medium text-on-surface">
                    {material.title}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 type-caption text-on-surface-variant">
                    {material.description ??
                      (vi
                        ? "Tài liệu đã duyệt quyền và nội dung."
                        : "Rights and content approved.")}
                  </span>
                </span>
                {placement?.status === "published" ? (
                  <span className="shrink-0 type-caption text-success">
                    {vi ? "Đã đăng" : "Published"}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      {nextCursor && !loading ? (
        <div className="mt-3 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void load(nextCursor)}
            disabled={busy}
          >
            {vi ? "Tải thêm" : "Load more"}
          </Button>
        </div>
      ) : null}

      {selected && destination ? (
        <div className="mt-4 border-t border-outline-variant pt-4">
          <div className="flex items-start gap-2 type-body-sm text-on-surface">
            <ShieldCheck
              className="mt-0.5 shrink-0 text-primary"
              aria-hidden="true"
            />
            <p>
              {vi
                ? `Sẽ đăng cho tất cả học viên của lớp “${destination.title}”.`
                : `This will publish to all learners in “${destination.title}”.`}
            </p>
          </div>
          {existingPlacement ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-success-container px-3 py-3 type-body-sm text-on-success-container">
              <span>
                {existingPlacementStatus === "published"
                  ? vi
                    ? "Tài liệu này đã được đăng cho lớp."
                    : "This material is already published to the class."
                  : existingPlacementStatus === "draft"
                    ? vi
                      ? "Bản nháp đã có. Bạn có thể đăng lại."
                      : "A draft is ready. You can publish it now."
                    : vi
                      ? "Tài liệu này chưa thể đăng lại trong lớp."
                      : "This material is unavailable for another release."}
              </span>
              <Link
                className="type-label font-medium underline"
                href={`/dashboard/materials?classId=${destination.id}`}
              >
                {vi ? "Mở tài liệu của học viên" : "Open learner materials"}
              </Link>
            </div>
          ) : null}
          {error && materials.length > 0 ? (
            <p className="mt-3 type-body-sm text-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="mt-3 flex justify-end">
            <Button
              variant="primary"
              onClick={() => void publish()}
              disabled={
                busy ||
                existingPlacementStatus === "published" ||
                existingPlacementStatus === "scheduled" ||
                existingPlacementStatus === "withdrawn"
              }
            >
              {busy ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <CheckCircle2 aria-hidden="true" />
              )}
              {busy
                ? vi
                  ? "Đang xuất bản…"
                  : "Publishing…"
                : vi
                  ? "Xác nhận và đăng"
                  : "Confirm and publish"}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
