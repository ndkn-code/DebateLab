"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  mockAnnotationKey,
  type Highlight,
  type Note,
  useMockAnnotationsStore,
} from "@/lib/stores/mockAnnotationsStore";
import { HIGHLIGHT_STYLES } from "./exam/annotation-styles";

const EMPTY_HIGHLIGHTS: Highlight[] = [];
const EMPTY_NOTES: Note[] = [];

function managedTextNodes(container: HTMLElement): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || parent.closest("[data-annotation-ui]")) return NodeFilter.FILTER_REJECT;
      return node.textContent?.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

function clearManagedAnnotations(container: HTMLElement): void {
  container.querySelectorAll("[data-note-anchor-indicator]").forEach((element) => element.remove());
  container.querySelectorAll("[data-question-highlight]").forEach((element) => {
    const parent = element.parentNode;
    if (!parent) return;
    while (element.firstChild) parent.insertBefore(element.firstChild, element);
    element.remove();
  });
  container.normalize();
}

function wrapHighlight(
  container: HTMLElement,
  questionId: string,
  highlight: Highlight,
  onRemove: (highlightId: string) => void,
): void {
  const nodes = managedTextNodes(container);
  let cursor = 0;
  const intersections: Array<{ node: Text; start: number; end: number }> = [];
  for (const node of nodes) {
    const nodeStart = cursor;
    const nodeEnd = cursor + node.length;
    const start = Math.max(highlight.start, nodeStart) - nodeStart;
    const end = Math.min(highlight.end, nodeEnd) - nodeStart;
    if (end > start) intersections.push({ node, start, end });
    cursor = nodeEnd;
  }

  for (const intersection of intersections.reverse()) {
    const range = document.createRange();
    range.setStart(intersection.node, intersection.start);
    range.setEnd(intersection.node, intersection.end);
    const span = document.createElement("span");
    span.dataset.questionHighlight = highlight.id;
    span.dataset.questionId = questionId;
    span.className = `box-decoration-clone rounded px-0.5 ${HIGHLIGHT_STYLES[highlight.color].className}`;
    span.title = "Click to remove highlight";
    span.addEventListener("click", (event) => {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim()) return;
      event.preventDefault();
      event.stopPropagation();
      onRemove(highlight.id);
    });
    try {
      range.surroundContents(span);
    } catch {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
    }
    range.detach();
  }
}

function insertNoteMarker(
  container: HTMLElement,
  note: Note,
  onOpenNotes: (noteId: string) => void,
): void {
  const offset = note.anchor.range.end;
  const nodes = managedTextNodes(container);
  let cursor = 0;
  for (const node of nodes) {
    const next = cursor + node.length;
    if (offset <= next) {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.dataset.noteAnchorIndicator = note.id;
      marker.dataset.annotationUi = "true";
      marker.setAttribute("aria-label", "Open anchored note");
      marker.title = "Open note";
      marker.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpenNotes(note.id);
      });
      const interactive = node.parentElement?.closest(
        "button, a, [role=button], [role=radio], [role=checkbox]",
      );
      if (interactive && container.contains(interactive) && interactive.parentNode) {
        marker.className =
          "absolute right-12 top-2 size-2.5 rounded-full bg-secondary shadow-[0_0_0_2px_var(--color-surface)] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
        interactive.parentNode.insertBefore(marker, interactive.nextSibling);
      } else {
        marker.className =
          "mx-0.5 inline-block size-2.5 rounded-full bg-secondary align-super shadow-[0_0_0_2px_var(--color-surface)] transition-transform hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";
        const range = document.createRange();
        range.setStart(node, Math.max(0, Math.min(node.length, offset - cursor)));
        range.collapse(true);
        range.insertNode(marker);
        range.detach();
      }
      return;
    }
    cursor = next;
  }
}

export function QuestionHighlighter({
  questionId,
  onOpenNotes,
  children,
}: {
  questionId: string;
  onOpenNotes?: (noteId: string) => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const activeAttemptId = useMockAnnotationsStore((state) => state.activeAttemptId);
  const highlights = useMockAnnotationsStore((state) =>
    activeAttemptId
      ? (state.highlights[mockAnnotationKey(activeAttemptId, questionId)] ?? EMPTY_HIGHLIGHTS)
      : EMPTY_HIGHLIGHTS,
  );
  const notes = useMockAnnotationsStore((state) =>
    activeAttemptId
      ? (state.notes[mockAnnotationKey(activeAttemptId, questionId)] ?? EMPTY_NOTES)
      : EMPTY_NOTES,
  );
  const removeHighlight = useMockAnnotationsStore((state) => state.removeHighlight);

  useLayoutEffect(() => {
    const container = ref.current;
    if (!container) return undefined;
    clearManagedAnnotations(container);
    for (const highlight of highlights) {
      wrapHighlight(container, questionId, highlight, (highlightId) => {
        removeHighlight(questionId, highlightId);
      });
    }
    for (const note of notes) insertNoteMarker(container, note, onOpenNotes ?? (() => undefined));
    return () => clearManagedAnnotations(container);
  });

  return (
    <div
      ref={ref}
      data-annotation-kind="question"
      data-annotation-key={questionId}
      className="min-w-0 flex-1 select-text"
    >
      {children}
    </div>
  );
}
