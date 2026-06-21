/**
 * Pure forecast-quality statistics for the IELTS band-prediction backtest
 * (Wave 6.3 Workstream B). No DB, no I/O, no clock — every function is a
 * deterministic transform of its inputs, which is exactly what the `scoring/**`
 * coverage gate enforces and what lets the harness validate the math on
 * synthetic trajectories before any real cohort exists.
 *
 * Band errors live on the official half-band grid (0–9 in 0.5 steps), so
 * "within half a band" means an absolute error ≤ 0.5.
 */

/** One point forecast paired with the realized band it was scored against. */
export interface BandComparison {
  predicted: number;
  actual: number;
}

/** A served prediction interval paired with the realized band (calibration). */
export interface IntervalObservation {
  lower: number;
  upper: number;
  actual: number;
}

/** A probabilistic forecast (p ∈ [0,1]) paired with its binary outcome. */
export interface ProbabilityForecast {
  probability: number;
  outcome: 0 | 1;
}

/**
 * Result of recalibrating a served interval so its empirical coverage matches
 * the claimed level (e.g. tuning a nominal "80%" interval to actually contain
 * the truth 80% of the time). Uses split-conformal scaling of the half-width.
 */
export interface IntervalCalibration {
  /** Coverage the interval claims to provide (e.g. 0.8). */
  claimedLevel: number;
  /** Fraction of truths the SERVED interval actually contained. */
  servedCoverage: number;
  /** Multiplier on the half-width that makes empirical coverage ≥ claimed. */
  recommendedScale: number;
  /** Coverage the recalibrated (scaled) interval achieves on this set. */
  recalibratedCoverage: number;
  /** Absolute miscalibration of the served interval, |served − claimed|. */
  calibrationError: number;
  /** Number of usable interval observations. */
  sampleSize: number;
}

const COVERAGE_EPSILON = 1e-9;
const HALF_BAND = 0.5;

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Mean absolute error |predicted − actual|. Lower is better. */
export function meanAbsoluteError(rows: readonly BandComparison[]): number {
  return mean(rows.map((row) => Math.abs(row.predicted - row.actual)));
}

/**
 * Signed bias mean(predicted − actual). Positive ⇒ the model over-predicts
 * (flatters the learner); negative ⇒ it under-predicts.
 */
export function signedBias(rows: readonly BandComparison[]): number {
  return mean(rows.map((row) => row.predicted - row.actual));
}

/** Root mean square error — penalizes large misses more than {@link meanAbsoluteError}. */
export function rootMeanSquareError(rows: readonly BandComparison[]): number {
  return Math.sqrt(mean(rows.map((row) => (row.predicted - row.actual) ** 2)));
}

/** Fraction of forecasts landing within half a band of the truth. Higher is better. */
export function withinHalfBandRate(rows: readonly BandComparison[]): number {
  return mean(
    rows.map((row) =>
      Math.abs(row.predicted - row.actual) <= HALF_BAND + COVERAGE_EPSILON ? 1 : 0,
    ),
  );
}

/**
 * Smallest value `v` such that at least `level` of the (ascending) values are
 * ≤ v — the conformal upper quantile. Guarantees the recalibrated interval
 * covers ≥ the claimed level on the calibration set. Returns NaN when empty.
 */
export function coverageQuantile(values: readonly number[], level: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const clampedLevel = Math.min(1, Math.max(0, level));
  const index = Math.min(
    sorted.length,
    Math.max(1, Math.ceil(clampedLevel * sorted.length)),
  );
  return sorted[index - 1];
}

/**
 * Recalibrate a served interval to a target coverage. Each observation's
 * nonconformity is the band error in units of the served half-width; the
 * recommended scale is the conformal quantile of those scores at the claimed
 * level. Multiply the served half-width by it and empirical coverage matches.
 */
export function recalibrateInterval(
  rows: readonly IntervalObservation[],
  claimedLevel: number,
): IntervalCalibration {
  const scores = rows.flatMap((row) => {
    const halfWidth = (row.upper - row.lower) / 2;
    if (!Number.isFinite(halfWidth) || halfWidth <= 0) return [];
    if (!Number.isFinite(row.actual)) return [];
    const center = (row.lower + row.upper) / 2;
    return [Math.abs(row.actual - center) / halfWidth];
  });
  if (scores.length === 0) {
    return {
      claimedLevel,
      servedCoverage: 0,
      recommendedScale: 1,
      recalibratedCoverage: 0,
      calibrationError: claimedLevel,
      sampleSize: 0,
    };
  }
  const servedCoverage = mean(scores.map((score) => (score <= 1 + COVERAGE_EPSILON ? 1 : 0)));
  const recommendedScale = coverageQuantile(scores, claimedLevel);
  const recalibratedCoverage = mean(
    scores.map((score) => (score <= recommendedScale + COVERAGE_EPSILON ? 1 : 0)),
  );
  return {
    claimedLevel,
    servedCoverage,
    recommendedScale,
    recalibratedCoverage,
    calibrationError: Math.abs(servedCoverage - claimedLevel),
    sampleSize: scores.length,
  };
}

