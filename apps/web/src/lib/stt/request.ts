import { isPlainRecord } from "@/lib/api/request-validation";
import type { MotionBrief } from "@/types";

function readStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, maxLength) : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function parseMotionBriefForStt(value: unknown): MotionBrief | undefined {
  if (!isPlainRecord(value)) return undefined;
  const keyTerms = readStringArray(value.keyTerms, 12, 160);
  const scope = typeof value.scope === "string" ? value.scope.trim().slice(0, 800) : "";
  const propositionBurden =
    typeof value.propositionBurden === "string"
      ? value.propositionBurden.trim().slice(0, 800)
      : "";
  const oppositionBurden =
    typeof value.oppositionBurden === "string"
      ? value.oppositionBurden.trim().slice(0, 800)
      : "";
  const modelClarification =
    typeof value.modelClarification === "string"
      ? value.modelClarification.trim().slice(0, 800)
      : "";

  if (
    keyTerms.length === 0 &&
    !scope &&
    !propositionBurden &&
    !oppositionBurden &&
    !modelClarification
  ) {
    return undefined;
  }

  return {
    keyTerms,
    scope,
    propositionBurden,
    oppositionBurden,
    modelClarification,
  };
}
