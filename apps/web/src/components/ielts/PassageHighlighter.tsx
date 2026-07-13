"use client";

import { useMemo } from "react";
import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import {
  mockAnnotationKey,
  type Highlight,
  type Note,
  useMockAnnotationsStore,
} from "@/lib/stores/mockAnnotationsStore";
import { HIGHLIGHT_STYLES } from "./exam/annotation-styles";

const EMPTY_HIGHLIGHTS: Highlight[] = [];
const EMPTY_NOTES: Note[] = [];

interface PassageSegment {
  start: number;
  end: number;
  text: string;
  highlight: Highlight | null;
  notes: Note[];
}

function buildPassageSegments(
  text: string,
  highlights: Highlight[],
  notes: Note[],
): PassageSegment[] {
  if (!text) return [];
  const boundaries = new Set<number>([0, text.length]);
  for (const highlight of highlights) {
    boundaries.add(Math.max(0, Math.min(text.length, highlight.start)));
    boundaries.add(Math.max(0, Math.min(text.length, highlight.end)));
  }
  for (const note of notes) {
    boundaries.add(Math.max(0, Math.min(text.length, note.anchor.range.end)));
  }
  const points = [...boundaries].sort((left, right) => left - right);
  const segments: PassageSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (end <= start) continue;
    let active: Highlight | null = null;
    for (const highlight of highlights) {
      if (highlight.start <= start && highlight.end >= end) active = highlight;
    }
    segments.push({
      start,
      end,
      text: text.slice(start, end),
      highlight: active,
      notes: notes.filter((note) => note.anchor.range.end === end),
    });
  }
  return segments;
}

function hasActiveSelection(): boolean {
  const selection = window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().trim());
}

export function PassageHighlighter({
  passageKey,
  title,
  body,
  onOpenNotes,
}: {
  passageKey: string;
  title: string;
  body: string;
  onOpenNotes?: (noteId: string) => void;
}) {
  const activeAttemptId = useMockAnnotationsStore((state) => state.activeAttemptId);
  const highlights = useMockAnnotationsStore((state) =>
    activeAttemptId
      ? (state.highlights[mockAnnotationKey(activeAttemptId, passageKey)] ?? EMPTY_HIGHLIGHTS)
      : EMPTY_HIGHLIGHTS,
  );
  const notes = useMockAnnotationsStore((state) =>
    activeAttemptId
      ? (state.notes[mockAnnotationKey(activeAttemptId, passageKey)] ?? EMPTY_NOTES)
      : EMPTY_NOTES,
  );
  const removeHighlight = useMockAnnotationsStore((state) => state.removeHighlight);
  const segments = useMemo(
    () => buildPassageSegments(body, highlights, notes),
    [body, highlights, notes],
  );

  return (
    <article className="max-h-[60vh] overflow-y-auto rounded-3xl border border-outline-variant bg-surface-container p-5 text-sm leading-relaxed text-on-surface">
      <h3 className="mb-3 text-base font-bold">{title}</h3>
      <div
        data-annotation-kind="passage"
        data-annotation-key={passageKey}
        className="select-text whitespace-pre-wrap"
      >
        {segments.map((segment) => (
          <span key={`${segment.start}:${segment.end}`}>
            {segment.highlight ? (
              <span
                role="button"
                tabIndex={0}
                title="Remove highlight"
                data-highlight-id={segment.highlight.id}
                onClick={(event) => {
                  if (hasActiveSelection()) return;
                  event.stopPropagation();
                  removeHighlight(passageKey, segment.highlight!.id);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  removeHighlight(passageKey, segment.highlight!.id);
                }}
                className={cn(
                  "box-decoration-clone rounded px-0.5 transition-colors animate-in fade-in-0 duration-200",
                  HIGHLIGHT_STYLES[segment.highlight.color].className,
                )}
              >
                {segment.text}
              </span>
            ) : (
              segment.text
            )}
            {segment.notes.map((note) => (
              <button
                key={note.id}
                type="button"
                data-annotation-ui
                aria-label="Open anchored note"
                title="Open note"
                onClick={() => onOpenNotes?.(note.id)}
                className="mx-0.5 inline-flex size-4 items-center justify-center rounded-full bg-secondary align-super text-on-secondary shadow-[0_0_0_2px_var(--color-surface-container)] transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ProductIcon name="fileText" className="size-2.5" weight="bold" />
              </button>
            ))}
          </span>
        ))}
      </div>
    </article>
  );
}
