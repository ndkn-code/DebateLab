/**
 * Backtest engine for IELTS band prediction (Wave 6.3 Workstream B). Pure: it
 * replays a learner's chronological evidence and, at each mock boundary,
 * recomputes the forecast a model WOULD have made using only evidence dated
 * strictly before that mock — then scores it against the mock's actual bands.
 *
 * Strictly-before is the no-leakage rule: a mock's own result (its objective
 * grades, its W/S scores) lands in the evidence ledger at or after the mock
 * timestamp, so filtering on `<` holds it out and the forecast is genuinely
 * out-of-sample.
 *
 * Metrics, per skill and overall: MAE, signed bias, RMSE, within-half-band
 * hit-rate, and interval calibration (does the served "80%" interval actually
 * contain the truth 80% of the time?). Plus a Brier score for the
 * "on track to hit target by test date" forecast, derived from the predicted
 * overall band and its interval. The same engine scores v1 and every challenger
 * through the {@link Forecaster} seam.
 */
import {
  IELTS_SKILLS,
  type IeltsBandEstimate,
  type IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import { buildIeltsBandPrediction } from "./predictor";
import {
  brierScore,
  brierSkillScore,
  meanAbsoluteError,
  normalExceedanceProbability,
  normalQuantile,
  recalibrateInterval,
  rootMeanSquareError,
  signedBias,
  withinHalfBandRate,
  type BandComparison,
  type IntervalObservation,
  type ProbabilityForecast,
} from "./metrics";
import type {
  BacktestOptions,
  BacktestReport,
  BacktestScenario,
  BandForecast,
  ForecastRequest,
  Forecaster,
  ForecastTarget,
  MockOutcome,
  TargetMetrics,
} from "./backtest.types";

export const V1_MODEL_VERSION = "weighted-recency-v1";
const DEFAULT_CLAIMED_LEVEL = 0.8;

function toForecast(estimate: IeltsBandEstimate): BandForecast {
  return {
    band: estimate.band,
    lower: estimate.lower,
    upper: estimate.upper,
    confidence: estimate.confidence,
  };
}

/** Adapter exposing the served `weighted-recency-v1` predictor as a Forecaster. */
export const weightedRecencyForecaster: Forecaster = (
  request: ForecastRequest,
): { overall: BandForecast; skills: Record<IeltsSkill, BandForecast> } => {
  const prediction = buildIeltsBandPrediction({
    userId: request.userId,
    module: request.module,
    asOf: request.asOf,
    targetBand: request.targetBand,
    observations: request.observations,
    skillStates: request.skillStates,
  });
  return {
    overall: toForecast(prediction.overall),
    skills: Object.fromEntries(
      IELTS_SKILLS.map((skill) => [skill, toForecast(prediction.skills[skill])]),
    ) as Record<IeltsSkill, BandForecast>,
  };
};

interface Accumulator {
  comparisons: Map<ForecastTarget, BandComparison[]>;
  intervals: Map<ForecastTarget, IntervalObservation[]>;
  onTrack: ProbabilityForecast[];
  boundaryCount: number;
  skippedDiagnostic: number;
  zForLevel: number;
}

function newAccumulator(zForLevel: number): Accumulator {
  const targets: ForecastTarget[] = ["overall", ...IELTS_SKILLS];
  const comparisons = new Map<ForecastTarget, BandComparison[]>();
  const intervals = new Map<ForecastTarget, IntervalObservation[]>();
  for (const target of targets) {
    comparisons.set(target, []);
    intervals.set(target, []);
  }
  return {
    comparisons,
    intervals,
    onTrack: [],
    boundaryCount: 0,
    skippedDiagnostic: 0,
    zForLevel,
  };
}

/** Record a single (forecast, actual) pair for one target, when both exist. */
function scoreTarget(
  acc: Accumulator,
  target: ForecastTarget,
  forecast: BandForecast,
  actual: number | null,
): void {
  if (forecast.band == null || actual == null) return;
  acc.comparisons.get(target)?.push({ predicted: forecast.band, actual });
  if (forecast.lower != null && forecast.upper != null) {
    acc.intervals.get(target)?.push({ lower: forecast.lower, upper: forecast.upper, actual });
  }
}

// Turn the served interval back into a Gaussian SD so the "on track" forecast
// is a real probability. Caller only invokes this with a non-null band; a
// missing or zero-width interval ⇒ SD 0 ⇒ the forecast becomes a step.
function sigmaFromForecast(forecast: BandForecast, zForLevel: number): number {
  if (forecast.lower == null || forecast.upper == null) return 0;
  const halfWidth = (forecast.upper - forecast.lower) / 2;
  if (halfWidth <= 0) return 0;
  return halfWidth / zForLevel;
}

function priorObservations(scenario: BacktestScenario, cutoff: number) {
  return scenario.observations.filter(
    (observation) => Date.parse(observation.occurredAt) < cutoff,
  );
}

function processMock(
  acc: Accumulator,
  forecaster: Forecaster,
  scenario: BacktestScenario,
  mock: MockOutcome,
): void {
  const cutoff = Date.parse(mock.occurredAt);
  const forecast = forecaster({
    userId: scenario.userId,
    module: scenario.module,
    asOf: mock.occurredAt,
    targetBand: scenario.targetBand,
    observations: priorObservations(scenario, cutoff),
    skillStates: scenario.skillStates ?? [],
  });

  if (forecast.overall.band == null) {
    acc.skippedDiagnostic += 1;
  } else if (mock.overall != null) {
    acc.boundaryCount += 1;
    const sigma = sigmaFromForecast(forecast.overall, acc.zForLevel);
    acc.onTrack.push({
      probability: normalExceedanceProbability(forecast.overall.band, sigma, scenario.targetBand),
      outcome: mock.overall >= scenario.targetBand ? 1 : 0,
    });
  }
  scoreTarget(acc, "overall", forecast.overall, mock.overall);
  for (const skill of IELTS_SKILLS) {
    scoreTarget(acc, skill, forecast.skills[skill], mock.bands[skill]);
  }
}

function targetMetrics(
  acc: Accumulator,
  target: ForecastTarget,
  claimedLevel: number,
): TargetMetrics {
  const comparisons = acc.comparisons.get(target) ?? [];
  const intervals = acc.intervals.get(target) ?? [];
  return {
    target,
    count: comparisons.length,
    mae: meanAbsoluteError(comparisons),
    bias: signedBias(comparisons),
    rmse: rootMeanSquareError(comparisons),
    withinHalfBand: withinHalfBandRate(comparisons),
    calibration: recalibrateInterval(intervals, claimedLevel),
  };
}

/**
 * Replay every scenario through a forecaster and pool the results into one
 * report. Boundaries from all learners are pooled before metrics are computed,
 * so calibration and MAE reflect the population, not a per-learner average.
 */
export function runBacktest(
  forecaster: Forecaster,
  scenarios: readonly BacktestScenario[],
  options: BacktestOptions = {},
): BacktestReport {
  const claimedLevel = options.claimedLevel ?? DEFAULT_CLAIMED_LEVEL;
  const zForLevel = normalQuantile((1 + claimedLevel) / 2);
  const acc = newAccumulator(zForLevel);

  for (const scenario of scenarios) {
    const ordered = [...scenario.mocks].sort(
      (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
    );
    for (const mock of ordered) {
      processMock(acc, forecaster, scenario, mock);
    }
  }

  const onTrackOutcomes = acc.onTrack.map((forecast) => forecast.outcome);
  const baseRate =
    onTrackOutcomes.length === 0
      ? 0
      : onTrackOutcomes.reduce<number>((sum, value) => sum + value, 0) /
        onTrackOutcomes.length;

  return {
    model: options.modelLabel ?? "model",
    claimedLevel,
    learnerCount: scenarios.length,
    boundaryCount: acc.boundaryCount,
    skippedDiagnostic: acc.skippedDiagnostic,
    overall: targetMetrics(acc, "overall", claimedLevel),
    skills: Object.fromEntries(
      IELTS_SKILLS.map((skill) => [skill, targetMetrics(acc, skill, claimedLevel)]),
    ) as Record<IeltsSkill, TargetMetrics>,
    onTrack: {
      score: brierScore(acc.onTrack),
      skillScore: brierSkillScore(acc.onTrack),
      baseRate,
      count: acc.onTrack.length,
    },
  };
}
