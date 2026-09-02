/**
 * Reading split-pane ratio (passage | questions), persisted per attempt in
 * localStorage. Pure so the clamp/parse rules are unit-testable.
 */
export const SPLIT_MIN = 0.3;
export const SPLIT_MAX = 0.7;
export const SPLIT_DEFAULT = 0.5;

export function clampSplitRatio(n: number): number {
  if (!Number.isFinite(n)) return SPLIT_DEFAULT;
  return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, n));
}

/** A stored ratio, clamped; `null` when absent or not a finite number. */
export function parseStoredSplitRatio(raw: string | null): number | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return clampSplitRatio(parsed);
}

export function splitStorageKey(attemptId: string): string {
  return `ielts:mock:${attemptId}:split`;
}
