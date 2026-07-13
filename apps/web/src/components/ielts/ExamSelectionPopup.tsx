"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ProductIcon } from "@/components/ui/product-icon";
import {
  type MockHighlightColor,
  type NoteAnchor,
  useMockAnnotationsStore,
} from "@/lib/stores/mockAnnotationsStore";
import { cn } from "@/lib/utils";
import { HIGHLIGHT_STYLES } from "./exam/annotation-styles";

interface PendingSelection {
  anchorKey: string;
  anchor: NoteAnchor;
  quote: string;
  x: number;
  y: number;
  above: boolean;
}

interface ExamSelectionPopupProps {
  highlightMode: boolean;
  selectedColor: MockHighlightColor;
  onNoteCreated: (noteId: string) => void;
}

function offsetInContainer(container: HTMLElement, node: Node, offset: number): number | null {
  if (!container.contains(node)) return null;
  const range = document.createRange();
  range.selectNodeContents(container);
  try {
    range.setEnd(node, offset);
    return range.toString().length;
  } catch {
    return null;
  } finally {
    range.detach();
  }
}

function annotationContainerFor(node: Node): HTMLElement | null {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return element?.closest<HTMLElement>("[data-annotation-kind][data-annotation-key]") ?? null;
}

function readSelection(): PendingSelection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  const container = annotationContainerFor(range.commonAncestorContainer);
  if (
    !container ||
    !container.contains(range.startContainer) ||
    !container.contains(range.endContainer)
  ) {
    return null;
  }
  const anchorKey = container.dataset.annotationKey;
  const kind = container.dataset.annotationKind;
  const start = offsetInContainer(container, range.startContainer, range.startOffset);
  const end = offsetInContainer(container, range.endContainer, range.endOffset);
  const quote = range.toString().trim();
  if (!anchorKey || !kind || start === null || end === null || end <= start || !quote) return null;

  const annotationRange = { start, end };
  const anchor: NoteAnchor = kind === "passage"
    ? { kind: "passage", passageKey: anchorKey, range: annotationRange }
    : { kind: "question", questionId: anchorKey, range: annotationRange };
  const rect = range.getBoundingClientRect();
  const x = Math.min(window.innerWidth - 12, Math.max(12, rect.left + rect.width / 2));
  const roomBelow = window.innerHeight - rect.bottom;
  const above = roomBelow <= 72;
  const y = above ? rect.top - 10 : rect.bottom + 10;
  return { anchorKey, anchor, quote, x, y, above };
}

export function ExamSelectionPopup({
  highlightMode,
  selectedColor,
  onNoteCreated,
}: ExamSelectionPopupProps) {
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const addHighlight = useMockAnnotationsStore((state) => state.addHighlight);
  const addNote = useMockAnnotationsStore((state) => state.addNote);

  const captureSelection = useCallback(() => {
    setPending(readSelection());
  }, []);

  useEffect(() => {
    const handleMouseUp = (event: MouseEvent) => {
      if (popupRef.current?.contains(event.target as Node)) return;
      window.setTimeout(captureSelection, 10);
    };
    const handleTouchEnd = () => window.setTimeout(captureSelection, 120);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [captureSelection]);

  useEffect(() => {
    if (!pending) return undefined;
    const handlePointerDown = (event: PointerEvent) => {
      if (!popupRef.current?.contains(event.target as Node)) setPending(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPending(null);
      window.getSelection()?.removeAllRanges();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pending]);

  const finish = () => {
    setPending(null);
    window.getSelection()?.removeAllRanges();
  };

  if (!pending || typeof document === "undefined") return null;
  const colorStyle = HIGHLIGHT_STYLES[selectedColor];

  return createPortal(
    <div
      ref={popupRef}
      data-annotation-ui
      role="toolbar"
      aria-label="Selection actions"
      style={{ left: pending.x, top: pending.y }}
      className={cn(
        "fixed z-[2147483647] flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-outline-variant bg-surface p-1.5 text-on-surface shadow-xl animate-in fade-in zoom-in-95 duration-150",
        pending.above && "-translate-y-full",
      )}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        disabled={!highlightMode}
        onClick={() => {
          addHighlight(
            pending.anchorKey,
            pending.anchor.range.start,
            pending.anchor.range.end,
            selectedColor,
          );
          finish();
        }}
        className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-xs font-extrabold transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
      >
        <span className={cn("size-3.5 rounded-full", colorStyle.className)} />
        Highlight
      </button>
      <span className="h-6 w-px bg-outline-variant" aria-hidden="true" />
      <button
        type="button"
        onClick={() => {
          const note = addNote(pending.anchorKey, pending.quote, pending.anchor);
          if (note) onNoteCreated(note.id);
          finish();
        }}
        className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-xs font-extrabold transition hover:bg-secondary-container hover:text-on-secondary-container"
      >
        <ProductIcon name="fileText" size="sm" weight="bold" />
        Note
      </button>
    </div>,
    document.body,
  );
}
