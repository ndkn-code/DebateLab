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
import { parseQuestionMetadata } from "@/lib/ielts/question-types/metadata";
import type {
  IeltsAnswer,
  IeltsVerdict,
} from "@/lib/ielts/question-types/types";
import { buildAnswerKey } from "@/lib/scoring/ielts/build-key";
import { gradeQuestion } from "@/lib/scoring/ielts/grade-question";
import { parseAllowNumber } from "@/lib/scoring/ielts/text-normalize";

/** Non-secret columns needed to grade (everything bar the key itself). */
const QUESTION_COLUMNS =
  "id, question_type, skill, prompt, group_instructions, word_limit, max_points, options, visual, metadata, test_id, group_key";

interface GradingQuestionRow {
  test_id: string;
  group_key: string | null;
}

/**
 * Instructions of the groups these questions belong to, keyed by
 * `${test_id}:${group_key}`. Only fetched when some question has a group.
 * Note: the group's `any_order` flag is deliberately NOT consulted here —
 * any-order marking is a set-level rule over several rows, so it can only be
 * applied by the attempt grader (`grade-attempt.ts`), never when grading one
 * question in isolation.
 */
async function loadGroupInstructions(
  supabase: ReturnType<typeof createTypedAdminClient>,
  questions: readonly GradingQuestionRow[],
): Promise<Map<string, string | null>> {
  const testIds = [
    ...new Set(questions.filter((q) => q.group_key).map((q) => q.test_id)),
  ];
  if (testIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("ielts_question_groups")
    .select("test_id, group_key, instructions")
    .in("test_id", testIds);
  if (error) {
    throw new Error(`gradeQuestionResponses (groups): ${error.message}`);
  }
  return new Map(
    (data ?? []).map((row) => [`${row.test_id}:${row.group_key}`, row.instructions]),
  );
}

/** `metadata.allowNumber` wins; else the row's or its group's instructions. */
function resolveAllowNumber(params: {
  metadata: unknown;
  groupInstructions: string | null;
  groupSetInstructions: string | null | undefined;
}): boolean {
  const explicit = parseQuestionMetadata(params.metadata).allowNumber;
  if (typeof explicit === "boolean") return explicit;
  return (
    parseAllowNumber(params.groupInstructions) ||
    parseAllowNumber(params.groupSetInstructions)
  );
}

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
  const questionRows = questionsResult.data ?? [];
  const groupInstructions = await loadGroupInstructions(supabase, questionRows);

  const verdicts: Record<string, IeltsVerdict> = {};
  for (const question of questionRows) {
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
      {
        wordLimit: view.wordLimit,
        allowNumber: resolveAllowNumber({
          metadata: question.metadata,
          groupInstructions: question.group_instructions,
          groupSetInstructions: question.group_key
            ? groupInstructions.get(`${question.test_id}:${question.group_key}`)
            : undefined,
        }),
      },
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
