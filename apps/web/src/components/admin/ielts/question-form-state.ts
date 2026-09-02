/**
 * Pure state ↔ payload helpers for the IELTS question form: typed metadata
 * (`items`, `selectCount`, `slot`, `numberSpan`, `allowNumber`, `cueCard`,
 * `letter`), the `visual` union, and the key (single string vs per-blank
 * record). Unset fields are omitted from the payload — never sent as "".
 */
import type { Json } from "@/types/supabase";
import type { QuestionWithKey } from "@/lib/api/ielts/tree";
import { VisualSchema, type IeltsVisual } from "@/lib/api/ielts/visual";
import { splitPipeList } from "@/lib/api/ielts/normalize";
import {
  DEFAULT_CUE_CARD_PREP_SECONDS,
  DEFAULT_CUE_CARD_SPEAK_SECONDS,
  KNOWN_METADATA_KEYS,
  parseQuestionMetadata,
  type IeltsLetterRegister,
} from "@/lib/ielts/question-types/metadata";
import { promptBlankIds } from "@/lib/ielts/question-types/prompt";
import { optionLinesFromJson, toItemEntries } from "./authoring-utils";
import type { IeltsQuestionType } from "./ielts-ui";

// ── Type families ────────────────────────────────────────────────────────────

export const MATCHING_TYPES: ReadonlySet<IeltsQuestionType> = new Set([
  "matching_headings",
  "matching_information",
  "matching_features",
  "matching_sentence_endings",
]);
export const COMPLETION_TYPES: ReadonlySet<IeltsQuestionType> = new Set([
  "sentence_completion",
  "summary_completion",
  "note_table_form_flowchart_completion",
  "short_answer",
]);
export const LABELING_TYPES: ReadonlySet<IeltsQuestionType> = new Set([
  "diagram_label",
  "map_plan_label",
]);

/** Writing Task 1 (both modules) and labelling types carry a `visual`. */
export function usesVisual(type: IeltsQuestionType): boolean {
  return (
    LABELING_TYPES.has(type) ||
    type === "writing_task1_academic" ||
    type === "writing_task1_general"
  );
}

export function metadataRecord(raw: unknown): Record<string, Json> {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, Json>)
    : {};
}

export function jsonToText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.filter((v) => typeof v === "string").join(" | ");
  return "";
}

