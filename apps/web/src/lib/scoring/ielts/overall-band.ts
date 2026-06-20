/**
 * Cross-skill overall IELTS band (WS-2.2). Pure + fully unit-tested (the
 * `scoring/**` coverage gate). This is the canonical encoding of the official
 * overall-band rule (authoring-spec §6 / masterplan §6):
 *
 *   Overall = mean of the FOUR skill bands (Listening, Reading, Writing,
 *   Speaking), rounded to the nearest half-band — ".25 rounds up to .5, .75
 *   rounds up to the next whole" (6.25→6.5, 6.75→7.0), which is round-half-up on
 *   the half-band grid (the already coverage-gated {@link roundToHalfBand}).
 *
 * The official band needs all four skills. During a mock the objective skills
 * (R/L) are graded synchronously while Writing/Speaking score asynchronously, so
 * this also reports a PROVISIONAL overall (the half-band mean of whichever skill
 * bands exist so far) plus how many skills contributed — the results layer shows
 * it as "provisional" until every skill has landed.
 */
import { roundToHalfBand } from "../round-half-band";

const MIN_BAND = 0;
const MAX_BAND = 9;
const SKILL_COUNT = 4;

/** The four skill bands (0-9), each null until that skill is scored. */
export interface SkillBandInputs {
  listening: number | null;
  reading: number | null;
  writing: number | null;
  speaking: number | null;
}

export interface OverallBandResult {
  /** Half-band-rounded mean of the skill bands present, or null when none are. */
  band: number | null;
  /** False only once all four skill bands are present (the official overall). */
  isProvisional: boolean;
  /** How many of the four skill bands contributed to {@link band}. */
  presentCount: number;
}

function assertBand(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  if (value < MIN_BAND || value > MAX_BAND) {
    throw new Error(`${label} must be between ${MIN_BAND} and ${MAX_BAND}`);
  }
}

/**
 * Compute the overall band from the four skill bands. Present bands are averaged
 * and half-band rounded; the result is flagged provisional unless all four are
 * present. Throws on a non-finite / out-of-range band (inputs are DB-constrained
 * `numeric(2,1)` 0-9, so this only guards programmer error).
 */
export function computeOverallBand(skills: SkillBandInputs): OverallBandResult {
  const present: number[] = [];
  const labelled: Array<[number | null, string]> = [
    [skills.listening, "listening"],
    [skills.reading, "reading"],
    [skills.writing, "writing"],
    [skills.speaking, "speaking"],
  ];
  for (const [value, label] of labelled) {
    if (value === null) continue;
    assertBand(value, label);
    present.push(value);
  }

  if (present.length === 0) {
    return { band: null, isProvisional: true, presentCount: 0 };
  }

  const mean = present.reduce((sum, band) => sum + band, 0) / present.length;
  return {
    band: roundToHalfBand(mean),
    isProvisional: present.length < SKILL_COUNT,
    presentCount: present.length,
  };
}
