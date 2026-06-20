/**
 * Variant-tolerant text matching for IELTS completion / short-answer grading
 * (WS-1.2). Pure and fully unit-tested — this is the `scoring/**` coverage gate.
 *
 * IELTS marks objective text answers on exact wording (correct spelling
 * required), but tolerant of: case, surrounding whitespace/punctuation, smart
 * quotes and dashes, thousands separators, and numeral formatting (`3` ≡ `3.0`).
 * Synonyms and alternative spellings are NOT guessed — they come from the
 * authored accept-variants list.
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

/** Word count of the normalized answer (hyphenated tokens count as one word). */
export function countWords(input: string): number {
  const normalized = normalizeText(input);
  if (normalized === "") return 0;
  return normalized.split(" ").length;
}

/** True when the answer is over the question's word limit (IELTS: over = wrong). */
export function exceedsWordLimit(input: string, wordLimit: number | null): boolean {
  if (wordLimit == null) return false;
  return countWords(input) > wordLimit;
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

/**
 * True when `answer` matches any accepted string — by normalized equality or, if
 * both sides are numeric, by numeric equality (`1,000` ≡ `1000`, `3` ≡ `3.0`).
 */
export function textMatches(answer: string, accepted: readonly string[]): boolean {
  const normalizedAnswer = normalizeText(answer);
  if (normalizedAnswer === "") return false;
  const answerNumber = numericValue(answer);
  for (const candidate of accepted) {
    if (normalizeText(candidate) === normalizedAnswer) return true;
    if (answerNumber !== null) {
      const candidateNumber = numericValue(candidate);
      if (
        candidateNumber !== null &&
        Math.abs(candidateNumber - answerNumber) < NUMERIC_EPSILON
      ) {
        return true;
      }
    }
  }
  return false;
}
