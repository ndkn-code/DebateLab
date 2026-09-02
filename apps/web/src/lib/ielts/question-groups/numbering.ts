/**
 * Official-paper question numbering: sequential across the parts of one
 * section; a row with `numberSpan` N occupies N consecutive numbers.
 */
import { parseQuestionMetadata } from "@/lib/ielts/question-types/metadata";
import type { NumberingQuestionLike, QuestionNumber } from "./types";

/** En dash, as printed on the paper ("21–22"). */
export const QUESTION_RANGE_DASH = "–";

export function formatQuestionRange(start: number, end: number): string {
  return end > start ? `${start}${QUESTION_RANGE_DASH}${end}` : String(start);
}

/** "Questions 1–5" / "Questions 21–22" / "Question 7". */
export function formatQuestionsHeading(start: number, end: number): string {
  return end > start
    ? `Questions ${formatQuestionRange(start, end)}`
    : `Question ${start}`;
}

/** How many numbers a row consumes: explicit `numberSpan`, else metadata, else 1. */
export function resolveNumberSpan(question: NumberingQuestionLike): number {
  const explicit = question.numberSpan;
  if (typeof explicit === "number" && Number.isInteger(explicit) && explicit >= 1) {
    return explicit;
  }
  const fromMeta = parseQuestionMetadata(question.metadata).numberSpan;
  return typeof fromMeta === "number" && fromMeta >= 1 ? fromMeta : 1;
}

/**
 * Number every question of a section (all parts, in order) starting at
 * `startAt`. The map is keyed by question id; a duplicate id keeps its first
 * assignment so the numbering stays stable even on a malformed structure.
 */
export function assignQuestionNumbers(
  parts: readonly { questions: readonly NumberingQuestionLike[] }[],
  startAt = 1,
): Map<string, QuestionNumber> {
  const numbers = new Map<string, QuestionNumber>();
  let next = startAt;
  for (const part of parts) {
    for (const question of part.questions) {
      if (numbers.has(question.id)) continue;
      const span = resolveNumberSpan(question);
      const start = next;
      const end = next + span - 1;
      numbers.set(question.id, {
        questionId: question.id,
        start,
        end,
        label: formatQuestionRange(start, end),
      });
      next = end + 1;
    }
  }
  return numbers;
}

/** Total numbers consumed by the given parts (last number = startAt + total - 1). */
export function countQuestionNumbers(
  parts: readonly { questions: readonly NumberingQuestionLike[] }[],
): number {
  return parts.reduce(
    (sum, part) => sum + part.questions.reduce((s, q) => s + resolveNumberSpan(q), 0),
    0,
  );
}
