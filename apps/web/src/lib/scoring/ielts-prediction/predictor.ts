import {
  DEFAULT_IELTS_TARGET_BAND,
  IELTS_SKILLS,
  IeltsBandPredictionSchema,
  type IeltsBandEstimate,
  type IeltsBandEvidence,
  type IeltsBandEvidenceSource,
  type IeltsBandPrediction,
  type IeltsPredictionStatus,
  type IeltsSkill,
  type IeltsTrendDirection,
} from "@/lib/ielts/adaptive/contracts";
import { computeOverallBand } from "@/lib/scoring/ielts/overall-band";
import { roundToHalfBand } from "@/lib/scoring/round-half-band";
import { buildWeaknesses } from "./weakness";
import type {
  BuildIeltsBandPredictionInput,
  IeltsPredictionObservation,
} from "./input.types";

const MODEL_VERSION = "weighted-recency-v1";
const MS_PER_DAY = 86_400_000;
const MAX_EVIDENCE_ROWS = 8;

const HALF_LIFE_DAYS: Record<IeltsBandEvidenceSource, number> = {
  full_mock: 75,
  skill_mock: 75,
  writing_task: 60,
  speaking_part: 60,
  objective_drill: 45,
  learn_activity: 45,
  debate_prior: 30,
};

const SKILL_LABELS: Record<IeltsSkill, { en: string; vi: string }> = {
  listening: { en: "Listening", vi: "Nghe" },
  reading: { en: "Reading", vi: "Đọc" },
  writing: { en: "Writing", vi: "Viết" },
  speaking: { en: "Speaking", vi: "Nói" },
};

