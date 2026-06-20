/**
 * Grade a single answerable slot (WS-1.2). Pure — coverage-gated.
 *
 *  - select       → exact option-id match (1 mark).
 *  - multi_select → 1 mark per correct option chosen, up to the required count;
 *                   choosing MORE than required scores 0 (standard IELTS rule).
 *  - text         → variant-tolerant match, with the word limit enforced
 *                   (over the limit = wrong, per the official marking guidance).
 */
import type {
  BlankKey,
  BlankValue,
  BlankVerdict,
} from "@/lib/ielts/question-types/types";
import { exceedsWordLimit, textMatches } from "./text-normalize";

function asString(value: BlankValue | undefined): string {
  return typeof value === "string" ? value : "";
}

function asArray(value: BlankValue | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function gradeSelect(key: BlankKey, value: BlankValue | undefined): BlankVerdict {
  const max = key.points ?? 1;
  const choice = asString(value).trim();
  const correct = choice !== "" && key.accept.includes(choice);
  return { awarded: correct ? max : 0, max, correct };
}

function gradeMultiSelect(
  key: BlankKey,
  value: BlankValue | undefined,
): BlankVerdict {
  const required = key.select ?? key.accept.length;
  const max = Math.max(required, 0);
  const chosen = [
    ...new Set(asArray(value).map((entry) => entry.trim()).filter(Boolean)),
  ];
  if (chosen.length > required) return { awarded: 0, max, correct: false };
  const acceptSet = new Set(key.accept);
  const hits = chosen.filter((entry) => acceptSet.has(entry)).length;
  const awarded = Math.min(hits, max);
  return { awarded, max, correct: max > 0 && awarded === max };
}

function gradeText(
  key: BlankKey,
  value: BlankValue | undefined,
  wordLimit: number | null,
): BlankVerdict {
  const max = key.points ?? 1;
  const answer = asString(value);
  if (exceedsWordLimit(answer, wordLimit)) return { awarded: 0, max, correct: false };
  const correct = textMatches(answer, key.accept);
  return { awarded: correct ? max : 0, max, correct };
}

export function gradeBlank(
  key: BlankKey,
  value: BlankValue | undefined,
  wordLimit: number | null,
): BlankVerdict {
  switch (key.mode) {
    case "select":
      return gradeSelect(key, value);
    case "multi_select":
      return gradeMultiSelect(key, value);
    case "text":
      return gradeText(key, value, wordLimit);
  }
}
