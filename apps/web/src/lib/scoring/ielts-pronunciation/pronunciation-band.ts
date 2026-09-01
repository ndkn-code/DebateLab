/**
 * Optional, versioned calibration of Azure's provider-specific PronScore to an
 * IELTS pronunciation estimate. There is deliberately no built-in mapping:
 * Microsoft does not claim its 0–100 score is an IELTS scale, and the mapping
 * must be fitted and held out on independently examiner-labelled target audio.
 */
import { roundToHalfBand } from "../round-half-band";
import type { PhonemeReport } from "./phoneme-report";

export interface PronunciationCalibrationKnot {
  providerScore: number;
  ieltsBand: number;
}

export interface PronunciationCalibrationProfile {
  version: string;
  provider: string;
  model: string;
  locales: string[];
  minimumWordCount: number;
  requiresProsody: boolean;
  /** Monotone knots fitted on development labels, never on the holdout set. */
  knots: PronunciationCalibrationKnot[];
}

function validProfile(profile: PronunciationCalibrationProfile): boolean {
  if (!profile.version.trim() || profile.knots.length < 2) return false;
  if (
    !Number.isInteger(profile.minimumWordCount) ||
    profile.minimumWordCount < 1
  )
    return false;
  return profile.knots.every((knot, index, knots) => {
    if (
      !Number.isFinite(knot.providerScore) ||
      knot.providerScore < 0 ||
      knot.providerScore > 100 ||
      !Number.isFinite(knot.ieltsBand) ||
      knot.ieltsBand < 0 ||
      knot.ieltsBand > 9
    ) {
      return false;
    }
    if (index === 0) return true;
    return (
      knot.providerScore > knots[index - 1]!.providerScore &&
      knot.ieltsBand >= knots[index - 1]!.ieltsBand
    );
  });
}

function interpolate(
  score: number,
  knots: PronunciationCalibrationKnot[],
): number {
  if (score <= knots[0]!.providerScore) return knots[0]!.ieltsBand;
  if (score >= knots.at(-1)!.providerScore) return knots.at(-1)!.ieltsBand;
  for (let index = 1; index < knots.length; index += 1) {
    const upper = knots[index]!;
    const lower = knots[index - 1]!;
    if (score > upper.providerScore) continue;
    const fraction =
      (score - lower.providerScore) /
      (upper.providerScore - lower.providerScore);
    return lower.ieltsBand + fraction * (upper.ieltsBand - lower.ieltsBand);
  }
  return knots.at(-1)!.ieltsBand;
}

/**
 * Returns null unless an independently validated calibration profile exactly
 * matches this provider/model/locale and the sample has sufficient evidence.
 */
export function derivePronunciationBand(
  report: PhonemeReport,
  profile?: PronunciationCalibrationProfile | null,
): number | null {
  if (
    report.status !== "scored" ||
    report.overall === null ||
    !profile ||
    !validProfile(profile) ||
    profile.provider !== report.provider ||
    profile.model !== report.model ||
    !profile.locales.includes(report.locale) ||
    report.words.length < profile.minimumWordCount ||
    (profile.requiresProsody && report.overall.prosody === null)
  ) {
    return null;
  }
  return roundToHalfBand(
    interpolate(report.overall.pronunciation, profile.knots),
  );
}
