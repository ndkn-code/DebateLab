"use client";

import { create } from "zustand";

export const MOCK_HIGHLIGHT_COLORS = [
  "yellow",
  "green",
  "blue",
  "purple",
  "orange",
] as const;

export type MockHighlightColor = (typeof MOCK_HIGHLIGHT_COLORS)[number];

export interface Highlight {
  id: string;
  start: number;
  end: number;
  color: MockHighlightColor;
}

export interface HighlightSegment {
  start: number;
  end: number;
  text: string;
  highlight: Highlight | null;
}

export interface AnnotationRange {
  start: number;
  end: number;
}

export type NoteAnchor =
  | { kind: "passage"; passageKey: string; range: AnnotationRange }
  | { kind: "question"; questionId: string; range: AnnotationRange };

export interface Note {
  id: string;
  quote: string;
  body: string;
  anchor: NoteAnchor;
}

interface MockAnnotationsState {
  activeAttemptId: string | null;
  highlights: Record<string, Highlight[]>;
  flags: Record<string, true>;
  notes: Record<string, Note[]>;
  eliminations: Record<string, Set<string>>;
  hydrateAttempt: (attemptId: string) => void;
  clearActiveAttempt: () => void;
  addHighlight: (
    passageKey: string,
    start: number,
    end: number,
    color: MockHighlightColor,
  ) => Highlight | null;
  removeHighlight: (passageKey: string, highlightId: string) => void;
  clearHighlights: (passageKey: string) => void;
  addNote: (anchorKey: string, quote: string, anchor: NoteAnchor) => Note | null;
  editNote: (anchorKey: string, noteId: string, body: string) => void;
  removeNote: (anchorKey: string, noteId: string) => void;
  toggleFlag: (questionId: string) => void;
  clearFlag: (questionId: string) => void;
  toggleElimination: (questionId: string, optionId: string) => void;
  clearElimination: (questionId: string, optionId: string) => void;
  clearQuestionEliminations: (questionId: string) => void;
}

const STORAGE_VERSION = 1;
export const MOCK_ANNOTATION_PERSIST_DEBOUNCE_MS = 250;

const VALID_COLORS = new Set<MockHighlightColor>(MOCK_HIGHLIGHT_COLORS);
let persistTimer: ReturnType<typeof setTimeout> | null = null;

export function mockAnnotationKey(attemptId: string, entityId: string): string {
  return `${attemptId}:${entityId}`;
}

function attemptPrefix(attemptId: string): string {
  return `${attemptId}:`;
}

