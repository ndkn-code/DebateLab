import assert from "node:assert/strict";
import {
  buildBandBreakdowns,
  buildOverallSummary,
  buildSkillBandRows,
  type DerivedSkillBands,
} from "./band-summary";
import type { BandConversionRow } from "@/lib/scoring/ielts/band-conversion";
import type { AttemptResultsInput } from "./types";

const conv = (
  skill: BandConversionRow["skill"],
  module: BandConversionRow["module"],
  band: number,
  raw_min: number,
  raw_max: number,
): BandConversionRow => ({ conversion_key: "default", skill, module, band, raw_min, raw_max });

const conversions: BandConversionRow[] = [
  conv("listening", null, 9, 39, 40),
  conv("listening", null, 7, 30, 31),
  conv("listening", null, 6, 23, 25),
  conv("reading", "academic", 7, 30, 32),
  conv("reading", "academic", 6, 23, 26),
];

function input(p: Partial<AttemptResultsInput>): AttemptResultsInput {
  return {
    attemptId: "a",
    testTitle: "T",
    testSlug: "t",
    module: "academic",
    attemptStatus: "completed",
    submittedAt: null,
    skillsInTest: ["listening", "reading", "writing", "speaking"],
    listeningRaw: 30,
    readingRaw: 31,
    listeningBand: 7,
    readingBand: 7,
    storedWritingBand: null,
    storedSpeakingBand: null,
    objectiveQuestions: [],
    bandConversions: conversions,
    writingTasks: [],
    speakingParts: [],
    ...p,
  };
}

const partial: DerivedSkillBands = {
  writingBand: null,
  speakingBand: null,
  writingStatus: "not_attempted",
  speakingStatus: "not_attempted",
};
const full: DerivedSkillBands = {
  writingBand: 6.5,
  speakingBand: 7,
  writingStatus: "scored",
  speakingStatus: "scored",
};

// ---- Skill rows ------------------------------------------------------------
const rows = buildSkillBandRows(input({}), partial);
assert.deepEqual(
  rows.map((r) => [r.skill, r.band, r.raw, r.rawMax, r.status]),
  [
    ["listening", 7, 30, 40, "scored"],
    ["reading", 7, 31, 40, "scored"],
    ["writing", null, null, null, "not_attempted"],
    ["speaking", null, null, null, "not_attempted"],
  ],
);

// in_progress writing surfaces on the row.
const progressing = buildSkillBandRows(input({}), { ...partial, writingStatus: "in_progress" });
assert.equal(progressing.find((r) => r.skill === "writing")?.status, "in_progress");

// ---- Overall: provisional until all four land ------------------------------
assert.deepEqual(buildOverallSummary(input({}), partial), {
  band: 7,
  presentCount: 2,
  totalSkills: 4,
  isProvisional: true,
});
// Full mock, all four: mean (7+7+6.5+7)/4 = 6.875 -> 7.0, no longer provisional.
assert.deepEqual(buildOverallSummary(input({}), full), {
  band: 7,
  presentCount: 4,
  totalSkills: 4,
  isProvisional: false,
});
// Reading-only skill_set: overall is just that skill, still provisional.
assert.deepEqual(
  buildOverallSummary(input({ skillsInTest: ["reading"], listeningRaw: null, listeningBand: null }), partial),
  { band: 7, presentCount: 1, totalSkills: 1, isProvisional: true },
);

// ---- Raw→band breakdown ----------------------------------------------------
const breakdowns = buildBandBreakdowns(input({}));
assert.equal(breakdowns.length, 2);
const listening = breakdowns[0];
assert.equal(listening.skill, "listening");
assert.equal(listening.module, null);
assert.equal(listening.raw, 30);
assert.equal(listening.band, 7);
assert.equal(listening.conversionKey, "default");
// Sorted band-desc; the learner's row (raw 30 ∈ 30–31) is flagged.
assert.deepEqual(
  listening.rows.map((r) => [r.band, r.isLearnerRow]),
  [
    [9, false],
    [7, true],
    [6, false],
  ],
);
const reading = breakdowns[1];
assert.equal(reading.skill, "reading");
assert.equal(reading.module, "academic");
assert.equal(reading.rows.find((r) => r.isLearnerRow)?.band, 7);

// No objective skills sat -> no breakdowns.
assert.deepEqual(
  buildBandBreakdowns(input({ skillsInTest: ["writing"], listeningRaw: null, readingRaw: null })),
  [],
);

console.log("ielts/results/band-summary tests passed");
