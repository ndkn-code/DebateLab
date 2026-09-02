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
 *
 * Format-variety pass: questions carry their group (`groupKey`) and the
 * "AND/OR A NUMBER" allowance; a group flagged `anyOrder` ("Questions 21–22:
 * choose TWO letters, in either order" split into one row per number, or a
 * short-answer list) is marked as a set — see {@link applyAnyOrderGroups}.
 */
import {
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
import {
  DEFAULT_BLANK_ID,
  IeltsAnswerSchema,
  isObjectiveQuestionType,
  parseRawAnswerKey,
  type BlankKey,
  type IeltsAnswer,
  type IeltsAnswerKey,
  type IeltsQuestionFamily,
} from "@/lib/ielts/question-types";
import { buildAnswerKey } from "./build-key";
import { gradeQuestion } from "./grade-question";
import { extractValue, extractValues } from "./answer-normalize";
import {
  canonicalForMatch,
  exceedsWordLimit,
  textMatches,
} from "./text-normalize";

export interface GradableQuestion {
  id: string;
  skill: IeltsSkill;
  questionType: IeltsQuestionType;
  maxPoints: number;
  wordLimit: number | null;
  family: IeltsQuestionFamily;
  hasOptionBank: boolean;
  selectCount: number | null;
  /** The question set this row belongs to (`ielts_questions.group_key`). */
  groupKey?: string | null;
  /** "AND/OR A NUMBER": numeric tokens are free under the word limit. */
  allowNumber?: boolean;
  /** Informational: one `mcq_multi` row occupying N question numbers. */
  numberSpan?: number | null;
}

export interface GradableGroup {
  /** Members may be answered in any order; marked as a set. */
  anyOrder: boolean;
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

function toIeltsAnswer(
  type: IeltsQuestionType,
  response: unknown,
): IeltsAnswer {
  const parsed = IeltsAnswerSchema.safeParse(response);
  if (parsed.success) return parsed.data;

  if (type === "mcq_multi") {
    const values = extractValues(response);
    return values.length > 0 ? { values: { [DEFAULT_BLANK_ID]: values } } : { values: {} };
  }

  const single = extractValue(response);
  return single === null ? { values: {} } : { values: { [DEFAULT_BLANK_ID]: single } };
}

interface QuestionResult {
  isCorrect: boolean;
  awardedPoints: number;
}

interface ScoredRow {
  question: GradableQuestion;
  answerKey: IeltsAnswerKey;
  answer: IeltsAnswer;
  answered: boolean;
  result: QuestionResult;
}

function scoreQuestion(
  question: GradableQuestion,
  key: ObjectiveKey,
  response: unknown,
  answered: boolean,
): ScoredRow {
  const rawKey = parseRawAnswerKey(key.correct_answer, key.accept_variants);
  const answerKey = buildAnswerKey(
    rawKey,
    {
      family: question.family,
      hasOptionBank: question.hasOptionBank,
      selectCount: question.selectCount,
    },
  );
  const answer = toIeltsAnswer(question.questionType, response);
  const verdict = gradeQuestion(
    { wordLimit: question.wordLimit, allowNumber: question.allowNumber ?? false },
    answerKey,
    answer,
  );
  return {
    question,
    answerKey,
    answer,
    answered,
    result: {
      isCorrect: verdict.isCorrect,
      awardedPoints: verdict.awardedPoints,
    },
  };
}

// ── Any-order groups ─────────────────────────────────────────────────────────

function isMultiSelectRow(row: ScoredRow): boolean {
  return (
    row.question.family === "multi_select" ||
    row.question.questionType === "mcq_multi" ||
    row.answerKey.blanks[DEFAULT_BLANK_ID]?.mode === "multi_select"
  );
}

/** The learner's blank-"0" value when it is a usable single string. */
function learnerValue(row: ScoredRow): string | null {
  if (!row.answered) return null;
  const value = row.answer.values[DEFAULT_BLANK_ID];
  if (typeof value !== "string") return null;
  const key = row.answerKey.blanks[DEFAULT_BLANK_ID];
  if (key?.mode === "text") {
    const trimmed = value.trim();
    if (trimmed === "") return null;
    if (
      exceedsWordLimit(trimmed, row.question.wordLimit, {
        allowNumber: row.question.allowNumber ?? false,
      })
    ) {
      return null;
    }
    return trimmed;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function valueMatchesKey(value: string, key: BlankKey): boolean {
  if (key.mode === "text") return textMatches(value, key.accept);
  return key.accept.includes(value);
}

function dedupeKey(value: string, mode: BlankKey["mode"] | undefined): string {
  return mode === "text" ? canonicalForMatch(value) : value;
}

/**
 * Mark one any-order group as a set. Each row's blank-"0" accept set is one
 * pool entry (its alternatives travel together, so `colour` + `color` can never
 * earn two marks). Every distinct learner value that is answered and within the
 * word limit consumes at most one pool entry; `awarded = min(matches, rows)`
 * marks are then written back to the first `awarded` answered rows, in
 * question order, and the remaining rows get 0. Only rows whose key is a
 * single select/text blank take part — a `multi_select` row already scores its
 * own set.
 */
function applyAnyOrderGroup(rows: readonly ScoredRow[]): void {
  const pool = rows.map((row) => row.answerKey.blanks[DEFAULT_BLANK_ID] ?? null);
  const mode = pool.find((key) => key !== null)?.mode;

  const seen = new Set<string>();
  const values: string[] = [];
  for (const row of rows) {
    const value = learnerValue(row);
    if (value === null) continue;
    const dedupe = dedupeKey(value, mode);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    values.push(value);
  }

  const consumed = new Set<number>();
  let matches = 0;
  for (const value of values) {
    const index = pool.findIndex(
      (key, i) => key !== null && !consumed.has(i) && valueMatchesKey(value, key),
    );
    if (index === -1) continue;
    consumed.add(index);
    matches += 1;
  }

  let remaining = Math.min(matches, rows.length);
  for (const row of rows) {
    if (!row.answered) {
      row.result = { isCorrect: false, awardedPoints: 0 };
      continue;
    }
    if (remaining > 0) {
      remaining -= 1;
      const points = row.answerKey.blanks[DEFAULT_BLANK_ID]?.points ?? 1;
      row.result = { isCorrect: true, awardedPoints: points };
    } else {
      row.result = { isCorrect: false, awardedPoints: 0 };
    }
  }
}

/**
 * Re-mark every group flagged `anyOrder` that has at least two eligible rows
 * (in question order). Groups of one row, groups not flagged, and rows graded
 * as `multi_select` keep their row-wise verdicts.
 */
function applyAnyOrderGroups(
  rows: readonly ScoredRow[],
  groups: ReadonlyMap<string, GradableGroup> | undefined,
): void {
  if (!groups || groups.size === 0) return;
  const byGroup = new Map<string, ScoredRow[]>();
  for (const row of rows) {
    const groupKey = row.question.groupKey;
    if (!groupKey || !groups.get(groupKey)?.anyOrder) continue;
    if (isMultiSelectRow(row)) continue;
    const members = byGroup.get(groupKey);
    if (members) members.push(row);
    else byGroup.set(groupKey, [row]);
  }
  for (const members of byGroup.values()) {
    if (members.length < 2) continue;
    applyAnyOrderGroup(members);
  }
}

export interface GradeObjectiveAttemptParams {
  questions: readonly GradableQuestion[];
  keys: ReadonlyMap<string, ObjectiveKey>;
  responses: ReadonlyMap<string, unknown>;
  module: IeltsModule;
  bandRows: readonly BandConversionRow[];
  /** groupKey → group marking flags (any-order sets). Optional for legacy callers. */
  groups?: ReadonlyMap<string, GradableGroup>;
}

/** Grade every objective question in scope and roll up to per-skill bands. */
export function gradeObjectiveAttempt(
  params: GradeObjectiveAttemptParams,
): AttemptGrade {
  const { questions, keys, responses, module, bandRows, groups } = params;
  const rows: ScoredRow[] = [];
  const skillSeen = new Set<IeltsSkill>();

  for (const question of questions) {
    if (!isObjectiveQuestionType(question.questionType)) continue;
    skillSeen.add(question.skill);
    const key = keys.get(question.id) ?? { correct_answer: null, accept_variants: [] };
    rows.push(
      scoreQuestion(
        question,
        key,
        responses.get(question.id),
        responses.has(question.id),
      ),
    );
  }

  applyAnyOrderGroups(rows, groups);

  const graded: GradedResponse[] = [];
  const rawBySkill = new Map<IeltsSkill, number>();
  for (const row of rows) {
    // Only persist a graded row for questions the learner actually answered.
    if (row.answered) {
      graded.push({
        questionId: row.question.id,
        isCorrect: row.result.isCorrect,
        awardedPoints: row.result.awardedPoints,
      });
    }
    rawBySkill.set(
      row.question.skill,
      (rawBySkill.get(row.question.skill) ?? 0) + row.result.awardedPoints,
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
