"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bookmark,
  CheckCircle2,
  ChevronDown,
  MoreVertical,
} from "@/components/ui/icons";
import {
  buildTranscriptChunks,
  estimateTranscriptTimestamp,
  filterTranscriptAnnotationMatches,
  getTranscriptAnnotationAccent,
  locateTranscriptAnnotations,
  type TranscriptChunk,
  type TranscriptAnnotationFilter,
  type TranscriptAnnotationMatch,
} from "@/lib/feedback/annotations";
import type {
  TranscriptAnnotation,
} from "@/types/feedback";
import { cn } from "@/lib/utils";

type LocatedAnnotation = TranscriptAnnotationMatch & {
  start: number;
  end: number;
  matchedText: string;
  displayIndex: number;
  timestampLabel: string | null;
  isMatched: true;
};

type DisplayAnnotation = (TranscriptAnnotationMatch & {
  displayIndex: number;
  timestampLabel: string | null;
  isMatched: boolean;
}) | LocatedAnnotation;

interface AnnotatedTranscriptProps {
  transcript: string;
  annotations?: TranscriptAnnotation[] | null;
  emptyLabel: string;
  suggestionLabel: string;
  unmatchedLabel: string;
  roundLabel: (roundNumber: number) => string;
  durationSeconds?: number | null;
  speakerLabel?: string;
  showSpeakerControl?: boolean;
  speakerControlLabel?: string;
  leadingControl?: React.ReactNode;
  title?: string;
  description?: string;
}

