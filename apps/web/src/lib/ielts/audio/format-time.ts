/**
 * Audio clock formatting shared by the listening player, the exam clip
 * player, and results playback. Pure — no React.
 */

/** "m:ss" for a playback position; junk (NaN, Infinity, negatives) → "0:00". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  return `${minutes}:${(wholeSeconds % 60).toString().padStart(2, "0")}`;
}
