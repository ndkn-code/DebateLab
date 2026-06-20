/**
 * Server-authoritative grading for IELTS objective questions (WS-1.2).
 *
 * Grading is the ONLY place answer keys are read, and it happens exclusively on
 * the server with the service-role client — `ielts_question_keys` has no
 * learner-readable RLS policy (docs/ielts/data-access.md §8). The returned
 * {@link IeltsVerdict} is key-free (correctness + points only); the correct
 * answer, accept-variants and explanations are never serialised to the client.
 *
 * The pure scoring lives in `lib/scoring/ielts/*`; this module only does the
 * trusted DB read and wires the pieces together.
 */
import { z } from "zod";
import { parseInput } from "@/lib/api/boundary";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { isObjectiveQuestionType } from "@/lib/ielts/question-types/registry";
import {
  IeltsAnswerSchema,
  parseQuestionView,
  parseRawAnswerKey,
} from "@/lib/ielts/question-types/schemas";
import type {
  IeltsAnswer,
  IeltsVerdict,
} from "@/lib/ielts/question-types/types";
import { buildAnswerKey } from "@/lib/scoring/ielts/build-key";
import { gradeQuestion } from "@/lib/scoring/ielts/grade-question";

/** Non-secret columns needed to grade (everything bar the key itself). */
const QUESTION_COLUMNS =
  "id, question_type, skill, prompt, group_instructions, word_limit, max_points, options, visual, metadata";

export const GradeResponseInputSchema = z.object({
  questionId: z.string().uuid(),
  answer: IeltsAnswerSchema,
});
export type GradeResponseInput = z.infer<typeof GradeResponseInputSchema>;

/**
 * Grade many answers at once (used by the single-answer path and reusable by the
 * WS-2.1 mock engine when a section is submitted). Reads keys with the
 * service-role client; questions that are missing, non-objective, or have no key
 * row are simply omitted from the result.
 */
export async function gradeQuestionResponses(
  answers: Record<string, IeltsAnswer>,
): Promise<Record<string, IeltsVerdict>> {
  const questionIds = Object.keys(answers);
  if (questionIds.length === 0) return {};

  const supabase = createTypedAdminClient();
  const [questionsResult, keysResult] = await Promise.all([
    supabase.from("ielts_questions").select(QUESTION_COLUMNS).in("id", questionIds),
    supabase
      .from("ielts_question_keys")
      .select("question_id, correct_answer, accept_variants")
      .in("question_id", questionIds),
  ]);
  if (questionsResult.error) {
    throw new Error(`gradeQuestionResponses (questions): ${questionsResult.error.message}`);
  }
  if (keysResult.error) {
    throw new Error(`gradeQuestionResponses (keys): ${keysResult.error.message}`);
  }

  const keyByQuestion = new Map(
    (keysResult.data ?? []).map((row) => [row.question_id, row]),
  );

  const verdicts: Record<string, IeltsVerdict> = {};
  for (const question of questionsResult.data ?? []) {
    const keyRow = keyByQuestion.get(question.id);
    if (!keyRow || !isObjectiveQuestionType(question.question_type)) continue;

    const view = parseQuestionView(question);
    const rawKey = parseRawAnswerKey(keyRow.correct_answer, keyRow.accept_variants);
    const key = buildAnswerKey(rawKey, {
      family: view.family,
      hasOptionBank: view.options.length > 0,
      selectCount: view.selectCount,
    });
    verdicts[question.id] = gradeQuestion(
      { wordLimit: view.wordLimit },
      key,
      answers[question.id],
    );
  }
  return verdicts;
}

/**
 * The single canonical grading path for one submitted answer. Validates the
 * untrusted input at the boundary, then returns a key-free verdict.
 */
export async function gradeQuestionResponse(raw: unknown): Promise<IeltsVerdict> {
  const input = parseInput(GradeResponseInputSchema, raw);
  const verdicts = await gradeQuestionResponses({ [input.questionId]: input.answer });
  const verdict = verdicts[input.questionId];
  if (!verdict) {
    throw new Error(
      `gradeQuestionResponse: question ${input.questionId} is not gradable (missing, non-objective, or no key)`,
    );
  }
  return verdict;
}
