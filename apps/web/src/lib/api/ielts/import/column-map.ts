/**
 * Column → schema mapping for each authoring-template tab (WS-1.1, spec §8).
 * Pure row mappers: fuzzy header lookup + loose coercion into the shapes the
 * canonical create paths accept. They DON'T validate (that's the canonical Zod
 * create path at execute time) — they only translate cells, tolerating variants.
 */
import type { Json } from "@/types/supabase";
import { parseLeadingInt } from "../normalize";
import {
  describedVisual,
  has,
  indexRow,
  isExampleRow,
  mapPartToType,
  mapTaskToType,
  parseSpeakers,
  pick,
  type HeaderIndex,
  type Row,
} from "./cells";
import type { MappedPassage, MappedQuestion, MappedSection } from "./types";

const NUMBER_WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };

function parseWordLimit(instructions: string): number | null {
  const match = instructions.toLowerCase().match(/no more than\s+([\w-]+)\s+word/);
  if (!match) return null;
  const token = match[1];
  return parseLeadingInt(token) ?? NUMBER_WORDS[token] ?? null;
}

function authoringMeta(index: HeaderIndex, importId: string): Record<string, Json> {
  const meta: Record<string, Json> = {};
  const assign = (key: string, predicate: (h: string) => boolean) => {
    const value = pick(index, predicate);
    if (value) meta[key] = value;
  };
  if (importId) meta.importId = importId;
  assign("set", has("set"));
  assign("topic", (h) => h === "topic");
  assign("difficulty", has("difficulty"));
  assign("author", (h) => h === "author");
  assign("status", (h) => h === "status");
  assign("qaReviewer", has("qa"));
  assign("notes", has("note"));
  assign("targetBand", has("target band"));
  assign("originality", has("originality"));
  assign("audioStatus", has("audio status"));
  return meta;
}

function idOf(index: HeaderIndex, ...subs: string[]): string {
  for (const sub of subs) {
    const value = pick(index, has(sub));
    if (value) return value;
  }
  return "";
}

export function mapPassageRow(row: Row, rowNumber: number): MappedPassage | null {
  const index = indexRow(row);
  const importId = idOf(index, "passage id", "id");
  if (isExampleRow(importId)) return null;
  return {
    importId,
    rowNumber,
    input: {
      title: pick(index, (h) => h === "title"),
      body: pick(index, has("passage text")) || pick(index, (h) => h === "body"),
      orderIndex: rowNumber,
      wordCount: parseLeadingInt(pick(index, has("word count"))),
      genre: pick(index, has("genre")) || null,
      metadata: authoringMeta(index, importId),
    },
  };
}

export function mapSectionRow(row: Row, rowNumber: number): MappedSection | null {
  const index = indexRow(row);
  const importId = idOf(index, "script id", "id");
  if (isExampleRow(importId)) return null;
  const speakers = parseSpeakers(pick(index, has("speaker")));
  return {
    importId,
    rowNumber,
    input: {
      sectionNumber: parseLeadingInt(pick(index, has("section"))) ?? 1,
      script: pick(index, has("script text")) || pick(index, (h) => h === "script"),
      title: pick(index, has("context")) || null,
      accent: speakers[0]?.accent ?? "uk",
      speakers,
      orderIndex: rowNumber,
      metadata: authoringMeta(index, importId),
    },
  };
}

const explanationEn = (h: string) => h.includes("explanation") && /\b(en|eng)\b/.test(h);
const explanationVi = (h: string) => h.includes("explanation") && /\b(vn|vi|viet)\b/.test(h);

