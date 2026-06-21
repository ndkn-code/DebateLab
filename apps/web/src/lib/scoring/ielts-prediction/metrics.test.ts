import assert from "node:assert/strict";
import {
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

function close(actual: number, expected: number, tol = 1e-9): void {
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${actual} ≈ ${expected} (±${tol})`);
}

// ---- MAE vs bias vs RMSE: the same rows, three different lenses -------------
{
  const rows = [
    { predicted: 6, actual: 6.5 },
    { predicted: 7, actual: 6.5 },
  ];
  close(meanAbsoluteError(rows), 0.5); // (0.5 + 0.5) / 2
  close(signedBias(rows), 0); // (−0.5 + 0.5) / 2 — errors cancel
  close(rootMeanSquareError(rows), 0.5);
}
{
  const rows = [
    { predicted: 7, actual: 6 },
    { predicted: 7.5, actual: 6.5 },
  ];
  close(meanAbsoluteError(rows), 1);
  close(signedBias(rows), 1); // systematic over-prediction
}

// ---- Empty inputs are neutral (count is tracked separately) -----------------
close(meanAbsoluteError([]), 0);
close(signedBias([]), 0);
close(rootMeanSquareError([]), 0);
close(withinHalfBandRate([]), 0);

// ---- Within-half-band hit-rate ---------------------------------------------
{
  const rows = [
    { predicted: 6, actual: 6.5 }, // 0.5 → in
    { predicted: 6, actual: 7 }, // 1.0 → out
    { predicted: 6, actual: 6 }, // 0.0 → in
  ];
  close(withinHalfBandRate(rows), 2 / 3);
}

// ---- Conformal coverage quantile -------------------------------------------
close(coverageQuantile([0, 0.5, 1, 1.5, 2], 0.8), 1.5); // ceil(0.8·5)=4th order stat
close(coverageQuantile([0, 0.5, 1, 1.5, 2], 0.81), 2);
close(coverageQuantile([0, 0.5, 1, 1.5, 2], 0), 0); // clamps to the 1st
close(coverageQuantile([1, 2, 3], 2), 3); // level clamps to 1
close(coverageQuantile([1, 2, 3], -1), 1); // level clamps to 0
assert.ok(Number.isNaN(coverageQuantile([], 0.8)));

// ---- Recalibration: a deliberately under-covering interval ------------------
{
  // centers 0, half-width 1; truths at distances 0,0.5,1,1.5,2 ⇒ scores identical.
  const rows = [0, 0.5, 1, 1.5, 2].map((actual) => ({ lower: -1, upper: 1, actual }));
  const cal = recalibrateInterval(rows, 0.8);
  close(cal.servedCoverage, 0.6); // only 3/5 inside the served interval
  close(cal.recommendedScale, 1.5); // widen ×1.5 to reach 80%
  close(cal.recalibratedCoverage, 0.8);
  close(cal.calibrationError, 0.2); // |0.6 − 0.8|
  assert.equal(cal.sampleSize, 5);
}
// Degenerate intervals are filtered; non-finite truths are dropped.
{
  const cal = recalibrateInterval([{ lower: 1, upper: 1, actual: 1 }], 0.8);
  assert.equal(cal.sampleSize, 0);
  close(cal.recommendedScale, 1);
  close(cal.servedCoverage, 0);
  close(cal.calibrationError, 0.8);
}
{
  const cal = recalibrateInterval(
    [
      { lower: -1, upper: 1, actual: Number.NaN },
      { lower: -1, upper: 1, actual: 0 },
    ],
    0.8,
  );
  assert.equal(cal.sampleSize, 1); // the NaN truth is excluded
  close(cal.servedCoverage, 1);
}

// ---- Brier score + skill score ---------------------------------------------
close(brierScore([{ probability: 1, outcome: 1 }, { probability: 0, outcome: 0 }]), 0);
close(brierScore([{ probability: 0.5, outcome: 1 }, { probability: 0.5, outcome: 0 }]), 0.25);
close(brierScore([]), 0);
close(brierSkillScore([{ probability: 1, outcome: 1 }, { probability: 0, outcome: 0 }]), 1);
close(brierSkillScore([{ probability: 1, outcome: 1 }, { probability: 1, outcome: 1 }]), 0); // no variance
close(brierSkillScore([]), 0);

// ---- Standard normal CDF ----------------------------------------------------
close(standardNormalCdf(0), 0.5);
close(standardNormalCdf(1.2815515594), 0.9, 1e-3);
close(standardNormalCdf(-1), 1 - standardNormalCdf(1)); // symmetry, negative branch
assert.ok(standardNormalCdf(8) > 0.9999);
assert.ok(standardNormalCdf(-8) < 0.0001);

// ---- Inverse normal CDF (all three Acklam regions + guards) -----------------
close(normalQuantile(0.5), 0);
close(normalQuantile(0.9), 1.2815515594, 1e-4);
close(normalQuantile(0.975), 1.959963985, 1e-4);
close(normalQuantile(0.025), -1.959963985, 1e-4);
close(normalQuantile(0.01), -2.326347874, 1e-3); // low tail
close(normalQuantile(0.99), 2.326347874, 1e-3); // high tail
assert.equal(normalQuantile(0), Number.NEGATIVE_INFINITY);
assert.equal(normalQuantile(1), Number.POSITIVE_INFINITY);
close(standardNormalCdf(normalQuantile(0.3)), 0.3, 1e-6); // round-trip

// ---- Exceedance probability -------------------------------------------------
close(normalExceedanceProbability(6.5, 0.5, 6.5), 0.5); // at the mean
assert.ok(normalExceedanceProbability(7, 0.5, 6.5) > 0.5);
assert.ok(normalExceedanceProbability(6, 0.5, 6.5) < 0.5);
assert.equal(normalExceedanceProbability(7, 0, 6.5), 1); // sigma 0 → step
assert.equal(normalExceedanceProbability(6, 0, 6.5), 0);
assert.equal(normalExceedanceProbability(6.5, 0, 6.5), 1); // point ≥ threshold

console.log("scoring/ielts-prediction/metrics tests passed");
