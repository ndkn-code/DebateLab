/**
 * Variant-tolerant text matching for IELTS completion / short-answer grading
 * (WS-1.2, extended in the format-variety pass). Pure and fully unit-tested —
 * this is the `scoring/**` coverage gate.
 *
 * IELTS marks objective text answers on exact wording (correct spelling
 * required), but the official marking guidance is tolerant of: case,
 * surrounding whitespace/punctuation, smart quotes and dashes, thousands
 * separators, numeral formatting (`3` ≡ `3.0`), numbers written as words
 * (`twenty` ≡ `20`), hyphenation (`part-time` ≡ `part time`), and a leading
 * article (`the garden` ≡ `garden`). Synonyms and alternative spellings are NOT
 * guessed — they come from the authored accept-variants list.
 */

/** Lower-cased, whitespace- and punctuation-trimmed canonical form. */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[‘’‛′]/g, "'") // curly single quotes / prime
    .replace(/[“”″]/g, '"') // curly double quotes
    .replace(/[‐-―]/g, "-") // hyphen/dash variants
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?"'`]+|[\s.,;:!?"'`]+$/g, "");
}

// ── Number words ─────────────────────────────────────────────────────────────

const ONES: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const TENS: Record<string, number> = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const HUNDRED = "hundred";
const SCALES: Record<string, number> = { thousand: 1_000, million: 1_000_000 };

const ORDINALS: Record<string, string> = {
  first: "1st",
  second: "2nd",
  third: "3rd",
  fourth: "4th",
  fifth: "5th",
  sixth: "6th",
  seventh: "7th",
  eighth: "8th",
  ninth: "9th",
  tenth: "10th",
};

function isNumberWord(token: string): boolean {
  return token in ONES || token in TENS || token === HUNDRED || token in SCALES;
}

type PhraseKind = "none" | "ones" | "tens" | "hundred" | "scale" | "and";

interface PhraseState {
  total: number;
  current: number;
  last: PhraseKind;
  lastScale: number;
}

function applyAnd(state: PhraseState): boolean {
  // "two hundred AND five" — only meaningful after a hundred/scale word.
  if (state.last !== "hundred" && state.last !== "scale") return false;
  state.last = "and";
  return true;
}

function applyOnes(state: PhraseState, value: number, tokenCount: number): boolean {
  if (state.last === "ones") return false;
  if (state.last === "tens" && (value === 0 || value >= 10)) return false;
  if (value === 0 && (state.last !== "none" || tokenCount > 1)) return false;
  state.current += value;
  state.last = "ones";
  return true;
}

function applyTens(state: PhraseState, value: number): boolean {
  if (state.last === "ones" || state.last === "tens") return false;
  state.current += value;
  state.last = "tens";
  return true;
}

function applyHundred(state: PhraseState): boolean {
  // Only a units word may multiply a hundred ("two hundred"; bare = 100).
  if (state.last !== "ones" && state.last !== "none") return false;
  if (state.current >= 100) return false;
  state.current = (state.current || 1) * 100;
  state.last = "hundred";
  return true;
}

function applyScale(state: PhraseState, scale: number): boolean {
  if (state.last === "and" || scale >= state.lastScale) return false;
  state.total += (state.current || 1) * scale;
  state.current = 0;
  state.lastScale = scale;
  state.last = "scale";
  return true;
}

function applyToken(state: PhraseState, token: string, tokenCount: number): boolean {
  if (token === "and") return applyAnd(state);
  if (token in ONES) return applyOnes(state, ONES[token], tokenCount);
  if (token in TENS) return applyTens(state, TENS[token]);
  if (token === HUNDRED) return applyHundred(state);
  if (token in SCALES) return applyScale(state, SCALES[token]);
  return false;
}

/**
 * Parse a run of number words (`two hundred and twenty one`) to its value, or
 * `null` when the run is not a well-formed number (`one two`, `twenty ten`).
 */
function parseNumberPhrase(tokens: readonly string[]): number | null {
  const state: PhraseState = {
    total: 0,
    current: 0,
    last: "none",
    lastScale: Number.POSITIVE_INFINITY,
  };
  for (const token of tokens) {
    if (!applyToken(state, token, tokens.length)) return null;
  }
  if (state.last === "and" || state.last === "none") return null;
  return state.total + state.current;
}

/**
 * Rewrite number words as digits inside an already-normalized, space-separated
 * string: `twenty one` → `21`, `two hundred` → `200`, `three thousand` →
 * `3000`, `first` → `1st`. Malformed runs are left untouched. Symmetric — the
 * grader applies it to both the learner's answer and every accepted string.
 */
