/**
 * Server-authoritative objective scoring for IELTS Reading/Listening items
 * (WS-2.1). Pure + fully unit-tested (the `scoring/**` coverage gate). One
 * dispatcher routes each `ielts_question_type` to a small strategy:
 *   - exact choice  (mcq_single, matching_*, map_plan_label)
 *   - truth value   (true_false_notgiven, yes_no_notgiven)
 *   - multi choice  (mcq_multi) — per-correct credit, over-selection penalty
 *   - text gap      (sentence/summary/note-table/short-answer/diagram) —
 *                    variant-tolerant, "NO MORE THAN N WORDS" aware
 *
 * WS-1.2 ships richer per-type renderers/validators; its scorers can replace
 * these via the registry (lib/ielts) at merge. Until then this grades R/L
 * end-to-end so an attempt yields a band.
 */
import type { Enums } from "@/types/supabase";
import {
  extractValue,
  extractValues,
  normalizeBoolean,
  normalizeChoice,
  normalizeText,
  toAnswerStrings,
  wordCount,
} from "./answer-normalize";

export type IeltsQuestionType = Enums<"ielts_question_type">;

/** The non-secret fields the grader needs from an `ielts_questions` row. */
export interface ObjectiveQuestion {
  question_type: IeltsQuestionType;
  max_points: number;
  word_limit: number | null;
}

/** The secret fields from an `ielts_question_keys` row (service-role only). */
export interface ObjectiveKey {
  correct_answer: unknown;
  accept_variants: unknown;
}

export interface ObjectiveScore {
  isCorrect: boolean;
  awardedPoints: number;
  maxPoints: number;
}

const CHOICE_TYPES = new Set<IeltsQuestionType>([
  "mcq_single",
  "matching_headings",
  "matching_information",
  "matching_features",
  "map_plan_label",
]);

const BOOLEAN_TYPES = new Set<IeltsQuestionType>([
  "true_false_notgiven",
  "yes_no_notgiven",
]);

const TEXT_TYPES = new Set<IeltsQuestionType>([
  "sentence_completion",
  "summary_completion",
  "note_table_form_flowchart_completion",
  "short_answer",
  "diagram_label",
]);

/** True when a question type is auto-gradable here (R/L objective items). */
export function isObjectiveType(type: IeltsQuestionType): boolean {
  return (
    type === "mcq_multi" ||
    CHOICE_TYPES.has(type) ||
    BOOLEAN_TYPES.has(type) ||
    TEXT_TYPES.has(type)
  );
}

function miss(maxPoints: number): ObjectiveScore {
  return { isCorrect: false, awardedPoints: 0, maxPoints };
}

function allOrNothing(isCorrect: boolean, maxPoints: number): ObjectiveScore {
  return { isCorrect, awardedPoints: isCorrect ? maxPoints : 0, maxPoints };
}

function scoreExactChoice(
  key: ObjectiveKey,
  response: unknown,
  maxPoints: number,
): ObjectiveScore {
  const picked = extractValue(response);
  if (picked === null) return miss(maxPoints);
  const accepted = [
    ...toAnswerStrings(key.correct_answer),
    ...toAnswerStrings(key.accept_variants),
  ].map(normalizeChoice);
  return allOrNothing(accepted.includes(normalizeChoice(picked)), maxPoints);
}

function scoreBoolean(
  key: ObjectiveKey,
  response: unknown,
  maxPoints: number,
): ObjectiveScore {
  const picked = extractValue(response);
  if (picked === null) return miss(maxPoints);
  const accepted = toAnswerStrings(key.correct_answer).map(normalizeBoolean);
  return allOrNothing(accepted.includes(normalizeBoolean(picked)), maxPoints);
}

function scoreTextGap(
  question: ObjectiveQuestion,
  key: ObjectiveKey,
  response: unknown,
  maxPoints: number,
): ObjectiveScore {
  const typed = extractValue(response);
  if (typed === null || typed.trim() === "") return miss(maxPoints);
  if (question.word_limit !== null && wordCount(typed) > question.word_limit) {
    return miss(maxPoints); // exceeded "NO MORE THAN N WORDS"
  }
  const accepted = [
    ...toAnswerStrings(key.correct_answer),
    ...toAnswerStrings(key.accept_variants),
  ].map(normalizeText);
  return allOrNothing(
    accepted.length > 0 && accepted.includes(normalizeText(typed)),
    maxPoints,
  );
}

function scoreMultiChoice(
  key: ObjectiveKey,
  response: unknown,
  maxPoints: number,
): ObjectiveScore {
  const correct = new Set(toAnswerStrings(key.correct_answer).map(normalizeChoice));
  if (correct.size === 0) return miss(maxPoints);
  const selected = new Set(extractValues(response).map(normalizeChoice));
  let hit = 0;
  for (const value of selected) if (correct.has(value)) hit += 1;
  const overSelected = Math.max(0, selected.size - correct.size);
  const awardedPoints = Math.max(0, Math.min(hit, maxPoints) - overSelected);
  const isCorrect = overSelected === 0 && hit === correct.size;
  return { isCorrect, awardedPoints, maxPoints };
}

/**
 * Grade one objective response. `maxPoints` is the question's authored
 * `max_points` (clamped ≥ 0). Non-objective types (Writing/Speaking prompts)
 * are not graded here and return a zero result.
 */
export function scoreObjectiveAnswer(
  question: ObjectiveQuestion,
  key: ObjectiveKey,
  response: unknown,
): ObjectiveScore {
  const maxPoints = Math.max(0, Math.trunc(question.max_points || 0));
  const type = question.question_type;
  if (type === "mcq_multi") return scoreMultiChoice(key, response, maxPoints);
  if (BOOLEAN_TYPES.has(type)) return scoreBoolean(key, response, maxPoints);
  if (CHOICE_TYPES.has(type)) return scoreExactChoice(key, response, maxPoints);
  if (TEXT_TYPES.has(type)) return scoreTextGap(question, key, response, maxPoints);
  return miss(maxPoints);
}