interface AnnotationConnector {
  id: string;
  path: string;
  accent: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const TAG_LABELS: Record<string, string> = {
  stance: "Stance",
  clarity: "Clarity",
  mechanism: "Mechanism",
  evidence: "Evidence",
  logic: "Logic",
  rebuttal: "Rebuttal",
  clash: "Clash",
  weighing: "Weighing",
  impact: "Impact",
  structure: "Structure",
  delivery: "Delivery",
};

const FILTER_OPTIONS: Array<{
  value: TranscriptAnnotationFilter;
  labelKey: "filterAll" | "filterStrength" | "filterImprovement" | "filterWarning";
}> = [
  { value: "all", labelKey: "filterAll" },
  { value: "strength", labelKey: "filterStrength" },
  { value: "improvement", labelKey: "filterImprovement" },
  { value: "warning", labelKey: "filterWarning" },
];

const TAG_STYLES: Record<
  string,
  {
    accent: string;
    accentRgb: string;
    mark: string;
    activeMark: string;
    card: string;
    badge: string;
    dot: string;
    connector: string;
  }
> = {
  stance: {
    accent: "#0788A0",
    accentRgb: "7,136,160",
    mark: "bg-primary-container text-on-surface-variant ring-primary-fixed",
    activeMark: "shadow-token-card",
    card: "border-outline-variant bg-white",
    badge: "bg-primary-container text-on-surface-variant",
    dot: "bg-primary text-white",
    connector: "border-primary",
  },
  clarity: {
    accent: "#0788A0",
    accentRgb: "7,136,160",
    mark: "bg-primary-container text-on-surface-variant ring-primary-fixed",
    activeMark: "shadow-token-card",
    card: "border-outline-variant bg-white",
    badge: "bg-primary-container text-on-surface-variant",
    dot: "bg-primary text-white",
    connector: "border-primary",
  },
  structure: {
    accent: "#0788A0",
    accentRgb: "7,136,160",
    mark: "bg-primary-container text-on-surface-variant ring-primary-fixed",
    activeMark: "shadow-token-card",
    card: "border-outline-variant bg-white",
    badge: "bg-primary-container text-on-surface-variant",
    dot: "bg-primary text-white",
    connector: "border-primary",
  },
  mechanism: {
    accent: "#00B8D9",
    accentRgb: "0,184,217",
    mark: "bg-primary-container text-on-surface-variant ring-outline-variant",
    activeMark: "shadow-token-primary",
    card: "border-outline-variant bg-white",
    badge: "bg-primary-container text-on-surface-variant",
    dot: "bg-primary text-white",
    connector: "border-primary",
  },
  logic: {
    accent: "#00B8D9",
    accentRgb: "0,184,217",
    mark: "bg-primary-container text-on-surface-variant ring-outline-variant",
    activeMark: "shadow-token-primary",
    card: "border-outline-variant bg-white",
    badge: "bg-primary-container text-on-surface-variant",
    dot: "bg-primary text-white",
    connector: "border-primary",
  },
  weighing: {
    accent: "#00B8D9",
    accentRgb: "0,184,217",
    mark: "bg-primary-container text-on-surface-variant ring-outline-variant",
    activeMark: "shadow-token-primary",
    card: "border-outline-variant bg-white",
    badge: "bg-primary-container text-on-surface-variant",
    dot: "bg-primary text-white",
    connector: "border-primary",
  },
  impact: {
    accent: "#00B8D9",
    accentRgb: "52,199,89",
    mark: "bg-surface-container text-on-surface-variant ring-outline-variant",
    activeMark: "shadow-token-card",
    card: "border-outline-variant bg-white",
    badge: "bg-surface-container text-on-surface-variant",
    dot: "bg-success text-white",
    connector: "border-outline-variant",
  },
  evidence: {
    accent: "#00B8D9",
    accentRgb: "52,199,89",
    mark: "bg-surface-container text-on-surface-variant ring-outline-variant",
    activeMark: "shadow-token-card",
    card: "border-outline-variant bg-white",
    badge: "bg-surface-container text-on-surface-variant",
    dot: "bg-success text-white",
    connector: "border-outline-variant",
  },
  clash: {
    accent: "#FFD166",
    accentRgb: "245,185,66",
    mark: "bg-surface-container text-on-surface-variant ring-outline-variant",
    activeMark: "shadow-token-card",
    card: "border-outline-variant bg-white",
    badge: "bg-surface-container text-on-surface-variant",
    dot: "bg-warning text-on-surface",
    connector: "border-warning",
  },
  rebuttal: {
    accent: "#FFD166",
    accentRgb: "245,185,66",
    mark: "bg-surface-container text-on-surface-variant ring-outline-variant",
    activeMark: "shadow-token-card",
    card: "border-outline-variant bg-white",
    badge: "bg-surface-container text-on-surface-variant",
    dot: "bg-warning text-on-surface",
    connector: "border-warning",
  },
  delivery: {
    accent: "#00B8D9",
    accentRgb: "123,97,255",
    mark: "bg-surface-container text-on-surface-variant ring-outline-variant",
    activeMark: "shadow-token-card",
    card: "border-outline-variant bg-white",
    badge: "bg-surface-container text-on-surface-variant",
    dot: "bg-surface-container-high text-white",
    connector: "border-outline-variant",
  },
};

function isLocatedAnnotation(
  annotation: DisplayAnnotation
): annotation is LocatedAnnotation {
  return (
    typeof annotation.start === "number" &&
    typeof annotation.end === "number" &&
    typeof annotation.matchedText === "string"
  );
}

function getTagLabel(
  tag: string,
  t: ReturnType<typeof useTranslations<"sessionResult.annotations">>
) {
  try {
    return t(`tags.${tag}`);
  } catch {
    return TAG_LABELS[tag] ?? tag;
  }
}

function getTagStyle(tag: string) {
  if (TAG_STYLES[tag]) return TAG_STYLES[tag];

  const accent = getTranscriptAnnotationAccent(tag);
  return (
    Object.values(TAG_STYLES).find((style) => style.accent === accent) ??
    TAG_STYLES.logic
  );
}

function getUsableDuration(
  durationSeconds?: number | null,
  transcriptFallbackSeconds?: number | null
) {
  if (durationSeconds && durationSeconds > 0) return durationSeconds;
  if (transcriptFallbackSeconds && transcriptFallbackSeconds > 0) {
    return transcriptFallbackSeconds;
  }
  return null;
}

function buildDisplayAnnotations(
  transcript: string,
  annotations: TranscriptAnnotation[] | null | undefined,
  durationSeconds?: number | null
): DisplayAnnotation[] {
  return locateTranscriptAnnotations(transcript, annotations).map(
    (annotation, index) => {
      const timestampLabel = estimateTranscriptTimestamp(
        annotation.start,
        transcript.length,
        durationSeconds
      );

      return {
        ...annotation,
        displayIndex: index + 1,
        timestampLabel,
        isMatched: annotation.matchedText !== null,
      };
    }
  );
}

function buildChunkSegments(
  transcript: string,
  chunk: TranscriptChunk,
  annotations: DisplayAnnotation[]
) {
  const located = annotations
    .filter(isLocatedAnnotation)
    .filter(
      (annotation) => annotation.end > chunk.start && annotation.start < chunk.end
    )
    .sort((first, second) => first.start - second.start);
  const segments: Array<
    | { type: "text"; key: string; text: string }
    | {
        type: "annotation";
        key: string;
        text: string;
        annotation: LocatedAnnotation;
      }
  > = [];
  let cursor = chunk.start;

  located.forEach((annotation, index) => {
    const nextAnnotation = located[index + 1];
    const start = Math.max(annotation.start, chunk.start);
    let end = Math.min(annotation.end, chunk.end);
    const maxRenderableEnd = Math.min(
      chunk.end,
      nextAnnotation?.start ?? chunk.end
    );

    while (
      end < maxRenderableEnd &&
      /[.!?,;:]/.test(transcript.charAt(end))
    ) {
      end += 1;
    }

    if (start < cursor || end <= start) return;

    if (start > cursor) {
      segments.push({
        type: "text",
        key: `text-${cursor}-${start}`,
        text: transcript.slice(cursor, start),
      });
    }

    segments.push({
      type: "annotation",
      key: annotation.id,
      text: transcript.slice(start, end),
      annotation,
    });
    cursor = end;
  });

  if (cursor < chunk.end) {
    segments.push({
      type: "text",
      key: `text-${cursor}-${chunk.end}`,
      text: transcript.slice(cursor, chunk.end),
    });
  }

  return segments;
}

function buildConnectorPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number
) {
  const radius = 12;
  const elbowX = Math.max(startX + 24, Math.min(endX - 42, startX + 92));
  const direction = endY >= startY ? 1 : -1;
  const verticalDistance = Math.abs(endY - startY);

  if (verticalDistance < radius * 1.5) {
    return `M ${startX} ${startY} H ${endX}`;
  }

  return [
    `M ${startX} ${startY}`,
    `H ${elbowX - radius}`,
    `Q ${elbowX} ${startY} ${elbowX} ${startY + direction * radius}`,
    `V ${endY - direction * radius}`,
    `Q ${elbowX} ${endY} ${elbowX + radius} ${endY}`,
    `H ${endX}`,
  ].join(" ");
}

