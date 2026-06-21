/**
 * DB-free contract tests for the IELTS adaptive foundation seam.
 */
import assert from "node:assert/strict";
import {
  DEFAULT_IELTS_TARGET_BAND,
  IELTS_LEARN_ACTIVITY_TYPES,
  IeltsBandPredictionSchema,
  IeltsGoalModelSchema,
  IeltsLearnAtomSchema,
  IeltsPredictionSnapshotSchema,
  IeltsWeaknessSignalSchema,
  fixtureIeltsBandPrediction,
  fixtureIeltsGoal,
  fixtureIeltsLearnAtoms,
  fixtureIeltsPredictionSnapshot,
  fixtureIeltsWeaknessSignals,
  getFixtureIeltsPredictionSnapshot,
  loadFixtureIeltsPredictionForPlanning,
  lowConfidenceIeltsBandPrediction,
  emptyHistoryIeltsPredictionSnapshot,
} from "./index";

for (const weakness of fixtureIeltsWeaknessSignals) {
  assert.deepEqual(IeltsWeaknessSignalSchema.parse(weakness), weakness);
}

assert.equal(
  IeltsWeaknessSignalSchema.safeParse({
    signalId: "old-track-c-shape",
    skill: "reading",
    focusArea: "matching headings",
    gapHalfBands: 2,
  }).success,
  false,
  "Track C's older weakness variant must not replace Track B's shape",
);

assert.deepEqual(
  fixtureIeltsLearnAtoms.map((atom) => atom.activityType),
  [...IELTS_LEARN_ACTIVITY_TYPES],
  "fixture atoms pin the Track D registered activity taxonomy",
);

assert.equal(
  IeltsLearnAtomSchema.safeParse({
    activityType: "ielts_question_drill",
    skill: "reading",
    focusArea: "matching headings",
    estimatedMinutes: 12,
    questionIds: [],
    rendererTags: ["legacy"],
    scoringMode: "objective",
  }).success,
  false,
  "Track C placeholder activity keys are not Track D registered types",
);

for (const atom of fixtureIeltsLearnAtoms) {
  assert.deepEqual(IeltsLearnAtomSchema.parse(atom), atom);
}

assert.deepEqual(
  IeltsBandPredictionSchema.parse(fixtureIeltsBandPrediction),
  fixtureIeltsBandPrediction,
);
assert.deepEqual(
  IeltsBandPredictionSchema.parse(lowConfidenceIeltsBandPrediction),
  lowConfidenceIeltsBandPrediction,
);
assert.deepEqual(
  IeltsPredictionSnapshotSchema.parse(fixtureIeltsPredictionSnapshot),
  fixtureIeltsPredictionSnapshot,
);
assert.deepEqual(
  IeltsPredictionSnapshotSchema.parse(emptyHistoryIeltsPredictionSnapshot),
  emptyHistoryIeltsPredictionSnapshot,
);

assert.deepEqual(IeltsGoalModelSchema.parse(fixtureIeltsGoal), fixtureIeltsGoal);
assert.equal(
  IeltsGoalModelSchema.parse({
    targetTestDate: "2026-09-01",
    availability: {
      studyDays: [1, 2, 3],
      dailyMinutes: 30,
    },
  }).targetOverallBand,
  DEFAULT_IELTS_TARGET_BAND,
);
assert.equal(
  IeltsGoalModelSchema.safeParse({
    targetOverallBand: 6.25,
    targetTestDate: "2026-09-01",
    availability: {
      studyDays: [1],
      dailyMinutes: 30,
    },
  }).success,
  false,
  "IELTS targets are half-band values",
);
assert.equal(
  IeltsGoalModelSchema.safeParse({
    targetTestDate: "2026-09-01",
    focusSkills: ["writing", "writing"],
    availability: {
      studyDays: [1],
      dailyMinutes: 30,
    },
  }).success,
  false,
  "focus skills are a declared set",
);

async function main(): Promise<void> {
  const prediction = await loadFixtureIeltsPredictionForPlanning(
    "00000000-0000-4000-8000-000000000999",
    { module: "general_training", targetBand: 7 },
  );
  assert.equal(prediction.userId, "00000000-0000-4000-8000-000000000999");
  assert.equal(prediction.module, "general_training");
  assert.notEqual(prediction, fixtureIeltsBandPrediction);

  const empty = getFixtureIeltsPredictionSnapshot("empty_history");
  assert.equal(empty.predictedOverallBand, null);
  assert.deepEqual(empty.weaknesses, []);

  console.log("IELTS adaptive contract tests passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
