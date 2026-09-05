/**
 * Destination-led column mapping for the roster importer (B3).
 *
 * **Destination-led, not source-led.** The UI shows one row per Thinkfy field
 * (nine rows, fixed) and asks which source column feeds it. Source-led mapping
 * grows with the teacher's sheet — a real centre roster carries `STT`,
 * `Học phí`, `Ghi chú lớp`, `Ca học` — and turns a 9-decision screen into a
 * 20-decision one, most of them "ignore".
 *
 * Auto-suggest is a **scored alias table**, not substring containment. The
 * IELTS importer's `has()` is fine against our own template, but against a
 * stranger's sheet `Tên` would match `Tên phụ huynh` as readily as `Họ và tên`.
 * Scoring plus greedy one-source-column-per-field resolves that; a weak
 * (substring-only) hit is surfaced as a guess the teacher must confirm.
 */
import { ROSTER_FIELDS, type RosterFieldId } from "../columns";
import { normalizeKey } from "./normalize";

/** 3 = header is exactly ours · 2 = known alias · 1 = substring guess. */
export type MappingConfidence = "exact" | "alias" | "guessed";

export interface ColumnSuggestion {
  field: RosterFieldId;
  /** Index into the sheet's header row, or `null` for "not mapped". */
  sourceIndex: number | null;
  confidence: MappingConfidence | null;
}

/** field → source column index. `null` means the field is left empty. */
export type RosterColumnMapping = Record<RosterFieldId, number | null>;

const SCORE: Record<MappingConfidence, number> = { exact: 3, alias: 2, guessed: 1 };

function fieldTokens(field: (typeof ROSTER_FIELDS)[number]): {
  exact: Set<string>;
  aliases: Set<string>;
} {
  return {
    exact: new Set(Object.values(field.header).map(normalizeKey)),
    aliases: new Set(field.aliases.map(normalizeKey)),
  };
}

function scoreHeader(
  header: string,
  tokens: { exact: Set<string>; aliases: Set<string> },
): MappingConfidence | null {
  const key = normalizeKey(header);
  if (!key) return null;
  if (tokens.exact.has(key)) return "exact";
  if (tokens.aliases.has(key)) return "alias";
  for (const alias of [...tokens.exact, ...tokens.aliases]) {
    // Word-boundary containment both ways: "ho ten hs" ⊃ "ho ten".
    if (alias.length >= 3 && (key.includes(alias) || alias.includes(key))) return "guessed";
  }
  return null;
}

/**
 * Greedy best-first assignment. Each source column feeds at most one field, so
 * `Email` and `Email phụ huynh` cannot both collapse onto `email` — the higher
 * score wins the column and the loser falls back to its next-best candidate.
 */
export function suggestColumnMapping(headers: readonly string[]): ColumnSuggestion[] {
  interface Candidate {
    field: RosterFieldId;
    sourceIndex: number;
    confidence: MappingConfidence;
  }
  const candidates: Candidate[] = [];
  for (const field of ROSTER_FIELDS) {
    const tokens = fieldTokens(field);
    headers.forEach((header, sourceIndex) => {
      const confidence = scoreHeader(header, tokens);
      if (confidence) candidates.push({ field: field.id, sourceIndex, confidence });
    });
  }
  candidates.sort((a, b) => {
    const delta = SCORE[b.confidence] - SCORE[a.confidence];
    if (delta !== 0) return delta;
    // Stable: earlier field declaration, then earlier column.
    const fieldDelta =
      ROSTER_FIELDS.findIndex((f) => f.id === a.field) -
      ROSTER_FIELDS.findIndex((f) => f.id === b.field);
    return fieldDelta !== 0 ? fieldDelta : a.sourceIndex - b.sourceIndex;
  });

  const takenFields = new Set<RosterFieldId>();
  const takenColumns = new Set<number>();
  const resolved = new Map<RosterFieldId, ColumnSuggestion>();
  for (const candidate of candidates) {
    if (takenFields.has(candidate.field) || takenColumns.has(candidate.sourceIndex)) continue;
    takenFields.add(candidate.field);
    takenColumns.add(candidate.sourceIndex);
    resolved.set(candidate.field, {
      field: candidate.field,
      sourceIndex: candidate.sourceIndex,
      confidence: candidate.confidence,
    });
  }
  return ROSTER_FIELDS.map(
    (field) =>
      resolved.get(field.id) ?? { field: field.id, sourceIndex: null, confidence: null },
  );
}

export function emptyMapping(): RosterColumnMapping {
  return ROSTER_FIELDS.reduce((acc, field) => {
    acc[field.id] = null;
    return acc;
  }, {} as RosterColumnMapping);
}

export function mappingFromSuggestions(
  suggestions: readonly ColumnSuggestion[],
): RosterColumnMapping {
  const mapping = emptyMapping();
  for (const suggestion of suggestions) mapping[suggestion.field] = suggestion.sourceIndex;
  return mapping;
}

/** Fields whose auto-suggestion is a weak guess and must be confirmed by a human. */
export function guessedFields(
  suggestions: readonly ColumnSuggestion[],
): RosterFieldId[] {
  return suggestions
    .filter((suggestion) => suggestion.confidence === "guessed")
    .map((suggestion) => suggestion.field);
}
