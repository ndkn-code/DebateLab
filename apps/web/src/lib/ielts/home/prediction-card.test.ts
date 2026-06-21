import assert from "node:assert/strict";
import {
  fixtureIeltsBandPrediction,
  lowConfidenceIeltsBandPrediction,
} from "@/lib/ielts/adaptive/contracts";
import {
  buildIeltsPredictionCardView,
  formatBandRange,
} from "./prediction-card";

// formatBandRange ----------------------------------------------------------
assert.equal(formatBandRange(5.5, 6.5), "5.5–6.5");
assert.equal(formatBandRange(6, 6), "6.0", "equal bounds collapse to a single band");
assert.equal(formatBandRange(null, 6.5), null, "a missing bound yields no range");
assert.equal(formatBandRange(6, null), null);

// Standard prediction (has evidence) ---------------------------------------
{
  const view = buildIeltsPredictionCardView(fixtureIeltsBandPrediction, {
    targetBand: 7,
  });

  assert.equal(view.isDiagnosticFirst, false);
  assert.equal(view.overall.band, 6);
  assert.equal(view.overall.rangeLabel, "5.5–6.5");
  assert.equal(view.overall.confidencePercent, 62);
  assert.equal(view.overall.status, "medium_confidence");
  assert.equal(view.overall.trend, "up");
  assert.equal(view.overall.targetBand, 7);
  assert.equal(view.overall.targetDelta, -1, "6 − 7 target = −1 band gap");
  assert.equal(view.overall.meetsTarget, false);

  assert.equal(view.skills.length, 4);
  const listening = view.skills.find((row) => row.skill === "listening");
  assert.ok(listening);
  assert.equal(listening.band, 6);
  assert.equal(listening.rangeLabel, "5.5–6.5");
  assert.equal(listening.hasEvidence, true);
  // Order is the canonical skill order.
  assert.deepEqual(
    view.skills.map((row) => row.skill),
    ["listening", "reading", "writing", "speaking"],
  );
}

// meetsTarget when band reaches target -------------------------------------
{
  const view = buildIeltsPredictionCardView(fixtureIeltsBandPrediction, {
    targetBand: 6,
  });
  assert.equal(view.overall.targetDelta, 0);
  assert.equal(view.overall.meetsTarget, true);
}

// Diagnostic-first (no evidence) -------------------------------------------
{
  const view = buildIeltsPredictionCardView(lowConfidenceIeltsBandPrediction, {
    targetBand: 6.5,
  });

  assert.equal(view.isDiagnosticFirst, true, "diagnostic_needed → never show a band");
  assert.equal(view.overall.band, null);
  assert.equal(view.overall.rangeLabel, null);
  assert.equal(view.overall.confidencePercent, 0);
  assert.equal(view.overall.targetDelta, null);
  assert.equal(view.overall.meetsTarget, false);

  assert.ok(view.skills.every((row) => row.hasEvidence === false));
  assert.ok(view.skills.every((row) => row.band === null));
  assert.ok(view.skills.every((row) => row.rangeLabel === null));

  assert.equal(view.nextBestDiagnostic.required, true);
  assert.equal(view.nextBestDiagnostic.skill, "full_mock");
}

console.log("prediction-card.test.ts: all assertions passed");