function linesOf(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function intOrUndefined(value: string): number | undefined {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

// ── Visual ───────────────────────────────────────────────────────────────────

export type VisualKind = "none" | "image" | "table" | "chart" | "described";

export interface VisualState {
  kind: VisualKind;
  url: string;
  alt: string;
  caption: string;
  /** `Header A | Header B` */
  headersLine: string;
  /** One row per line, cells pipe-separated. */
  rowsText: string;
  /** JSON for `{ chartType, title?, xAxisKey?, data[], series[] }`. */
  chartJson: string;
  description: string;
}

export function initVisualState(raw: unknown): VisualState {
  const state: VisualState = {
    kind: "none",
    url: "",
    alt: "",
    caption: "",
    headersLine: "",
    rowsText: "",
    chartJson: "",
    description: "",
  };
  const parsed = VisualSchema.safeParse(raw);
  if (!parsed.success) return state;
  const v = parsed.data;
  state.kind = v.type;
  if (v.type === "image") {
    state.url = v.url;
    state.alt = v.alt;
    state.caption = v.caption ?? "";
  } else if (v.type === "table") {
    state.headersLine = v.headers.join(" | ");
    state.rowsText = v.rows.map((row) => row.join(" | ")).join("\n");
    state.caption = v.caption ?? "";
  } else if (v.type === "chart") {
    const { chartType, title, xAxisKey, data, series } = v;
    state.chartJson = JSON.stringify({ chartType, title, xAxisKey, data, series }, null, 2);
  } else {
    state.description = v.description;
  }
  return state;
}

function parseChartJson(text: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Chart JSON is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Chart JSON must be an object with chartType, data and series");
  }
  return parsed as Record<string, unknown>;
}

function rawVisual(v: VisualState): unknown {
  switch (v.kind) {
    case "none":
      return null;
    case "image":
      return {
        type: "image",
        url: v.url.trim(),
        alt: v.alt.trim(),
        caption: v.caption.trim() || undefined,
      };
    case "table":
      return {
        type: "table",
        headers: splitPipeList(v.headersLine),
        rows: linesOf(v.rowsText).map((line) => line.split("|").map((cell) => cell.trim())),
        caption: v.caption.trim() || undefined,
      };
    case "chart":
      return { ...parseChartJson(v.chartJson), type: "chart" };
    case "described":
      return { type: "described", description: v.description.trim() };
  }
}

/** Editor state → validated `visual` payload (throws a readable message). */
export function buildVisual(v: VisualState): IeltsVisual | null {
  const raw = rawVisual(v);
  if (raw === null) return null;
  const parsed = VisualSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "visual"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Visual — ${issues}`);
  }
  return parsed.data;
}

// ── Typed metadata ───────────────────────────────────────────────────────────

export interface AdvancedState {
  slot: string;
  numberSpan: string;
  selectCount: string;
  /** "" = derive from instructions, "yes" / "no" = explicit. */
  allowNumber: "" | "yes" | "no";
  maxPoints: string;
  /** `id | label | text` lines (matching statements). */
  itemsText: string;
  cueTopic: string;
  cueBullets: string;
  cueClosing: string;
  cuePrep: string;
  cueSpeak: string;
  letterRecipient: string;
  letterRegister: IeltsLetterRegister;
  letterBullets: string;
}

export function initAdvancedState(question?: QuestionWithKey): AdvancedState {
  const meta = parseQuestionMetadata(question?.metadata);
  return {
    slot: meta.slot ?? "",
    numberSpan: meta.numberSpan != null ? String(meta.numberSpan) : "",
    selectCount: meta.selectCount != null ? String(meta.selectCount) : "",
    allowNumber: meta.allowNumber === undefined ? "" : meta.allowNumber ? "yes" : "no",
    maxPoints: question ? String(question.max_points) : "",
    itemsText: optionLinesFromJson(meta.items),
    cueTopic: meta.cueCard?.topic ?? "",
    cueBullets: meta.cueCard?.bullets.join("\n") ?? "",
    cueClosing: meta.cueCard?.closing ?? "",
    cuePrep: String(meta.cueCard?.prepSeconds ?? DEFAULT_CUE_CARD_PREP_SECONDS),
    cueSpeak: String(meta.cueCard?.speakSeconds ?? DEFAULT_CUE_CARD_SPEAK_SECONDS),
    letterRecipient: meta.letter?.recipient ?? "",
    letterRegister: meta.letter?.register ?? "formal",
    letterBullets: meta.letter?.bullets.join("\n") ?? "",
  };
}

function cueCardJson(adv: AdvancedState): Json {
  const closing = adv.cueClosing.trim();
  return {
    topic: adv.cueTopic.trim(),
    bullets: linesOf(adv.cueBullets),
    ...(closing ? { closing } : {}),
    prepSeconds: intOrUndefined(adv.cuePrep) ?? DEFAULT_CUE_CARD_PREP_SECONDS,
    speakSeconds: intOrUndefined(adv.cueSpeak) ?? DEFAULT_CUE_CARD_SPEAK_SECONDS,
  };
}

function letterJson(adv: AdvancedState): Json {
  return {
    recipient: adv.letterRecipient.trim(),
    register: adv.letterRegister,
    bullets: linesOf(adv.letterBullets),
  };
}

function itemsJson(adv: AdvancedState): Json[] {
  return toItemEntries(adv.itemsText).map((item) => ({
    id: item.id,
    ...(item.label ? { label: item.label } : {}),
    text: item.text,
  }));
}

/**
 * Existing metadata (adaptive tags, import ids…) is preserved; the typed keys
 * are rewritten from the form and dropped when unset.
 */
export function buildMetadata(
  base: Record<string, Json>,
  adv: AdvancedState,
  type: IeltsQuestionType,
  difficulty: string,
): Record<string, Json> {
  const out: Record<string, Json> = { ...base };
  for (const key of KNOWN_METADATA_KEYS) delete out[key];
  delete out.difficulty;
  if (difficulty) out.difficulty = difficulty;
  const slot = adv.slot.trim();
  if (slot) out.slot = slot;
  const numberSpan = type === "mcq_multi" ? intOrUndefined(adv.numberSpan) : undefined;
  if (numberSpan !== undefined) out.numberSpan = numberSpan;
  const selectCount = type === "mcq_multi" ? intOrUndefined(adv.selectCount) : undefined;
  if (selectCount !== undefined) out.selectCount = selectCount;
  if (adv.allowNumber) out.allowNumber = adv.allowNumber === "yes";
  if (MATCHING_TYPES.has(type) && adv.itemsText.trim()) out.items = itemsJson(adv);
  if (type === "speaking_part2_cuecard") out.cueCard = cueCardJson(adv);
  if (type === "writing_task1_general") out.letter = letterJson(adv);
  return out;
}

// ── Key ──────────────────────────────────────────────────────────────────────

export const NOTE_KEYS = {
  writing: ["task", "coherence", "lexical", "grammar"],
  speaking: ["fluency", "lexical", "grammar", "pronunciation"],
} as const;

export const NOTE_LABELS: Record<string, string> = {
  task: "Examiner: Task (TA/TR)",
  coherence: "Examiner: Coherence (CC)",
  lexical: "Examiner: Lexical (LR)",
  grammar: "Examiner: Grammar (GRA)",
  fluency: "Examiner: Fluency (FC)",
  pronunciation: "Examiner: Pronunciation",
};

export interface BlankKey {
  value: string;
  /** Pipe-separated accepted variants. */
  variants: string;
}

export interface KeyState {
  single: string;
  variants: string;
  blanks: Record<string, BlankKey>;
  explanationEn: string;
  explanationVi: string;
  modelAnswer: string;
  notes: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function notesRecord(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") out[k] = v;
  return out;
}

export function initKeyState(question?: QuestionWithKey): KeyState {
  const key = question?.key ?? null;
  const blanks: Record<string, BlankKey> = {};
  const answer = key?.correct_answer;
  const variants = key?.accept_variants;
  if (isRecord(answer)) {
    for (const [id, value] of Object.entries(answer)) {
      const perBlank = isRecord(variants) ? variants[id] : undefined;
      blanks[id] = { value: jsonToText(value), variants: jsonToText(perBlank) };
    }
  }
  return {
    single: isRecord(answer) ? "" : jsonToText(answer),
    variants: isRecord(variants) ? "" : jsonToText(variants),
    blanks,
    explanationEn: key?.explanation_en ?? "",
    explanationVi: key?.explanation_vi ?? "",
    modelAnswer: key?.model_answer ?? "",
    notes: notesRecord(key?.examiner_notes),
  };
}

export interface KeyPayload {
  correctAnswer: string | Record<string, string>;
  acceptVariants: string | Record<string, string[]>;
}

/** ≥2 `__BLANK_` markers → `{ blankId: answer }` record; otherwise one string. */
export function buildKey(prompt: string, key: KeyState): KeyPayload {
  const blankIds = promptBlankIds(prompt);
  if (blankIds.length < 2) {
    return { correctAnswer: key.single.trim(), acceptVariants: key.variants.trim() };
  }
  const correctAnswer: Record<string, string> = {};
  const acceptVariants: Record<string, string[]> = {};
  for (const id of blankIds) {
    const blank = key.blanks[id];
    const value = blank?.value.trim() ?? "";
    if (!value) throw new Error(`Blank "${id}" needs a correct answer`);
    correctAnswer[id] = value;
    const variants = splitPipeList(blank?.variants);
    if (variants.length > 0) acceptVariants[id] = variants;
  }
  return { correctAnswer, acceptVariants };
}

export function examinerNotesFor(
  category: "writing" | "speaking" | "objective",
  notes: Record<string, string>,
): Record<string, string> {
  if (category === "objective") return {};
  const out: Record<string, string> = {};
  for (const name of NOTE_KEYS[category]) out[name] = notes[name] ?? "";
  return out;
}
