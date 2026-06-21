// Served predictor (weighted-recency-v1).
export { buildIeltsBandPrediction } from "./predictor";
export type {
  BuildIeltsBandPredictionInput,
  IeltsPredictionObservation,
  IeltsPredictionSubskillState,
} from "./input.types";

// Backtest harness (Wave 6.3 Workstream B) — pure, no user-facing surface.
export { runBacktest, weightedRecencyForecaster, V1_MODEL_VERSION } from "./backtest";
export type {
  BacktestOptions,
  BacktestReport,
  BacktestScenario,
  BandForecast,
  Forecaster,
  ForecastRequest,
  ForecastTarget,
  MockOutcome,
  MultiBandForecast,
  OnTrackBrier,
  TargetMetrics,
} from "./backtest.types";

// Forecast-quality statistics.
export {
  brierScore,
  brierSkillScore,
  coverageQuantile,
  meanAbsoluteError,
  normalExceedanceProbability,
  normalQuantile,
  recalibrateInterval,
  rootMeanSquareError,
  signedBias,
  standardNormalCdf,
  withinHalfBandRate,
} from "./metrics";
export type {
  BandComparison,
  IntervalCalibration,
  IntervalObservation,
  ProbabilityForecast,
} from "./metrics";

// Shadow challenger #1: 2PL-IRT per-subskill ability.
export { irtForecaster, IRT_MODEL_VERSION, bandToTheta, thetaToBand } from "./irt";

// Promotion gate: a challenger ships only when it beats v1 on MAE AND calibration.
export {
  decidePromotion,
  runShadowComparison,
  DEFAULT_PROMOTION_POLICY,
} from "./shadow";
export type { ModelComparison, PromotionPolicy, ShadowForecasters } from "./shadow";

// Deterministic synthetic fixtures (known true ability) for pre-launch validation.
export { makeSyntheticScenario, mulberry32, gaussianNoise } from "./synthetic";
export type { SyntheticLearnerSpec } from "./synthetic";
