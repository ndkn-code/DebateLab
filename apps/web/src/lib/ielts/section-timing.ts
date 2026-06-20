/**
 * Pure section-timing helpers (WS-2.1). The DATABASE is authoritative for
 * timing (the SECURITY DEFINER RPCs anchor started_at/deadline_at to now()).
 * These helpers only DERIVE display/runtime state from those stored timestamps
 * — the same logic serves the countdown UI and server-side guards, so a client
 * can never disagree with the server about whether time is up.
 */

export type SectionRuntimeStatus =
  | "not_started"
  | "running"
  | "paused"
  | "submitted"
  | "expired";

export interface SectionTimingState {
  startedAt: string | null;
  deadlineAt: string | null;
  submittedAt: string | null;
  pausedAt: string | null;
  timeLimitSeconds: number | null;
}

/** Effective runtime status given the wall-clock `nowMs` (ms epoch). */
export function sectionStatus(
  state: SectionTimingState,
  nowMs: number,
): SectionRuntimeStatus {
  if (state.submittedAt !== null) return "submitted";
  if (state.startedAt === null) return "not_started";
  if (state.pausedAt !== null) return "paused";
  if (state.deadlineAt !== null && nowMs > Date.parse(state.deadlineAt)) {
    return "expired";
  }
  return "running";
}

/**
 * Seconds left on the section clock. While paused the remaining time is frozen
 * (measured at pausedAt, not now). A not-yet-started section reports its full
 * allowance; a truly untimed section reports 0 (no countdown).
 */
export function remainingSeconds(
  state: SectionTimingState,
  nowMs: number,
): number {
  if (state.deadlineAt === null) {
    return state.startedAt === null ? (state.timeLimitSeconds ?? 0) : 0;
  }
  const reference =
    state.pausedAt !== null ? Date.parse(state.pausedAt) : nowMs;
  return Math.max(0, Math.round((Date.parse(state.deadlineAt) - reference) / 1000));
}

/** True once the section can no longer accept answers (submitted or expired). */
export function isSectionClosed(
  state: SectionTimingState,
  nowMs: number,
): boolean {
  const status = sectionStatus(state, nowMs);
  return status === "submitted" || status === "expired";
}
