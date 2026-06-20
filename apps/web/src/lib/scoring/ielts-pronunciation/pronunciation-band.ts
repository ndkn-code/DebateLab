/**
 * Derive an IELTS Pronunciation band (0–9, half-band) from a phoneme report.
 *
 * Azure's composite PronScore (0–100) is the single best objective signal for
 * the Pronunciation criterion. We map it linearly onto the 0–9 band scale and
 * snap to the IELTS half-band grid (masterplan §6). This is a transparent
 * SUGGESTION the Speaking scorer (WS-3.2) blends with its rubric judgment — the
 * authoritative `pronunciation_band` stays WS-3.2's to set.
 */
import { roundToHalfBand } from "../round-half-band";
import type { PhonemeReport } from "./phoneme-report";

const MAX_BAND = 9;
const MAX_SCORE = 100;

/**
 * Linear 0–100 → 0–9 mapping, snapped to the nearest half-band. Returns `null`
 * for an empty/unscored report so the caller can fall back to its own judgment.
 */
export function derivePronunciationBand(report: PhonemeReport): number | null {
  if (report.status !== "scored" || report.overall === null) return null;
  const band = (report.overall.pronunciation / MAX_SCORE) * MAX_BAND;
  return roundToHalfBand(band);
}
