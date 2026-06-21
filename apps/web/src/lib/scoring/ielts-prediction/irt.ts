/**
 * Shadow challenger #1 — a 2PL-IRT-style per-subskill ability estimate
 * (Wave 6.3 Workstream B). It implements the same {@link Forecaster} seam as
 * the served `weighted-recency-v1`, so the backtest scores both on identical
 * mock boundaries and the promotion gate compares like with like.
 *
 * HOW IT DIFFERS FROM v1. v1 is a recency-weighted MEAN of band point-estimates
 * with a bucketed, heuristic confidence→interval map. This model instead works
 * on a latent ability scale (the IRT θ): each observation is a measurement whose
 * Fisher information scales with the square of its source's DISCRIMINATION
 * (the "2" of 2PL — a full mock discriminates ability far better than a learn
 * activity), its reliability·coverage, and its recency. Abilities pool by
 * information (the MLE/EAP update), a weak Gaussian prior regularizes sparse
 * data, and the interval is the genuine Gaussian posterior (half-width =
 * z·posteriorSD), not a lookup table — so its uncertainty is principled and
 * directly comparable to v1 on calibration.
 *
 * Our evidence arrives already aggregated to band point-estimates rather than
 * raw item responses, so this is IRT's measurement core (information-weighted
 * latent-ability estimation with discrimination) adapted to that input — an
 * honest, structurally distinct alternative, not a reimplementation of v1.
 */
import {
  IELTS_SKILLS,
  type IeltsBandEvidenceSource,
  type IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import { computeOverallBand } from "@/lib/scoring/ielts/overall-band";
import { roundToHalfBand } from "@/lib/scoring/round-half-band";
import { normalQuantile } from "./metrics";
import type {
  BandForecast,
  Forecaster,
  ForecastRequest,
  MultiBandForecast,
} from "./backtest.types";
import type { IeltsPredictionObservation } from "./input.types";

export const IRT_MODEL_VERSION = "irt-2pl-v1";

const MS_PER_DAY = 86_400_000;
const THETA_SLOPE = 1.5; // bands per logit unit of ability
const THETA_CENTER = 4.5; // band at θ = 0 (mid of the 0–9 scale)
const HALF_LIFE_DAYS = 60; // information half-life for recency decay
const PRIOR_INFO = 0.2; // weak prior precision at θ = 0 (mild shrinkage)
const NOMINAL_LEVEL = 0.8; // the interval is a nominal 80% posterior interval
const Z_NOMINAL = normalQuantile((1 + NOMINAL_LEVEL) / 2); // ≈ 1.2816

/** Per-source discrimination a — how sharply the source resolves ability. */
const DISCRIMINATION: Record<IeltsBandEvidenceSource, number> = {
  full_mock: 1.4,
  skill_mock: 1.2,
  writing_task: 1.0,
  speaking_part: 1.0,
  objective_drill: 0.8,
  learn_activity: 0.6,
  debate_prior: 0, // excluded from ability estimation entirely
};

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

/** Map a 0–9 band onto the latent ability scale (band 4.5 ⇒ θ = 0). */
export function bandToTheta(band: number): number {
  return (band - THETA_CENTER) / THETA_SLOPE;
}

/** Map a latent ability back to a 0–9 band, clamped to the scale. */
export function thetaToBand(theta: number): number {
  return clamp(THETA_CENTER + THETA_SLOPE * theta, 0, 9);
}

const DIAGNOSTIC_FORECAST: BandForecast = {
  band: null,
  lower: null,
  upper: null,
  confidence: 0,
};

interface AbilityMeasurement {
  theta: number;
  information: number;
}

function measure(
  observation: IeltsPredictionObservation,
  asOf: number,
): AbilityMeasurement | null {
  if (observation.band == null || observation.source === "debate_prior") return null;
  const discrimination = DISCRIMINATION[observation.source];
  const quality =
    clamp(observation.reliability, 0, 1) * clamp(observation.coverage, 0, 1);
  if (discrimination <= 0 || quality <= 0) return null;
  const ageDays = Math.max(0, (asOf - Date.parse(observation.occurredAt)) / MS_PER_DAY);
  const recency = Math.exp(-ageDays / HALF_LIFE_DAYS);
  const information = discrimination ** 2 * quality * recency;
  if (!(information > 0)) return null;
  return { theta: bandToTheta(normalizeBand(observation.band)), information };
}

function estimateSkillAbility(
  skill: IeltsSkill,
  observations: readonly IeltsPredictionObservation[],
  asOf: number,
): BandForecast {
  const measurements = observations
    .filter((observation) => observation.skill === skill)
    .flatMap((observation) => {
      const measured = measure(observation, asOf);
      return measured ? [measured] : [];
    });
  if (measurements.length === 0) return DIAGNOSTIC_FORECAST;

  const observedInfo = measurements.reduce((sum, m) => sum + m.information, 0);
  const weightedTheta = measurements.reduce((sum, m) => sum + m.information * m.theta, 0);
  const totalInfo = observedInfo + PRIOR_INFO;
  const thetaHat = weightedTheta / totalInfo; // prior mean is θ = 0
  const posteriorSd = Math.sqrt(1 / totalInfo);
  const halfWidth = Z_NOMINAL * posteriorSd;
  const band = normalizeBand(thetaToBand(thetaHat));
  return {
    band,
    lower: normalizeBand(thetaToBand(thetaHat - halfWidth)),
    upper: normalizeBand(thetaToBand(thetaHat + halfWidth)),
    confidence: roundDecimal(clamp(1 - 1 / (1 + observedInfo), 0, 1), 3),
  };
}

function buildOverall(skills: Record<IeltsSkill, BandForecast>): BandForecast {
  const bands = IELTS_SKILLS.map((skill) => skills[skill].band);
  if (bands.some((band) => band == null)) return DIAGNOSTIC_FORECAST;
  const skillBand = (pick: (forecast: BandForecast) => number | null) =>
    Object.fromEntries(IELTS_SKILLS.map((skill) => [skill, pick(skills[skill])])) as Record<
      IeltsSkill,
      number | null
    >;
  return {
    band: computeOverallBand(skillBand((f) => f.band)).band,
    lower: computeOverallBand(skillBand((f) => f.lower)).band,
    upper: computeOverallBand(skillBand((f) => f.upper)).band,
    confidence: roundDecimal(Math.min(...IELTS_SKILLS.map((s) => skills[s].confidence)), 3),
  };
}

/** The 2PL-IRT shadow forecaster (see file header). Pure + deterministic. */
export const irtForecaster: Forecaster = (request: ForecastRequest): MultiBandForecast => {
  const asOf = Date.parse(request.asOf);
  const skills = Object.fromEntries(
    IELTS_SKILLS.map((skill) => [
      skill,
      estimateSkillAbility(skill, request.observations, asOf),
    ]),
  ) as Record<IeltsSkill, BandForecast>;
  return { overall: buildOverall(skills), skills };
};
