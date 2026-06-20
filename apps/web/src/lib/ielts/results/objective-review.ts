/**
 * Pure objective-review builder for the IELTS results screen (WS-2.2).
 *
 * Turns each graded objective question into a learner-facing review row:
 * prompt, the learner's formatted answer, the formatted correct answer, the
 * recorded correct/incorrect verdict, and the bilingual explanation. The secret
 * key has already been read server-side; here it is only formatted (option ids
 * → display labels) — never surfaced raw. Items are grouped by skill (R/L) in
 * the order the repository supplies (authored `order_index`).
 *
 * Formatting reuses the same tolerant extractors the grader uses
 * (`lib/scoring/ielts/answer-normalize`), so "your answer" mirrors exactly what
 * was scored, whatever envelope the renderer emitted.
 */
import {
  extractValue,
  extractValues,
  normalizeChoice,
  toAnswerStrings,
} from "@/lib/scoring/ielts/answer-normalize";
import type {
  IeltsOption,
  IeltsQuestionView,
} from "@/lib/ielts/question-types/types";
import type {
  AttemptResultsInput,
  ObjectiveReviewItem,
  ObjectiveReviewSection,
  ObjectiveSkillKey,
  ResultsObjectiveQuestion,
} from "./types";
import { SKILL_LABELS } from "./types";

const BLANK_MARKER = /__BLANK_[^_]+__/g;
const NOT_ANSWERED = "Not answered";
const EMPTY = "—";

/** Replace `__BLANK_x__` placeholders with a visible gap for readability. */
function cleanPrompt(prompt: string): string {
  return prompt.replace(BLANK_MARKER, "______").trim();
}

/** Map one option id / value to its display string, falling back to the raw value. */
function displayValue(options: IeltsOption[], value: string): string {
  const norm = normalizeChoice(value);
  const option = options.find(
    (candidate) =>
      normalizeChoice(candidate.id) === norm ||
      (candidate.label != null && normalizeChoice(candidate.label) === norm),
  );
  if (!option) return value.trim();
  if (option.label && option.text && option.label !== option.text) {
    return `${option.label}. ${option.text}`;
  }
  return option.text || option.label || value.trim();
}

function formatList(
  view: IeltsQuestionView,
  values: string[],
  emptyLabel: string,
): string {
  const cleaned = values.map((value) => displayValue(view.options, value)).filter(Boolean);
  if (cleaned.length === 0) return emptyLabel;
  const separator = view.family === "multi_select" ? ", " : " / ";
  return cleaned.join(separator);
}

function learnerValues(question: ResultsObjectiveQuestion): string[] {
  if (question.view.family === "multi_select") {
    return extractValues(question.response);
  }
  const single = extractValue(question.response);
  return single === null ? [] : [single];
}

function toReviewItem(
  question: ResultsObjectiveQuestion,
  number: number,
): ObjectiveReviewItem {
  const { view } = question;
  const values = learnerValues(question);
  return {
    questionId: view.id,
    number,
    questionType: view.questionType,
    prompt: cleanPrompt(view.prompt),
    groupInstructions: view.groupInstructions,
    learnerAnswer: formatList(view, values, NOT_ANSWERED),
    correctAnswer: formatList(view, toAnswerStrings(question.correctAnswer), EMPTY),
    answered: values.length > 0,
    isCorrect: question.isCorrect === true,
    awardedPoints: question.awardedPoints ?? 0,
    maxPoints: view.maxPoints,
    explanationEn: question.explanationEn,
    explanationVi: question.explanationVi,
  };
}

/** Group objective questions into per-skill review sections (R/L), numbered. */
export function buildObjectiveReview(
  input: AttemptResultsInput,
): ObjectiveReviewSection[] {
  const bySkill = new Map<ObjectiveSkillKey, ResultsObjectiveQuestion[]>();
  for (const question of input.objectiveQuestions) {
    const skill = question.view.skill;
    if (skill !== "listening" && skill !== "reading") continue;
    const list = bySkill.get(skill) ?? [];
    list.push(question);
    bySkill.set(skill, list);
  }

  const sections: ObjectiveReviewSection[] = [];
  for (const skill of ["listening", "reading"] as const) {
    const questions = bySkill.get(skill);
    if (!questions || questions.length === 0) continue;
    const items = questions.map((question, index) => toReviewItem(question, index + 1));
    sections.push({
      skill,
      label: SKILL_LABELS[skill],
      correctCount: items.filter((item) => item.isCorrect).length,
      totalCount: items.length,
      items,
    });
  }
  return sections;
}
