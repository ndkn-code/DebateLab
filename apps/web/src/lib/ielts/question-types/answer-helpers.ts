/**
 * Pure, immutable helpers for reading/writing an {@link IeltsAnswer}. Kept out
 * of the renderers so the answer-shape logic is unit-testable and the React
 * components stay thin.
 */
import type { BlankValue, IeltsAnswer } from "./types";

export function emptyAnswer(): IeltsAnswer {
  return { values: {} };
}

/** The string value for a blank ("" when unset or array-valued). */
export function getStringValue(answer: IeltsAnswer | null, blankId: string): string {
  const value = answer?.values[blankId];
  return typeof value === "string" ? value : "";
}

/** The list value for a blank ([] when unset or string-valued). */
export function getArrayValue(answer: IeltsAnswer | null, blankId: string): string[] {
  const value = answer?.values[blankId];
  return Array.isArray(value) ? value : [];
}

/** Immutably set a blank's value. */
export function setValue(
  answer: IeltsAnswer | null,
  blankId: string,
  value: BlankValue,
): IeltsAnswer {
  return { values: { ...(answer?.values ?? {}), [blankId]: value } };
}

/**
 * Toggle membership of `item` in a multi-select blank. When `max` is set and the
 * blank is already full, adding a new item is ignored (removal always works).
 */
export function toggleArrayValue(
  answer: IeltsAnswer | null,
  blankId: string,
  item: string,
  max?: number,
): IeltsAnswer {
  const current = getArrayValue(answer, blankId);
  if (current.includes(item)) {
    return setValue(answer, blankId, current.filter((entry) => entry !== item));
  }
  if (max != null && current.length >= max) return answer ?? emptyAnswer();
  return setValue(answer, blankId, [...current, item]);
}
