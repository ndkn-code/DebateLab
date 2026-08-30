import assert from "node:assert/strict";
import {
  criteriaForReview,
  deriveSpeakingBand,
  deriveWritingTaskBand,
  IELTS_TEACHER_RUBRIC,
  isHalfBand,
  validateTeacherBands,
} from "./rubric";

assert.equal(IELTS_TEACHER_RUBRIC.key, "ielts_official_v1");
assert.deepEqual(criteriaForReview("writing", 1).map((c) => c.key), ["taskAchievement", "coherenceCohesion", "lexicalResource", "grammaticalRangeAccuracy"]);
assert.deepEqual(criteriaForReview("writing", 2).map((c) => c.key), ["taskResponse", "coherenceCohesion", "lexicalResource", "grammaticalRangeAccuracy"]);
assert.ok(criteriaForReview("speaking").every((c) => c.labelEn && c.labelVi));

assert.equal(isHalfBand(0), true);
assert.equal(isHalfBand(8.5), true);
assert.equal(isHalfBand(9), true);
assert.equal(isHalfBand(8.25), false);
assert.equal(isHalfBand(9.5), false);
assert.throws(() => validateTeacherBands({ lexicalResource: 7.25 }), /half-band/);

assert.equal(deriveWritingTaskBand({ taskResponse: 7, coherenceCohesion: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7 }), 7);
assert.equal(deriveSpeakingBand({ fluencyCoherence: 7, lexicalResource: 7, grammaticalRangeAccuracy: 7, pronunciation: 7 }), 7);
assert.equal(deriveSpeakingBand({ fluencyCoherence: 7 }), null);
