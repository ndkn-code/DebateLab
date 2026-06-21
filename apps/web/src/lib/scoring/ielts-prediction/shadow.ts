/**
 * Shadow-model evaluation + promotion gate (Wave 6.3 Workstream B). A challenger
 * forecaster runs ALONGSIDE the served `weighted-recency-v1` on the same
 * backtest set; v1 stays served until a challenger demonstrably wins.
 *
 * The bar is deliberately strict: a challenger is promoted only when it beats v1
 * on BOTH accuracy (overall MAE) AND calibration (how close the served interval's
 * empirical coverage is to its claimed level), by a margin, on enough boundaries,
 * and WITHOUT scoring fewer boundaries than v1 — so it can't "win" by abstaining
 * on the hard cases. A model that is more accurate but wildly overconfident does
 * not ship; neither does one that is well-calibrated but less accurate.
 */
import { runBacktest, V1_MODEL_VERSION } from "./backtest";
import type {
  BacktestOptions,
  BacktestReport,
  BacktestScenario,
  Forecaster,
} from "./backtest.types";

/** Tunables for the promotion decision. */
export interface PromotionPolicy {
  /** Minimum scored boundaries before any promotion is considered. */
  minBoundaries: number;
  /** Overall MAE must improve by at least this (bands). */
  maeEpsilon: number;
  /** Overall calibration error must improve by at least this (coverage points). */
  calibrationEpsilon: number;
}

export const DEFAULT_PROMOTION_POLICY: PromotionPolicy = {
  minBoundaries: 30,
  maeEpsilon: 0.01,
  calibrationEpsilon: 0.01,
};

/** The outcome of comparing a challenger against the champion. */
export interface ModelComparison {
  champion: BacktestReport;
  challenger: BacktestReport;
  promote: boolean;
  reasons: string[];
  deltas: {
    mae: number;
    calibrationError: number;
    withinHalfBand: number;
  };
}

/** Forecasters + labels for a shadow run. */
export interface ShadowForecasters {
  champion: Forecaster;
  challenger: Forecaster;
  championLabel?: string;
  challengerLabel?: string;
}

function calibrationError(report: BacktestReport): number {
  return report.overall.calibration.calibrationError;
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/**
 * Decide whether a challenger should be promoted over the champion. Pure
 * function of two finished reports, so the gate logic is unit-testable on
 * hand-built reports independent of any model's behavior.
 */
export function decidePromotion(
  champion: BacktestReport,
  challenger: BacktestReport,
  policy: PromotionPolicy = DEFAULT_PROMOTION_POLICY,
): ModelComparison {
  const championCal = calibrationError(champion);
  const challengerCal = calibrationError(challenger);
  const maeImproved = challenger.overall.mae <= champion.overall.mae - policy.maeEpsilon;
  const calImproved = challengerCal <= championCal - policy.calibrationEpsilon;
  const enoughData = challenger.boundaryCount >= policy.minBoundaries;
  const noAbstention = challenger.boundaryCount >= champion.boundaryCount;

  const reasons = [
    `boundaries: challenger ${challenger.boundaryCount} vs min ${policy.minBoundaries} — ${enoughData ? "ok" : "too few"}`,
    `coverage: challenger ${challenger.boundaryCount} vs champion ${champion.boundaryCount} — ${noAbstention ? "ok" : "fewer (abstained)"}`,
    `MAE: ${round(challenger.overall.mae)} vs ${round(champion.overall.mae)} — ${maeImproved ? "better" : "not better"}`,
    `calibration error: ${round(challengerCal)} vs ${round(championCal)} — ${calImproved ? "better" : "not better"}`,
  ];

  return {
    champion,
    challenger,
    promote: enoughData && noAbstention && maeImproved && calImproved,
    reasons,
    deltas: {
      mae: round(challenger.overall.mae - champion.overall.mae),
      calibrationError: round(challengerCal - championCal),
      withinHalfBand: round(challenger.overall.withinHalfBand - champion.overall.withinHalfBand),
    },
  };
}

/**
 * Run champion and challenger over the same scenarios and apply the gate.
 * Both models see identical mock boundaries, so the comparison is apples to
 * apples.
 */
export function runShadowComparison(
  scenarios: readonly BacktestScenario[],
  models: ShadowForecasters,
  options: { policy?: PromotionPolicy; backtest?: BacktestOptions } = {},
): ModelComparison {
  const backtestOptions = options.backtest ?? {};
  const champion = runBacktest(models.champion, scenarios, {
    ...backtestOptions,
    modelLabel: models.championLabel ?? V1_MODEL_VERSION,
  });
  const challenger = runBacktest(models.challenger, scenarios, {
    ...backtestOptions,
    modelLabel: models.challengerLabel ?? "challenger",
  });
  return decidePromotion(champion, challenger, options.policy ?? DEFAULT_PROMOTION_POLICY);
}
