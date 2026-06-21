import assert from "node:assert/strict";
import {
  fixtureIeltsBandPrediction,
  lowConfidenceIeltsBandPrediction,
} from "@/lib/ielts/adaptive/contracts";
import {
  confidencePercent,
  defaultIeltsOnboardingGoal,
  defaultTargetTestDate,
  goalFromStudyPlanRow,
  initialOnboardingStep,
  predictionHasOverallEvidence,
} from "./model";

assert.equal(defaultTargetTestDate("2026-06-21"), "2026-09-19");

{
  const goal = defaultIeltsOnboardingGoal({
    todayIso: "2026-06-21",
    timezone: "America/New_York",
    feedbackLanguage: "en",
  });

  assert.equal(goal.targetOverallBand, 6.5);
  assert.equal(goal.targetTestDate, "2026-09-19");
  assert.deepEqual(goal.availability.studyDays, [1, 2, 3, 4, 5]);
  assert.equal(goal.availability.dailyMinutes, 45);
  assert.equal(goal.availability.timezone, "America/New_York");
}

{
  const goal = goalFromStudyPlanRow({
    module: "academic",
    target_overall_band: 7,
    target_listening_band: 7.5,
    target_reading_band: null,
    target_writing_band: 6.5,
    target_speaking_band: null,
    target_test_date: "2026-08-20",
    focus_skills: ["writing", "speaking"],
    daily_minutes: 60,
    study_days: [2, 4, 6],
    timezone: "Asia/Ho_Chi_Minh",
    feedback_language: "vi",
  });

  assert.equal(goal.targetOverallBand, 7);
  assert.equal(goal.targetSkillBands.listening, 7.5);
  assert.equal(goal.targetSkillBands.reading, null);
  assert.deepEqual(goal.focusSkills, ["writing", "speaking"]);
  assert.equal(goal.feedbackLanguage, "vi");
}

assert.equal(predictionHasOverallEvidence(lowConfidenceIeltsBandPrediction), false);
assert.equal(predictionHasOverallEvidence(fixtureIeltsBandPrediction), true);

assert.equal(
  initialOnboardingStep({
    hasGoal: false,
    prediction: lowConfidenceIeltsBandPrediction,
  }),
  "welcome",
);
assert.equal(
  initialOnboardingStep({
    hasGoal: true,
    prediction: lowConfidenceIeltsBandPrediction,
  }),
  "diagnostic",
);
assert.equal(
  initialOnboardingStep({
    hasGoal: true,
    prediction: fixtureIeltsBandPrediction,
  }),
  "result",
);
assert.equal(
  initialOnboardingStep({
    hasGoal: true,
    prediction: lowConfidenceIeltsBandPrediction,
    requestedStep: "result",
  }),
  "diagnostic",
);
{
  const partialEvidencePrediction = {
    ...lowConfidenceIeltsBandPrediction,
    skills: {
      ...lowConfidenceIeltsBandPrediction.skills,
      listening: {
        ...lowConfidenceIeltsBandPrediction.skills.listening,
        band: 6,
      },
    },
  };

  assert.equal(
    initialOnboardingStep({
      hasGoal: true,
      prediction: partialEvidencePrediction,
      requestedStep: "result",
    }),
    "result",
  );
}
assert.equal(
  initialOnboardingStep({
    hasGoal: true,
    prediction: fixtureIeltsBandPrediction,
    requestedStep: "result",
  }),
  "result",
);

assert.equal(confidencePercent(0.556), 56);
assert.equal(confidencePercent(2), 100);
assert.equal(confidencePercent(-1), 0);

console.log("ielts/onboarding/model.test.ts passed");
