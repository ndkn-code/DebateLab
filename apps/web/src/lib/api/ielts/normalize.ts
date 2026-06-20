/**
 * Pure, dependency-free text/answer normalization helpers (WS-1.1).
 *
 * Shared by the canonical question create-path (variant tolerance for hand
 * authoring) and the bulk importer (tolerating spreadsheet cell formats). No
 * Supabase / Zod imports — trivially unit-testable.
 */

/** Trim and collapse internal runs of whitespace to a single space. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Split a pipe-separated authoring cell into a clean list (options, headings,
 * features, accept-variants, cue-card bullets, follow-up questions). Trims each
 * entry, drops empties. Tolerates a trailing/leading pipe.
 */
export function splitPipeList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map((part) => normalizeWhitespace(part))
    .filter((part) => part.length > 0);
}

/** Unique, trimmed, non-empty — preserves first-seen order. */
export function dedupeStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = normalizeWhitespace(raw);
    if (v.length > 0 && !seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

/**
 * Extract the first integer from a loosely-formatted cell ("≈850", "150 words",
 * "40 min", "750-900" -> 750). Returns null when no digits are present.
 */
export function parseLeadingInt(value: string | null | undefined): number | null {
  if (value == null) return null;
  const match = String(value).match(/-?\d+/);
  if (!match) return null;
  const n = Number.parseInt(match[0], 10);
  return Number.isFinite(n) ? n : null;
}

export type TfngToken = "TRUE" | "FALSE" | "NOT GIVEN";
export type YnngToken = "YES" | "NO" | "NOT GIVEN";

function canonicalizeTriState(value: string): "AFFIRM" | "DENY" | "NOT GIVEN" | null {
  const v = normalizeWhitespace(value).toUpperCase().replace(/[._]/g, " ");
  if (v === "NG" || v === "NOT GIVEN" || v === "NOTGIVEN") return "NOT GIVEN";
  if (v === "T" || v === "TRUE" || v === "Y" || v === "YES") return "AFFIRM";
  if (v === "F" || v === "FALSE" || v === "N" || v === "NO") return "DENY";
  return null;
}

/** Map a loose value to a canonical TRUE / FALSE / NOT GIVEN token (or null). */
export function normalizeTfngToken(value: string): TfngToken | null {
  const c = canonicalizeTriState(value);
  if (c === "AFFIRM") return "TRUE";
  if (c === "DENY") return "FALSE";
  if (c === "NOT GIVEN") return "NOT GIVEN";
  return null;
}

/** Map a loose value to a canonical YES / NO / NOT GIVEN token (or null). */
export function normalizeYnngToken(value: string): YnngToken | null {
  const c = canonicalizeTriState(value);
  if (c === "AFFIRM") return "YES";
  if (c === "DENY") return "NO";
  if (c === "NOT GIVEN") return "NOT GIVEN";
  return null;
}

/**
 * Comparable form for an objective short-answer / completion answer: lower-cased,
 * whitespace-collapsed, surrounding punctuation stripped. Used by WS-1.2 grading
 * too; defined here so the single accept-variant convention lives in one place.
 */
export function normalizeAnswerKey(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}
