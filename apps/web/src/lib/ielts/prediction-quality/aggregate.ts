/**
 * Pure aggregation for the admin "Prediction Quality" dashboard (Wave 6.3
 * Workstream B, item 4).
 *
 * The server repository assembles one {@link BacktestScenario} per qualifying
 * (learner, module) — a chronological history of evidence + real mock outcomes.
 * This module replays them through the served `weighted-recency-v1` model with
 * the backtest harness and reshapes the pooled {@link BacktestReport} into the
 * dashboard's KPI cards, per-skill error table, calibration plot (claimed vs
 * empirical coverage), and month-by-month drift series.
 *
 * Everything here is a deterministic function of the input scenarios: no DB, no
 * `Date.now()`. Time buckets are derived from each mock's own `occurredAt`, so
 * the same scenarios always produce the same view — which is what lets it be
 * validated on synthetic fixtures before any real cohort exists.
 */
import { IELTS_SKILLS, type IeltsModule } from "@/lib/ielts/adaptive/contracts";
import {
  runBacktest,
  weightedRecencyForecaster,
  V1_MODEL_VERSION,
  type BacktestReport,
  type BacktestScenario,
  type ForecastTarget,
  type TargetMetrics,
} from "@/lib/scoring/ielts-prediction";
import type {
  CalibrationPoint,
  DriftPoint,
  PredictionErrorRow,
  PredictionQualityInput,
  PredictionQualityKpis,
  PredictionQualityView,
} from "./types";

const DEFAULT_CLAIMED_LEVEL = 0.8;
const DEFAULT_MIN_MOCKS = 2;

/** Overall first, then the four skills — the canonical display order. */
export const TARGET_ORDER: readonly ForecastTarget[] = ["overall", ...IELTS_SKILLS];

