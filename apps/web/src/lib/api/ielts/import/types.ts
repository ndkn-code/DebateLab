/**
 * Shared types for the bulk-import pipeline (WS-1.1): the mapped (pre-DB) rows
 * produced by column-map, and the per-row result report produced by execute.
 */
import type { Json } from "@/types/supabase";
import type { Accent } from "./cells";

export interface MappedPassage {
  importId: string;
  rowNumber: number;
  input: {
    title: string;
    body: string;
    orderIndex: number;
    wordCount: number | null;
    genre: string | null;
    metadata: Record<string, Json>;
  };
}

export interface MappedSection {
  importId: string;
  rowNumber: number;
  input: {
    sectionNumber: number;
    script: string;
    title: string | null;
    accent: Accent;
    speakers: Array<{ name: string; accent: Accent }>;
    orderIndex: number;
    metadata: Record<string, Json>;
  };
}

/**
 * A "Question Groups" row — the shared bank / stimulus for a set of numbered
 * questions. `importId` is the group key (unique per test); member questions
 * reference it through their `Group Key` column.
 */
export interface MappedQuestionGroup {
  importId: string;
  rowNumber: number;
  passageImportId: string | null;
  sectionImportId: string | null;
  /** Cell-level problems (e.g. unparseable stimulus JSON) surfaced as plan warnings. */
  warnings: string[];
  input: {
    skill: string;
    groupKey: string;
    orderIndex: number;
    title: string | null;
    instructions: string | null;
    stimulus: Json | null;
    /** Pipe-separated bank; normalized by the canonical create path. */
    bank: string;
    bankReuse: boolean;
    answerMode: "select" | "text" | null;
    anyOrder: boolean;
    metadata: Record<string, Json>;
  };
}

/** The question fields a row maps to — links stay as import-ids until execute. */
export interface MappedQuestion {
  importId: string | null;
  rowNumber: number;
  passageImportId: string | null;
  sectionImportId: string | null;
  /** Cell-level problems (e.g. unparseable visual JSON) surfaced as plan warnings. */
  warnings?: string[];
  input: {
    skill: "listening" | "reading" | "writing" | "speaking";
    questionType: string;
    prompt: string;
    options: string;
    groupKey: string;
    groupInstructions: string;
    wordLimit: number | null;
    visual: Json | null;
    correctAnswer: string;
    acceptVariants: string;
    explanationEn: string;
    explanationVi: string;
    modelAnswer: string;
    examinerNotes: Record<string, string>;
    orderIndex: number;
    metadata: Record<string, Json>;
  };
}

export type ImportRowOutcome = "created" | "skipped" | "error";

export interface ImportRowResult {
  tab: string;
  rowNumber: number;
  importId: string | null;
  entity: "passage" | "listening_section" | "question_group" | "question";
  outcome: ImportRowOutcome;
  message?: string;
}

export interface ImportReport {
  testId: string;
  created: {
    passages: number;
    listeningSections: number;
    questionGroups: number;
    questions: number;
  };
  skipped: number;
  errors: number;
  warnings: string[];
  rows: ImportRowResult[];
}
