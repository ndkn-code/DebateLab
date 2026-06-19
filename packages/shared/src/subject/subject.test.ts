import assert from "node:assert/strict";
import {
  SUBJECTS,
  DEFAULT_SUBJECT,
  SUBJECT_CONFIG,
  isSubject,
  coerceSubject,
  getSubjectConfig,
} from "./subject";

// Axis membership + default.
assert.deepEqual([...SUBJECTS], ["debate", "ielts"]);
assert.equal(DEFAULT_SUBJECT, "debate");

// Type guard.
assert.equal(isSubject("debate"), true);
assert.equal(isSubject("ielts"), true);
assert.equal(isSubject("sat"), false);
assert.equal(isSubject(""), false);
assert.equal(isSubject(undefined), false);
assert.equal(isSubject(null), false);
assert.equal(isSubject(123), false);

// Coercion defaults to `debate` so existing (debate) traffic is byte-identical.
assert.equal(coerceSubject("debate"), "debate");
assert.equal(coerceSubject("ielts"), "ielts");
assert.equal(coerceSubject("nonsense"), "debate");
assert.equal(coerceSubject(undefined), "debate");
assert.equal(coerceSubject(null), "debate");
// Explicit fallback is honored.
assert.equal(coerceSubject("nonsense", "ielts"), "ielts");

// Config map is complete + well-formed for every subject.
for (const subject of SUBJECTS) {
  const config = SUBJECT_CONFIG[subject];
  assert.equal(config.code, subject);
  assert.ok(config.label.length > 0);
  assert.ok(config.labelVi.length > 0);
}
assert.equal(SUBJECT_CONFIG.debate.label, "Debate");
assert.equal(SUBJECT_CONFIG.debate.labelVi, "Debate");
assert.equal(SUBJECT_CONFIG.ielts.label, "IELTS");
assert.equal(SUBJECT_CONFIG.ielts.labelVi, "IELTS");

// getSubjectConfig coerces unknown input before lookup.
assert.equal(getSubjectConfig("ielts").code, "ielts");
assert.equal(getSubjectConfig("nonsense").code, "debate");
assert.equal(getSubjectConfig(undefined).code, "debate");

console.log("subject tests passed");
