/**
 * Grade one objective IELTS question by summing its blanks (WS-1.2). Pure —
 * coverage-gated. The result is key-free and safe to return to a client.
 */
import type {
  BlankVerdict,
  IeltsAnswer,
  IeltsAnswerKey,
  IeltsVerdict,
} from "@/lib/ielts/question-types/types";
import { gradeBlank } from "./grade-blank";

export interface GradeContext {
  /** The question's word limit (applies to text blanks only). */
  wordLimit: number | null;
}

export function gradeQuestion(
  ctx: GradeContext,
  key: IeltsAnswerKey,
  answer: IeltsAnswer,
): IeltsVerdict {
  const blanks: Record<string, BlankVerdict> = {};
  let awardedPoints = 0;
  let maxPoints = 0;

  for (const [blankId, blankKey] of Object.entries(key.blanks)) {
    const verdict = gradeBlank(blankKey, answer.values[blankId], ctx.wordLimit);
    blanks[blankId] = verdict;
    awardedPoints += verdict.awarded;
    maxPoints += verdict.max;
  }

  return {
    awardedPoints,
    maxPoints,
    isCorrect: maxPoints > 0 && awardedPoints === maxPoints,
    blanks,
  };
}
