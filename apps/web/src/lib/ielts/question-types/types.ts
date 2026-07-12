/**
 * IELTS objective question-type contract (WS-1.2).
 *
 * The single shared vocabulary used by the learner-facing renderers
 * (`components/ielts/questions/*`), the server-authoritative scorers
 * (`lib/scoring/ielts/*`), and the grading repository (`lib/api/ielts/*`).
 *
 * Three layers are deliberately separated by secrecy:
 *  - {@link IeltsQuestionView} — NON-secret, parsed from `ielts_questions`; safe
 *    to send to the client (prompt, options, items, visual).
 *  - {@link IeltsAnswer} — the learner's submission; also non-secret.
 *  - {@link IeltsAnswerKey} — SECRET; parsed from `ielts_question_keys` and only
 *    ever read server-side via the service-role client. Never serialised to a
 *    renderer or returned from a server action.
 *  - {@link IeltsVerdict} — the grading result; key-free and safe to return.
 *
 * Every objective `ielts_questions` row resolves to one or more answerable
 * slots ("blanks"). A blank is graded by its {@link BlankMode}; a question's
 * score is the sum over its blanks. This collapses 13 question types onto three
 * grading modes + five renderer families — see {@link IeltsQuestionFamily}.
 */
import type { Enums } from "@/types/supabase";
import type { IeltsVisual as AuthoredIeltsVisual } from "@/lib/api/ielts/visual";

export type IeltsQuestionType = Enums<"ielts_question_type">;
export type IeltsSkill = Enums<"ielts_skill">;

/** How a single answerable slot is graded. */
export type BlankMode = "select" | "multi_select" | "text";

/**
 * Renderer family — drives which player component renders a type and the
 * default grading mode of its blanks. Orthogonal to skill (listening/reading).
 */
export type IeltsQuestionFamily =
  | "single_select" // mcq_single, true_false_notgiven, yes_no_notgiven
  | "multi_select" // mcq_multi
  | "matching" // matching_headings, matching_information, matching_features
  | "completion" // sentence/summary/note_table_form_flowchart/short_answer
  | "labeling"; // diagram_label, map_plan_label

// ── Non-secret, learner-facing shapes (parsed from `ielts_questions`) ─────────

/** A selectable choice or a shared-bank entry (headings, features, options). */
export interface IeltsOption {
  /** Stable id referenced by answers and keys. */
  id: string;
  /** Display marker, e.g. "A", "i", "1". */
  label?: string;
  text: string;
}

/** A statement to be matched (matching_*) — its `id` is the blank id. */
export interface IeltsMatchItem {
  id: string;
  label?: string;
  text: string;
}

/** A blank embedded in a table/note/flowchart cell. */
export interface IeltsVisualGap {
  id: string;
  label?: string;
}

export interface IeltsTableCell {
  text?: string;
  gap?: IeltsVisualGap;
}

type AuthoredVisualOfKind<Kind extends AuthoredIeltsVisual["type"]> = Extract<
  AuthoredIeltsVisual,
  { type: Kind }
>;

type WithKind<Visual extends { type: string }> = Omit<Visual, "type"> & {
  kind: Visual["type"];
};

export type IeltsTableVisual = Omit<
  WithKind<AuthoredVisualOfKind<"table">>,
  "rows"
> & {
  /** Row-major grid; a cell is either static `text` or a `gap` input. */
  rows: IeltsTableCell[][];
};

/** A labelable position on a diagram/map image. */
export interface IeltsImageHotspot {
  /** Stable id referenced by answers and keys (the blank id). */
  id: string;
  label?: string;
  /** Position as a 0–100 percentage of the image box. */
  x: number;
  y: number;
}

export type IeltsImageVisual = Omit<
  WithKind<AuthoredVisualOfKind<"image">>,
  "alt"
> & {
  /** Legacy objective diagrams may not have authored alternative text yet. */
  alt?: string;
  hotspots: IeltsImageHotspot[];
};

export type IeltsChartVisual = WithKind<AuthoredVisualOfKind<"chart">>;
export type IeltsDescribedVisual = WithKind<AuthoredVisualOfKind<"described">>;

/** Every authored visual kind normalized to the renderer-side `kind` discriminator. */
export type IeltsVisual =
  | IeltsTableVisual
  | IeltsImageVisual
  | IeltsChartVisual
  | IeltsDescribedVisual;

/** The parsed, non-secret question handed to a renderer. */
export interface IeltsQuestionView {
  id: string;
  questionType: IeltsQuestionType;
  family: IeltsQuestionFamily;
  skill: IeltsSkill;
  /** May contain `__BLANK_<id>__` markers for completion types. */
  prompt: string;
  groupInstructions: string | null;
  /** Word cap for text answers, e.g. "NO MORE THAN TWO WORDS" → 2. */
  wordLimit: number | null;
  maxPoints: number;
  /** Choices / shared matching bank. */
  options: IeltsOption[];
  /** Matching statements (matching_* only). */
  items: IeltsMatchItem[];
  visual: IeltsVisual | null;
  /** multi_select: how many choices to pick. */
  selectCount: number | null;
}

// ── Learner answer (non-secret) ──────────────────────────────────────────────

/** text/select → a string; multi_select → a list of selected option ids. */
export type BlankValue = string | string[];

export interface IeltsAnswer {
  /** blankId → the learner's answer for that slot. */
  values: Record<string, BlankValue>;
}

// ── Secret key (read server-side only) ───────────────────────────────────────

export interface BlankKey {
  mode: BlankMode;
  /**
   * select/multi_select → accepted option ids; text → accepted answer strings
   * (canonical answer plus spelling/number variants, already merged).
   */
  accept: string[];
  /** multi_select only: number of choices to pick (defaults to `accept.length`). */
  select?: number;
  /** Points for this blank (default 1; multi_select uses `select` as its max). */
  points?: number;
}

export interface IeltsAnswerKey {
  /** blankId → grading rule for that slot. */
  blanks: Record<string, BlankKey>;
}

/** Author-facing key shape as stored in `ielts_question_keys` (pre-`buildAnswerKey`). */
export interface RawAnswerKey {
  /** blankId → canonical correct value(s). */
  correctAnswer: Record<string, BlankValue>;
  /** blankId → extra accepted text variants (text blanks only). */
  acceptVariants: Record<string, string[]>;
}

// ── Grading verdict (key-free; safe to return to the client) ─────────────────

export interface BlankVerdict {
  awarded: number;
  max: number;
  correct: boolean;
}

export interface IeltsVerdict {
  awardedPoints: number;
  maxPoints: number;
  /** True only when every point was earned (`awardedPoints === maxPoints`, max > 0). */
  isCorrect: boolean;
  /** Per-blank correctness for review UIs — reveals right/wrong, never the key. */
  blanks: Record<string, BlankVerdict>;
}
