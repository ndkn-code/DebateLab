import assert from "node:assert/strict";
import {
  buildResultsBandInsight,
  formatBandValue,
  normalizeBandTargets,
  targetBandForSkill,
  targetDeltaView,
  type IeltsBandTargets,
} from "./band-visuals";
import type { SkillBandRow } from "./results/types";

assert.equal(formatBandValue(7), "7.0");
assert.equal(formatBandValue(6.5), "6.5");
assert.equal(formatBandValue(null), "—");

assert.deepEqual(targetDeltaView(6.5, 7), {
  state: "gap",
  text: "0.5 to go",
  amount: 0.5,
});
assert.deepEqual(targetDeltaView(7, 7), {
  state: "met",
  text: "On target",
  amount: 0,
});
assert.deepEqual(targetDeltaView(null, 7), {
  state: "pending",
  text: "Target 7.0",
  amount: null,
});

const targets: IeltsBandTargets = normalizeBandTargets({
  overall: 7,
  skills: {
    listening: 7.5,
    reading: null,
  },
});

assert.equal(targetBandForSkill(targets, "listening"), 7.5);
assert.equal(targetBandForSkill(targets, "reading"), 7);
assert.equal(targetBandForSkill(null, "writing"), 6.5);

const rows: SkillBandRow[] = [
  {
    skill: "listening",
    label: "Listening",
    band: 7,
    raw: 31,
    rawMax: 40,
    status: "scored",
  },
  {
    skill: "reading",
    label: "Reading",
    band: 6,
    raw: 26,
    rawMax: 40,
    status: "scored",
  },
  {
    skill: "writing",
    label: "Writing",
    band: null,
    raw: null,
    rawMax: null,
    status: "in_progress",
  },
];

assert.equal(
  buildResultsBandInsight(rows, targets),
  "Listening is your anchor; Reading is the clearest place to gain 1.0.",
);

assert.equal(
  buildResultsBandInsight(
    rows.map((row) =>
      row.band === null ? row : { ...row, band: row.skill === "reading" ? 7 : 7.5 },
    ),
    targets,
  ),
  "On target. Listening is leading at 7.5.",
);

assert.equal(
  buildResultsBandInsight(rows.map((row) => ({ ...row, band: null })), targets),
  "We'll update this as more skills are scored.",
);

console.log("ielts/band-visuals tests passed");
