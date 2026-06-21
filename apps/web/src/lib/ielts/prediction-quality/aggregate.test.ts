import assert from "node:assert/strict";
import {
  makeSyntheticScenario,
  type BacktestScenario,
  type SyntheticLearnerSpec,
} from "@/lib/scoring/ielts-prediction";
import {
  bucketScenariosByMonth,
  buildPredictionQualityView,
  monthKey,
  monthLabel,
  targetLabel,
  TARGET_ORDER,
} from "./aggregate";

const BASE_SPEC: Omit<SyntheticLearnerSpec, "userId" | "seed"> = {
  module: "academic",
  trueBands: { listening: 6.5, reading: 6, writing: 5.5, speaking: 6 },
  targetBand: 6.5,
  startDate: "2026-01-12T09:00:00.000Z",
  mockCount: 4,
  daysBetweenMocks: 30,
  observationsPerSkillPerCycle: 3,
  observationNoise: 0,
  examNoise: 0,
};

/** The served predictor validates `userId` as a UUID, so fixtures need real ones. */
function uuid(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}

function learner(n: number, seed: number, overrides: Partial<SyntheticLearnerSpec> = {}) {
  return makeSyntheticScenario({ ...BASE_SPEC, userId: uuid(n), seed, ...overrides });
}

// ---- Pure label / bucket helpers -------------------------------------------
{
  assert.equal(targetLabel("overall"), "Overall");
  assert.equal(targetLabel("listening"), "Listening");
  assert.equal(targetLabel("speaking"), "Speaking");
  assert.deepEqual([...TARGET_ORDER], ["overall", "listening", "reading", "writing", "speaking"]);

  assert.equal(monthKey("2026-05-12T10:00:00.000Z"), "2026-05");
  assert.equal(monthKey("2026-11-01T00:00:00.000Z"), "2026-11");
  assert.equal(monthLabel("2026-05"), "May 2026");
  assert.equal(monthLabel("2026-11"), "Nov 2026");
  assert.equal(monthLabel("not-a-date"), "not-a-date"); // graceful fallback
}

// ---- bucketScenariosByMonth: split mocks, keep full evidence, sort ----------
{
  const base = learner(1, 7);
  // Two mocks two months apart, sharing the full observation history.
  const scenario: BacktestScenario = {
    ...base,
    mocks: [
      { attemptId: "m-mar", occurredAt: "2026-03-10T09:00:00.000Z", bands: base.mocks[0].bands, overall: base.mocks[0].overall },
      { attemptId: "m-jan", occurredAt: "2026-01-05T09:00:00.000Z", bands: base.mocks[1].bands, overall: base.mocks[1].overall },
    ],
  };
  const buckets = bucketScenariosByMonth([scenario]);
  assert.deepEqual(buckets.map((b) => b.window), ["2026-01", "2026-03"]); // chronological
  for (const bucket of buckets) {
    assert.equal(bucket.scenarios.length, 1);
    assert.equal(bucket.scenarios[0].mocks.length, 1); // one mock per month
    assert.equal(bucket.scenarios[0].observations.length, scenario.observations.length); // full evidence kept
  }
}

// ---- Empty cohort: a clean, honest empty state -----------------------------
{
  const view = buildPredictionQualityView({ scenarios: [] });
  assert.equal(view.hasData, false);
  assert.equal(view.kpis.boundaryCount, 0);
  assert.equal(view.kpis.learnerCount, 0);
  assert.equal(view.kpis.mae, null);
  assert.equal(view.kpis.calibrationError, null);
  assert.equal(view.kpis.onTrackBrier, null);
  assert.equal(view.errorRows.length, 5); // overall + 4 skills always present
  assert.equal(view.calibration.length, 5);
  assert.equal(view.drift.length, 0);
  for (const row of view.errorRows) {
    assert.equal(row.mae, null);
    assert.equal(row.servedCoverage, null);
  }
  assert.deepEqual(view.meta, {
    scenariosConsidered: 0,
    qualifyingScenarios: 0,
    minMocks: 2,
    modules: [],
    syntheticData: false,
  });
}

// ---- The ≥2-mock filter excludes sparse learners ----------------------------
{
  const twoMock = learner(2, 2);
  const oneMock: BacktestScenario = {
    userId: uuid(99),
    module: "academic",
    targetBand: 6.5,
    observations: [],
    mocks: [{ attemptId: "solo", occurredAt: "2026-02-01T09:00:00.000Z", bands: { listening: 6, reading: 6, writing: 6, speaking: 6 }, overall: 6 }],
    skillStates: [],
  };
  const view = buildPredictionQualityView({ scenarios: [twoMock, oneMock] });
  assert.equal(view.meta.scenariosConsidered, 2);
  assert.equal(view.meta.qualifyingScenarios, 1); // sparse learner dropped
  assert.equal(view.kpis.learnerCount, 1);
}

// ---- Synthetic recovery: noiseless truth ⇒ small error, well-formed view ----
{
  const view = buildPredictionQualityView({
    scenarios: [learner(11, 11), learner(22, 22), learner(33, 33)],
    syntheticData: true,
  });

  assert.equal(view.hasData, true);
  assert.equal(view.meta.qualifyingScenarios, 3);
  assert.equal(view.kpis.learnerCount, 3);
  assert.equal(view.meta.syntheticData, true);
  assert.deepEqual(view.meta.modules, ["academic"]);
  assert.ok(view.kpis.boundaryCount >= 3, "expected several scored boundaries");

  // Rows are overall + 4 skills, in canonical order.
  assert.deepEqual(view.errorRows.map((r) => r.target), [...TARGET_ORDER]);
  assert.deepEqual(view.calibration.map((c) => c.target), [...TARGET_ORDER]);

  // A noiseless trajectory should be recovered well within a band.
  assert.ok(view.kpis.mae !== null && view.kpis.mae <= 1, `overall MAE ${view.kpis.mae} should be ≤ 1`);
  assert.ok(view.kpis.withinHalfBand !== null && view.kpis.withinHalfBand >= 0.5);

  // Calibration points carry the claimed level and a sane empirical fraction.
  for (const point of view.calibration) {
    assert.equal(point.claimed, 0.8);
    assert.ok(point.empirical >= 0 && point.empirical <= 1);
  }
}

// ---- Drift: chronological buckets that conserve every scored boundary -------
{
  const scenarios = [learner(5, 5), learner(6, 6)];
  const view = buildPredictionQualityView({ scenarios });

  // Windows are sorted ascending and labelled.
  const windows = view.drift.map((d) => d.window);
  assert.deepEqual(windows, [...windows].sort());
  for (const point of view.drift) {
    assert.equal(point.label, monthLabel(point.window));
  }

  // Every scored boundary lands in exactly one month bucket — no double-count,
  // no drops (windowing keeps all evidence, so per-mock scoring is unchanged).
  const driftBoundaryTotal = view.drift.reduce((sum, point) => sum + point.boundaryCount, 0);
  assert.equal(driftBoundaryTotal, view.kpis.boundaryCount);
}

console.log("prediction-quality/aggregate.test.ts: all assertions passed.");
