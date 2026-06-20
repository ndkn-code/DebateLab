/**
 * IELTS question-type registry (WS-1.2) — the one place that maps each
 * `ielts_question_type` to its renderer {@link IeltsQuestionFamily} and grading
 * defaults. Adding a new objective type = add a registry entry + (if a new
 * family) a renderer and a grading mode. The core debate activity engine
 * (`lib/activity/registry.ts`) is left byte-identical (masterplan §2.7).
 */
import type {
  IeltsOption,
  IeltsQuestionFamily,
  IeltsQuestionType,
} from "./types";

interface RegistryEntry {
  family: IeltsQuestionFamily;
  /** Fixed, non-authored options (T/F/NG, Y/N/NG); empty when authored. */
  fixedOptions: IeltsOption[];
}

/**
 * Blank id used by the single-slot families (single_select, multi_select) and by
 * the bare-value author shorthand for keys. Renderer and key must agree on it.
 */
export const DEFAULT_BLANK_ID = "0";

/** Option ids for the verdict-style families — stable across locales. */
export const TFNG_OPTIONS: IeltsOption[] = [
  { id: "true", label: "T", text: "True" },
  { id: "false", label: "F", text: "False" },
  { id: "not_given", label: "NG", text: "Not Given" },
];

export const YNNG_OPTIONS: IeltsOption[] = [
  { id: "yes", label: "Y", text: "Yes" },
  { id: "no", label: "N", text: "No" },
  { id: "not_given", label: "NG", text: "Not Given" },
];

const REGISTRY: Record<IeltsQuestionType, RegistryEntry> = {
  mcq_single: { family: "single_select", fixedOptions: [] },
  mcq_multi: { family: "multi_select", fixedOptions: [] },
  true_false_notgiven: { family: "single_select", fixedOptions: TFNG_OPTIONS },
  yes_no_notgiven: { family: "single_select", fixedOptions: YNNG_OPTIONS },
  matching_headings: { family: "matching", fixedOptions: [] },
  matching_information: { family: "matching", fixedOptions: [] },
  matching_features: { family: "matching", fixedOptions: [] },
  sentence_completion: { family: "completion", fixedOptions: [] },
  summary_completion: { family: "completion", fixedOptions: [] },
  note_table_form_flowchart_completion: {
    family: "completion",
    fixedOptions: [],
  },
  short_answer: { family: "completion", fixedOptions: [] },
  diagram_label: { family: "labeling", fixedOptions: [] },
  map_plan_label: { family: "labeling", fixedOptions: [] },
  // Writing / Speaking are AI-scored (WS-3.x), not objective — no renderer here.
  writing_task1_academic: { family: "completion", fixedOptions: [] },
  writing_task1_general: { family: "completion", fixedOptions: [] },
  writing_task2_essay: { family: "completion", fixedOptions: [] },
  speaking_part1: { family: "completion", fixedOptions: [] },
  speaking_part2_cuecard: { family: "completion", fixedOptions: [] },
  speaking_part3: { family: "completion", fixedOptions: [] },
};

/** The objective (auto-gradable) types this card renders and scores. */
export const OBJECTIVE_QUESTION_TYPES: IeltsQuestionType[] = [
  "mcq_single",
  "mcq_multi",
  "true_false_notgiven",
  "yes_no_notgiven",
  "matching_headings",
  "matching_information",
  "matching_features",
  "sentence_completion",
  "summary_completion",
  "note_table_form_flowchart_completion",
  "short_answer",
  "diagram_label",
  "map_plan_label",
];

const OBJECTIVE_SET = new Set<IeltsQuestionType>(OBJECTIVE_QUESTION_TYPES);

/** Is this an objective type (auto-graded here) vs an AI-scored W/S prompt? */
export function isObjectiveQuestionType(type: IeltsQuestionType): boolean {
  return OBJECTIVE_SET.has(type);
}

export function getQuestionFamily(
  type: IeltsQuestionType,
): IeltsQuestionFamily {
  return REGISTRY[type].family;
}

/** Fixed options for T/F/NG and Y/N/NG; `[]` for authored-option types. */
export function getFixedOptions(type: IeltsQuestionType): IeltsOption[] {
  return REGISTRY[type].fixedOptions;
}