function isVerticallyVisible(
  rect: DOMRect,
  containerRect: DOMRect,
  padding = 4
) {
  return (
    rect.bottom >= containerRect.top + padding &&
    rect.top <= containerRect.bottom - padding
  );
}

export function AnnotatedTranscript({
  transcript,
  annotations,
  emptyLabel,
  suggestionLabel,
  unmatchedLabel,
  roundLabel,
  durationSeconds,
  speakerLabel,
  showSpeakerControl = true,
  speakerControlLabel,
  leadingControl,
  title,
  description,
}: AnnotatedTranscriptProps) {
  const t = useTranslations("sessionResult.annotations");
  const usableDuration = getUsableDuration(durationSeconds);
  const connectorRootRef = useRef<HTMLDivElement | null>(null);
  const transcriptPaneRef = useRef<HTMLDivElement | null>(null);
  const cardRailRef = useRef<HTMLDivElement | null>(null);
  const highlightRefs = useRef(new Map<string, HTMLButtonElement>());
  const markerRefs = useRef(new Map<string, HTMLSpanElement>());
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const cardAnchorRefs = useRef(new Map<string, HTMLSpanElement>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<AnnotationConnector[]>([]);
  const [connectorBox, setConnectorBox] = useState({ width: 0, height: 0 });
  const [filter, setFilter] = useState<TranscriptAnnotationFilter>("all");
  const displayAnnotations = useMemo(
    () => buildDisplayAnnotations(transcript, annotations, usableDuration),
    [annotations, transcript, usableDuration]
  );
  const chunks = useMemo(
    () => buildTranscriptChunks(transcript, usableDuration),
    [transcript, usableDuration]
  );
  const filteredAnnotations = useMemo(() => {
    return filterTranscriptAnnotationMatches(
      displayAnnotations,
      filter
    ) as DisplayAnnotation[];
  }, [displayAnnotations, filter]);
  const visibleAnnotationIds = useMemo(
    () => new Set(filteredAnnotations.map((annotation) => annotation.id)),
    [filteredAnnotations]
  );

  useLayoutEffect(() => {
    transcriptPaneRef.current?.scrollTo({ top: 0 });
    cardRailRef.current?.scrollTo({ top: 0 });
  }, [filter, transcript]);

  useLayoutEffect(() => {
    const root = connectorRootRef.current;
    if (!root) return;
    const transcriptPane = transcriptPaneRef.current;
    const cardRail = cardRailRef.current;

    let animationFrame = 0;
    let delayedFrame = 0;

    const updateConnectors = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect();
        const nextBox = {
          width: Math.ceil(rootRect.width),
          height: Math.ceil(rootRect.height),
        };
        setConnectorBox((current) =>
          current.width === nextBox.width && current.height === nextBox.height
            ? current
            : nextBox
        );
        const nextConnectors = filteredAnnotations
          .filter(isLocatedAnnotation)
          .map((annotation) => {
            const highlight = highlightRefs.current.get(annotation.id);
            const marker = markerRefs.current.get(annotation.id);
            const card = cardRefs.current.get(annotation.id);
            const cardAnchor = cardAnchorRefs.current.get(annotation.id);
            if (!highlight || !card) return null;

            const highlightRect = highlight.getBoundingClientRect();
            const markerRect = marker?.getBoundingClientRect();
            const cardRect = card.getBoundingClientRect();
            const cardAnchorRect = cardAnchor?.getBoundingClientRect();
            const transcriptPaneRect =
              transcriptPane?.getBoundingClientRect();
            const cardRailRect = cardRail?.getBoundingClientRect();
            const tone = getTagStyle(annotation.tag);
            const clientRects = Array.from(highlight.getClientRects());
            const lastHighlightRect =
              clientRects.length > 0
                ? clientRects[clientRects.length - 1]
                : highlightRect;
            const highlightAnchorRect = markerRect ?? lastHighlightRect;
            const cardTargetRect = cardAnchorRect ?? cardRect;

            if (
              transcriptPaneRect &&
              !isVerticallyVisible(highlightAnchorRect, transcriptPaneRect)
            ) {
              return null;
            }

            if (
              cardRailRect &&
              !isVerticallyVisible(cardTargetRect, cardRailRect)
            ) {
              return null;
            }

            const startX =
              (transcriptPaneRect?.right ??
                (markerRect ? markerRect.right : lastHighlightRect.right)) -
              rootRect.left +
              1;
            const startY =
              (markerRect
                ? markerRect.top + markerRect.height / 2
                : lastHighlightRect.top + lastHighlightRect.height / 2) -
              rootRect.top;
            const endX = cardRect.left - rootRect.left - 1;
            const endY =
              (cardAnchorRect
                ? cardAnchorRect.top + cardAnchorRect.height / 2
                : cardRect.top + 50) - rootRect.top;

            return {
              id: annotation.id,
              path: buildConnectorPath(startX, startY, endX, endY),
              accent: tone.accent,
              startX,
              startY,
              endX,
              endY,
            };
          })
          .filter(Boolean) as AnnotationConnector[];

        setConnectors(nextConnectors);
      });
    };

    updateConnectors();
    delayedFrame = window.setTimeout(updateConnectors, 80);
    window.addEventListener("resize", updateConnectors);
    transcriptPane?.addEventListener("scroll", updateConnectors, {
      passive: true,
    });
    cardRail?.addEventListener("scroll", updateConnectors, {
      passive: true,
    });

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateConnectors)
        : null;
    resizeObserver?.observe(root);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(delayedFrame);
      window.removeEventListener("resize", updateConnectors);
      transcriptPane?.removeEventListener("scroll", updateConnectors);
      cardRail?.removeEventListener("scroll", updateConnectors);
      resizeObserver?.disconnect();
    };
  }, [filteredAnnotations, chunks]);

  if (!transcript.trim()) {
    return (
      <section className="rounded-2xl border border-outline-variant bg-white p-8 text-center text-sm leading-7 text-on-surface-variant">
        {emptyLabel}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-normal text-on-surface">
            {title ?? t("title")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-on-surface-variant">
            {description ?? t("description")}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[minmax(180px,220px)_220px]">
          {leadingControl ??
            (showSpeakerControl ? (
              <label className="block">
                <span className="text-xs font-bold text-on-surface-variant">
                  {speakerControlLabel ?? t("speaker")}
                </span>
                <div className="mt-1 flex h-11 items-center justify-between rounded-lg border border-outline-variant bg-white px-3 text-sm font-semibold text-on-surface">
                  {speakerLabel ?? t("you")}
                  <ChevronDown className="h-4 w-4 text-on-surface-variant" />
                </div>
              </label>
            ) : null)}
          <label className="block">
            <span className="text-xs font-bold text-on-surface-variant">
              {t("view")}
            </span>
            <div className="relative mt-1">
              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as TranscriptAnnotationFilter)
                }
                className="h-11 w-full appearance-none rounded-lg border border-outline-variant bg-white px-3 pr-9 text-sm font-semibold text-on-surface outline-none focus:border-primary"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            </div>
          </label>
        </div>
      </div>

      <div
        ref={connectorRootRef}
        className="relative isolate mt-5 grid gap-5 xl:max-h-[calc(100vh-230px)] xl:grid-cols-[minmax(0,1fr)_96px_480px] xl:gap-0"
      >
        <div
          ref={transcriptPaneRef}
          className="relative z-10 min-h-[280px] overflow-y-auto rounded-xl border border-outline-variant bg-white px-4 py-5 sm:px-5 xl:max-h-[calc(100vh-230px)]"
        >
          <div className="space-y-7">
            {chunks.map((chunk) => {
              const segments = buildChunkSegments(
                transcript,
                chunk,
                displayAnnotations
              );

              return (
                <div
                  key={chunk.id}
                  className="grid min-w-0 grid-cols-[3.25rem_minmax(0,1fr)] gap-4"
                >
                  <div className="pt-1 font-mono text-xs font-bold text-on-surface-variant">
                    {chunk.timestampLabel}
                  </div>
                  <p className="whitespace-pre-wrap text-[0.98rem] leading-7 text-on-surface-variant">
                    {segments.map((segment) => {
                      if (segment.type === "text") {
                        return <span key={segment.key}>{segment.text}</span>;
                      }

                      const tone = getTagStyle(segment.annotation.tag);
                      const isActive = activeId === segment.annotation.id;
                      const isFilteredOut = !visibleAnnotationIds.has(
                        segment.annotation.id
                      );

                      return (
                        <button
                          ref={(node) => {
                            if (node) {
                              highlightRefs.current.set(
                                segment.annotation.id,
                                node
                              );
                            } else {
                              highlightRefs.current.delete(
                                segment.annotation.id
                              );
                            }
                          }}
                          key={segment.key}
                          type="button"
                          onClick={() =>
                            setActiveId((current) =>
                              current === segment.annotation.id
                                ? null
                                : segment.annotation.id
                            )
                          }
                          onMouseEnter={() => setActiveId(segment.annotation.id)}
                          onFocus={() => setActiveId(segment.annotation.id)}
                          className={cn(
                            "relative mx-0.5 mr-9 inline-block max-w-[calc(100%-2.5rem)] rounded px-1 py-0.5 text-left font-semibold leading-7 ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            tone.mark,
                            isActive && tone.activeMark,
                            isFilteredOut && "opacity-35"
                          )}
                          style={{
                            boxDecorationBreak: "clone",
                            WebkitBoxDecorationBreak: "clone",
                          }}
                        >
                          <span
                            className="align-baseline"
                          >
                            {segment.text}
                          </span>
                          <span
                            ref={(node) => {
                              if (node) {
                                markerRefs.current.set(
                                  segment.annotation.id,
                                  node
                                );
                              } else {
                                markerRefs.current.delete(
                                  segment.annotation.id
                                );
                              }
                            }}
                            className={cn(
                              "absolute right-[-28px] top-1/2 z-40 inline-flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full px-1 text-[0.68rem] leading-5 shadow-token-card",
                              tone.dot
                            )}
                          >
                            {segment.annotation.displayIndex}
                          </span>
                        </button>
                      );
                    })}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="hidden xl:block" aria-hidden="true" />

        <div
          ref={cardRailRef}
          className="relative z-10 space-y-4 overflow-y-auto pr-1 xl:max-h-[calc(100vh-230px)]"
        >
          {filteredAnnotations.length > 0 ? (
            filteredAnnotations.map((annotation) => {
              const tone = getTagStyle(annotation.tag);
              const isActive = activeId === annotation.id;

              return (
                <article
                  ref={(node) => {
                    if (node) {
                      cardRefs.current.set(annotation.id, node);
                    } else {
                      cardRefs.current.delete(annotation.id);
                    }
                  }}
                  key={annotation.id}
                  onMouseEnter={() => setActiveId(annotation.id)}
                  onFocus={() => setActiveId(annotation.id)}
                  tabIndex={0}
                  className={cn(
                    "relative rounded-xl border bg-white p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    tone.card,
                    isActive && "shadow-token-card"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        ref={(node) => {
                          if (node) {
                            cardAnchorRefs.current.set(annotation.id, node);
                          } else {
                            cardAnchorRefs.current.delete(annotation.id);
                          }
                        }}
                        className={cn(
                          "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-bold",
                          tone.dot
                        )}
                      >
                        {annotation.displayIndex}
                      </span>
                      <span
                        className={cn(
                          "rounded-md px-2.5 py-1 text-xs font-bold",
                          tone.badge
                        )}
                      >
                        {getTagLabel(annotation.tag, t)}
                      </span>
                      {annotation.timestampLabel ? (
                        <span className="font-mono text-xs font-bold text-on-surface-variant">
                          {annotation.timestampLabel}
                        </span>
                      ) : null}
                      {annotation.roundNumber ? (
                        <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-on-surface-variant ring-1 ring-outline-variant">
                          {roundLabel(annotation.roundNumber)}
                        </span>
                      ) : null}
                      {!annotation.matchedText ? (
                        <span className="rounded-md bg-error-container px-2.5 py-1 text-xs font-semibold text-on-surface-variant ring-1 ring-outline-variant">
                          {unmatchedLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex gap-2 text-on-surface-variant">
                      <Bookmark className="h-4 w-4" />
                      <MoreVertical className="h-4 w-4" />
                    </div>
                  </div>

                  <blockquote
                    className="mt-4 border-l-2 pl-3 text-sm font-bold leading-6 text-on-surface"
                    style={{ borderColor: tone.accent }}
                  >
                    &ldquo;{annotation.matchedText ?? annotation.quote}&rdquo;
                  </blockquote>
                  <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                    {annotation.feedback}
                  </p>
                  {annotation.suggestion ? (
                    <p
                      className="mt-4 rounded-lg border bg-white p-3 text-sm leading-6 text-on-surface-variant"
                      style={{
                        borderColor: `rgba(${tone.accentRgb}, 0.35)`,
                      }}
                    >
                      <span className="font-bold text-on-surface">
                        {suggestionLabel}:{" "}
                      </span>
                      {annotation.suggestion}
                    </p>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-xl border border-outline-variant bg-background p-5 text-sm leading-6 text-on-surface-variant">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              {t("emptyFilter")}
            </div>
          )}
        </div>

        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
          style={{
            overflow: "visible",
            display: connectorBox.width >= 980 ? "block" : "none",
          }}
          viewBox={`0 0 ${Math.max(connectorBox.width, 1)} ${Math.max(
            connectorBox.height,
            1
          )}`}
          width={Math.max(connectorBox.width, 1)}
          height={Math.max(connectorBox.height, 1)}
        >
          {connectors.map((connector) => {
            const isActive = activeId === connector.id;

            return (
              <g key={connector.id}>
                <path
                  d={connector.path}
                  fill="none"
                  stroke={connector.accent}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={isActive ? 2.4 : 2}
                  opacity={isActive || !activeId ? 1 : 0.45}
                />
                <circle
                  cx={connector.startX}
                  cy={connector.startY}
                  fill={connector.accent}
                  opacity={isActive || !activeId ? 1 : 0.45}
                  r={3.2}
                />
                <circle
                  cx={connector.endX}
                  cy={connector.endY}
                  fill={connector.accent}
                  opacity={isActive || !activeId ? 1 : 0.45}
                  r={3.2}
                />
              </g>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
