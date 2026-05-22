import type { DebateScore, ScoreRationale, ScoreRationaleCategory } from "@/types";

export interface DebateFeedbackDepthTarget {
  minArgumentBreakdowns: number;
  minAnnotations: number;
  minClashLinks: number;
  maxArgumentBreakdowns: number;
  maxAnnotations: number;
  maxClashLinks: number;
}

export function getDebateFeedbackDepthTarget(params: {
  isFullRound?: boolean;
  actualDuration?: number;
  roundCount?: number;
}): DebateFeedbackDepthTarget {
  if (!params.isFullRound) {
    return {
      minArgumentBreakdowns: 2,
      minAnnotations: 4,
      minClashLinks: 0,
      maxArgumentBreakdowns: 4,
      maxAnnotations: 8,
      maxClashLinks: 0,
    };
  }

  const duration = params.actualDuration ?? 0;
  if (duration >= 540 || (params.roundCount ?? 0) >= 5) {
    return {
      minArgumentBreakdowns: 5,
      minAnnotations: 10,
      minClashLinks: 5,
      maxArgumentBreakdowns: 7,
      maxAnnotations: 14,
      maxClashLinks: 8,
    };
  }

  return {
    minArgumentBreakdowns: 4,
    minAnnotations: 8,
    minClashLinks: 4,
    maxArgumentBreakdowns: 6,
    maxAnnotations: 12,
    maxClashLinks: 6,
  };
}

export function isFeedbackBelowDepthTarget(
  feedback: DebateScore,
  target: DebateFeedbackDepthTarget
) {
  return (
    (feedback.argumentBreakdowns?.length ?? 0) < target.minArgumentBreakdowns ||
    (feedback.transcriptAnnotations?.length ?? 0) < target.minAnnotations ||
    (target.minClashLinks > 0 &&
      (feedback.clashLinks?.length ?? 0) < target.minClashLinks) ||
    !feedback.scoreRationale
  );
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeCategory(
  value: unknown,
  fallbackScore: number,
  maxScore: number
): ScoreRationaleCategory | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  const rationale = readString(source.rationale);
  const whyNotHigher = readString(source.whyNotHigher);
  const nextStep = readString(source.nextStep);
  if (!rationale || !whyNotHigher || !nextStep) return null;

  return {
    score: readNumber(source.score, fallbackScore),
    maxScore: readNumber(source.maxScore, maxScore),
    rationale,
    whyNotHigher,
    nextStep,
  };
}

export function normalizeScoreRationale(
  value: unknown,
  feedback: Pick<DebateScore, "content" | "structure" | "language" | "persuasion">
): ScoreRationale | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Record<string, unknown>;
  const overall = readString(source.overall);
  if (!overall) return undefined;

  const content = normalizeCategory(source.content, feedback.content.score, 40);
  const structure = normalizeCategory(source.structure, feedback.structure.score, 25);
  const language = normalizeCategory(source.language, feedback.language.score, 25);
  const persuasion = normalizeCategory(source.persuasion, feedback.persuasion.score, 10);

  if (!content || !structure || !language || !persuasion) return undefined;

  return {
    overall,
    content,
    structure,
    language,
    persuasion,
  };
}