const TARGET_LABELS: Record<ForecastTarget, string> = {
  overall: "Overall",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

export function targetLabel(target: ForecastTarget): string {
  return TARGET_LABELS[target];
}

function metricsForTarget(report: BacktestReport, target: ForecastTarget): TargetMetrics {
  return target === "overall" ? report.overall : report.skills[target];
}

/** Error metrics are only meaningful once a boundary was scored. */
function toErrorRow(metrics: TargetMetrics): PredictionErrorRow {
  const scored = metrics.count > 0;
  const calibrated = metrics.calibration.sampleSize > 0;
  return {
    target: metrics.target,
    label: targetLabel(metrics.target),
    count: metrics.count,
    mae: scored ? metrics.mae : null,
    bias: scored ? metrics.bias : null,
    rmse: scored ? metrics.rmse : null,
    withinHalfBand: scored ? metrics.withinHalfBand : null,
    servedCoverage: calibrated ? metrics.calibration.servedCoverage : null,
    calibrationError: calibrated ? metrics.calibration.calibrationError : null,
    recommendedScale: calibrated ? metrics.calibration.recommendedScale : null,
  };
}

function toCalibrationPoint(metrics: TargetMetrics, claimedLevel: number): CalibrationPoint {
  return {
    target: metrics.target,
    label: targetLabel(metrics.target),
    claimed: claimedLevel,
    empirical: metrics.calibration.servedCoverage,
    sampleSize: metrics.calibration.sampleSize,
  };
}

/** UTC `YYYY-MM` of an ISO timestamp — the drift bucket key. */
export function monthKey(occurredAt: string): string {
  return occurredAt.slice(0, 7);
}

/** "May 2026" for a `YYYY-MM` key. */
export function monthLabel(key: string): string {
  const date = new Date(`${key}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Slice each scenario's mocks into calendar-month buckets, keeping the FULL
 * observation history in every bucket so the no-leakage replay still sees all
 * evidence dated before each retained mock. A bucket holds only the scenarios
 * that have a mock in that month. Buckets are returned chronologically.
 */
export function bucketScenariosByMonth(
  scenarios: readonly BacktestScenario[],
): { window: string; scenarios: BacktestScenario[] }[] {
  const byWindow = new Map<string, BacktestScenario[]>();
  for (const scenario of scenarios) {
    const mocksByWindow = new Map<string, BacktestScenario["mocks"][number][]>();
    for (const mock of scenario.mocks) {
      const key = monthKey(mock.occurredAt);
      const list = mocksByWindow.get(key) ?? [];
      list.push(mock);
      mocksByWindow.set(key, list);
    }
    for (const [key, mocks] of mocksByWindow) {
      const windowed: BacktestScenario = { ...scenario, mocks };
      const bucket = byWindow.get(key) ?? [];
      bucket.push(windowed);
      byWindow.set(key, bucket);
    }
  }
  return [...byWindow.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([window, windowScenarios]) => ({ window, scenarios: windowScenarios }));
}

function buildDrift(
  scenarios: readonly BacktestScenario[],
  claimedLevel: number,
): DriftPoint[] {
  return bucketScenariosByMonth(scenarios).map(({ window, scenarios: windowScenarios }) => {
    const report = runBacktest(weightedRecencyForecaster, windowScenarios, { claimedLevel });
    const scored = report.overall.count > 0;
    const calibrated = report.overall.calibration.sampleSize > 0;
    return {
      window,
      label: monthLabel(window),
      boundaryCount: report.boundaryCount,
      mae: scored ? report.overall.mae : null,
      bias: scored ? report.overall.bias : null,
      withinHalfBand: scored ? report.overall.withinHalfBand : null,
      calibrationError: calibrated ? report.overall.calibration.calibrationError : null,
    };
  });
}

function toKpis(report: BacktestReport): PredictionQualityKpis {
  const scored = report.overall.count > 0;
  const calibrated = report.overall.calibration.sampleSize > 0;
  return {
    model: report.model,
    claimedLevel: report.claimedLevel,
    learnerCount: report.learnerCount,
    boundaryCount: report.boundaryCount,
    skippedDiagnostic: report.skippedDiagnostic,
    mae: scored ? report.overall.mae : null,
    bias: scored ? report.overall.bias : null,
    withinHalfBand: scored ? report.overall.withinHalfBand : null,
    servedCoverage: calibrated ? report.overall.calibration.servedCoverage : null,
    calibrationError: calibrated ? report.overall.calibration.calibrationError : null,
    onTrackBrier: report.onTrack.count > 0 ? report.onTrack.score : null,
    onTrackSkillScore: report.onTrack.count > 0 ? report.onTrack.skillScore : null,
  };
}

function collectModules(scenarios: readonly BacktestScenario[]): IeltsModule[] {
  const seen = new Set<IeltsModule>();
  for (const scenario of scenarios) seen.add(scenario.module);
  return [...seen].sort();
}

/**
 * Replay every qualifying scenario through the served model and shape the
 * pooled report into the dashboard view. Scenarios with fewer than `minMocks`
 * mocks are excluded from scoring but still counted in `scenariosConsidered`.
 */
export function buildPredictionQualityView(
  input: PredictionQualityInput,
): PredictionQualityView {
  const claimedLevel = input.claimedLevel ?? DEFAULT_CLAIMED_LEVEL;
  const minMocks = input.minMocks ?? DEFAULT_MIN_MOCKS;
  const considered = input.scenariosConsidered ?? input.scenarios.length;

  const qualifying = input.scenarios.filter((scenario) => scenario.mocks.length >= minMocks);
  const report = runBacktest(weightedRecencyForecaster, qualifying, {
    claimedLevel,
    modelLabel: V1_MODEL_VERSION,
  });

  return {
    hasData: report.boundaryCount > 0,
    kpis: toKpis(report),
    errorRows: TARGET_ORDER.map((target) => toErrorRow(metricsForTarget(report, target))),
    calibration: TARGET_ORDER.map((target) =>
      toCalibrationPoint(metricsForTarget(report, target), claimedLevel),
    ),
    drift: buildDrift(qualifying, claimedLevel),
    meta: {
      scenariosConsidered: considered,
      qualifyingScenarios: qualifying.length,
      minMocks,
      modules: collectModules(qualifying),
      syntheticData: input.syntheticData ?? false,
    },
  };
}
