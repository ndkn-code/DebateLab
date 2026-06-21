/**
 * Shared types for the band-prediction backtest harness (Wave 6.3 Workstream B).
 * Type-only module — exempt from the `scoring/**` sibling-test rule.
 *
 * The {@link Forecaster} seam is the point of the whole harness: the served
 * `weighted-recency-v1` model and every shadow challenger (IRT, Elo, …)
 * implement the same signature, so one replay engine can score them all on
 * identical mock boundaries and the promotion gate compares like with like.
 */
import type { IeltsModule, IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import type {
  IeltsPredictionObservation,
  IeltsPredictionSubskillState,
} from "./input.types";
import type { IntervalCalibration } from "./metrics";

/** A single band forecast: point estimate + interval + confidence. */
export interface BandForecast {
  band: number | null;
  lower: number | null;
  upper: number | null;
  confidence: number;
}

/** A forecast for the overall band plus each of the four skills. */
export interface MultiBandForecast {
  overall: BandForecast;
  skills: Record<IeltsSkill, BandForecast>;
}

/** Everything a forecaster sees about a learner AS OF one moment in time. */
export interface ForecastRequest {
  userId: string;
  module: IeltsModule;
  asOf: string;
  targetBand: number;
  observations: readonly IeltsPredictionObservation[];
  skillStates: readonly IeltsPredictionSubskillState[];
}

/**
 * A model under test: a pure function from prior evidence to a forecast.
 * Deterministic — the same request must always yield the same forecast.
 */
export type Forecaster = (request: ForecastRequest) => MultiBandForecast;

/** An actual completed mock (one `attempt_band_scores` row + when it landed). */
export interface MockOutcome {
  attemptId: string;
  occurredAt: string;
  bands: Record<IeltsSkill, number | null>;
  overall: number | null;
}

/** One learner's full, replayable chronological history. */
export interface BacktestScenario {
  userId: string;
  module: IeltsModule;
  targetBand: number;
  targetTestDate?: string | null;
  observations: readonly IeltsPredictionObservation[];
  mocks: readonly MockOutcome[];
  skillStates?: readonly IeltsPredictionSubskillState[];
}

/** A forecast target: the overall band or one specific skill. */
export type ForecastTarget = "overall" | IeltsSkill;

/** Error + calibration metrics for one target over all scored boundaries. */
export interface TargetMetrics {
  target: ForecastTarget;
  count: number;
  mae: number;
  bias: number;
  rmse: number;
  withinHalfBand: number;
  calibration: IntervalCalibration;
}

/** Brier evaluation of the "on track to hit target by test date" forecast. */
export interface OnTrackBrier {
  score: number;
  skillScore: number;
  baseRate: number;
  count: number;
}

/** The full report for one model over one or more learners' histories. */
export interface BacktestReport {
  model: string;
  claimedLevel: number;
  learnerCount: number;
  /** Mock boundaries where the overall band was scorable. */
  boundaryCount: number;
  /** Boundaries skipped because the model returned a diagnostic (null) band. */
  skippedDiagnostic: number;
  overall: TargetMetrics;
  skills: Record<IeltsSkill, TargetMetrics>;
  onTrack: OnTrackBrier;
}

/** Tunable knobs for a backtest run. */
export interface BacktestOptions {
  modelLabel?: string;
  /** Nominal coverage the served interval claims (default 0.8). */
  claimedLevel?: number;
}
