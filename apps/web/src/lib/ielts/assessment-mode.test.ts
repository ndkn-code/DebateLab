import assert from "node:assert/strict";
import {
  canStartIeltsAssessment,
  assessmentModeForTestKind,
  assessmentModePolicy,
  SIMULATION_SKILL_ORDER,
  SIMULATION_TIME_LIMITS,
} from "./assessment-mode";

assert.equal(
  canStartIeltsAssessment("practice", {
    ieltsEnabled: true,
    assessmentModesEnabled: false,
  }),
  true,
  "Practice remains available when the IELTS product is on",
);
assert.equal(
  canStartIeltsAssessment("simulation", {
    ieltsEnabled: true,
    assessmentModesEnabled: false,
  }),
  false,
  "Simulation stays fail-closed behind its rollout flag",
);
assert.equal(
  canStartIeltsAssessment("simulation", {
    ieltsEnabled: true,
    assessmentModesEnabled: true,
  }),
  true,
);
assert.equal(
  canStartIeltsAssessment("practice", {
    ieltsEnabled: false,
    assessmentModesEnabled: true,
  }),
  false,
  "The product-level IELTS flag remains authoritative",
);

assert.equal(assessmentModeForTestKind("full_mock"), "simulation");
assert.equal(assessmentModeForTestKind("skill_set"), "practice");
assert.equal(assessmentModeForTestKind("drill"), "practice");

const simulation = assessmentModePolicy("simulation");
assert.deepEqual(simulation.skillOrder, SIMULATION_SKILL_ORDER);
assert.deepEqual(simulation.sectionTimeLimits, SIMULATION_TIME_LIMITS);
assert.equal(simulation.sectionTimeLimits.listening, 32 * 60);
assert.equal(simulation.canPause, false);
assert.equal(simulation.canNavigateToSubmittedSection, false);
assert.equal(simulation.canShowInAttemptFeedback, false);
assert.equal(simulation.canReplayListeningAudio, false);
assert.equal(simulation.hasSpeakingSection, false);
assert.deepEqual(simulation.warningSeconds, [600, 300]);
assert.equal(simulation.speakingProductLabel, "Speaking Rehearsal");

const practice = assessmentModePolicy("practice");
assert.equal(practice.canPause, true);
assert.equal(practice.canNavigateToSubmittedSection, true);
assert.equal(practice.canShowInAttemptFeedback, true);
assert.equal(practice.canReplayListeningAudio, true);
assert.equal(practice.hasSpeakingSection, true);
assert.deepEqual(practice.warningSeconds, []);

console.log("ielts/assessment-mode tests passed");
