/**
 * Section-timer warning policy (pure). `warningSeconds` on the assessment
 * mode lists the thresholds (e.g. 600, 300); the player keeps the list of
 * thresholds it has already announced and asks, on every tick, which one to
 * announce now.
 */

/**
 * The threshold to announce at `remainingSeconds`, or `null`.
 *
 * The candidate is the tightest applicable threshold — the smallest one that
 * is still ≥ the remaining time — and it is returned only if it has not fired.
 * Larger thresholds that were skipped (a resume at 4:00 never saw 10:00) are
 * treated as stale and never announced late. Once the candidate has fired the
 * result stays `null` until the next threshold is reached, so a 1 Hz tick
 * announces each threshold exactly once even when it lands between ticks.
 */
export function nextTimerWarning(
  remainingSeconds: number,
  thresholds: readonly number[],
  fired: readonly number[],
): number | null {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return null;
  let candidate: number | null = null;
  for (const threshold of thresholds) {
    if (!Number.isFinite(threshold) || threshold <= 0) continue;
    if (threshold < remainingSeconds) continue;
    if (candidate === null || threshold < candidate) candidate = threshold;
  }
  if (candidate === null || fired.includes(candidate)) return null;
  return candidate;
}

/** Whole minutes a threshold represents (600 → 10, 90 → 2 by ceiling). */
export function warningMinutes(threshold: number): number {
  return Math.max(0, Math.ceil(threshold / 60));
}

/** Locale-neutral "m:ss" for a threshold ("10:00", "5:00", "0:30"). */
export function formatWarningMinutes(threshold: number): string {
  const total = Math.max(0, Math.floor(threshold));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