export function numberWordsToDigits(input: string): string {
  const tokens = input.split(" ");
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];
    if (token in ORDINALS) {
      out.push(ORDINALS[token]);
      i += 1;
      continue;
    }
    if (!isNumberWord(token)) {
      out.push(token);
      i += 1;
      continue;
    }
    // Collect the run of number words (allowing an inner "and" that is
    // immediately followed by another number word).
    let j = i;
    while (j < tokens.length) {
      const candidate = tokens[j];
      if (isNumberWord(candidate)) {
        j += 1;
        continue;
      }
      if (candidate === "and" && j > i && j + 1 < tokens.length && isNumberWord(tokens[j + 1])) {
        j += 1;
        continue;
      }
      break;
    }
    const run = tokens.slice(i, j);
    const value = parseNumberPhrase(run);
    if (value === null) out.push(...run);
    else out.push(String(value));
    i = j;
  }
  return out.join(" ");
}

// ── Canonical matching ───────────────────────────────────────────────────────

const LEADING_ARTICLE = /^(?:a|an|the) (?=\S)/;

/**
 * The form two strings are compared in: {@link normalizeText}, then hyphens
 * and dashes become spaces (`part-time` ≡ `part time`), number words become
 * digits, and ONE leading article is dropped when something follows it
 * (`the garden` ≡ `garden`; a bare `a` stays `a`).
 */
export function canonicalForMatch(input: string): string {
  const spaced = normalizeText(input)
    .replace(/(?<=\S)-(?=\S)/g, " ") // in-word hyphen → space (a sign like "-7" is kept)
    .replace(/ - /g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return numberWordsToDigits(spaced)
    .split(" ")
    .map(stripOrdinalSuffix)
    .join(" ")
    .replace(LEADING_ARTICLE, "");
}

const ORDINAL_SUFFIX = /^(\d+)(?:st|nd|rd|th)$/;

/** `3rd` → `3`, `21st` → `21`; anything else unchanged (dates: `3rd March` ≡ `3 March`). */
export function stripOrdinalSuffix(token: string): string {
  const match = ORDINAL_SUFFIX.exec(token);
  return match ? match[1] : token;
}

export interface WordCountOptions {
  /**
   * "ONE WORD AND/OR A NUMBER": tokens that parse as a number do not count
   * toward the word limit.
   */
  allowNumber?: boolean;
}

/** Word count of the normalized answer (hyphenated tokens count as one word). */
export function countWords(input: string, options: WordCountOptions = {}): number {
  const normalized = normalizeText(input);
  if (normalized === "") return 0;
  const tokens = normalized.split(" ");
  if (!options.allowNumber) return tokens.length;
  return tokens.filter((token) => numericValue(stripOrdinalSuffix(token)) === null).length;
}

/** True when the answer is over the question's word limit (IELTS: over = wrong). */
export function exceedsWordLimit(
  input: string,
  wordLimit: number | null,
  options: WordCountOptions = {},
): boolean {
  if (wordLimit == null) return false;
  return countWords(input, options) > wordLimit;
}

const ALLOW_NUMBER_INSTRUCTION =
  /and\s*\/?\s*or\s+a\s+number|and\s+a\s+number|or\s+a\s+number/i;

/**
 * Whether a set's instructions grant the "AND/OR A NUMBER" allowance, e.g.
 * "Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer."
 */
export function parseAllowNumber(instructions: string | null | undefined): boolean {
  if (!instructions) return false;
  return ALLOW_NUMBER_INSTRUCTION.test(instructions);
}

/**
 * Parse a numeric answer, ignoring thousands separators, currency, and `%`.
 * Unlike {@link normalizeText} this keeps a leading decimal point (`.5` → 0.5).
 */
export function numericValue(input: string): number | null {
  const cleaned = input.normalize("NFKC").replace(/[,\s$£€%]/g, "");
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

const NUMERIC_EPSILON = 1e-9;

function numbersEqual(a: number | null, b: number | null): boolean {
  return a !== null && b !== null && Math.abs(a - b) < NUMERIC_EPSILON;
}

/**
 * True when `answer` matches any accepted string — by canonical equality
 * ({@link canonicalForMatch}) or, if both sides are numeric, by numeric
 * equality (`1,000` ≡ `1000`, `3` ≡ `3.0`, `twenty` ≡ `20.0`).
 */
export function textMatches(answer: string, accepted: readonly string[]): boolean {
  const canonicalAnswer = canonicalForMatch(answer);
  if (canonicalAnswer === "") return false;
  const answerNumber = numericValue(answer) ?? numericValue(canonicalAnswer);
  for (const candidate of accepted) {
    const canonicalCandidate = canonicalForMatch(candidate);
    if (canonicalCandidate === canonicalAnswer) return true;
    if (answerNumber !== null) {
      const candidateNumber =
        numericValue(candidate) ?? numericValue(canonicalCandidate);
      if (numbersEqual(candidateNumber, answerNumber)) return true;
    }
  }
  return false;
}
