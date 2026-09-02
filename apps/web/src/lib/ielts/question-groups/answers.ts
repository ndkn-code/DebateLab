/**
 * Answer helpers for grouped questions. Every member of a group is its own
 * `ielts_questions` row whose single blank is `DEFAULT_BLANK_ID` ("0"); the
 * value is the picked bank option id (select mode) or the typed text.
 */
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import { DEFAULT_BLANK_ID } from "@/lib/ielts/question-types/registry";
import type { IeltsAnswer } from "@/lib/ielts/question-types/types";

/** Structural response map — identical to the player's `IeltsResponseMap`. */
export type GroupResponseMap = IeltsResponseMap;

function firstNonEmpty(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? value : null;
  }
  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = firstNonEmpty(entry);
      if (found !== null) return found;
    }
  }
  return null;
}

/**
 * The learner's current value for a group member: the blank-"0" string of an
 * `IeltsAnswer` (an array collapses to its first non-empty entry). A bare
 * string response is tolerated. `null` when unset or blank.
 */
export function groupSlotValue(
  responses: GroupResponseMap,
  questionId: string,
): string | null {
  const response = responses[questionId];
  if (response == null) return null;
  if (typeof response === "string") return firstNonEmpty(response);
  if (typeof response !== "object" || Array.isArray(response)) return null;
  const values = (response as { values?: unknown }).values;
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  return firstNonEmpty((values as Record<string, unknown>)[DEFAULT_BLANK_ID]);
}

/** The `IeltsAnswer` to store for a member; `null` / "" clears the slot. */
export function setGroupSlotValue(optionIdOrText: string | null): IeltsAnswer {
  if (optionIdOrText === null || optionIdOrText.length === 0) return { values: {} };
  return { values: { [DEFAULT_BLANK_ID]: optionIdOrText } };
}

export function isSlotAnswered(
  responses: GroupResponseMap,
  questionId: string,
): boolean {
  return groupSlotValue(responses, questionId) !== null;
}

/**
 * Bank option ids already picked by the given members — used to grey out a
 * used heading/feature when `bankReuse` is false.
 */
export function usedOptionIds(
  responses: GroupResponseMap,
  questionIds: readonly string[],
): Set<string> {
  const used = new Set<string>();
  for (const id of questionIds) {
    const value = groupSlotValue(responses, id);
    if (value !== null) used.add(value);
  }
  return used;
}

/** Members still waiting for a value, in the order given. */
export function unansweredSlotIds(
  responses: GroupResponseMap,
  questionIds: readonly string[],
): string[] {
  return questionIds.filter((id) => !isSlotAnswered(responses, id));
}
