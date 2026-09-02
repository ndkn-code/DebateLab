/**
 * Build the mode-resolved {@link IeltsAnswerKey} consumed by the grader from the
 * author-friendly {@link RawAnswerKey} stored in `ielts_question_keys` plus a few
 * facts about the question (WS-1.2). Pure — coverage-gated.
 *
 * The grading {@link BlankMode} is derived here (not stored), so authors only
 * write correct values: select families grade option ids; completion/labeling
 * grade text unless the question carries an option bank (e.g. a word list), in
 * which case they grade the chosen option id.
 *
 * Text keys are also expanded the way an official answer key reads them:
 * `roof-top/rooftop` lists two alternatives and `(the) garden` marks an
 * optional word — see {@link expandKeyAlternatives}.
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

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const OPTIONAL_GROUP = /\(([^()]*)\)/;
const MAX_OPTIONAL_GROUPS = 4;

/** `(the) garden` → [`the garden`, `garden`] (cartesian over up to 4 groups). */
function expandOptionalGroups(value: string): string[] {
  let forms = [value];
  for (let round = 0; round < MAX_OPTIONAL_GROUPS; round += 1) {
    const next: string[] = [];
    let expanded = false;
    for (const form of forms) {
      const match = OPTIONAL_GROUP.exec(form);
      if (!match || match.index === undefined) {
        next.push(form);
        continue;
      }
      expanded = true;
      const before = form.slice(0, match.index);
      const after = form.slice(match.index + match[0].length);
      next.push(collapseSpaces(`${before}${match[1]}${after}`));
      next.push(collapseSpaces(`${before} ${after}`));
    }
    forms = next;
    if (!expanded) break;
  }
  return forms;
}

/** `roof-top/rooftop` → both; `1/2` and `12/05` stay intact (no letters). */
function expandSlashAlternatives(value: string): string[] {
  if (!value.includes("/")) return [value];
  const parts = value.split("/").map(collapseSpaces);
  const hasLetter = parts.some((part) => /\p{L}/u.test(part));
  if (!hasLetter) return [value];
  return parts;
}

/**
 * Expand one authored text key into every string it stands for, the way the
 * official key notation is read: `/` separates alternatives (only when at least
 * one side has a letter, so fractions and dates like `1/2`, `12/05` survive),
 * and a parenthesised word is optional. The original string is always kept
 * first; results are trimmed, non-empty, and de-duplicated.
 */
export function expandKeyAlternatives(value: string): string[] {
  const out = [value];
  for (const form of expandOptionalGroups(value)) {
    out.push(...expandSlashAlternatives(form));
  }
  return dedupe(out.map(collapseSpaces).filter((entry) => entry.length > 0));
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
  const authored = [...toStringArray(correct), ...variants];
  if (mode === "text") {
    return { mode, accept: dedupe(authored.flatMap(expandKeyAlternatives)) };
  }
  // select accepts the canonical option id(s) plus any variants verbatim.
  return { mode, accept: dedupe(authored) };
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
