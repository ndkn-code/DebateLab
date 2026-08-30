import type { ScoreSource } from "@thinkfy/shared";

export type EffectiveScoreSource = ScoreSource;

export interface EffectiveBandProjection {
  listeningBand: number | null;
  readingBand: number | null;
  writingBand: number | null;
  speakingBand: number | null;
  overallBand: number | null;
  provisionalBand: number | null;
  overallIsProvisional: boolean;
  scoreSource: EffectiveScoreSource;
}

type ScoreRow = Record<string, unknown> | null | undefined;

function band(row: ScoreRow, key: string): number | null {
  const value = row?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function projectEffectiveScoreSource(
  effective: ScoreRow,
  source: ScoreRow,
): EffectiveScoreSource {
  if (
    effective?.score_source === "teacher" ||
    effective?.score_source === "mixed"
  ) {
    return "teacher_confirmed";
  }
  return band(source, "writing_band") !== null ||
    band(source, "speaking_band") !== null
    ? "ai_provisional"
    : "objective";
}

/**
 * Prefer the materialized, teacher-aware score while preserving an AI-only
 * fallback for attempts created before the effective-score migration.
 */
export function projectEffectiveBands(
  effective: ScoreRow,
  ai: ScoreRow,
): EffectiveBandProjection {
  const source = effective ?? ai;
  const listeningBand = band(source, "listening_band");
  const readingBand = band(source, "reading_band");
  const writingBand = band(source, "writing_band");
  const speakingBand = band(source, "speaking_band");
  const complete = [
    listeningBand,
    readingBand,
    writingBand,
    speakingBand,
  ].every((value) => value !== null);
  const flagged = effective?.overall_is_provisional === true;
  return {
    listeningBand,
    readingBand,
    writingBand,
    speakingBand,
    overallBand: complete && !flagged ? band(source, "overall_band") : null,
    provisionalBand: effective
      ? band(effective, "provisional_band")
      : band(ai, "overall_band"),
    overallIsProvisional: !complete || flagged,
    scoreSource: projectEffectiveScoreSource(effective, source),
  };
}
