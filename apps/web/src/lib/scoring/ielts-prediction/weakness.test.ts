import assert from "node:assert/strict";
import { buildIeltsBandPrediction } from "./predictor";
import type { IeltsPredictionSubskillState } from "./input.types";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const states: IeltsPredictionSubskillState[] = [
  {
    skill: "reading",
    subskillKey: "reading:matching_headings",
    labelEn: "Matching headings",
    labelVi: "Ghép tiêu đề đoạn",
    bandEstimate: 5,
    masteryScore: 0.42,
    confidence: 0.8,
    weaknessWeight: 0.7,
    evidenceCount: 5,
    questionType: "matching_headings",
  },
  {
    skill: "writing",
    subskillKey: "writing:grammar",
    labelEn: "Grammar",
    labelVi: "Ngữ pháp",
    bandEstimate: 6,
    masteryScore: 0.6,
    confidence: 0.5,
    weaknessWeight: 0.25,
    evidenceCount: 2,
    criterion: "grammar",
  },
];

const prediction = buildIeltsBandPrediction({
  userId: USER_ID,
  module: "academic",
  asOf: "2026-06-21T00:00:00.000Z",
  targetBand: 6.5,
  observations: [
    {
      skill: "listening",
      band: 7,
      occurredAt: "2026-06-20T00:00:00.000Z",
      source: "full_mock",
      label: "Listening mock",
      reliability: 1,
      coverage: 1,
    },
    {
      skill: "reading",
      band: 5.5,
      occurredAt: "2026-06-20T00:00:00.000Z",
      source: "full_mock",
      label: "Reading mock",
      reliability: 1,
      coverage: 1,
    },
    {
      skill: "writing",
      band: 6,
      occurredAt: "2026-06-20T00:00:00.000Z",
      source: "writing_task",
      label: "Writing task",
      reliability: 0.85,
      coverage: 0.75,
    },
    {
      skill: "speaking",
      band: 7,
      occurredAt: "2026-06-20T00:00:00.000Z",
      source: "speaking_part",
      label: "Speaking part",
      reliability: 0.85,
      coverage: 0.7,
    },
  ],
  skillStates: states,
});

assert.equal(prediction.weaknesses[0].key, "reading:matching_headings");
assert.equal(prediction.weaknesses[0].severity, "critical");
assert.deepEqual(prediction.weaknesses[0].recommendedActivityFilters.subskillTags, [
  "reading:matching_headings",
]);
assert.ok(prediction.weaknesses.some((signal) => signal.key === "reading:overall_band"));

console.log("IELTS prediction weakness tests passed");