function mapObjectiveQuestion(
  index: HeaderIndex,
  rowNumber: number,
  skill: "reading" | "listening",
): MappedQuestion {
  const importId = idOf(index, "item id", "id");
  const instructions = pick(index, has("instruction"));
  return {
    importId,
    rowNumber,
    passageImportId: skill === "reading" ? idOf(index, "passage id") || null : null,
    sectionImportId: skill === "listening" ? idOf(index, "script id") || null : null,
    input: {
      skill,
      questionType: pick(index, has("question type")),
      prompt: pick(index, has("question stem")) || pick(index, has("stem")),
      options: pick(index, has("option")),
      groupInstructions: instructions,
      wordLimit: parseWordLimit(instructions),
      visual: null,
      correctAnswer: pick(index, has("correct answer")),
      acceptVariants: pick(index, has("accept")),
      explanationEn: pick(index, explanationEn),
      explanationVi: pick(index, explanationVi),
      modelAnswer: "",
      examinerNotes: {},
      orderIndex: parseLeadingInt(pick(index, has("q#"))) ?? rowNumber,
      metadata: authoringMeta(index, importId),
    },
  };
}

export function mapReadingQuestionRow(row: Row, rowNumber: number): MappedQuestion | null {
  const index = indexRow(row);
  if (isExampleRow(idOf(index, "item id", "id"))) return null;
  return mapObjectiveQuestion(index, rowNumber, "reading");
}

export function mapListeningQuestionRow(row: Row, rowNumber: number): MappedQuestion | null {
  const index = indexRow(row);
  if (isExampleRow(idOf(index, "item id", "id"))) return null;
  return mapObjectiveQuestion(index, rowNumber, "listening");
}

function examinerNote(index: HeaderIndex, ...keys: string[]): string {
  return pick(index, (h) => h.includes("examiner notes") && keys.some((k) => h.includes(k)));
}

export function mapWritingRow(row: Row, rowNumber: number): MappedQuestion | null {
  const index = indexRow(row);
  const importId = idOf(index, "item id", "id");
  if (isExampleRow(importId)) return null;
  const taskCell = pick(index, (h) => h === "task");
  const metadata = authoringMeta(index, importId);
  const wordMin = parseLeadingInt(pick(index, has("word min")));
  if (wordMin != null) metadata.wordMin = wordMin;
  return {
    importId,
    rowNumber,
    passageImportId: null,
    sectionImportId: null,
    input: {
      skill: "writing",
      questionType: mapTaskToType(taskCell) ?? taskCell,
      prompt: pick(index, has("prompt")),
      options: "",
      groupInstructions: "",
      wordLimit: null,
      visual: describedVisual(pick(index, has("visual"))),
      correctAnswer: "",
      acceptVariants: "",
      explanationEn: "",
      explanationVi: "",
      modelAnswer: pick(index, has("model answer")),
      examinerNotes: {
        task: examinerNote(index, "ta", "tr"),
        coherence: examinerNote(index, "cc"),
        lexical: examinerNote(index, "lr"),
        grammar: examinerNote(index, "gra"),
      },
      orderIndex: rowNumber,
      metadata,
    },
  };
}

export function mapSpeakingRow(row: Row, rowNumber: number): MappedQuestion | null {
  const index = indexRow(row);
  const importId = idOf(index, "item id", "id");
  if (isExampleRow(importId)) return null;
  const metadata = authoringMeta(index, importId);
  const followups = pick(index, has("follow"));
  if (followups) metadata.followups = followups;
  return {
    importId,
    rowNumber,
    passageImportId: null,
    sectionImportId: null,
    input: {
      skill: "speaking",
      questionType:
        mapPartToType(pick(index, (h) => h.startsWith("part"))) ??
        pick(index, (h) => h.startsWith("part")),
      prompt: pick(index, has("prompt")),
      options: pick(index, has("bullet")),
      groupInstructions: "",
      wordLimit: null,
      visual: null,
      correctAnswer: "",
      acceptVariants: "",
      explanationEn: "",
      explanationVi: "",
      modelAnswer: pick(index, (h) => h.includes("sample") || h.includes("model")),
      examinerNotes: {
        fluency: examinerNote(index, "fc", "fluency"),
        lexical: examinerNote(index, "lr"),
        grammar: examinerNote(index, "gra"),
        pronunciation: examinerNote(index, "pron"),
      },
      orderIndex: rowNumber,
      metadata,
    },
  };
}
