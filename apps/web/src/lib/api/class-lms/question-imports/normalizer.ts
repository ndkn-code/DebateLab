import type { AnswerSource, IeltsSkill, IeltsVariant } from "./contracts";
import { IELTS_QUESTION_TYPES } from "@/lib/api/ielts/schema";

type IeltsQuestionType = (typeof IELTS_QUESTION_TYPES)[number];

export type QuestionImportValidationIssue = { code: string; message: string; severity: "error" | "warning" };
export type NormalizedQuestionDraft = {
  schemaVersion: 1;
  skill: IeltsSkill;
  variant: IeltsVariant;
  questionType: IeltsQuestionType;
  rawQuestionType: string;
  prompt: string;
  options: string[];
  answer: unknown;
  answerSource: AnswerSource | null;
  source: { page: number; region?: { x: number; y: number; width: number; height: number } };
  validationIssues: QuestionImportValidationIssue[];
  requiresTeacherConfirmation: boolean;
  hasRequiredMedia: boolean;
};

const OBJECTIVE_TYPES = new Set<IeltsQuestionType>([
  "mcq_single",
  "mcq_multi",
  "true_false_notgiven",
  "yes_no_notgiven",
  "matching_headings",
  "matching_information",
  "matching_features",
  "matching_sentence_endings",
  "sentence_completion",
  "summary_completion",
  "note_table_form_flowchart_completion",
  "short_answer",
  "diagram_label",
  "map_plan_label",
]);

const TYPE_ALIASES: Record<string, IeltsQuestionType> = {
  multiple_choice: "mcq_single",
  multiple_choice_single: "mcq_single",
  multiple_choice_multiple: "mcq_multi",
  true_false_not_given: "true_false_notgiven",
  yes_no_not_given: "yes_no_notgiven",
  matching_headings: "matching_headings",
  matching_information: "matching_information",
  matching_features: "matching_features",
  matching_sentence_endings: "matching_sentence_endings",
  sentence_completion: "sentence_completion",
  summary_completion: "summary_completion",
  completion: "sentence_completion",
  note_completion: "note_table_form_flowchart_completion",
  table_completion: "note_table_form_flowchart_completion",
  form_completion: "note_table_form_flowchart_completion",
  flowchart_completion: "note_table_form_flowchart_completion",
  short_answer: "short_answer",
  diagram_labeling: "diagram_label",
  diagram_label: "diagram_label",
  map_labeling: "map_plan_label",
  plan_labeling: "map_plan_label",
  map_plan_label: "map_plan_label",
  writing_task_1_academic: "writing_task1_academic",
  writing_task_1_general: "writing_task1_general",
  writing_task_2: "writing_task2_essay",
  speaking_part_1: "speaking_part1",
  speaking_part_2: "speaking_part2_cuecard",
  speaking_part_3: "speaking_part3",
};

function normalizeQuestionType(value: string): IeltsQuestionType | null {
  if ((IELTS_QUESTION_TYPES as readonly string[]).includes(value))
    return value as IeltsQuestionType;
  return TYPE_ALIASES[value] ?? null;
}

function stringValue(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export function normalizeQuestionDraft(raw: Record<string, unknown>, defaults: { skill: IeltsSkill; variant: IeltsVariant; page?: number }): NormalizedQuestionDraft {
  const rawQuestionType = stringValue(raw.questionType ?? raw.type)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const normalizedType = normalizeQuestionType(rawQuestionType);
  const questionType = normalizedType ?? "short_answer";
  const prompt = stringValue(raw.prompt ?? raw.question ?? raw.text);
  const answer = raw.answer ?? raw.correctAnswer ?? null;
  const answerSource = answer === null || answer === "" ? null : (raw.answerSource === "teacher" || raw.answerSource === "ai_suggested" ? raw.answerSource : "document");
  const validationIssues: QuestionImportValidationIssue[] = [];
  if (!normalizedType)
    validationIssues.push({
      code: "unsupported_question_type",
      message: "Choose an official IELTS question type before publishing.",
      severity: "error",
    });
  if (!prompt) validationIssues.push({ code: "missing_prompt", message: "Question text is missing.", severity: "error" });
  if (!OBJECTIVE_TYPES.has(questionType) && ["writing", "speaking"].includes(defaults.skill) && !prompt) validationIssues.push({ code: "missing_task", message: "Task prompt is missing.", severity: "error" });
  if (OBJECTIVE_TYPES.has(questionType) && !answer) validationIssues.push({ code: "needs_answer", message: "Confirm the answer before publishing.", severity: "warning" });
  const hasRequiredMedia = raw.hasRequiredMedia !== false;
  if (!hasRequiredMedia) validationIssues.push({ code: "missing_media", message: "Required audio or visual media is missing.", severity: "error" });
  return {
    schemaVersion: 1, skill: defaults.skill, variant: defaults.variant, questionType, rawQuestionType, prompt,
    options: Array.isArray(raw.options) ? raw.options.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean) : [],
    answer, answerSource, source: { page: Number.isInteger(raw.page) ? Number(raw.page) : (defaults.page ?? 1) },
    validationIssues, requiresTeacherConfirmation: answerSource === "ai_suggested" || (OBJECTIVE_TYPES.has(questionType) && !answer), hasRequiredMedia,
  };
}

export function normalizeQuestionImport(items: unknown[], defaults: { skill: IeltsSkill; variant: IeltsVariant }) {
  return items.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))).map((item) => normalizeQuestionDraft(item, defaults));
}
