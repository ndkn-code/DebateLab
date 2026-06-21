/**
 * Pure view-model for the IELTS home predicted-band card (WS-6.2.1).
 *
 * Shapes a Track-B `IeltsBandPrediction` into exactly what the dashboard card
 * renders: an overall estimate (band, confidence range, trend, gap-to-target)
 * plus a per-skill row each, and a diagnostic-first flag. Diagnostic-first is
 * the binding rule (phase-6-synthesis §2): until a learner has real evidence we
 * never show a band — we show "start your diagnostic". Keeping this logic pure
 * (and tested) keeps the component a thin renderer.
 */
import {
  IELTS_SKILLS,
  type IeltsBandEstimate,
  type IeltsBandPrediction,
  type IeltsPredictionStatus,
  type IeltsSkill,
  type IeltsTrendDirection,
} from "@/lib/ielts/adaptive/contracts";

export interface IeltsPredictionSkillRow {
  skill: IeltsSkill;
  band: number | null;
  rangeLabel: string | null;
  status: IeltsPredictionStatus;
  trend: IeltsTrendDirection;
  hasEvidence: boolean;
}

export interface IeltsPredictionOverallView {
  band: number | null;
  rangeLabel: string | null;
  confidencePercent: number;
  status: IeltsPredictionStatus;
  trend: IeltsTrendDirection;
  trendDelta30d: number | null;
  evidencePoints: number;
  targetBand: number;
  /** band − target (positive = above target), or null with no band yet. */
  targetDelta: number | null;
  /** True once the predicted band has reached/exceeded the target. */
  meetsTarget: boolean;
}

export interface IeltsPredictionCardView {
  /** No usable band yet → render the diagnostic prompt, not a number. */
  isDiagnosticFirst: boolean;
  overall: IeltsPredictionOverallView;
  skills: IeltsPredictionSkillRow[];
  /** What the next diagnostic should cover, straight from the predictor. */
  nextBestDiagnostic: IeltsBandPrediction["nextBestDiagnostic"];
}

/** Canonical one-decimal IELTS band string, or null when absent. */
function bandText(band: number | null): string | null {
  return band === null ? null : band.toFixed(1);
}

/** A "6.0–7.0"-style uncertainty range, or null if either bound is missing. */
export function formatBandRange(
  lower: number | null,
  upper: number | null,
): string | null {
  if (lower === null || upper === null) return null;
  const lo = bandText(lower);
  const hi = bandText(upper);
  if (lo === null || hi === null) return null;
  return lo === hi ? lo : `${lo}–${hi}`;
}

/** Diagnostic-first: an estimate has no usable band until it leaves cold-start. */
function hasEvidence(estimate: IeltsBandEstimate): boolean {
  return estimate.band !== null && estimate.status !== "diagnostic_needed";
}

function toSkillRow(skill: IeltsSkill, estimate: IeltsBandEstimate): IeltsPredictionSkillRow {
  const evidence = hasEvidence(estimate);
  return {
    skill,
    band: estimate.band,
    rangeLabel: evidence ? formatBandRange(estimate.lower, estimate.upper) : null,
    status: estimate.status,
    trend: estimate.trend.direction,
    hasEvidence: evidence,
  };
}

function clampConfidencePercent(confidence: number): number {
  return Math.round(Math.max(0, Math.min(1, confidence)) * 100);
}

/** Build the predicted-band card view-model from a Track-B prediction + target. */
export function buildIeltsPredictionCardView(
  prediction: IeltsBandPrediction,
  options: { targetBand: number },
): IeltsPredictionCardView {
  const overall = prediction.overall;
  const overallEvidence = hasEvidence(overall);
  const targetDelta =
    overall.band === null
      ? null
      : Math.round((overall.band - options.targetBand) * 10) / 10;

  return {
    isDiagnosticFirst: !overallEvidence,
    overall: {
      band: overall.band,
      rangeLabel: overallEvidence
        ? formatBandRange(overall.lower, overall.upper)
        : null,
      confidencePercent: clampConfidencePercent(overall.confidence),
      status: overall.status,
      trend: overall.trend.direction,
      trendDelta30d: overall.trend.delta30d,
      evidencePoints: overall.trend.evidencePoints,
      targetBand: options.targetBand,
      targetDelta,
      meetsTarget: targetDelta !== null && targetDelta >= 0,
    },
    skills: IELTS_SKILLS.map((skill) => toSkillRow(skill, prediction.skills[skill])),
    nextBestDiagnostic: prediction.nextBestDiagnostic,
  };
}
