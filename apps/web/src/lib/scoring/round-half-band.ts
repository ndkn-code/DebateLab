/**
 * IELTS band rounding.
 *
 * WS-0.1 seeds the `scoring/` path together with its CI coverage gate (real
 * band conversion lands in WS-2.2). This module is pure and fully unit-tested,
 * which is exactly what the `scoring/**` coverage threshold enforces.
 *
 * IELTS reports skill and overall bands to the nearest half-band: a criterion
 * mean ending in .25 rounds up to .5, and .75 rounds up to the next whole band
 * (masterplan §6). On the half-band grid that is plain round-half-up, i.e.
 * `Math.round(x * 2) / 2`.
 */

export function roundToHalfBand(raw: number): number {
  if (!Number.isFinite(raw)) {
    throw new Error("roundToHalfBand: raw must be a finite number");
  }
  if (raw < 0) {
    throw new Error("roundToHalfBand: raw must be non-negative");
  }
  return Math.round(raw * 2) / 2;
}

export interface SkillBands {
  listening: number;
  reading: number;
  writing: number;
  speaking: number;
}

/**
 * Overall IELTS band = mean of the four skill bands, rounded to the nearest
 * half-band (masterplan §6).
 */
export function overallBand(skills: SkillBands): number {
  const mean =
    (skills.listening + skills.reading + skills.writing + skills.speaking) / 4;
  return roundToHalfBand(mean);
}