interface WeightedObservation {
  observation: IeltsPredictionObservation;
  band: number;
  daysAgo: number;
  recencyWeight: number;
  weight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundDecimal(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function normalizeBand(value: number): number {
  return roundToHalfBand(clamp(value, 0, 9));
}

function daysAgo(occurredAt: string, asOf: Date): number {
  const occurred = Date.parse(occurredAt);
  if (Number.isNaN(occurred)) return 0;
  return Math.max(0, (asOf.getTime() - occurred) / MS_PER_DAY);
}

function effectiveWeight(
  observation: IeltsPredictionObservation,
  asOf: Date,
): Pick<WeightedObservation, "daysAgo" | "recencyWeight" | "weight"> {
  const age = daysAgo(observation.occurredAt, asOf);
  const recencyWeight = Math.exp(-age / HALF_LIFE_DAYS[observation.source]);
  const reliability = clamp(observation.reliability, 0, 1);
  const coverage = clamp(observation.coverage, 0, 1);
  return {
    daysAgo: age,
    recencyWeight,
    weight: reliability * coverage * recencyWeight,
  };
}

function toEvidence(row: WeightedObservation): IeltsBandEvidence {
  return {
    source: row.observation.source,
    label: row.observation.label,
    band: row.band,
    rawScore: row.observation.rawScore ?? null,
    weight: roundDecimal(clamp(row.weight, 0, 1), 3),
    occurredAt: row.observation.occurredAt,
    explanation:
      row.observation.reasonEn ??
      `${row.observation.label} contributed with recency-adjusted weight.`,
  };
}

function emptyTrend(evidencePoints: number): IeltsBandEstimate["trend"] {
  return {
    direction: "unknown",
    delta30d: null,
    evidencePoints,
    explanation: "Trend needs at least two dated IELTS band observations.",
  };
}

function trendDirection(delta30d: number): IeltsTrendDirection {
  if (delta30d >= 0.25) return "up";
  if (delta30d <= -0.25) return "down";
  return "flat";
}

function trendExplanation(direction: IeltsTrendDirection, delta: number): string {
  const absDelta = Math.abs(delta).toFixed(2);
  if (direction === "flat") {
    return `Recent IELTS evidence is broadly flat (${absDelta} bands per 30 days).`;
  }
  return `Recent IELTS evidence is trending ${direction} by ${absDelta} bands per 30 days.`;
}

function computeTrend(weighted: readonly WeightedObservation[]): IeltsBandEstimate["trend"] {
  const recent = weighted
    .filter((row) => row.daysAgo <= 120)
    .sort((a, b) => a.observation.occurredAt.localeCompare(b.observation.occurredAt));
  if (recent.length < 2) return emptyTrend(recent.length);
  const firstTime = Date.parse(recent[0].observation.occurredAt);
  const points = recent.map((row) => ({
    x: (Date.parse(row.observation.occurredAt) - firstTime) / MS_PER_DAY,
    y: row.band,
  }));
  const delta =
    points.length === 2 ? twoPointDelta(points) : leastSquaresDelta(points);
  const roundedDelta = roundDecimal(delta, 2);
  const direction = trendDirection(roundedDelta);
  return {
    direction,
    delta30d: roundedDelta,
    evidencePoints: recent.length,
    explanation: trendExplanation(direction, roundedDelta),
  };
}

function twoPointDelta(points: readonly { x: number; y: number }[]): number {
  const days = Math.max(1, points[1].x - points[0].x);
  return ((points[1].y - points[0].y) / days) * 30;
}

function leastSquaresDelta(points: readonly { x: number; y: number }[]): number {
  const meanX = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const meanY = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const denominator = points.reduce((sum, point) => sum + (point.x - meanX) ** 2, 0);
  if (denominator === 0) return 0;
  const numerator = points.reduce(
    (sum, point) => sum + (point.x - meanX) * (point.y - meanY),
    0,
  );
  return (numerator / denominator) * 30;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function confidenceFor(weighted: readonly WeightedObservation[]): number {
  const sumWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  const sumSquared = weighted.reduce((sum, row) => sum + row.weight ** 2, 0);
  const effectiveSampleSize = sumSquared === 0 ? 0 : (sumWeight ** 2) / sumSquared;
  const quality = Math.min(1, sumWeight / 2.5);
  const recency = Math.max(...weighted.map((row) => row.recencyWeight), 0);
  const stabilityPenalty = Math.min(
    0.25,
    standardDeviation(weighted.map((row) => row.band)) / 4,
  );
  return roundDecimal(
    clamp(
      0.15 +
        0.35 * quality +
        0.25 * Math.min(1, effectiveSampleSize / 4) +
        0.25 * recency -
        stabilityPenalty,
      0,
      1,
    ),
    3,
  );
}

function statusFor(confidence: number, hasBand: boolean): IeltsPredictionStatus {
  if (!hasBand) return "diagnostic_needed";
  if (confidence >= 0.8) return "high_confidence";
  if (confidence >= 0.55) return "medium_confidence";
  return "low_confidence";
}

function rangeHalfWidth(confidence: number): number {
  if (confidence < 0.3) return 1.5;
  if (confidence < 0.55) return 1;
  if (confidence < 0.8) return 0.75;
  return 0.5;
}

function estimateSkill(
  skill: IeltsSkill,
  observations: readonly IeltsPredictionObservation[],
  asOf: Date,
): IeltsBandEstimate {
  const weighted = observations
    .filter((observation) => observation.skill === skill)
    .flatMap((observation) => {
      if (observation.band == null || observation.source === "debate_prior") return [];
      const weights = effectiveWeight(observation, asOf);
      return weights.weight === 0
        ? []
        : [{ observation, band: normalizeBand(observation.band), ...weights }];
    });
  if (weighted.length === 0) return diagnosticSkillEstimate(skill, observations);
  const sumWeight = weighted.reduce((sum, row) => sum + row.weight, 0);
  const rawBand =
    weighted.reduce((sum, row) => sum + row.band * row.weight, 0) / sumWeight;
  const band = normalizeBand(rawBand);
  const confidence = confidenceFor(weighted);
  const halfWidth = rangeHalfWidth(confidence);
  return {
    band,
    lower: normalizeBand(band - halfWidth),
    upper: normalizeBand(band + halfWidth),
    confidence,
    status: statusFor(confidence, true),
    trend: computeTrend(weighted),
    evidence: weighted
      .sort((a, b) => b.weight - a.weight)
      .slice(0, MAX_EVIDENCE_ROWS)
      .map(toEvidence),
    explanation: [
      `${SKILL_LABELS[skill].en} estimate uses ${weighted.length} recency-weighted IELTS observation(s).`,
      `Confidence reflects evidence quality, recency, volume, and score stability.`,
    ],
  };
}

function diagnosticSkillEstimate(
  skill: IeltsSkill,
  observations: readonly IeltsPredictionObservation[],
): IeltsBandEstimate {
  const evidence = observations
    .filter((observation) => observation.skill === skill)
    .slice(0, MAX_EVIDENCE_ROWS)
    .map((observation) => ({
      source: observation.source,
      label: observation.label,
      band: null,
      rawScore: observation.rawScore ?? null,
      weight: 0,
      occurredAt: observation.occurredAt,
      explanation:
        observation.reasonEn ??
        "This signal is retained for context but is not enough for a band forecast.",
    }));
  return {
    band: null,
    lower: null,
    upper: null,
    confidence: 0,
    status: "diagnostic_needed",
    trend: emptyTrend(0),
    evidence,
    explanation: [`${SKILL_LABELS[skill].en} needs IELTS diagnostic evidence.`],
  };
}

function buildOverall(skills: Record<IeltsSkill, IeltsBandEstimate>): IeltsBandEstimate {
  const missing = IELTS_SKILLS.filter((skill) => skills[skill].band == null);
  const evidence = IELTS_SKILLS.flatMap((skill) => skills[skill].evidence).slice(
    0,
    MAX_EVIDENCE_ROWS,
  );
  if (missing.length > 0) {
    return {
      band: null,
      lower: null,
      upper: null,
      confidence: 0,
      status: "diagnostic_needed",
      trend: emptyTrend(0),
      evidence,
      explanation: ["Overall prediction needs all four IELTS skill estimates."],
    };
  }
  const bands = Object.fromEntries(
    IELTS_SKILLS.map((skill) => [skill, skills[skill].band]),
  ) as Record<IeltsSkill, number>;
  const lower = Object.fromEntries(
    IELTS_SKILLS.map((skill) => [skill, skills[skill].lower]),
  ) as Record<IeltsSkill, number>;
  const upper = Object.fromEntries(
    IELTS_SKILLS.map((skill) => [skill, skills[skill].upper]),
  ) as Record<IeltsSkill, number>;
  const confidence = roundDecimal(Math.min(...IELTS_SKILLS.map((s) => skills[s].confidence)), 3);
  const trend = overallTrend(skills);
  return {
    band: computeOverallBand(bands).band,
    lower: computeOverallBand(lower).band,
    upper: computeOverallBand(upper).band,
    confidence,
    status: statusFor(confidence, true),
    trend,
    evidence,
    explanation: ["Overall prediction uses official four-skill IELTS aggregation."],
  };
}

function overallTrend(skills: Record<IeltsSkill, IeltsBandEstimate>): IeltsBandEstimate["trend"] {
  const deltas = IELTS_SKILLS.map((skill) => skills[skill].trend.delta30d).filter(
    (delta): delta is number => delta != null,
  );
  if (deltas.length === 0) return emptyTrend(0);
  const delta = roundDecimal(
    deltas.reduce((sum, value) => sum + value, 0) / deltas.length,
    2,
  );
  const direction = trendDirection(delta);
  return {
    direction,
    delta30d: delta,
    evidencePoints: deltas.length,
    explanation: trendExplanation(direction, delta),
  };
}

function nextBestDiagnostic(
  skills: Record<IeltsSkill, IeltsBandEstimate>,
): IeltsBandPrediction["nextBestDiagnostic"] {
  const missing = IELTS_SKILLS.filter((skill) => skills[skill].band == null);
  if (missing.length === 0) {
    return {
      required: false,
      skill: null,
      reasonEn: "All four IELTS skills have enough evidence for planning.",
      reasonVi: "Cả bốn kỹ năng IELTS đã có đủ dữ liệu để lập kế hoạch.",
    };
  }
  if (missing.length > 1) {
    return {
      required: true,
      skill: "full_mock",
      reasonEn: "Complete a diagnostic to unlock a four-skill prediction.",
      reasonVi: "Hãy làm bài chẩn đoán để mở dự đoán đủ bốn kỹ năng.",
    };
  }
  const skill = missing[0];
  return {
    required: true,
    skill,
    reasonEn: `${SKILL_LABELS[skill].en} needs diagnostic evidence before overall prediction.`,
    reasonVi: `${SKILL_LABELS[skill].vi} cần dữ liệu chẩn đoán trước khi dự đoán tổng thể.`,
  };
}

function limitationsFor(
  observations: readonly IeltsPredictionObservation[],
  skills: Record<IeltsSkill, IeltsBandEstimate>,
): string[] {
  const missing = IELTS_SKILLS.filter((skill) => skills[skill].band == null);
  const low = IELTS_SKILLS.filter((skill) => skills[skill].status === "low_confidence");
  const limitations: string[] = [];
  if (observations.length === 0) {
    limitations.push("No IELTS evidence is available yet; prediction is diagnostic-first.");
  }
  if (missing.length > 0) {
    limitations.push(`Missing IELTS band evidence for: ${missing.join(", ")}.`);
  }
  if (low.length > 0) {
    limitations.push(`Low-confidence skill estimate(s): ${low.join(", ")}.`);
  }
  return limitations;
}

export function buildIeltsBandPrediction(
  input: BuildIeltsBandPredictionInput,
): IeltsBandPrediction {
  const asOf = new Date(input.asOf ?? new Date().toISOString());
  const asOfIso = asOf.toISOString();
  const targetBand = normalizeBand(input.targetBand ?? DEFAULT_IELTS_TARGET_BAND);
  const skills = Object.fromEntries(
    IELTS_SKILLS.map((skill) => [
      skill,
      estimateSkill(skill, input.observations, asOf),
    ]),
  ) as Record<IeltsSkill, IeltsBandEstimate>;
  const prediction: IeltsBandPrediction = {
    userId: input.userId,
    asOf: asOfIso,
    modelVersion: MODEL_VERSION,
    module: input.module,
    overall: buildOverall(skills),
    skills,
    weaknesses: buildWeaknesses(skills, input.skillStates ?? [], targetBand),
    limitations: limitationsFor(input.observations, skills),
    nextBestDiagnostic: nextBestDiagnostic(skills),
  };
  return IeltsBandPredictionSchema.parse(prediction);
}
