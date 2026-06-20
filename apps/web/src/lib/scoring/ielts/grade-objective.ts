/**
 * Pure attempt-level objective grading (WS-2.1). Given the test's objective
 * questions, their secret keys, and the learner's responses, compute every
 * per-question result AND the per-skill raw → band rollup — with no I/O. The
 * DB layer (lib/api/ielts) loads the inputs (keys via the service-role client)
 * and persists the outputs; all the marking logic lives here so it is fully
 * unit-tested under the `scoring/**` coverage gate.
 *
 * IELTS raw is "number correct out of 40": raw = Σ awarded points over that
 * skill's questions (unanswered = 0), clamped to [0, 40] to satisfy the band
 * table + the attempt_band_scores CHECK.
 */
import {
  isObjectiveType,
  scoreObjectiveAnswer,
  type IeltsQuestionType,
  type ObjectiveKey,
} from "./objective-scoring";
import {
  computeObjectiveBands,
  type BandConversionRow,
  type IeltsModule,
  type IeltsSkill,
  type ObjectiveBandResult,
} from "./band-conversion";

export interface GradableQuestion {
  id: string;
  skill: IeltsSkill;
  questionType: IeltsQuestionType;
  maxPoints: number;
  wordLimit: number | null;
}

export interface GradedResponse {
  questionId: string;
  isCorrect: boolean;
  awardedPoints: number;
}

export interface AttemptGrade {
  graded: GradedResponse[];
  listeningRaw: number | null;
  readingRaw: number | null;
  bands: ObjectiveBandResult;
}

const MAX_RAW = 40;

function clampRaw(value: number): number {
  return Math.max(0, Math.min(MAX_RAW, value));
}

export interface GradeObjectiveAttemptParams {
  questions: readonly GradableQuestion[];
  keys: ReadonlyMap<string, ObjectiveKey>;
  responses: ReadonlyMap<string, unknown>;
  module: IeltsModule;
  bandRows: readonly BandConversionRow[];
}

/** Grade every objective question in scope and roll up to per-skill bands. */
export function gradeObjectiveAttempt(
  params: GradeObjectiveAttemptParams,
): AttemptGrade {
  const { questions, keys, responses, module, bandRows } = params;
  const graded: GradedResponse[] = [];
  const rawBySkill = new Map<IeltsSkill, number>();
  const skillSeen = new Set<IeltsSkill>();

  for (const question of questions) {
    if (!isObjectiveType(question.questionType)) continue;
    skillSeen.add(question.skill);
    const key = keys.get(question.id) ?? { correct_answer: null, accept_variants: [] };
    const result = scoreObjectiveAnswer(
      {
        question_type: question.questionType,
        max_points: question.maxPoints,
        word_limit: question.wordLimit,
      },
      key,
      responses.get(question.id),
    );
    // Only persist a graded row for questions the learner actually answered.
    if (responses.has(question.id)) {
      graded.push({
        questionId: question.id,
        isCorrect: result.isCorrect,
        awardedPoints: result.awardedPoints,
      });
    }
    rawBySkill.set(
      question.skill,
      (rawBySkill.get(question.skill) ?? 0) + result.awardedPoints,
    );
  }

  const listeningRaw = skillSeen.has("listening")
    ? clampRaw(rawBySkill.get("listening") ?? 0)
    : null;
  const readingRaw = skillSeen.has("reading")
    ? clampRaw(rawBySkill.get("reading") ?? 0)
    : null;

  return {
    graded,
    listeningRaw,
    readingRaw,
    bands: computeObjectiveBands(bandRows, module, {
      listening: listeningRaw,
      reading: readingRaw,
    }),
  };
}
