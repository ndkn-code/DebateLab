import type {
  DebateDuelClashLink,
  DebateDuelClashOutcome,
  DebateDuelClashTag,
} from "@/types";

const VALID_OUTCOMES = new Set<DebateDuelClashOutcome>([
  "answered",
  "dropped",
  "misanswered",
  "turned",
  "weighed",
]);

const VALID_TAGS = new Set<DebateDuelClashTag>([
  "clash",
  "rebuttal",
  "weighing",
  "logic",
  "evidence",
]);

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(value: unknown) {
  const normalized = readString(value);
  return normalized.length > 0 ? normalized : null;
}

function makeClashId(index: number, sourceSpeechId: string, sourceQuote: string) {
  const slug = sourceQuote
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 36);

  return `clash-${index + 1}-${sourceSpeechId}-${slug || "link"}`;
}

export function normalizeDebateDuelClashLinks(
  value: unknown
): DebateDuelClashLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((rawLink, index) => {
      if (!rawLink || typeof rawLink !== "object") return null;
      const link = rawLink as Record<string, unknown>;
      const rawOutcome = readString(link.outcome);

      if (!VALID_OUTCOMES.has(rawOutcome as DebateDuelClashOutcome)) {
        return null;
      }

      const sourceSpeechId = readString(link.sourceSpeechId);
      const sourceQuote = readString(link.sourceQuote);
      const judgeRead = readString(link.judgeRead);
      const suggestion = readString(link.suggestion);

      if (!sourceSpeechId || !sourceQuote || !judgeRead || !suggestion) {
        return null;
      }

      const responseQuote = readNullableString(link.responseQuote);
      const responseSpeechId = responseQuote
        ? readNullableString(link.responseSpeechId)
        : null;
      const outcome = responseQuote
        ? (rawOutcome as DebateDuelClashOutcome)
        : "dropped";
      const rawTag = readString(link.tag);
      const tag = VALID_TAGS.has(rawTag as DebateDuelClashTag)
        ? (rawTag as DebateDuelClashTag)
        : "clash";
      const id =
        readString(link.id) || makeClashId(index, sourceSpeechId, sourceQuote);

      return {
        id,
        sourceSpeechId,
        responseSpeechId,
        sourceQuote,
        responseQuote,
        outcome,
        judgeRead,
        suggestion,
        tag,
      } satisfies DebateDuelClashLink;
    })
    .filter(Boolean) as DebateDuelClashLink[];
}

