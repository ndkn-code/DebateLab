import assert from "node:assert/strict";
import {
  buildMockBlueprint,
  IELTS_SECTION_TIME_LIMITS,
  type IeltsSkill,
} from "./mock-blueprint";

const ALL: IeltsSkill[] = ["listening", "reading", "writing", "speaking"];

// Canonical limits: L 40m (30+10), R 60m, W 60m, S 14m.
assert.equal(IELTS_SECTION_TIME_LIMITS.listening, 2400);
assert.equal(IELTS_SECTION_TIME_LIMITS.reading, 3600);
assert.equal(IELTS_SECTION_TIME_LIMITS.writing, 3600);
assert.equal(IELTS_SECTION_TIME_LIMITS.speaking, 840);

// full_mock with all four skills → ordered L,R,W,S with sequential orders.
const full = buildMockBlueprint({ kind: "full_mock", skill: null, skillsWithContent: ALL });
assert.deepEqual(
  full.map((s) => [s.skill, s.sectionOrder, s.timeLimitSeconds, s.label]),
  [
    ["listening", 0, 2400, "Listening"],
    ["reading", 1, 3600, "Reading"],
    ["writing", 2, 3600, "Writing"],
    ["speaking", 3, 840, "Speaking"],
  ],
);

// full_mock with only R/L content → two sections, re-indexed 0,1.
const rl = buildMockBlueprint({
  kind: "full_mock",
  skill: null,
  skillsWithContent: ["reading", "listening"],
});
assert.deepEqual(
  rl.map((s) => [s.skill, s.sectionOrder]),
  [
    ["listening", 0],
    ["reading", 1],
  ],
);

// skill_set / drill → just the targeted skill.
assert.deepEqual(
  buildMockBlueprint({ kind: "skill_set", skill: "reading", skillsWithContent: ["reading"] }).map(
    (s) => s.skill,
  ),
  ["reading"],
);
assert.deepEqual(
  buildMockBlueprint({ kind: "drill", skill: "listening", skillsWithContent: ["listening"] }).map(
    (s) => s.skill,
  ),
  ["listening"],
);

// skill_set whose skill has no authored content → no sections.
assert.deepEqual(
  buildMockBlueprint({ kind: "skill_set", skill: "writing", skillsWithContent: ["reading"] }),
  [],
);
// skill_set with null skill (malformed) → no sections.
assert.deepEqual(
  buildMockBlueprint({ kind: "skill_set", skill: null, skillsWithContent: ALL }),
  [],
);

// time overrides win.
const overridden = buildMockBlueprint({
  kind: "skill_set",
  skill: "reading",
  skillsWithContent: ["reading"],
  timeLimitOverrides: { reading: 1800 },
});
assert.equal(overridden[0].timeLimitSeconds, 1800);

console.log("ielts/mock-blueprint tests passed");
