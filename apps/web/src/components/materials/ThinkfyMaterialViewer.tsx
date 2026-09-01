"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { MaterialDocumentRenderer } from "./MaterialDocumentRenderer";
import { materialCopy } from "./material-copy";
import {
  isPreviewExpired,
  previewUrl,
  type LearnerMaterialProjection,
} from "./material-ui-model";

function ViewerMessage({
  tone = "neutral",
  children,
  action,
}: {
  tone?: "neutral" | "error";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`mx-auto flex max-w-md flex-col items-center gap-3 rounded-control border p-6 text-center ${tone === "error" ? "border-error/25 bg-error-container text-on-error-container" : "border-outline-variant bg-surface text-on-surface"}`}
    >
      <AlertCircle className="size-5" aria-hidden="true" />
      <p className="type-body-sm">{children}</p>
      {action}
    </div>
  );
}

export function ThinkfyMaterialViewer({
  material,
  locale,
  open,
  onOpenChange,
  onRefresh,
}: {
  material: LearnerMaterialProjection | null;
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}) {
  const copy = materialCopy(locale);
  const [page, setPage] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const pageRenditions = useMemo(
    () =>
      material?.renditions
        .filter((item) => item.preview.renditionKind === "page_image")
        .sort(
          (left, right) =>
            (left.preview.pageNumber ?? 0) - (right.preview.pageNumber ?? 0),
        ) ?? [],
    [material],
  );

  if (!material) return null;
  const descriptor = material.preview;
  const descriptorUrl = previewUrl(descriptor);
  const placementUnavailable =
    material.placementStatus !== "published" ||
    material.accessState === "locked";
  const inProgress = ["uploading", "queued", "scanning", "converting"].includes(
    material.processingStatus,
  );
  const failed =
    material.processingStatus === "failed" ||
    material.processingStatus === "rejected";
  const expired = descriptor ? isPreviewExpired(descriptor) : false;
  const currentPage = pageRenditions[page];
  const currentPageUrl = previewUrl(currentPage?.preview);

  const retry = onRefresh ? (
    <Button
      variant="outline"
      onClick={() => {
        setLoadFailed(false);
        onRefresh();
      }}
    >
      <RefreshCw aria-hidden="true" />
      {copy.retry}
    </Button>
  ) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setPage(0);
          setLoadFailed(false);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton
        aria-describedby="material-viewer-description"
        className="flex h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden rounded-xl border border-outline-variant bg-background p-0 shadow-2xl sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-[80rem] motion-reduce:duration-0"
      >
        <header className="shrink-0 border-b border-outline-variant bg-surface px-4 py-3 pr-12 sm:px-6">
          <p className="type-caption font-semibold uppercase tracking-widest text-primary">
            Thinkfy · {copy.materials}
          </p>
          <DialogTitle className="mt-1 truncate type-title font-semibold text-on-surface">
            {material.title}
          </DialogTitle>
          <DialogDescription
            id="material-viewer-description"
            className="mt-1 type-caption text-on-surface-variant"
          >
            {[
              material.lessonTitle,
              material.required ? copy.required : copy.optional,
            ]
              .filter(Boolean)
              .join(" · ")}
          </DialogDescription>
          {descriptor?.watermark.learnerLabel ? (
            <p className="mt-1 type-caption text-on-surface-variant">
              {[
                descriptor.watermark.learnerLabel,
                descriptor.watermark.classLabel,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </header>

        <main className="min-h-0 flex-1 overflow-auto p-3 sm:p-6">
          {placementUnavailable ? (
            <ViewerMessage>
              {material.placementStatus === "withdrawn"
                ? copy.withdrawn
                : (material.lockReasons[0] ?? copy.previewUnavailable)}
            </ViewerMessage>
          ) : inProgress ? (
            <ViewerMessage>{copy.processing}</ViewerMessage>
          ) : failed ? (
            <ViewerMessage tone="error" action={retry}>
              {material.processingStatus === "rejected"
                ? copy.rejected
                : copy.failed}
            </ViewerMessage>
          ) : expired ? (
            <ViewerMessage tone="error" action={retry}>
              {copy.previewExpired}
            </ViewerMessage>
          ) : loadFailed ? (
            <ViewerMessage tone="error" action={retry}>
              {copy.previewUnavailable}
            </ViewerMessage>
          ) : material.document ? (
            <div className="rounded-control border border-outline-variant bg-surface p-4 sm:p-8">
              <MaterialDocumentRenderer
                document={material.document}
                renditions={material.renditions}
                locale={locale}
              />
            </div>
          ) : pageRenditions.length && currentPageUrl ? (
            <figure className="flex h-full min-h-[50dvh] flex-col items-center justify-center gap-3">
              {/* Authorized, short-lived page rendition supplied by the learner projection. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentPageUrl}
                alt={`${material.title}, ${copy.page} ${page + 1}`}
                onError={() => setLoadFailed(true)}
                className="max-h-[calc(100dvh-12rem)] max-w-full rounded-control border border-outline-variant bg-white object-contain"
              />
              <figcaption className="type-caption text-on-surface-variant">
                {copy.page} {page + 1} / {pageRenditions.length}
              </figcaption>
            </figure>
          ) : material.mediaKind === "image" && descriptorUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={descriptorUrl}
              alt={material.title}
              onError={() => setLoadFailed(true)}
              className="mx-auto max-h-full max-w-full rounded-control border border-outline-variant object-contain"
            />
          ) : material.mediaKind === "audio" && descriptorUrl ? (
            <figure className="mx-auto max-w-xl rounded-control border border-outline-variant bg-surface p-5">
              <figcaption className="mb-3 type-title font-semibold">
                {material.title} · {copy.audio}
              </figcaption>
              <audio
                controls
                preload="metadata"
                className="w-full"
                src={descriptorUrl}
                onError={() => setLoadFailed(true)}
              />
              <details className="mt-4">
                <summary className="cursor-pointer type-label font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                  {copy.transcript}
                </summary>
                <p className="mt-2 type-body-sm text-on-surface-variant">
                  {material.renditions.find((item) => item.transcript)
                    ?.transcript ?? copy.noTranscript}
                </p>
              </details>
            </figure>
          ) : descriptor?.renditionKind === "pdf_preview" && descriptorUrl ? (
            <div className="flex h-full min-h-[60dvh] flex-col gap-2">
              <iframe
                title={material.title}
                src={descriptorUrl}
                sandbox=""
                referrerPolicy="no-referrer"
                onError={() => setLoadFailed(true)}
                className="min-h-0 flex-1 rounded-control border border-outline-variant bg-white"
              />
              <a
                href={descriptorUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-outline-variant px-3 type-label font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Download className="size-4" aria-hidden="true" />
                {copy.download}
              </a>
            </div>
          ) : (
            <ViewerMessage>{copy.documentUnavailable}</ViewerMessage>
          )}
        </main>

        {pageRenditions.length > 1 && !loadFailed ? (
          <nav
            aria-label={`${copy.materials} · ${copy.page}`}
            className="flex min-h-12 shrink-0 items-center justify-center gap-3 border-t border-outline-variant bg-surface px-4 py-2"
          >
            <Button
              variant="outline"
              size="icon"
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              aria-label={copy.previousPage}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <span
              aria-live="polite"
              className="min-w-20 text-center type-label tabular-nums text-on-surface-variant"
            >
              {copy.page} {page + 1} / {pageRenditions.length}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={page === pageRenditions.length - 1}
              onClick={() =>
                setPage((value) =>
                  Math.min(pageRenditions.length - 1, value + 1),
                )
              }
              aria-label={copy.nextPage}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </nav>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
