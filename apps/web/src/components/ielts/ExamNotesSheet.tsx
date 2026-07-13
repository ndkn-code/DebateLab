"use client";

import { useEffect, useMemo } from "react";
import { ProductIcon } from "@/components/ui/product-icon";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { type Note, useMockAnnotationsStore } from "@/lib/stores/mockAnnotationsStore";
import { cn } from "@/lib/utils";
import type { MockPart } from "./mock-parts";

interface NoteEntry {
  anchorKey: string;
  note: Note;
  label: string;
}

function partLabels(parts: MockPart[]): Map<string, string> {
  const labels = new Map<string, string>();
  let numberOffset = 0;
  parts.forEach((part, partIndex) => {
    const first = numberOffset + 1;
    const last = numberOffset + part.questions.length;
    const range = part.questions.length > 0
      ? `Questions ${first}\u2013${last}`
      : "Task notes";
    const label = `Part ${partIndex + 1} · ${range}`;
    labels.set(part.id, label);
    part.questions.forEach((question) => labels.set(question.id, label));
    numberOffset = last;
  });
  return labels;
}

export function ExamNotesSheet({
  open,
  attemptId,
  activeNoteId,
  parts,
  onOpenChange,
  onJumpToNote,
}: {
  open: boolean;
  attemptId: string;
  activeNoteId: string | null;
  parts: MockPart[];
  onOpenChange: (open: boolean) => void;
  onJumpToNote: (note: Note) => void;
}) {
  const notes = useMockAnnotationsStore((state) => state.notes);
  const editNote = useMockAnnotationsStore((state) => state.editNote);
  const removeNote = useMockAnnotationsStore((state) => state.removeNote);
  const entries = useMemo(() => {
    const labels = partLabels(parts);
    const prefix = `${attemptId}:`;
    return Object.entries(notes).flatMap(([key, values]) => {
      if (!key.startsWith(prefix)) return [];
      const anchorKey = key.slice(prefix.length);
      return values.map((note): NoteEntry => ({
        anchorKey,
        note,
        label: labels.get(anchorKey) ?? "Exam notes",
      }));
    });
  }, [attemptId, notes, parts]);

  useEffect(() => {
    if (!open || !activeNoteId) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`exam-note-${activeNoteId}`)?.focus();
    }, 200);
    return () => window.clearTimeout(timer);
  }, [activeNoteId, open]);

  const jumpToNote = (entry: NoteEntry) => {
    onOpenChange(false);
    onJumpToNote(entry.note);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="z-[1000] w-[min(92vw,26rem)] gap-0 border-outline-variant bg-surface p-0 sm:max-w-md">
        <SheetHeader className="border-b border-outline-variant px-5 py-4">
          <SheetTitle className="font-display text-lg font-extrabold text-on-surface">
            Exam notes
          </SheetTitle>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {entries.length === 0 ? (
            <div className="flex min-h-48 flex-col items-center justify-center rounded-3xl border border-dashed border-outline-variant bg-surface-container-low p-6 text-center">
              <ProductIcon name="fileText" size="lg" className="text-primary" />
              <p className="mt-3 text-sm font-bold text-on-surface">No notes yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((entry) => (
                <article
                  key={entry.note.id}
                  className={cn(
                    "rounded-3xl border border-outline-variant bg-surface-container-low p-4 transition-shadow",
                    activeNoteId === entry.note.id && "ring-2 ring-secondary",
                  )}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs font-extrabold text-secondary">{entry.label}</p>
                    <button
                      type="button"
                      onClick={() => jumpToNote(entry)}
                      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-primary hover:bg-primary-container"
                    >
                      <ProductIcon name="mouseClick" size="xs" weight="bold" />
                      Jump
                    </button>
                  </div>
                  <blockquote className="mb-3 border-l-2 border-secondary pl-3 text-sm font-semibold text-on-surface">
                    “{entry.note.quote}”
                  </blockquote>
                  <textarea
                    id={`exam-note-${entry.note.id}`}
                    value={entry.note.body}
                    onChange={(event) => editNote(entry.anchorKey, entry.note.id, event.target.value)}
                    placeholder="Write your note…"
                    rows={4}
                    className="w-full resize-y rounded-2xl border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface outline-none transition focus:border-primary focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="button"
                    onClick={() => removeNote(entry.anchorKey, entry.note.id)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-extrabold tracking-wide text-error transition hover:bg-error-container"
                  >
                    <ProductIcon name="trash" size="xs" weight="bold" />
                    DELETE
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