/** Mean squared error of probabilistic forecasts, mean((p − outcome)²) ∈ [0,1]. */
export function brierScore(forecasts: readonly ProbabilityForecast[]): number {
  return mean(forecasts.map((f) => (f.probability - f.outcome) ** 2));
}

/**
 * Brier skill score vs the base-rate "climatology" forecast: 1 means perfect,
 * 0 means no better than always predicting the observed base rate, negative
 * means worse than that baseline. Returns 0 when outcomes never vary (the
 * baseline is already perfect, so skill is undefined).
 */
export function brierSkillScore(forecasts: readonly ProbabilityForecast[]): number {
  if (forecasts.length === 0) return 0;
  const baseRate = mean(forecasts.map((f) => f.outcome));
  const baselineBrier = mean(forecasts.map((f) => (baseRate - f.outcome) ** 2));
  if (baselineBrier <= COVERAGE_EPSILON) return 0;
  return 1 - brierScore(forecasts) / baselineBrier;
}

// Abramowitz & Stegun 7.1.26 — max abs error 1.5e-7, ample for band probabilities.
function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const poly =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
    t;
  return sign * (1 - poly * Math.exp(-x * x));
}

/** Standard normal CDF Φ(z). Φ(0)=0.5, Φ(−z)=1−Φ(z). */
export function standardNormalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

// Peter Acklam's inverse-normal-CDF rational approximation (rel. error < 1.2e-9).
const ACKLAM_A = [
  -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
  1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
];
const ACKLAM_B = [
  -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
  6.680131188771972e1, -1.328068155288572e1,
];
const ACKLAM_C = [
  -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
  -2.549732539343734, 4.374664141464968, 2.938163982698783,
];
const ACKLAM_D = [
  7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
  3.754408661907416,
];
const ACKLAM_LOW = 0.02425;

/** Inverse standard normal CDF Φ⁻¹(p) for p ∈ (0,1). Φ⁻¹(0.5)=0. */
export function normalQuantile(p: number): number {
  if (p <= 0) return Number.NEGATIVE_INFINITY;
  if (p >= 1) return Number.POSITIVE_INFINITY;
  if (p < ACKLAM_LOW) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((ACKLAM_C[0] * q + ACKLAM_C[1]) * q + ACKLAM_C[2]) * q + ACKLAM_C[3]) * q +
        ACKLAM_C[4]) *
        q +
        ACKLAM_C[5]) /
      ((((ACKLAM_D[0] * q + ACKLAM_D[1]) * q + ACKLAM_D[2]) * q + ACKLAM_D[3]) * q + 1)
    );
  }
  if (p > 1 - ACKLAM_LOW) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((ACKLAM_C[0] * q + ACKLAM_C[1]) * q + ACKLAM_C[2]) * q + ACKLAM_C[3]) * q +
        ACKLAM_C[4]) *
        q +
        ACKLAM_C[5]) /
      ((((ACKLAM_D[0] * q + ACKLAM_D[1]) * q + ACKLAM_D[2]) * q + ACKLAM_D[3]) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((ACKLAM_A[0] * r + ACKLAM_A[1]) * r + ACKLAM_A[2]) * r + ACKLAM_A[3]) * r +
      ACKLAM_A[4]) *
      r +
      ACKLAM_A[5]) *
      q) /
    (((((ACKLAM_B[0] * r + ACKLAM_B[1]) * r + ACKLAM_B[2]) * r + ACKLAM_B[3]) * r +
      ACKLAM_B[4]) *
      r +
      1)
  );
}

/**
 * P(X ≥ threshold) for X ~ Normal(point, sigma). With sigma ≤ 0 the forecast
 * collapses to a deterministic step (1 if point ≥ threshold else 0).
 */
export function normalExceedanceProbability(
  point: number,
  sigma: number,
  threshold: number,
): number {
  if (!(sigma > 0)) return point >= threshold ? 1 : 0;
  return standardNormalCdf((point - threshold) / sigma);
}
