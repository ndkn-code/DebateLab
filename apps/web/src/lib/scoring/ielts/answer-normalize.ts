/**
 * Pure answer-normalization helpers for IELTS objective auto-grading (WS-2.1).
 *
 * Variant tolerance lives here so the per-type scorers stay declarative. These
 * functions are the contract WS-1.2's renderers and WS-1.1's authoring conform
 * to (a learner response / answer key is read through `extractValue(s)`), so the
 * grader is tolerant of the exact JSON envelope a renderer emits.
 */

export type ResponseLike = unknown;

/** Comparable free-text token: trim, collapse internal whitespace, lowercase. */
export function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Choice token (option id, matching/label letter): drop non-alphanumerics. */
export function normalizeChoice(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

// T/F/NG and Y/N/NG: canonicalize synonyms while keeping yes/no distinct from
// true/false (a TFNG item must not accept "yes" for "true").
const BOOLEAN_SYNONYMS: Record<string, string> = {
  t: "true",
  true: "true",
  f: "false",
  false: "false",
  y: "yes",
  yes: "yes",
  n: "no",
  no: "no",
  ng: "notgiven",
  notgiven: "notgiven",
};

/** Canonical truth token for true_false_notgiven / yes_no_notgiven items. */
export function normalizeBoolean(value: string): string {
  const collapsed = normalizeText(value).replace(/[\s_-]+/g, "");
  return BOOLEAN_SYNONYMS[collapsed] ?? collapsed;
}

function primitiveToString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

/** Pull a single scalar answer out of a response/key envelope, tolerantly. */
export function extractValue(response: ResponseLike): string | null {
  const direct = primitiveToString(response);
  if (direct !== null) return direct;
  if (response && typeof response === "object" && !Array.isArray(response)) {
    const record = response as Record<string, unknown>;
    for (const key of ["value", "selected", "answer", "text"]) {
      const found = primitiveToString(record[key]);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Pull a list of scalar answers out of a response/key envelope, tolerantly. */
export function extractValues(response: ResponseLike): string[] {
  if (Array.isArray(response)) {
    return response.map(primitiveToString).filter((v): v is string => v !== null);
  }
  if (response && typeof response === "object") {
    const record = response as Record<string, unknown>;
    for (const key of ["values", "selected", "answers"]) {
      const list = record[key];
      if (Array.isArray(list)) {
        return list.map(primitiveToString).filter((v): v is string => v !== null);
      }
    }
  }
  const single = extractValue(response);
  return single === null ? [] : [single];
}

function hasNonEmptyToken(value: unknown): boolean {
  const single = primitiveToString(value);
  if (single !== null) return single.trim().length > 0;
  if (Array.isArray(value)) return value.some(hasNonEmptyToken);
  return false;
}

/** UI-safe answer presence check shared by mock navigation/review surfaces. */
export function isAnsweredResponse(response: ResponseLike): boolean {
  if (response === null || response === undefined) return false;
  if (hasNonEmptyToken(response)) return true;

  if (response && typeof response === "object" && !Array.isArray(response)) {
    const record = response as Record<string, unknown>;
    if ("values" in record && record.values && typeof record.values === "object") {
      if (Array.isArray(record.values)) return record.values.some(hasNonEmptyToken);
      return Object.values(record.values as Record<string, unknown>).some(hasNonEmptyToken);
    }
    return ["value", "selected", "answer", "text", "essay", "speakingResponseId", "audioStoragePath"]
      .some((key) => hasNonEmptyToken(record[key]));
  }

  return false;
}

/** Flatten a JSON answer-key value into a list of acceptable answer strings. */
export function toAnswerStrings(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap(toAnswerStrings);
  }
  const single = extractValue(value);
  if (single !== null) return [single];
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.keys(record)
      .sort((a, b) => {
        const left = Number(a);
        const right = Number(b);
        if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
        return a.localeCompare(b);
      })
      .flatMap((key) => toAnswerStrings(record[key]));
  }
  return [];
}

/** Word count under IELTS "NO MORE THAN N WORDS" rules. */
export function wordCount(value: string): number {
  const trimmed = value.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}
