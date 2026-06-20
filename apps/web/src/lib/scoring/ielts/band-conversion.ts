/**
 * Raw → band conversion for IELTS Reading/Listening (WS-2.1). Pure + fully
 * unit-tested (the `scoring/**` coverage gate). The exact per-test table lives
 * in `band_conversions`; the grader prefers a test-specific `conversion_key`
 * over the representative `'default'`, and a module-specific row over a
 * module-agnostic one (Listening is module-independent; Reading splits
 * Academic vs General Training — masterplan §6 / authoring-spec §7).
 */
import { roundToHalfBand } from "../round-half-band";
import type { Enums } from "@/types/supabase";

export type IeltsSkill = Enums<"ielts_skill">;
export type IeltsModule = Enums<"ielts_module">;

/** The columns of a `band_conversions` row the conversion needs. */
export interface BandConversionRow {
  conversion_key: string;
  skill: IeltsSkill;
  module: IeltsModule | null;
  band: number;
  raw_min: number;
  raw_max: number;
}

/** Higher = more specific: test-specific key beats default; module-specific beats agnostic. */
function specificity(row: BandConversionRow): number {
  return (row.conversion_key === "default" ? 0 : 2) + (row.module === null ? 0 : 1);
}

/**
 * Map a raw correct-count to a band. `module` selects the Reading table
 * (ignored for module-agnostic rows). Returns null when no row covers the raw
 * score (caller decides how to surface "unscored").
 */
export function rawToBand(
  rows: readonly BandConversionRow[],
  skill: IeltsSkill,
  module: IeltsModule | null,
  raw: number,
): number | null {
  const matches = rows.filter(
    (row) =>
      row.skill === skill &&
      (row.module === null || row.module === module) &&
      raw >= row.raw_min &&
      raw <= row.raw_max,
  );
  if (matches.length === 0) return null;
  let best = matches[0];
  for (const row of matches) if (specificity(row) > specificity(best)) best = row;
  return best.band;
}

export interface ObjectiveRawScores {
  listening: number | null;
  reading: number | null;
}

export interface ObjectiveBandResult {
  listeningBand: number | null;
  readingBand: number | null;
  /**
   * Provisional overall = half-band-rounded mean of the bands available so far.
   * The official overall is the mean of all four skills; WS-2.2 recomputes it
   * once Writing/Speaking land. For an R/L-only sitting this is the learner's
   * current standing.
   */
  overallBand: number | null;
}

/** Compute Listening/Reading bands (+ provisional overall) for an attempt. */
export function computeObjectiveBands(
  rows: readonly BandConversionRow[],
  module: IeltsModule,
  raw: ObjectiveRawScores,
): ObjectiveBandResult {
  const listeningBand =
    raw.listening === null ? null : rawToBand(rows, "listening", null, raw.listening);
  const readingBand =
    raw.reading === null ? null : rawToBand(rows, "reading", module, raw.reading);
  const present = [listeningBand, readingBand].filter(
    (band): band is number => band !== null,
  );
  const overallBand =
    present.length === 0
      ? null
      : roundToHalfBand(present.reduce((sum, band) => sum + band, 0) / present.length);
  return { listeningBand, readingBand, overallBand };
}
