/**
 * Build the mode-resolved {@link IeltsAnswerKey} consumed by the grader from the
 * author-friendly {@link RawAnswerKey} stored in `ielts_question_keys` plus a few
 * facts about the question (WS-1.2). Pure — coverage-gated.
 *
 * The grading {@link BlankMode} is derived here (not stored), so authors only
 * write correct values: select families grade option ids; completion/labeling
 * grade text unless the question carries an option bank (e.g. a word list), in
 * which case they grade the chosen option id.
 */
import type {
  BlankKey,
  BlankMode,
  BlankValue,
  IeltsAnswerKey,
  IeltsQuestionFamily,
  RawAnswerKey,
} from "@/lib/ielts/question-types/types";

export interface KeyBuildContext {
  family: IeltsQuestionFamily;
  /** Whether the question carries a non-empty option bank (select vs text). */
  hasOptionBank: boolean;
  /** multi_select: how many choices to pick (defaults to the correct-set size). */
  selectCount?: number | null;
}

export function modeForFamily(
  family: IeltsQuestionFamily,
  hasOptionBank: boolean,
): BlankMode {
  switch (family) {
    case "single_select":
    case "matching":
      return "select";
    case "multi_select":
      return "multi_select";
    case "completion":
    case "labeling":
      return hasOptionBank ? "select" : "text";
  }
}

function toStringArray(value: BlankValue): string[] {
  const list = Array.isArray(value) ? value : [value];
  return list.filter((entry) => typeof entry === "string" && entry.length > 0);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}

function buildBlankKey(
  mode: BlankMode,
  correct: BlankValue,
  variants: string[],
  selectCount: number | null | undefined,
): BlankKey {
  if (mode === "multi_select") {
    const accept = dedupe(toStringArray(correct));
    return { mode, accept, select: selectCount ?? accept.length };
  }
  // select + text both accept the canonical value(s) plus any variants.
  const accept = dedupe([...toStringArray(correct), ...variants]);
  return { mode, accept };
}

export function buildAnswerKey(
  raw: RawAnswerKey,
  ctx: KeyBuildContext,
): IeltsAnswerKey {
  const mode = modeForFamily(ctx.family, ctx.hasOptionBank);
  const blanks: Record<string, BlankKey> = {};
  for (const [blankId, correct] of Object.entries(raw.correctAnswer)) {
    blanks[blankId] = buildBlankKey(
      mode,
      correct,
      raw.acceptVariants[blankId] ?? [],
      ctx.selectCount,
    );
  }
  return { blanks };
}
