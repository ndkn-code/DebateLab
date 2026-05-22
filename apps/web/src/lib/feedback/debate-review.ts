import type {
  DebateClashLink,
  DebateClashOutcome,
  DebateClashTag,
  DebateReviewSpeaker,
  DebateRound,
  DebateVerdict,
  TranscriptAnnotation,
} from "@/types";
import { normalizeRebuttalText } from "@/lib/rebuttal/structured-response";

const VALID_SPEAKERS = new Set<DebateReviewSpeaker>(["user", "ai"]);
const VALID_OUTCOMES = new Set<DebateClashOutcome>([
  "answered",
  "dropped",
  "misanswered",
  "turned",
  "weighed",
]);
const VALID_TAGS = new Set<DebateClashTag>([
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
  const text = readString(value);
  return text ? text : null;
}

function readRoundNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : null;
}

function clampConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : 0.5;
}

function normalizeSpeaker(value: unknown): DebateReviewSpeaker | null {
  const speaker = readString(value);
  return VALID_SPEAKERS.has(speaker as DebateReviewSpeaker)
    ? (speaker as DebateReviewSpeaker)
    : null;
}

function makeClashId(
  index: number,
  sourceRoundNumber: number,
  sourceSpeaker: DebateReviewSpeaker,
  sourceQuote: string
) {
  const slug = sourceQuote
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 34);

  return `round-${sourceRoundNumber}-${sourceSpeaker}-clash-${index + 1}-${
    slug || "link"
  }`;
}

export function normalizeDebateVerdict(value: unknown): DebateVerdict | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const winner = readString(source.winner);

  if (winner !== "user" && winner !== "ai" && winner !== "tie") {
    return null;
  }

  const summary = readString(source.summary);
  const nextMove = readString(source.nextMove);

  if (!summary || !nextMove) return null;

  const decidingReasons = Array.isArray(source.decidingReasons)
    ? source.decidingReasons.map(readString).filter(Boolean).slice(0, 5)
    : [];

  return {
    winner,
    confidence: clampConfidence(source.confidence),
    summary,
    decidingReasons,
    nextMove,
  };
}

export function normalizeDebateClashLinks(value: unknown): DebateClashLink[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((rawLink, index) => {
      if (!rawLink || typeof rawLink !== "object") return null;
      const link = rawLink as Record<string, unknown>;
      const rawOutcome = readString(link.outcome);

      if (!VALID_OUTCOMES.has(rawOutcome as DebateClashOutcome)) {
        return null;
      }

      const sourceRoundNumber = readRoundNumber(link.sourceRoundNumber);
      const sourceSpeaker = normalizeSpeaker(link.sourceSpeaker);
      const sourceQuote = readString(link.sourceQuote);
      const judgeRead = readString(link.judgeRead);
      const suggestion = readString(link.suggestion);

      if (
        !sourceRoundNumber ||
        !sourceSpeaker ||
        !sourceQuote ||
        !judgeRead ||
        !suggestion
      ) {
        return null;
      }

      const responseQuote = readNullableString(link.responseQuote);
      const responseRoundNumber = responseQuote
        ? readRoundNumber(link.responseRoundNumber)
        : null;
      const responseSpeaker = responseQuote
        ? normalizeSpeaker(link.responseSpeaker)
        : null;
      const outcome = responseQuote
        ? (rawOutcome as DebateClashOutcome)
        : "dropped";
      const rawTag = readString(link.tag);
      const tag = VALID_TAGS.has(rawTag as DebateClashTag)
        ? (rawTag as DebateClashTag)
        : "clash";

      if (responseQuote && (!responseRoundNumber || !responseSpeaker)) {
        return null;
      }

      return {
        id:
          readString(link.id) ||
          makeClashId(index, sourceRoundNumber, sourceSpeaker, sourceQuote),
        sourceRoundNumber,
        sourceSpeaker,
        responseRoundNumber,
        responseSpeaker,
        sourceQuote,
        responseQuote,
        outcome,
        judgeRead,
        suggestion,
        tag,
      } satisfies DebateClashLink;
    })
    .filter(Boolean) as DebateClashLink[];
}

export function getRoundSpeaker(round: DebateRound): DebateReviewSpeaker {
  return round.type === "ai-rebuttal" ? "ai" : "user";
}

export function getRoundText(round: DebateRound) {
  return round.type === "ai-rebuttal"
    ? normalizeRebuttalText(round.aiResponse ?? "")
    : round.transcript ?? "";
}

export function getRoundFilterId(round: DebateRound) {
  return `${getRoundSpeaker(round)}-${round.roundNumber}`;
}

export function filterAnnotationsForRound(
  annotations: TranscriptAnnotation[] | null | undefined,
  speaker: DebateReviewSpeaker,
  roundNumber: number
) {
  if (!Array.isArray(annotations)) return [];

  return annotations.filter((annotation) => {
    if (annotation.roundNumber !== roundNumber) return false;
    return (annotation.speaker ?? "user") === speaker;
  });
}