function storageKey(attemptId: string): string {
  return `ielts-mock-annotations-${attemptId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && window.localStorage != null;
}

function sanitizeHighlight(value: unknown): Highlight | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || candidate.id.length === 0) return null;
  if (typeof candidate.color !== "string" || !VALID_COLORS.has(candidate.color as MockHighlightColor)) {
    return null;
  }
  const start = Number(candidate.start);
  const end = Number(candidate.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {
    id: candidate.id,
    start,
    end,
    color: candidate.color as MockHighlightColor,
  };
}

function sanitizeHighlightRecord(value: unknown, attemptId: string): Record<string, Highlight[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const prefix = attemptPrefix(attemptId);
  const output: Record<string, Highlight[]> = {};
  for (const [key, rawHighlights] of Object.entries(value as Record<string, unknown>)) {
    if (!key.startsWith(prefix) || !Array.isArray(rawHighlights)) continue;
    const highlights = rawHighlights
      .map(sanitizeHighlight)
      .filter((highlight): highlight is Highlight => highlight !== null);
    if (highlights.length > 0) output[key] = highlights;
  }
  return output;
}

function sanitizeFlagRecord(value: unknown, attemptId: string): Record<string, true> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const prefix = attemptPrefix(attemptId);
  const output: Record<string, true> = {};
  for (const [key, flagged] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith(prefix) && flagged === true) output[key] = true;
  }
  return output;
}

function sanitizeRange(value: unknown): AnnotationRange | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const range = normalizedRange(Number(candidate.start), Number(candidate.end));
  return range ? { start: range[0], end: range[1] } : null;
}

function sanitizeNote(value: unknown): Note | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.id !== "string" || candidate.id.length === 0) return null;
  if (typeof candidate.quote !== "string" || typeof candidate.body !== "string") return null;
  if (!candidate.anchor || typeof candidate.anchor !== "object") return null;
  const rawAnchor = candidate.anchor as Record<string, unknown>;
  const range = sanitizeRange(rawAnchor.range);
  if (!range) return null;
  if (rawAnchor.kind === "passage" && typeof rawAnchor.passageKey === "string") {
    return {
      id: candidate.id,
      quote: candidate.quote,
      body: candidate.body,
      anchor: { kind: "passage", passageKey: rawAnchor.passageKey, range },
    };
  }
  if (rawAnchor.kind === "question" && typeof rawAnchor.questionId === "string") {
    return {
      id: candidate.id,
      quote: candidate.quote,
      body: candidate.body,
      anchor: { kind: "question", questionId: rawAnchor.questionId, range },
    };
  }
  return null;
}

function sanitizeNoteRecord(value: unknown, attemptId: string): Record<string, Note[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const prefix = attemptPrefix(attemptId);
  const output: Record<string, Note[]> = {};
  for (const [key, rawNotes] of Object.entries(value as Record<string, unknown>)) {
    if (!key.startsWith(prefix) || !Array.isArray(rawNotes)) continue;
    const notes = rawNotes.map(sanitizeNote).filter((note): note is Note => note !== null);
    if (notes.length > 0) output[key] = notes;
  }
  return output;
}

function readPersistedAnnotations(attemptId: string): {
  highlights: Record<string, Highlight[]>;
  flags: Record<string, true>;
  notes: Record<string, Note[]>;
} {
  if (!canUseStorage()) return { highlights: {}, flags: {}, notes: {} };
  try {
    const raw = window.localStorage.getItem(storageKey(attemptId));
    if (!raw) return { highlights: {}, flags: {}, notes: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return { highlights: {}, flags: {}, notes: {} };
    const record = parsed as Record<string, unknown>;
    return {
      highlights: sanitizeHighlightRecord(record.highlights, attemptId),
      flags: sanitizeFlagRecord(record.flags, attemptId),
      notes: sanitizeNoteRecord(record.notes, attemptId),
    };
  } catch {
    return { highlights: {}, flags: {}, notes: {} };
  }
}

function highlightsForAttempt(
  highlights: Record<string, Highlight[]>,
  attemptId: string,
): Record<string, Highlight[]> {
  const prefix = attemptPrefix(attemptId);
  return Object.fromEntries(
    Object.entries(highlights).filter((entry): entry is [string, Highlight[]] => {
      const [key, value] = entry;
      return key.startsWith(prefix) && value.length > 0;
    }),
  );
}

function flagsForAttempt(
  flags: Record<string, true>,
  attemptId: string,
): Record<string, true> {
  const prefix = attemptPrefix(attemptId);
  return Object.fromEntries(
    Object.entries(flags).filter(([key]) => key.startsWith(prefix)),
  );
}

function notesForAttempt(notes: Record<string, Note[]>, attemptId: string): Record<string, Note[]> {
  const prefix = attemptPrefix(attemptId);
  return Object.fromEntries(
    Object.entries(notes).filter(([key, value]) => key.startsWith(prefix) && value.length > 0),
  );
}

function omitAttemptSets(
  eliminations: Record<string, Set<string>>,
  attemptId: string,
): Record<string, Set<string>> {
  const prefix = attemptPrefix(attemptId);
  return Object.fromEntries(
    Object.entries(eliminations).filter(([key]) => !key.startsWith(prefix)),
  );
}

function persistAnnotationsNow(
  attemptId: string,
  highlights: Record<string, Highlight[]>,
  flags: Record<string, true>,
  notes: Record<string, Note[]>,
): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (!canUseStorage()) return;
  try {
    const scopedHighlights = highlightsForAttempt(highlights, attemptId);
    const scopedFlags = flagsForAttempt(flags, attemptId);
    const scopedNotes = notesForAttempt(notes, attemptId);
    if (
      Object.keys(scopedHighlights).length === 0 &&
      Object.keys(scopedFlags).length === 0 &&
      Object.keys(scopedNotes).length === 0
    ) {
      window.localStorage.removeItem(storageKey(attemptId));
      return;
    }
    window.localStorage.setItem(
      storageKey(attemptId),
      JSON.stringify({
        version: STORAGE_VERSION,
        highlights: scopedHighlights,
        flags: scopedFlags,
        notes: scopedNotes,
      }),
    );
  } catch {
    // Browser storage can be unavailable or quota-limited. Annotation UI should
    // remain usable even when persistence quietly cannot complete.
  }
}

function scheduleAnnotationPersist(
  attemptId: string,
  highlights: Record<string, Highlight[]>,
  flags: Record<string, true>,
  notes: Record<string, Note[]>,
): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistAnnotationsNow(attemptId, highlights, flags, notes);
  }, MOCK_ANNOTATION_PERSIST_DEBOUNCE_MS);
}

function createAnnotationId(prefix: "highlight" | "note"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizedRange(start: number, end: number): [number, number] | null {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return null;
  return [from, to];
}

export function buildHighlightSegments(
  text: string,
  highlights: Highlight[],
): HighlightSegment[] {
  if (text.length === 0) return [];
  const normalized = highlights
    .map((highlight, index) => {
      const start = Math.max(0, Math.min(text.length, Math.floor(highlight.start)));
      const end = Math.max(0, Math.min(text.length, Math.floor(highlight.end)));
      return end > start ? { ...highlight, start, end, index } : null;
    })
    .filter((highlight): highlight is Highlight & { index: number } => highlight !== null);

  if (normalized.length === 0) {
    return [{ start: 0, end: text.length, text, highlight: null }];
  }

  const boundaries = new Set<number>([0, text.length]);
  for (const highlight of normalized) {
    boundaries.add(highlight.start);
    boundaries.add(highlight.end);
  }

  const points = [...boundaries].sort((a, b) => a - b);
  const segments: HighlightSegment[] = [];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    if (end <= start) continue;
    let active: (Highlight & { index: number }) | null = null;
    for (const highlight of normalized) {
      if (highlight.start <= start && highlight.end >= end) active = highlight;
    }
    segments.push({
      start,
      end,
      text: text.slice(start, end),
      highlight: active
        ? {
            id: active.id,
            start: active.start,
            end: active.end,
            color: active.color,
          }
        : null,
    });
  }
  return segments;
}

export const useMockAnnotationsStore = create<MockAnnotationsState>((set, get) => ({
  activeAttemptId: null,
  highlights: {},
  flags: {},
  notes: {},
  eliminations: {},

  hydrateAttempt: (attemptId) =>
    set((state) => {
      const persisted = readPersistedAnnotations(attemptId);
      return {
        activeAttemptId: attemptId,
        highlights: {
          ...state.highlights,
          ...persisted.highlights,
        },
        flags: {
          ...state.flags,
          ...persisted.flags,
        },
        notes: {
          ...state.notes,
          ...persisted.notes,
        },
        eliminations:
          state.activeAttemptId && state.activeAttemptId !== attemptId
            ? omitAttemptSets(state.eliminations, state.activeAttemptId)
            : state.eliminations,
      };
    }),

  clearActiveAttempt: () =>
    set((state) => {
      if (!state.activeAttemptId) return state;
      persistAnnotationsNow(
        state.activeAttemptId,
        state.highlights,
        state.flags,
        state.notes,
      );
      return {
        activeAttemptId: null,
        eliminations: omitAttemptSets(state.eliminations, state.activeAttemptId),
      };
    }),

  addHighlight: (passageKey, start, end, color) => {
    const attemptId = get().activeAttemptId;
    const range = normalizedRange(start, end);
    if (!attemptId || !range || !VALID_COLORS.has(color)) return null;
    const [from, to] = range;
    const key = mockAnnotationKey(attemptId, passageKey);
    const highlight: Highlight = {
      id: createAnnotationId("highlight"),
      start: from,
      end: to,
      color,
    };
    set((state) => ({
      highlights: {
        ...state.highlights,
        [key]: [...(state.highlights[key] ?? []), highlight],
      },
    }));
    scheduleAnnotationPersist(attemptId, get().highlights, get().flags, get().notes);
    return highlight;
  },

  removeHighlight: (passageKey, highlightId) => {
    const attemptId = get().activeAttemptId;
    if (!attemptId) return;
    const key = mockAnnotationKey(attemptId, passageKey);
    set((state) => {
      const nextForKey = (state.highlights[key] ?? []).filter(
        (highlight) => highlight.id !== highlightId,
      );
      const highlights = { ...state.highlights };
      if (nextForKey.length > 0) highlights[key] = nextForKey;
      else delete highlights[key];
      return { highlights };
    });
    scheduleAnnotationPersist(attemptId, get().highlights, get().flags, get().notes);
  },

  clearHighlights: (passageKey) => {
    const attemptId = get().activeAttemptId;
    if (!attemptId) return;
    const key = mockAnnotationKey(attemptId, passageKey);
    set((state) => {
      const highlights = { ...state.highlights };
      delete highlights[key];
      return { highlights };
    });
    scheduleAnnotationPersist(attemptId, get().highlights, get().flags, get().notes);
  },

  addNote: (anchorKey, quote, anchor) => {
    const attemptId = get().activeAttemptId;
    const trimmedQuote = quote.trim();
    if (!attemptId || trimmedQuote.length === 0) return null;
    const key = mockAnnotationKey(attemptId, anchorKey);
    const note: Note = {
      id: createAnnotationId("note"),
      quote: trimmedQuote,
      body: "",
      anchor,
    };
    set((state) => ({
      notes: { ...state.notes, [key]: [...(state.notes[key] ?? []), note] },
    }));
    scheduleAnnotationPersist(attemptId, get().highlights, get().flags, get().notes);
    return note;
  },

  editNote: (anchorKey, noteId, body) => {
    const attemptId = get().activeAttemptId;
    if (!attemptId) return;
    const key = mockAnnotationKey(attemptId, anchorKey);
    set((state) => ({
      notes: {
        ...state.notes,
        [key]: (state.notes[key] ?? []).map((note) =>
          note.id === noteId ? { ...note, body } : note,
        ),
      },
    }));
    scheduleAnnotationPersist(attemptId, get().highlights, get().flags, get().notes);
  },

  removeNote: (anchorKey, noteId) => {
    const attemptId = get().activeAttemptId;
    if (!attemptId) return;
    const key = mockAnnotationKey(attemptId, anchorKey);
    set((state) => {
      const notes = { ...state.notes };
      const remaining = (notes[key] ?? []).filter((note) => note.id !== noteId);
      if (remaining.length > 0) notes[key] = remaining;
      else delete notes[key];
      return { notes };
    });
    scheduleAnnotationPersist(attemptId, get().highlights, get().flags, get().notes);
  },

  toggleFlag: (questionId) => {
    const attemptId = get().activeAttemptId;
    if (!attemptId) return;
    const key = mockAnnotationKey(attemptId, questionId);
    set((state) => {
      const flags = { ...state.flags };
      if (flags[key]) delete flags[key];
      else flags[key] = true;
      return { flags };
    });
    scheduleAnnotationPersist(attemptId, get().highlights, get().flags, get().notes);
  },

  clearFlag: (questionId) => {
    const attemptId = get().activeAttemptId;
    if (!attemptId) return;
    const key = mockAnnotationKey(attemptId, questionId);
    set((state) => {
      if (!state.flags[key]) return state;
      const flags = { ...state.flags };
      delete flags[key];
      return { flags };
    });
    scheduleAnnotationPersist(attemptId, get().highlights, get().flags, get().notes);
  },

  toggleElimination: (questionId, optionId) => {
    const attemptId = get().activeAttemptId;
    if (!attemptId) return;
    const key = mockAnnotationKey(attemptId, questionId);
    set((state) => {
      const next = new Set(state.eliminations[key] ?? []);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      const eliminations = { ...state.eliminations };
      if (next.size > 0) eliminations[key] = next;
      else delete eliminations[key];
      return { eliminations };
    });
  },

  clearElimination: (questionId, optionId) => {
    const attemptId = get().activeAttemptId;
    if (!attemptId) return;
    const key = mockAnnotationKey(attemptId, questionId);
    set((state) => {
      const existing = state.eliminations[key];
      if (!existing?.has(optionId)) return state;
      const next = new Set(existing);
      next.delete(optionId);
      const eliminations = { ...state.eliminations };
      if (next.size > 0) eliminations[key] = next;
      else delete eliminations[key];
      return { eliminations };
    });
  },

  clearQuestionEliminations: (questionId) => {
    const attemptId = get().activeAttemptId;
    if (!attemptId) return;
    const key = mockAnnotationKey(attemptId, questionId);
    set((state) => {
      if (!state.eliminations[key]) return state;
      const eliminations = { ...state.eliminations };
      delete eliminations[key];
      return { eliminations };
    });
  },
}));
