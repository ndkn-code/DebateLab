"use client";

import { useMemo, useState } from "react";
import {
  locateTranscriptAnnotations,
  type TranscriptAnnotationMatch,
} from "@/lib/feedback/annotations";
import type { TranscriptAnnotation } from "@/types/feedback";
import { cn } from "@/lib/utils";

type LocatedAnnotation = TranscriptAnnotationMatch & {
  start: number;
  end: number;
  matchedText: string;
};

interface AnnotatedTranscriptProps {
  transcript: string;
  annotations?: TranscriptAnnotation[] | null;
  emptyLabel: string;
  suggestionLabel: string;
  unmatchedLabel: string;
  roundLabel: (roundNumber: number) => string;
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

const SEVERITY_STYLES = {
  strength: {
    mark: "bg-[#EAF9EF] text-[#0F6B37] ring-[#BFEBD0]",
    card: "border-[#BFEBD0] bg-[#F4FCF7]",
    badge: "bg-[#EAF9EF] text-[#1A9153]",
  },
  improvement: {
    mark: "bg-[#EAF1FF] text-[#244F9D] ring-[#B9CBFA]",
    card: "border-[#D9E6FF] bg-[#F7FAFE]",
    badge: "bg-[#EAF1FF] text-[#3E78EC]",
  },
  warning: {
    mark: "bg-[#FFF1E7] text-[#A65313] ring-[#FFD7B3]",
    card: "border-[#FFD7B3] bg-[#FFF8F2]",
    badge: "bg-[#FFF1E7] text-[#C96A18]",
  },
} as const;

function isLocatedAnnotation(
  annotation: TranscriptAnnotationMatch
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

function buildTranscriptSegments(
  transcript: string,
  annotations: TranscriptAnnotationMatch[]
) {
  const located = annotations
    .filter(isLocatedAnnotation)
    .sort((first, second) => first.start - second.start);
  const segments: Array<
    | { type: "text"; key: string; text: string }
    | { type: "annotation"; key: string; text: string; annotation: LocatedAnnotation }
  > = [];
  let cursor = 0;

  located.forEach((annotation) => {
    if (annotation.start < cursor) return;

    if (annotation.start > cursor) {
      segments.push({
        type: "text",
        key: `text-${cursor}-${annotation.start}`,
        text: transcript.slice(cursor, annotation.start),
      });
    }

    segments.push({
      type: "annotation",
      key: annotation.id,
      text: transcript.slice(annotation.start, annotation.end),
      annotation,
    });
    cursor = annotation.end;
  });

  if (cursor < transcript.length) {
    segments.push({
      type: "text",
      key: `text-${cursor}-end`,
      text: transcript.slice(cursor),
    });
  }

  return segments.length > 0
    ? segments
    : [{ type: "text" as const, key: "text-all", text: transcript }];
}

export function AnnotatedTranscript({
  transcript,
  annotations,
  emptyLabel,
  suggestionLabel,
  unmatchedLabel,
  roundLabel,
}: AnnotatedTranscriptProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const matches = useMemo(
    () => locateTranscriptAnnotations(transcript, annotations),
    [transcript, annotations]
  );
  const segments = useMemo(
    () => buildTranscriptSegments(transcript, matches),
    [transcript, matches]
  );

  if (!transcript.trim()) {
    return <p className="mt-4 text-sm leading-7 text-[#30427A]">{emptyLabel}</p>;
  }

  if (matches.length === 0) {
    return (
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#30427A]">
        {transcript}
      </p>
    );
  }

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="rounded-lg border border-[#E6ECF8] bg-white p-4">
        <p className="whitespace-pre-wrap text-sm leading-8 text-[#30427A]">
          {segments.map((segment) => {
            if (segment.type === "text") {
              return <span key={segment.key}>{segment.text}</span>;
            }

            const tone = SEVERITY_STYLES[segment.annotation.severity];
            const isActive = activeId === segment.annotation.id;

            return (
              <button
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
                  "mx-0.5 rounded px-1 py-0.5 text-left font-semibold ring-1 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4D86F7]",
                  tone.mark,
                  isActive && "shadow-[0_0_0_3px_rgba(77,134,247,0.18)]"
                )}
              >
                {segment.text}
              </button>
            );
          })}
        </p>
      </div>

      <div className="space-y-3">
        {matches.map((annotation) => {
          const tone = SEVERITY_STYLES[annotation.severity];
          const isActive = activeId === annotation.id;

          return (
            <article
              key={annotation.id}
              onMouseEnter={() => setActiveId(annotation.id)}
              className={cn(
                "rounded-lg border p-4 transition-shadow",
                tone.card,
                isActive && "shadow-[0_12px_28px_rgba(34,67,138,0.13)]"
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-bold",
                    tone.badge
                  )}
                >
                  {getTagLabel(annotation.tag)}
                </span>
                {annotation.roundNumber ? (
                  <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#415069] ring-1 ring-[#DEE8F8]">
                    {roundLabel(annotation.roundNumber)}
                  </span>
                ) : null}
                {!annotation.matchedText ? (
                  <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#A65313] ring-1 ring-[#FFD7B3]">
                    {unmatchedLabel}
                  </span>
                ) : null}
              </div>

              <blockquote className="mt-3 border-l-2 border-[#A9C6FB] pl-3 text-sm font-semibold leading-6 text-[#162033]">
                {annotation.matchedText ?? annotation.quote}
              </blockquote>
              <p className="mt-3 text-sm leading-6 text-[#30427A]">
                {annotation.feedback}
              </p>
              {annotation.suggestion ? (
                <p className="mt-3 rounded-md bg-white/78 p-3 text-sm leading-6 text-[#415069] ring-1 ring-[#DEE8F8]">
                  <span className="font-bold text-[#0B1424]">
                    {suggestionLabel}:{" "}
                  </span>
                  {annotation.suggestion}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
