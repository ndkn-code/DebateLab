import assert from "node:assert/strict";

import { evaluateSimulationCompletion } from "./simulation-completion";

const base = {
  listeningBand: 7,
  readingBand: 6.5,
  writingBand: 6,
  writingRequired: true,
  speakingBand: null,
  overallBand: 6.5,
};

const writingReady = evaluateSimulationCompletion(base);
assert.equal(writingReady.attemptComplete, true);
assert.equal(writingReady.overallComplete, false);
assert.deepEqual(writingReady.missingRequiredSkills, []);

const missingWriting = evaluateSimulationCompletion({
  ...base,
  writingBand: null,
});
assert.equal(missingWriting.attemptComplete, false);
assert.deepEqual(missingWriting.missingRequiredSkills, ["writing"]);

const missingObjective = evaluateSimulationCompletion({
  ...base,
  listeningBand: null,
  readingBand: null,
});
assert.equal(missingObjective.attemptComplete, false);
assert.deepEqual(missingObjective.missingRequiredSkills, ["listening", "reading"]);

const speakingReady = evaluateSimulationCompletion({
  ...base,
  speakingBand: 6.5,
  overallBand: 6.5,
});
assert.equal(speakingReady.attemptComplete, true);
assert.equal(speakingReady.overallComplete, true);

const partialOverall = evaluateSimulationCompletion({
  ...base,
  speakingBand: null,
  overallBand: 7,
});
assert.equal(partialOverall.attemptComplete, true);
assert.equal(partialOverall.overallComplete, false);

const writingNotInTest = evaluateSimulationCompletion({
  ...base,
  writingBand: null,
  writingRequired: false,
});
assert.equal(writingNotInTest.attemptComplete, true);

console.log("IELTS simulation completion contract tests passed");
