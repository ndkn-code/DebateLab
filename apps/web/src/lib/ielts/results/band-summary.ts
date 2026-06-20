/**
 * Pure builders for the IELTS results band summary (WS-2.2): per-skill band
 * rows, the cross-skill overall, and the raw→band breakdown table. No I/O — the
 * results repository supplies the de-DB'd {@link AttemptResultsInput}; the page
 * renders what these return. Band math is delegated to the coverage-gated
 * `lib/scoring/ielts` (overall mean + §6 rounding; conversion-table selection).
 */
import {
  rawToBand,
  selectConversionTable,
} from "@/lib/scoring/ielts/band-conversion";
import { computeOverallBand } from "@/lib/scoring/ielts/overall-band";
import type {
  AttemptResultsInput,
  IeltsSkillKey,
  ObjectiveSkillKey,
  OverallBandSummary,
  SkillBandBreakdown,
  SkillBandRow,
  SkillResultStatus,
} from "./types";
import { SKILL_LABELS } from "./types";

const RAW_MAX = 40;
const OBJECTIVE_SKILLS: ObjectiveSkillKey[] = ["listening", "reading"];

/** The skill bands the rest of the summary derives from (W/S resolved upstream). */
export interface DerivedSkillBands {
  writingBand: number | null;
  speakingBand: number | null;
  writingStatus: SkillResultStatus;
  speakingStatus: SkillResultStatus;
}

function isObjectiveSkill(skill: IeltsSkillKey): skill is ObjectiveSkillKey {
  return skill === "listening" || skill === "reading";
}

/** Objective skills grade synchronously: a non-null raw means it was scored. */
function objectiveStatus(raw: number | null): SkillResultStatus {
  return raw === null ? "not_attempted" : "scored";
}

function skillRow(
  skill: IeltsSkillKey,
  input: AttemptResultsInput,
  derived: DerivedSkillBands,
): SkillBandRow {
  if (skill === "listening") {
    return rowFor(skill, input.listeningBand, input.listeningRaw, objectiveStatus(input.listeningRaw));
  }
  if (skill === "reading") {
    return rowFor(skill, input.readingBand, input.readingRaw, objectiveStatus(input.readingRaw));
  }
  if (skill === "writing") {
    return rowFor(skill, derived.writingBand, null, derived.writingStatus);
  }
  return rowFor(skill, derived.speakingBand, null, derived.speakingStatus);
}

function rowFor(
  skill: IeltsSkillKey,
  band: number | null,
  raw: number | null,
  status: SkillResultStatus,
): SkillBandRow {
  return {
    skill,
    label: SKILL_LABELS[skill],
    band,
    raw,
    rawMax: isObjectiveSkill(skill) ? RAW_MAX : null,
    status,
  };
}

/** Per-skill band rows for the skills this test covers, in blueprint order. */
export function buildSkillBandRows(
  input: AttemptResultsInput,
  derived: DerivedSkillBands,
): SkillBandRow[] {
  return input.skillsInTest.map((skill) => skillRow(skill, input, derived));
}

/**
 * Overall = mean of the skill bands present, half-band rounded (§6); provisional
 * until every skill the test covers has landed.
 */
export function buildOverallSummary(
  input: AttemptResultsInput,
  derived: DerivedSkillBands,
): OverallBandSummary {
  const inTest = new Set(input.skillsInTest);
  // Only count skills the test actually covers toward the overall.
  const result = computeOverallBand({
    listening: inTest.has("listening") ? input.listeningBand : null,
    reading: inTest.has("reading") ? input.readingBand : null,
    writing: inTest.has("writing") ? derived.writingBand : null,
    speaking: inTest.has("speaking") ? derived.speakingBand : null,
  });
  const totalSkills = input.skillsInTest.length;
  return {
    band: result.band,
    presentCount: result.presentCount,
    totalSkills,
    isProvisional: result.presentCount < totalSkills || result.isProvisional,
  };
}

function buildBreakdownForSkill(
  input: AttemptResultsInput,
  skill: ObjectiveSkillKey,
): SkillBandBreakdown | null {
  const raw = skill === "listening" ? input.listeningRaw : input.readingRaw;
  if (raw === null) return null;
  const moduleKey = skill === "listening" ? null : input.module;
  const table = selectConversionTable(input.bandConversions, skill, moduleKey);
  if (table.length === 0) return null;
  return {
    skill,
    label: SKILL_LABELS[skill],
    module: moduleKey,
    raw,
    rawMax: RAW_MAX,
    band: rawToBand(input.bandConversions, skill, moduleKey, raw),
    conversionKey: table[0].conversion_key,
    rows: table.map((row) => ({
      band: row.band,
      rawMin: row.raw_min,
      rawMax: row.raw_max,
      isLearnerRow: raw >= row.raw_min && raw <= row.raw_max,
    })),
  };
}

/** Raw→band breakdown tables for each objective skill the learner sat. */
export function buildBandBreakdowns(
  input: AttemptResultsInput,
): SkillBandBreakdown[] {
  const inTest = new Set(input.skillsInTest);
  return OBJECTIVE_SKILLS.filter((skill) => inTest.has(skill))
    .map((skill) => buildBreakdownForSkill(input, skill))
    .filter((breakdown): breakdown is SkillBandBreakdown => breakdown !== null);
}
