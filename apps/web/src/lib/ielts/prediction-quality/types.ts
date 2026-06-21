/**
 * Shapes for the internal admin "Prediction Quality" dashboard (Wave 6.3
 * Workstream B, item 4). The view-model is pure: it consumes the band-prediction
 * backtest harness (`runBacktest` → `BacktestReport`) over the qualifying-learner
 * scenarios the server repository assembles, and reshapes the reports into the
 * KPI cards, per-skill error table, calibration plot, and drift series the
 * recharts dashboard renders. No DB, no clock — every field is a deterministic
 * function of the input scenarios.
 */
import type { IeltsModule } from "@/lib/ielts/adaptive/contracts";
import type {
  BacktestScenario,
  ForecastTarget,
} from "@/lib/scoring/ielts-prediction";

/** Input to {@link buildPredictionQualityView}. */
export interface PredictionQualityInput {
  /** One replayable history per qualifying (learner, module). */
  scenarios: readonly BacktestScenario[];
  /** Nominal coverage the served interval claims (default 0.8). */
  claimedLevel?: number;
  /** Minimum mocks a scenario needs to be scored (default 2). */
  minMocks?: number;
  /**
   * Total (learner, module) histories examined before the min-mock filter, for
   * honest "N considered → M qualifying" reporting. Defaults to
   * `scenarios.length` when omitted (i.e. nothing was pre-filtered upstream).
   */
  scenariosConsidered?: number;
  /** True when the scenarios are synthetic fixtures, not a real cohort. */
  syntheticData?: boolean;
}

/** One row of the per-target error + calibration table (overall + 4 skills). */
export interface PredictionErrorRow {
  target: ForecastTarget;
  label: string;
  /** Scored mock boundaries contributing to this row. */
  count: number;
  /** Mean absolute band error; null when nothing was scored. */
  mae: number | null;
  /** Signed bias (predicted − actual); positive ⇒ the model flatters. */
  bias: number | null;
  rmse: number | null;
  /** Fraction within half a band of the truth (0..1). */
  withinHalfBand: number | null;
  /** Empirical coverage of the SERVED interval (0..1). */
  servedCoverage: number | null;
  /** |servedCoverage − claimedLevel|. */
  calibrationError: number | null;
  /** Conformal multiplier on the half-width that would restore coverage. */
  recommendedScale: number | null;
}

/** One point on the calibration plot: claimed vs empirical coverage per target. */
export interface CalibrationPoint {
  target: ForecastTarget;
  label: string;
  /** Nominal coverage the interval claims (e.g. 0.8). */
  claimed: number;
  /** Coverage actually achieved on the backtest set. */
  empirical: number;
  sampleSize: number;
}

/** One time bucket of the drift series (a calendar month of mock boundaries). */
export interface DriftPoint {
  /** Sortable bucket key, `YYYY-MM`. */
  window: string;
  /** Human label, e.g. "May 2026". */
  label: string;
  boundaryCount: number;
  mae: number | null;
  bias: number | null;
  withinHalfBand: number | null;
  calibrationError: number | null;
}

/** Headline metrics across all qualifying learners. */
export interface PredictionQualityKpis {
  model: string;
  claimedLevel: number;
  /** Qualifying (learner, module) scenarios scored. */
  learnerCount: number;
  /** Overall mock boundaries scored. */
  boundaryCount: number;
  /** Boundaries the model declined (diagnostic / null band). */
  skippedDiagnostic: number;
  mae: number | null;
  bias: number | null;
  withinHalfBand: number | null;
  servedCoverage: number | null;
  calibrationError: number | null;
  /** Brier score of the "on track to hit target" forecast. */
  onTrackBrier: number | null;
  /** Brier skill score vs the base-rate climatology forecast. */
  onTrackSkillScore: number | null;
}

export interface PredictionQualityMeta {
  /** (learner, module) histories examined before the min-mock filter. */
  scenariosConsidered: number;
  /** Histories that qualified (≥ minMocks). */
  qualifyingScenarios: number;
  minMocks: number;
  modules: IeltsModule[];
  syntheticData: boolean;
}

/** The fully-shaped, serializable payload the dashboard renders. */
export interface PredictionQualityView {
  /** True once at least one mock boundary was scored. */
  hasData: boolean;
  kpis: PredictionQualityKpis;
  /** Overall + per-skill, in display order. */
  errorRows: PredictionErrorRow[];
  /** Overall + per-skill calibration, in display order. */
  calibration: CalibrationPoint[];
  /** Chronological drift buckets. */
  drift: DriftPoint[];
  meta: PredictionQualityMeta;
}
