/**
 * Column → schema mapping for each authoring-template tab (WS-1.1, spec §8).
 * Pure row mappers: fuzzy header lookup + loose coercion into the shapes the
 * canonical create paths accept. They DON'T validate (that's the canonical Zod
 * create path at execute time) — they only translate cells, tolerating variants.
 */
import type { Json } from "@/types/supabase";
import { parseLeadingInt, parseWordLimit, splitPipeList } from "../normalize";
import {
  describedVisual,
  has,
  indexRow,
  isExampleRow,
  mapPartToType,
  mapTaskToType,
  parseJsonCell,
  parseSpeakers,
  parseYesNo,
  pick,
  type HeaderIndex,
  type Row,
} from "./cells";
import type { MappedPassage, MappedQuestion, MappedQuestionGroup, MappedSection } from "./types";

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

// ---- format-variety columns (optional on every question tab) ----------------

const isSlotHeader = (h: string) => h === "slot" || h.startsWith("slot ");

/** `Slot`, `Number Span`, `Allow Number` → typed metadata (in place). */
function applyFormatMeta(index: HeaderIndex, metadata: Record<string, Json>): void {
  const slot = pick(index, isSlotHeader);
  if (slot) metadata.slot = slot;
  const span = parseLeadingInt(pick(index, has("number span")));
  if (span != null) metadata.numberSpan = span;
  const allowNumber = parseYesNo(pick(index, has("allow number")));
  if (allowNumber != null) metadata.allowNumber = allowNumber;
}

/** `Visual JSON` (typed visual) wins over the free-text `Visual/Data` cell. */
function visualCell(index: HeaderIndex, warnings: string[]): Json | null {
  const raw = pick(index, has("visual", "json"));
  if (raw) {
    const parsed = parseJsonCell(raw);
    if (parsed.error) warnings.push(`Visual JSON: ${parsed.error}`);
    return parsed.value;
  }
  return describedVisual(pick(index, (h) => h.includes("visual") && !h.includes("json")));
}

/** Part-2 cue card from `Cue Card Topic / Bullets / Closing` (topic falls back to the prompt). */
function cueCardMeta(index: HeaderIndex, prompt: string): Json | null {
  const bullets = splitPipeList(pick(index, has("cue card", "bullet")));
  if (bullets.length === 0) return null;
  const topic = pick(index, has("cue card", "topic")) || prompt;
  const closing = pick(index, has("cue card", "closing"));
  return closing ? { topic, bullets, closing } : { topic, bullets };
}

function normalizeRegister(value: string): "formal" | "semi_formal" | "informal" {
  const v = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (v.startsWith("semi")) return "semi_formal";
  if (v.startsWith("informal")) return "informal";
  return "formal";
}

/** GT Task-1 letter brief from `Letter Recipient / Register / Bullets`. */
function letterMeta(index: HeaderIndex): Json | null {
  const recipient = pick(index, has("letter", "recipient"));
  if (!recipient) return null;
  return {
    recipient,
    register: normalizeRegister(pick(index, has("letter", "register"))),
    bullets: splitPipeList(pick(index, has("letter", "bullet"))),
  };
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
  const metadata = authoringMeta(index, importId);
  applyFormatMeta(index, metadata);
  const warnings: string[] = [];
  return {
    importId,
    rowNumber,
    passageImportId: skill === "reading" ? idOf(index, "passage id") || null : null,
    sectionImportId: skill === "listening" ? idOf(index, "script id") || null : null,
    warnings,
    input: {
      skill,
      questionType: pick(index, has("question type")),
      prompt: pick(index, has("question stem")) || pick(index, has("stem")),
      options: pick(index, has("option")),
      groupKey: pick(index, has("group key")),
      groupInstructions: instructions,
      wordLimit: parseWordLimit(instructions),
      visual: visualCell(index, warnings),
      correctAnswer: pick(index, has("correct answer")),
      acceptVariants: pick(index, has("accept")),
      explanationEn: pick(index, explanationEn),
      explanationVi: pick(index, explanationVi),
      modelAnswer: "",
      examinerNotes: {},
      orderIndex: parseLeadingInt(pick(index, has("q#"))) ?? rowNumber,
      metadata,
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
  const letter = letterMeta(index);
  if (letter) metadata.letter = letter;
  const warnings: string[] = [];
  return {
    importId,
    rowNumber,
    passageImportId: null,
    sectionImportId: null,
    warnings,
    input: {
      skill: "writing",
      questionType: mapTaskToType(taskCell) ?? taskCell,
      prompt: pick(index, has("prompt")),
      options: "",
      groupKey: "",
      groupInstructions: "",
      wordLimit: null,
      visual: visualCell(index, warnings),
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
  const partCell = pick(index, (h) => h.startsWith("part"));
  const questionType = mapPartToType(partCell) ?? partCell;
  const prompt = pick(index, has("prompt"));
  const cueCard = questionType === "speaking_part2_cuecard" ? cueCardMeta(index, prompt) : null;
  if (cueCard) metadata.cueCard = cueCard;
  return {
    importId,
    rowNumber,
    passageImportId: null,
    sectionImportId: null,
    input: {
      skill: "speaking",
      questionType,
      prompt,
      options: pick(index, has("bullet")),
      groupKey: "",
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

// ---- Question Groups tab ------------------------------------------------------

function normalizeAnswerMode(value: string): "select" | "text" | null {
  const v = value.trim().toLowerCase();
  return v === "select" || v === "text" ? v : null;
}

/**
 * Columns: Group Key · Skill · Passage ID / Script ID (import ids) · Order ·
 * Title · Instructions · Stimulus JSON · Bank (pipe list) · Bank Reuse (yes/no)
 * · Answer Mode (select/text) · Any Order (yes/no).
 */
export function mapQuestionGroupRow(row: Row, rowNumber: number): MappedQuestionGroup | null {
  const index = indexRow(row);
  const groupKey = idOf(index, "group key", "id").trim().toLowerCase();
  if (isExampleRow(groupKey)) return null;
  const warnings: string[] = [];
  const stimulus = parseJsonCell(pick(index, has("stimulus")));
  if (stimulus.error) warnings.push(`Stimulus JSON: ${stimulus.error}`);
  return {
    importId: groupKey,
    rowNumber,
    passageImportId: idOf(index, "passage id") || null,
    sectionImportId: idOf(index, "script id", "section id") || null,
    warnings,
    input: {
      skill: pick(index, (h) => h === "skill").toLowerCase(),
      groupKey,
      orderIndex: parseLeadingInt(pick(index, (h) => h === "order" || h.startsWith("order"))) ?? rowNumber,
      title: pick(index, (h) => h === "title") || null,
      instructions: pick(index, has("instruction")) || null,
      stimulus: stimulus.value,
      bank: pick(index, (h) => h.includes("bank") && !h.includes("reuse")),
      bankReuse: parseYesNo(pick(index, has("reuse"))) ?? false,
      answerMode: normalizeAnswerMode(pick(index, has("answer mode"))),
      anyOrder: parseYesNo(pick(index, has("any order"))) ?? false,
      metadata: authoringMeta(index, groupKey),
    },
  };
}
