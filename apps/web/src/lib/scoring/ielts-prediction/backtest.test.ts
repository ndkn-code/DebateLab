import assert from "node:assert/strict";
import { IELTS_SKILLS, type IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import { runBacktest, V1_MODEL_VERSION, weightedRecencyForecaster } from "./backtest";
import { irtForecaster } from "./irt";
import { makeSyntheticScenario } from "./synthetic";
import type { BacktestScenario, BandForecast, Forecaster } from "./backtest.types";
import type { IeltsPredictionObservation } from "./input.types";

// The v1 predictor validates userId as a UUID; the harness is UUID-agnostic.
const LEARNER = "11111111-1111-4111-8111-111111111111";

function close(actual: number, expected: number, tol = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${actual} ≈ ${expected} (±${tol})`);
}

function obs(skill: IeltsSkill, band: number, occurredAt: string): IeltsPredictionObservation {
  return {
    skill,
    band,
    occurredAt,
    source: "full_mock",
    label: `${skill}`,
    reliability: 1,
    coverage: 1,
    rawScore: null,
  };
}

function allSkills(band: number, occurredAt: string): IeltsPredictionObservation[] {
  return IELTS_SKILLS.map((skill) => obs(skill, band, occurredAt));
}

// ---- The v1 adapter mirrors buildIeltsBandPrediction ------------------------
{
  const forecast = weightedRecencyForecaster({
    userId: LEARNER,
    module: "academic",
    asOf: "2026-06-02T00:00:00.000Z",
    targetBand: 6.5,
    observations: allSkills(6.5, "2026-06-01T00:00:00.000Z"),
    skillStates: [],
  });
  assert.equal(forecast.overall.band, 6.5);
  assert.equal(forecast.skills.listening.band, 6.5);
  assert.equal(V1_MODEL_VERSION, "weighted-recency-v1");
}

// ---- Hand-built boundary: exact MAE / bias / per-skill error ----------------
{
  // Prior evidence puts every skill at band 6 ⇒ v1 predicts overall 6.
  // The mock's actual bands average to 6.5 (writing landed at 7).
  const scenario: BacktestScenario = {
    userId: LEARNER,
    module: "academic",
    targetBand: 6,
    observations: allSkills(6, "2026-06-01T00:00:00.000Z"),
    mocks: [
      {
        attemptId: "m1",
        occurredAt: "2026-06-15T00:00:00.000Z",
        bands: { listening: 6, reading: 6, writing: 7, speaking: 6 },
        overall: 6.5,
      },
    ],
  };
  const report = runBacktest(weightedRecencyForecaster, [scenario], { claimedLevel: 0.8 });
  assert.equal(report.boundaryCount, 1);
  assert.equal(report.skippedDiagnostic, 0);
  close(report.overall.mae, 0.5); // |6 − 6.5|
  close(report.overall.bias, -0.5); // under-prediction
  close(report.skills.writing.mae, 1); // predicted 6, actual 7
  close(report.skills.listening.mae, 0);
  // On-track: predicted 6 at threshold 6 ⇒ p = 0.5; outcome 1 ⇒ Brier 0.25.
  assert.equal(report.onTrack.count, 1);
  close(report.onTrack.baseRate, 1);
  close(report.onTrack.score, 0.25, 1e-6);
}

// ---- A mock with no prior evidence is skipped, not scored -------------------
{
  const scenario: BacktestScenario = {
    userId: LEARNER,
    module: "academic",
    targetBand: 6,
    observations: [],
    mocks: [
      {
        attemptId: "m",
        occurredAt: "2026-06-15T00:00:00.000Z",
        bands: { listening: 6, reading: 6, writing: 6, speaking: 6 },
        overall: 6,
      },
    ],
  };
  const report = runBacktest(weightedRecencyForecaster, [scenario]);
  assert.equal(report.boundaryCount, 0);
  assert.equal(report.skippedDiagnostic, 1);
  assert.equal(report.overall.count, 0);
}

// ---- No leakage: evidence dated AT the mock is held out ---------------------
{
  const tMock = "2026-06-15T00:00:00.000Z";
  const scenario: BacktestScenario = {
    userId: LEARNER,
    module: "academic",
    targetBand: 6,
    observations: [
      ...allSkills(5, "2026-06-01T00:00:00.000Z"), // prior truth
      ...allSkills(9, tMock), // the mock's OWN evidence — must be excluded
    ],
    mocks: [
      {
        attemptId: "m",
        occurredAt: tMock,
        bands: { listening: 5, reading: 5, writing: 5, speaking: 5 },
        overall: 5,
      },
    ],
  };
  const report = runBacktest(weightedRecencyForecaster, [scenario]);
  assert.equal(report.overall.count, 1);
  close(report.overall.mae, 0); // predicted from band-5 evidence only
}

// ---- Forecasters with degenerate intervals still score (branch coverage) ----
{
  const flat = (band: number): BandForecast => ({ band, lower: band, upper: band, confidence: 0.9 });
  const flatForecaster: Forecaster = () => ({
    overall: flat(6),
    skills: Object.fromEntries(IELTS_SKILLS.map((s) => [s, flat(6)])) as Record<
      IeltsSkill,
      BandForecast
    >,
  });
  const pointForecaster: Forecaster = () => ({
    overall: { band: 6, lower: null, upper: null, confidence: 0.5 },
    skills: Object.fromEntries(
      IELTS_SKILLS.map((s) => [s, { band: 6, lower: null, upper: null, confidence: 0.5 }]),
    ) as Record<IeltsSkill, BandForecast>,
  });
  const scenario: BacktestScenario = {
    userId: LEARNER,
    module: "academic",
    targetBand: 6,
    observations: allSkills(6, "2026-06-01T00:00:00.000Z"),
    mocks: [
      {
        attemptId: "m",
        occurredAt: "2026-06-15T00:00:00.000Z",
        bands: { listening: 6, reading: 6, writing: 6, speaking: 6 },
        overall: 6,
      },
    ],
  };
  const flatReport = runBacktest(flatForecaster, [scenario]);
  assert.equal(flatReport.boundaryCount, 1);
  assert.equal(flatReport.onTrack.count, 1);
  close(flatReport.onTrack.score, 0); // zero-width ⇒ step p=1, outcome 1
  // zero-width intervals are filtered out of calibration
  assert.equal(flatReport.overall.calibration.sampleSize, 0);

  const pointReport = runBacktest(pointForecaster, [scenario]);
  assert.equal(pointReport.boundaryCount, 1);
  assert.equal(pointReport.overall.calibration.sampleSize, 0); // null intervals → none recorded
}

// ---- Integration: noiseless stationary learner ⇒ v1 recovers the truth ------
{
  const scenario = makeSyntheticScenario({
    userId: LEARNER,
    module: "academic",
    trueBands: { listening: 6.5, reading: 6, writing: 5.5, speaking: 6.5 },
    targetBand: 6,
    startDate: "2026-01-01T00:00:00.000Z",
    mockCount: 5,
    daysBetweenMocks: 14,
    observationsPerSkillPerCycle: 3,
    observationNoise: 0,
    examNoise: 0,
    seed: 1,
  });
  const report = runBacktest(weightedRecencyForecaster, [scenario], { modelLabel: "v1" });
  assert.equal(report.model, "v1");
  assert.ok(report.boundaryCount >= 4);
  assert.ok(report.overall.mae <= 0.5);
  assert.equal(report.overall.withinHalfBand, 1);
}

// ---- claimedLevel threads through to calibration ----------------------------
{
  const scenario = makeSyntheticScenario({
    userId: LEARNER,
    module: "academic",
    trueBands: { listening: 6, reading: 6, writing: 6, speaking: 6 },
    targetBand: 6,
    startDate: "2026-01-01T00:00:00.000Z",
    mockCount: 3,
    daysBetweenMocks: 14,
    observationsPerSkillPerCycle: 2,
    observationNoise: 0.3,
    examNoise: 0.3,
    seed: 2,
  });
  const report = runBacktest(weightedRecencyForecaster, [scenario], { claimedLevel: 0.5 });
  assert.equal(report.claimedLevel, 0.5);
  assert.equal(report.overall.calibration.claimedLevel, 0.5);
}

// ---- The IRT challenger also runs cleanly through the engine ----------------
{
  const scenario = makeSyntheticScenario({
    userId: LEARNER,
    module: "academic",
    trueBands: { listening: 6.5, reading: 6, writing: 5.5, speaking: 6 },
    targetBand: 6,
    startDate: "2026-01-01T00:00:00.000Z",
    mockCount: 4,
    daysBetweenMocks: 14,
    observationsPerSkillPerCycle: 3,
    observationNoise: 0.3,
    examNoise: 0.3,
    seed: 3,
  });
  const report = runBacktest(irtForecaster, [scenario], { modelLabel: "irt" });
  assert.ok(Number.isFinite(report.overall.mae));
  assert.ok(report.boundaryCount >= 1);
}

console.log("scoring/ielts-prediction/backtest tests passed");
