/**
 * IELTS Speaking band math (WS-3.2).
 *
 * The official scoring is encoded EXACTLY here (authoring spec §5–§6, masterplan
 * §6):
 *
 *   - Four criteria, each 0-9, weighted 25%: Fluency & Coherence (FC), Lexical
 *     Resource (LR), Grammatical Range & Accuracy (GRA), Pronunciation (Pron).
 *   - Speaking band (one response/part) = mean of the four criteria, rounded to
 *     the nearest half-band.
 *   - Attempt Speaking band = mean of the per-part Speaking bands across the
 *     attempt's scored responses, rounded to the nearest half-band (a full
 *     Speaking test spans Parts 1/2/3).
 *
 * Half-band rounding (".25 rounds up to .5, .75 rounds up to the next whole") is
 * round-half-up on the half-band grid, provided by the shared, already
 * coverage-gated {@link roundToHalfBand}. This module stays pure so the
 * `scoring/**` coverage threshold (lines ≥90 / fns ≥90 / branches ≥80) is met by
 * its sibling `band-math.test.ts`. Mirrors `scoring/ielts-writing/band-math.ts`.
 */
import { roundToHalfBand } from "../round-half-band";

/** The four IELTS Speaking criteria, in canonical (display + averaging) order. */
export const SPEAKING_CRITERIA = [
  "fluencyCoherence",
  "lexicalResource",
  "grammaticalRangeAccuracy",
  "pronunciation",
] as const;

export type SpeakingCriterionKey = (typeof SPEAKING_CRITERIA)[number];

/** Per-criterion bands (0-9) for a single Speaking response/part. */
export type SpeakingCriteriaBands = Record<SpeakingCriterionKey, number>;

const MIN_BAND = 0;
const MAX_BAND = 9;

function assertScorable(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  if (value < MIN_BAND || value > MAX_BAND) {
    throw new Error(`${label} must be between ${MIN_BAND} and ${MAX_BAND}`);
  }
}

/**
 * Clamp a raw model number into [0, 9] and snap it to the nearest half-band, so
 * every stored criterion/band is a valid IELTS value for the `numeric(2,1)`
 * columns. A model may return e.g. `6.4`; this yields `6.5`.
 */
export function snapToHalfBand(raw: number): number {
  if (!Number.isFinite(raw)) {
    throw new Error("snapToHalfBand: raw must be a finite number");
  }
  const clamped = Math.min(MAX_BAND, Math.max(MIN_BAND, raw));
  return roundToHalfBand(clamped);
}

/**
 * Speaking band for one response/part = mean of the four criteria, rounded to
 * the nearest half-band. Inputs must already be valid 0-9 bands (snap them
 * first).
 */
export function speakingBandFromCriteria(
  criteria: SpeakingCriteriaBands,
): number {
  let sum = 0;
  for (const key of SPEAKING_CRITERIA) {
    const value = criteria[key];
    assertScorable(value, `criteria.${key}`);
    sum += value;
  }
  return roundToHalfBand(sum / SPEAKING_CRITERIA.length);
}

/**
 * Attempt-level Speaking band = mean of the per-part Speaking bands across the
 * attempt's scored responses, half-band rounded. Returns null when nothing has
 * been scored yet (no responses → no band).
 */
export function attemptSpeakingBand(
  responseBands: readonly number[],
): number | null {
  if (responseBands.length === 0) {
    return null;
  }
  let sum = 0;
  for (const band of responseBands) {
    assertScorable(band, "responseBand");
    sum += band;
  }
  return roundToHalfBand(sum / responseBands.length);
}
