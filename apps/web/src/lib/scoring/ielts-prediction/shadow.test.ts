import assert from "node:assert/strict";
import { IELTS_SKILLS, type IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import { weightedRecencyForecaster } from "./backtest";
import { irtForecaster } from "./irt";
import { DEFAULT_PROMOTION_POLICY, decidePromotion, runShadowComparison } from "./shadow";
import { makeSyntheticScenario } from "./synthetic";
import type { SyntheticLearnerSpec } from "./synthetic";
import type { BacktestReport, TargetMetrics } from "./backtest.types";

function close(actual: number, expected: number, tol = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${actual} ≈ ${expected} (±${tol})`);
}

function metric(mae: number, servedCoverage: number, claimedLevel = 0.8): TargetMetrics {
  return {
    target: "overall",
    count: 50,
    mae,
    bias: 0,
    rmse: mae,
    withinHalfBand: 0.9,
    calibration: {
      claimedLevel,
      servedCoverage,
      recommendedScale: 1,
      recalibratedCoverage: claimedLevel,
      calibrationError: Math.abs(servedCoverage - claimedLevel),
      sampleSize: 50,
    },
  };
}

function report(mae: number, servedCoverage: number, boundaryCount = 50): BacktestReport {
  const overall = metric(mae, servedCoverage);
  return {
    model: "m",
    claimedLevel: 0.8,
    learnerCount: 1,
    boundaryCount,
    skippedDiagnostic: 0,
    overall,
    skills: Object.fromEntries(IELTS_SKILLS.map((s) => [s, overall])) as Record<
      IeltsSkill,
      TargetMetrics
    >,
    onTrack: { score: 0.2, skillScore: 0.1, baseRate: 0.5, count: 50 },
  };
}

// ---- Better on BOTH MAE and calibration, enough data ⇒ promote --------------
{
  const decision = decidePromotion(report(0.5, 0.6), report(0.4, 0.78));
  assert.equal(decision.promote, true);
  close(decision.deltas.mae, -0.1);
  assert.ok(decision.deltas.calibrationError < 0);
}

// ---- Better MAE but worse calibration ⇒ no promotion ------------------------
assert.equal(decidePromotion(report(0.5, 0.8), report(0.4, 0.6)).promote, false);

// ---- Worse MAE ⇒ no promotion (even with great calibration) -----------------
assert.equal(decidePromotion(report(0.4, 0.6), report(0.5, 0.8)).promote, false);

// ---- Too few boundaries ⇒ no promotion --------------------------------------
assert.equal(decidePromotion(report(0.5, 0.6, 10), report(0.4, 0.78, 10)).promote, false);

// ---- Abstention guard: a challenger scoring fewer boundaries can't win -------
assert.equal(decidePromotion(report(0.5, 0.6, 50), report(0.4, 0.78, 40)).promote, false);

// ---- A tie inside epsilon ⇒ no promotion ------------------------------------
assert.equal(decidePromotion(report(0.5, 0.78), report(0.5, 0.78)).promote, false);

// ---- The decision always carries readable reasons ---------------------------
{
  const decision = decidePromotion(report(0.5, 0.6), report(0.4, 0.78));
  assert.equal(decision.reasons.length, 4);
  assert.ok(decision.reasons.every((reason) => typeof reason === "string"));
}

function scenario(seed: number): SyntheticLearnerSpec {
  return {
    // v1 validates userId as a UUID; derive a valid one from the seed digit.
    userId: `0000000${seed}-0000-4000-8000-000000000000`,
    module: "academic",
    trueBands: { listening: 6, reading: 6.5, writing: 5.5, speaking: 6 },
    targetBand: 6,
    startDate: "2026-01-01T00:00:00.000Z",
    mockCount: 5,
    daysBetweenMocks: 14,
    observationsPerSkillPerCycle: 3,
    observationNoise: 0.3,
    examNoise: 0.3,
    seed,
  };
}

// ---- Invariant: a model can never be promoted over itself -------------------
{
  const scenarios = [makeSyntheticScenario(scenario(5)), makeSyntheticScenario(scenario(6))];
  const decision = runShadowComparison(
    scenarios,
    { champion: weightedRecencyForecaster, challenger: weightedRecencyForecaster },
    { policy: { ...DEFAULT_PROMOTION_POLICY, minBoundaries: 1 } },
  );
  assert.equal(decision.promote, false);
  close(decision.deltas.mae, 0);
  close(decision.deltas.calibrationError, 0);
}

// ---- End to end: v1 vs the IRT challenger yields a valid comparison ----------
{
  const scenarios = [makeSyntheticScenario(scenario(7))];
  const comparison = runShadowComparison(
    scenarios,
    {
      champion: weightedRecencyForecaster,
      challenger: irtForecaster,
      challengerLabel: "irt-2pl-v1",
    },
    { policy: { ...DEFAULT_PROMOTION_POLICY, minBoundaries: 1 } },
  );
  assert.equal(typeof comparison.promote, "boolean");
  assert.equal(comparison.challenger.model, "irt-2pl-v1");
  assert.ok(Number.isFinite(comparison.deltas.calibrationError));
  assert.ok(Number.isFinite(comparison.deltas.withinHalfBand));
}

console.log("scoring/ielts-prediction/shadow tests passed");
