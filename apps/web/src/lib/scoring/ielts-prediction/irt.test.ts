import assert from "node:assert/strict";
import {
  IELTS_SKILLS,
  type IeltsBandEvidenceSource,
  type IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";
import { bandToTheta, irtForecaster, IRT_MODEL_VERSION, thetaToBand } from "./irt";
import type { ForecastRequest } from "./backtest.types";
import type { IeltsPredictionObservation } from "./input.types";

function obs(
  skill: IeltsSkill,
  band: number | null,
  occurredAt: string,
  source: IeltsBandEvidenceSource = "full_mock",
): IeltsPredictionObservation {
  return {
    skill,
    band,
    occurredAt,
    source,
    label: `${skill} evidence`,
    reliability: 1,
    coverage: 1,
    rawScore: null,
  };
}

function request(
  observations: IeltsPredictionObservation[],
  asOf = "2026-06-21T00:00:00.000Z",
): ForecastRequest {
  return { userId: "u", module: "academic", asOf, targetBand: 6.5, observations, skillStates: [] };
}

// ---- θ ↔ band link ----------------------------------------------------------
assert.equal(bandToTheta(4.5), 0);
assert.equal(thetaToBand(0), 4.5);
assert.equal(thetaToBand(bandToTheta(6.5)), 6.5);
assert.equal(thetaToBand(100), 9); // clamp high
assert.equal(thetaToBand(-100), 0); // clamp low
assert.equal(IRT_MODEL_VERSION, "irt-2pl-v1");

// ---- Recovery: consistent band-6.5 evidence on all skills → overall 6.5 -----
{
  const observations = IELTS_SKILLS.flatMap((skill) => [
    obs(skill, 6.5, "2026-06-01T00:00:00.000Z"),
    obs(skill, 6.5, "2026-06-10T00:00:00.000Z"),
    obs(skill, 6.5, "2026-06-18T00:00:00.000Z"),
  ]);
  const forecast = irtForecaster(request(observations));
  assert.equal(forecast.overall.band, 6.5);
  for (const skill of IELTS_SKILLS) {
    assert.equal(forecast.skills[skill].band, 6.5);
    const { lower, upper, confidence } = forecast.skills[skill];
    assert.ok(lower != null && upper != null && lower <= 6.5 && upper >= 6.5);
    assert.ok(confidence > 0);
  }
}

// ---- Diagnostic-first: a missing skill blanks the overall -------------------
{
  const observations = (["listening", "reading", "writing"] as const).map((skill) =>
    obs(skill, 6, "2026-06-10T00:00:00.000Z"),
  );
  const forecast = irtForecaster(request(observations));
  assert.equal(forecast.overall.band, null);
  assert.equal(forecast.skills.speaking.band, null);
  assert.equal(forecast.skills.speaking.confidence, 0);
}

// ---- Confidence grows with information --------------------------------------
{
  const few = irtForecaster(request([obs("reading", 6, "2026-06-18T00:00:00.000Z")]));
  const many = irtForecaster(
    request(Array.from({ length: 8 }, () => obs("reading", 6, "2026-06-18T00:00:00.000Z"))),
  );
  assert.ok(many.skills.reading.confidence > few.skills.reading.confidence);
}

// ---- High-band recovery clamps the interval at 9 ----------------------------
{
  const observations = IELTS_SKILLS.flatMap((skill) => [
    obs(skill, 9, "2026-06-12T00:00:00.000Z"),
    obs(skill, 9, "2026-06-15T00:00:00.000Z"),
    obs(skill, 9, "2026-06-18T00:00:00.000Z"),
  ]);
  const forecast = irtForecaster(request(observations));
  assert.equal(forecast.overall.band, 9);
  assert.ok((forecast.skills.listening.upper ?? 0) <= 9);
}

// ---- Ineligible evidence is excluded (debate prior, null band, zero weight) --
{
  const forecast = irtForecaster(
    request([
      obs("listening", 7, "2026-06-18T00:00:00.000Z", "debate_prior"),
      obs("listening", null, "2026-06-18T00:00:00.000Z"),
      { ...obs("listening", 6, "2026-06-18T00:00:00.000Z"), reliability: 0 },
    ]),
  );
  assert.equal(forecast.skills.listening.band, null);
}

console.log("scoring/ielts-prediction/irt tests passed");
