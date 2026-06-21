import assert from "node:assert/strict";
import { IELTS_SKILLS } from "@/lib/ielts/adaptive/contracts";
import { computeOverallBand } from "@/lib/scoring/ielts/overall-band";
import { gaussianNoise, makeSyntheticScenario, mulberry32 } from "./synthetic";
import type { SyntheticLearnerSpec } from "./synthetic";

function baseSpec(): SyntheticLearnerSpec {
  return {
    userId: "learner-1",
    module: "academic",
    trueBands: { listening: 6.5, reading: 6.5, writing: 6, speaking: 7 },
    targetBand: 6.5,
    startDate: "2026-01-01T00:00:00.000Z",
    mockCount: 4,
    daysBetweenMocks: 14,
    observationsPerSkillPerCycle: 2,
    observationNoise: 0.4,
    examNoise: 0.3,
    seed: 12345,
  };
}

// ---- mulberry32 is deterministic and in range ------------------------------
{
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  const seqC = [c(), c(), c()];
  assert.deepEqual(seqA, seqB); // same seed → same stream
  assert.notDeepEqual(seqA, seqC); // different seed → different stream
  for (const value of seqA) assert.ok(value >= 0 && value < 1);
}

// ---- gaussianNoise: sd 0 draws nothing; same seed → same draw --------------
{
  const rng = mulberry32(1);
  assert.equal(gaussianNoise(rng, 0), 0); // no draw consumed
  const first = gaussianNoise(rng, 1);
  const rng2 = mulberry32(1);
  assert.equal(gaussianNoise(rng2, 1), first);
}
{
  const rng = mulberry32(7);
  let sum = 0;
  const n = 2000;
  for (let i = 0; i < n; i += 1) sum += gaussianNoise(rng, 1);
  assert.ok(Math.abs(sum / n) < 0.1); // mean ≈ 0
}

// ---- Whole scenario is reproducible ----------------------------------------
assert.deepEqual(makeSyntheticScenario(baseSpec()), makeSyntheticScenario(baseSpec()));

// ---- Noiseless: mocks equal true ability; chronology + coverage hold --------
{
  const spec: SyntheticLearnerSpec = { ...baseSpec(), observationNoise: 0, examNoise: 0 };
  const scenario = makeSyntheticScenario(spec);
  assert.equal(scenario.mocks.length, spec.mockCount);
  for (const mock of scenario.mocks) {
    for (const skill of IELTS_SKILLS) assert.equal(mock.bands[skill], spec.trueBands[skill]);
    assert.equal(mock.overall, computeOverallBand(spec.trueBands).band);
  }
  const times = scenario.mocks.map((mock) => Date.parse(mock.occurredAt));
  for (let i = 1; i < times.length; i += 1) assert.ok(times[i] > times[i - 1]);
  const beforeFirst = scenario.observations.filter(
    (observation) => Date.parse(observation.occurredAt) < times[0],
  );
  for (const skill of IELTS_SKILLS) {
    assert.ok(beforeFirst.some((observation) => observation.skill === skill));
  }
}

// ---- Drift: a per-skill learning curve climbs each cycle --------------------
{
  const spec: SyntheticLearnerSpec = {
    ...baseSpec(),
    observationNoise: 0,
    examNoise: 0,
    mockCount: 3,
    trueBands: { listening: 6, reading: 6.5, writing: 6, speaking: 6 },
    driftPerMock: { reading: 0.5 },
  };
  const scenario = makeSyntheticScenario(spec);
  assert.equal(scenario.mocks[0].bands.reading, 6.5);
  assert.equal(scenario.mocks[1].bands.reading, 7); // +0.5
  assert.equal(scenario.mocks[2].bands.reading, 7.5); // +1.0
  assert.equal(scenario.mocks[2].bands.listening, 6); // no drift on listening
}

console.log("scoring/ielts-prediction/synthetic tests passed");
