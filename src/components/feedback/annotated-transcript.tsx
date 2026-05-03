"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bookmark,
  CheckCircle2,
  ChevronDown,
  MoreVertical,
} from "lucide-react";
import {
  estimateTranscriptTimestamp,
  filterTranscriptAnnotationMatches,
  formatTranscriptTimestamp,
  locateTranscriptAnnotations,
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
}

interface TranscriptChunk {
  id: string;
  start: number;
  end: number;
  text: string;
  timestampLabel: string | null;
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
  mechanism: "Mechanism",
  evidence: "Evidence",
  logic: "Logic",
  clash: "Clash",
  weighing: "Weighing",
  impact: "Impact",
  structure: "Structure",
  delivery: "Delivery",
};

const FILTER_OPTIONS: Array<{
  value: TranscriptAnnotationFilter;
  label: string;
}> = [
  { value: "all", label: "All annotations" },
  { value: "strength", label: "Strengths" },
  { value: "improvement", label: "Improvements" },
  { value: "warning", label: "Warnings" },
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
    accent: "#3E78EC",
    accentRgb: "62,120,236",
    mark: "bg-[#EEF4FF] text-[#2157C8] ring-[#A9C6FB]",
    activeMark: "shadow-[0_0_0_3px_rgba(62,120,236,0.18)]",
    card: "border-[#CFE0FF] bg-white",
    badge: "bg-[#EEF4FF] text-[#2157C8]",
    dot: "bg-[#3E78EC] text-white",
    connector: "border-[#3E78EC]",
  },
  structure: {
    accent: "#3E78EC",
    accentRgb: "62,120,236",
    mark: "bg-[#EEF4FF] text-[#2157C8] ring-[#A9C6FB]",
    activeMark: "shadow-[0_0_0_3px_rgba(62,120,236,0.18)]",
    card: "border-[#CFE0FF] bg-white",
    badge: "bg-[#EEF4FF] text-[#2157C8]",
    dot: "bg-[#3E78EC] text-white",
    connector: "border-[#3E78EC]",
  },
  mechanism: {
    accent: "#4D86F7",
    accentRgb: "77,134,247",
    mark: "bg-[#EAF1FF] text-[#245FD6] ring-[#B9CBFA]",
    activeMark: "shadow-[0_0_0_3px_rgba(77,134,247,0.2)]",
    card: "border-[#D9E6FF] bg-white",
    badge: "bg-[#EAF1FF] text-[#245FD6]",
    dot: "bg-[#4D86F7] text-white",
    connector: "border-[#4D86F7]",
  },
  logic: {
    accent: "#4D86F7",
    accentRgb: "77,134,247",
    mark: "bg-[#EAF1FF] text-[#245FD6] ring-[#B9CBFA]",
    activeMark: "shadow-[0_0_0_3px_rgba(77,134,247,0.2)]",
    card: "border-[#D9E6FF] bg-white",
    badge: "bg-[#EAF1FF] text-[#245FD6]",
    dot: "bg-[#4D86F7] text-white",
    connector: "border-[#4D86F7]",
  },
  weighing: {
    accent: "#4D86F7",
    accentRgb: "77,134,247",
    mark: "bg-[#EAF1FF] text-[#245FD6] ring-[#B9CBFA]",
    activeMark: "shadow-[0_0_0_3px_rgba(77,134,247,0.2)]",
    card: "border-[#D9E6FF] bg-white",
    badge: "bg-[#EAF1FF] text-[#245FD6]",
    dot: "bg-[#4D86F7] text-white",
    connector: "border-[#4D86F7]",
  },
  impact: {
    accent: "#34C759",
    accentRgb: "52,199,89",
    mark: "bg-[#EAF9EF] text-[#1A7F46] ring-[#BFEBD0]",
    activeMark: "shadow-[0_0_0_3px_rgba(52,199,89,0.18)]",
    card: "border-[#CDEED9] bg-white",
    badge: "bg-[#EAF9EF] text-[#1A9153]",
    dot: "bg-[#34C759] text-white",
    connector: "border-[#34C759]",
  },
  evidence: {
    accent: "#34C759",
    accentRgb: "52,199,89",
    mark: "bg-[#EAF9EF] text-[#1A7F46] ring-[#BFEBD0]",
    activeMark: "shadow-[0_0_0_3px_rgba(52,199,89,0.18)]",
    card: "border-[#CDEED9] bg-white",
    badge: "bg-[#EAF9EF] text-[#1A9153]",
    dot: "bg-[#34C759] text-white",
    connector: "border-[#34C759]",
  },
  clash: {
    accent: "#F5B942",
    accentRgb: "245,185,66",
    mark: "bg-[#FFF5E2] text-[#A05F00] ring-[#F9D889]",
    activeMark: "shadow-[0_0_0_3px_rgba(245,185,66,0.24)]",
    card: "border-[#F9D889] bg-white",
    badge: "bg-[#FFF5E2] text-[#C57F00]",
    dot: "bg-[#F5B942] text-[#0B1424]",
    connector: "border-[#F5B942]",
  },
  delivery: {
    accent: "#7B61FF",
    accentRgb: "123,97,255",
    mark: "bg-[#F1EEFF] text-[#6245F5] ring-[#CFC6FF]",
    activeMark: "shadow-[0_0_0_3px_rgba(123,97,255,0.2)]",
    card: "border-[#D8D0FF] bg-white",
    badge: "bg-[#F1EEFF] text-[#6245F5]",
    dot: "bg-[#7B61FF] text-white",
    connector: "border-[#7B61FF]",
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

function getTagLabel(tag: string) {
  return TAG_LABELS[tag] ?? tag;
}

function getTagStyle(tag: string) {
  return TAG_STYLES[tag] ?? TAG_STYLES.logic;
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

function buildTranscriptChunks(
  transcript: string,
  durationSeconds?: number | null
): TranscriptChunk[] {
  const trimmed = transcript.trim();
  if (!trimmed) return [];

  const chunks: TranscriptChunk[] = [];
  const sentenceRegex = /[^.!?\n]+[.!?]+(?:\s+|$)|[^\n]+(?:\n+|$)/g;
  const matches = [...transcript.matchAll(sentenceRegex)];
  const source =
    matches.length > 0
      ? matches.map((match) => ({
          text: match[0],
          index: match.index ?? 0,
        }))
      : [{ text: transcript, index: 0 }];

  let groupStart = source[0]?.index ?? 0;
  let groupText = "";
  let groupCount = 0;

  const pushGroup = () => {
    const text = groupText;
    const visibleText = text.trim();
    if (!visibleText) return;
    const leadingWhitespace = text.search(/\S/);
    const start = groupStart + Math.max(0, leadingWhitespace);
    const end = groupStart + text.length;
    chunks.push({
      id: `chunk-${start}-${end}`,
      start,
      end,
      text: transcript.slice(start, end),
      timestampLabel: estimateTranscriptTimestamp(
        start,
        transcript.length,
        durationSeconds
      ),
    });
    groupText = "";
    groupCount = 0;
  };

  source.forEach((sentence) => {
    if (!groupText) {
      groupStart = sentence.index;
    }

    groupText += sentence.text;
    groupCount += 1;

    if (groupCount >= 1 || sentence.text.includes("\n")) {
      pushGroup();
    }
  });

  pushGroup();

  return chunks.length > 0
    ? chunks
    : [
        {
          id: "chunk-all",
          start: 0,
          end: transcript.length,
          text: transcript,
          timestampLabel: durationSeconds ? formatTranscriptTimestamp(0) : null,
        },
      ];
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
  const radius = 14;
  const elbowX = Math.min(endX - 28, Math.max(startX + 44, endX - 70));
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

export function AnnotatedTranscript({
  transcript,
  annotations,
  emptyLabel,
  suggestionLabel,
  unmatchedLabel,
  roundLabel,
  durationSeconds,
  speakerLabel = "You",
}: AnnotatedTranscriptProps) {
  const usableDuration = getUsableDuration(durationSeconds);
  const connectorRootRef = useRef<HTMLDivElement | null>(null);
  const highlightRefs = useRef(new Map<string, HTMLButtonElement>());
  const markerRefs = useRef(new Map<string, HTMLSpanElement>());
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const cardAnchorRefs = useRef(new Map<string, HTMLSpanElement>());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<AnnotationConnector[]>([]);
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

  useEffect(() => {
    const root = connectorRootRef.current;
    if (!root) return;

    let animationFrame = 0;

    const updateConnectors = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const rootRect = root.getBoundingClientRect();
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
            const tone = getTagStyle(annotation.tag);
            const clientRects = Array.from(highlight.getClientRects());
            const lastHighlightRect =
              clientRects.length > 0
                ? clientRects[clientRects.length - 1]
                : highlightRect;
            const startX =
              (markerRect ? markerRect.right : lastHighlightRect.right) -
              rootRect.left;
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
    window.addEventListener("resize", updateConnectors);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateConnectors)
        : null;
    resizeObserver?.observe(root);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", updateConnectors);
      resizeObserver?.disconnect();
    };
  }, [filteredAnnotations, chunks]);

  if (!transcript.trim()) {
    return (
      <section className="rounded-2xl border border-[#DEE8F8] bg-white p-8 text-center text-sm leading-7 text-[#415069]">
        {emptyLabel}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#DEE8F8] bg-white p-5 shadow-[0_18px_45px_rgba(16,32,72,0.035)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-normal text-[#0B1424]">
            Annotated Transcript
          </h2>
          <p className="mt-2 text-sm leading-6 text-[#718096]">
            Review the exact moments where your argument can be strengthened.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-[180px_220px]">
          <label className="block">
            <span className="text-xs font-bold text-[#718096]">Speaker</span>
            <div className="mt-1 flex h-11 items-center justify-between rounded-lg border border-[#DEE8F8] bg-white px-3 text-sm font-semibold text-[#162033]">
              {speakerLabel}
              <ChevronDown className="h-4 w-4 text-[#718096]" />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#718096]">View</span>
            <div className="relative mt-1">
              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as TranscriptAnnotationFilter)
                }
                className="h-11 w-full appearance-none rounded-lg border border-[#DEE8F8] bg-white px-3 pr-9 text-sm font-semibold text-[#162033] outline-none focus:border-[#4D86F7]"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718096]" />
            </div>
          </label>
        </div>
      </div>

      <div
        ref={connectorRootRef}
        className="relative mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_480px] xl:gap-8"
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-20 hidden h-full w-full overflow-visible xl:block"
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

        <div className="relative z-10 rounded-xl border border-[#DEE8F8] bg-white px-4 py-5 sm:px-5">
          <div className="space-y-6">
            {chunks.map((chunk) => {
              const segments = buildChunkSegments(
                transcript,
                chunk,
                displayAnnotations
              );

              return (
                <div
                  key={chunk.id}
                  className="min-w-0"
                >
                  {chunk.timestampLabel ? (
                    <div className="mb-1.5 font-mono text-xs font-bold text-[#718096]">
                      {chunk.timestampLabel}
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap text-[0.98rem] leading-8 text-[#30427A]">
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
                            "relative mx-0.5 mr-8 inline-block max-w-[calc(100%-2rem)] rounded px-1 py-0.5 text-left font-semibold leading-7 ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D86F7]",
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
                              "absolute right-[-22px] top-1/2 inline-flex h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded-full px-1 text-[0.68rem] leading-5",
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

        <div className="relative z-10 space-y-4 xl:pl-28 xl:pr-1">
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
                    "relative rounded-xl border bg-white p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D86F7]",
                    tone.card,
                    isActive && "shadow-[0_16px_34px_rgba(34,67,138,0.14)]"
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
                        {getTagLabel(annotation.tag)}
                      </span>
                      {annotation.timestampLabel ? (
                        <span className="font-mono text-xs font-bold text-[#718096]">
                          {annotation.timestampLabel}
                        </span>
                      ) : null}
                      {annotation.roundNumber ? (
                        <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#415069] ring-1 ring-[#DEE8F8]">
                          {roundLabel(annotation.roundNumber)}
                        </span>
                      ) : null}
                      {!annotation.matchedText ? (
                        <span className="rounded-md bg-[#FDECEC] px-2.5 py-1 text-xs font-semibold text-[#C63B3B] ring-1 ring-[#F5B8B8]">
                          {unmatchedLabel}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex gap-2 text-[#718096]">
                      <Bookmark className="h-4 w-4" />
                      <MoreVertical className="h-4 w-4" />
                    </div>
                  </div>

                  <blockquote
                    className="mt-4 border-l-2 pl-3 text-sm font-bold leading-6 text-[#162033]"
                    style={{ borderColor: tone.accent }}
                  >
                    &ldquo;{annotation.matchedText ?? annotation.quote}&rdquo;
                  </blockquote>
                  <p className="mt-3 text-sm leading-6 text-[#30427A]">
                    {annotation.feedback}
                  </p>
                  {annotation.suggestion ? (
                    <p
                      className="mt-4 rounded-lg border bg-white p-3 text-sm leading-6 text-[#415069]"
                      style={{
                        borderColor: `rgba(${tone.accentRgb}, 0.35)`,
                      }}
                    >
                      <span className="font-bold text-[#0B1424]">
                        {suggestionLabel}:{" "}
                      </span>
                      {annotation.suggestion}
                    </p>
                  ) : null}
                </article>
              );
            })
          ) : (
            <div className="rounded-xl border border-[#DEE8F8] bg-[#F7FAFE] p-5 text-sm leading-6 text-[#415069]">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#EAF1FF] text-[#4D86F7]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              No annotations match this view.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
