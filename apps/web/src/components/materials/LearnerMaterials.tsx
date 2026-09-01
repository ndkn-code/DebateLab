"use client";

import { useId, useState } from "react";
import { FileText, ImagePlus, Lock, Volume2 } from "@/components/ui/icons";
import { materialCopy } from "./material-copy";
import { ThinkfyMaterialViewer } from "./ThinkfyMaterialViewer";
import type { LearnerMaterialProjection } from "./material-ui-model";

function statusLabel(material: LearnerMaterialProjection, locale: string) {
  const copy = materialCopy(locale);
  if (material.placementStatus === "withdrawn") return copy.withdrawn;
  if (material.placementStatus === "scheduled") return copy.scheduled;
  if (material.placementStatus === "draft") return copy.draft;
  if (material.processingStatus === "rejected") return copy.rejected;
  if (material.processingStatus === "failed") return copy.failed;
  if (material.processingStatus !== "ready") return copy.processing;
  return material.required ? copy.required : copy.optional;
}

function MaterialKindIcon({
  kind,
}: {
  kind: LearnerMaterialProjection["mediaKind"];
}) {
  if (kind === "audio")
    return <Volume2 className="size-4" aria-hidden="true" />;
  if (kind === "image")
    return <ImagePlus className="size-4" aria-hidden="true" />;
  return <FileText className="size-4" aria-hidden="true" />;
}

export function LearnerMaterials({
  materials,
  locale,
  title,
  emptyMessage,
  compact = false,
}: {
  materials: LearnerMaterialProjection[];
  locale: string;
  title?: string;
  emptyMessage?: string;
  compact?: boolean;
}) {
  const copy = materialCopy(locale);
  const headingId = useId();
  const [selected, setSelected] = useState<LearnerMaterialProjection | null>(
    null,
  );
  return (
    <section aria-labelledby={headingId}>
      <div className="flex items-center justify-between gap-3">
        <h2
          id={headingId}
          className="type-heading-sm font-semibold text-on-surface"
        >
          {title ?? copy.materials}
        </h2>
        {materials.length ? (
          <span className="type-caption tabular-nums text-on-surface-variant">
            {materials.length}
          </span>
        ) : null}
      </div>
      {materials.length ? (
        <ul className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
          {materials.map((material) => {
            const unavailable =
              material.placementStatus !== "published" ||
              material.processingStatus !== "ready" ||
              material.accessState !== "available";
            return (
              <li key={material.placementId}>
                <button
                  type="button"
                  onClick={() => setSelected(material)}
                  className="group flex min-h-11 w-full items-center gap-3 rounded-control border border-outline-variant bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none"
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${unavailable ? "bg-surface-container text-on-surface-variant" : "bg-primary-container text-primary"}`}
                  >
                    {unavailable ? (
                      <Lock className="size-4" aria-hidden="true" />
                    ) : (
                      <MaterialKindIcon kind={material.mediaKind} />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-label font-semibold text-on-surface">
                      {material.title}
                    </span>
                    <span className="mt-0.5 block truncate type-caption text-on-surface-variant">
                      {[material.lessonTitle, statusLabel(material, locale)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="type-caption font-semibold text-primary group-hover:underline">
                    {copy.open}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 rounded-control border border-dashed border-outline-variant p-5 text-center type-body-sm text-on-surface-variant">
          {emptyMessage ?? copy.noMaterials}
        </p>
      )}
      <ThinkfyMaterialViewer
        material={selected}
        locale={locale}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </section>
  );
}
