/**
 * Speaking Part 2 cue-card timer — a pure state machine over wall-clock
 * milliseconds. The component owns `setInterval` and `sessionStorage`; this
 * module owns every transition so a resume mid-prep or mid-speech is exact.
 *
 *   idle ─startPrep─▶ prep ─(expiry | skipPrep)─▶ speaking ─(expiry | stop)─▶ done
 */
export type CueCardTimerState =
  | { phase: "idle" }
  | { phase: "prep"; endsAt: number }
  | { phase: "speaking"; endsAt: number }
  | { phase: "done" };

export type CueCardTimerEvent = "prepEnded" | "speakingEnded" | null;

export interface CueCardTick {
  state: CueCardTimerState;
  event: CueCardTimerEvent;
}

export const CUE_CARD_IDLE: CueCardTimerState = { phase: "idle" };

const MS = 1000;

export function startPrep(now: number, prepSeconds: number): CueCardTimerState {
  return { phase: "prep", endsAt: now + Math.max(0, prepSeconds) * MS };
}

export function skipPrep(now: number, speakSeconds: number): CueCardTimerState {
  return { phase: "speaking", endsAt: now + Math.max(0, speakSeconds) * MS };
}

/**
 * Advance the machine to `now`. Prep expiry starts speaking from `now` (not
 * from the missed deadline, so a long tab sleep still grants the full speaking
 * time); speaking expiry ends the card.
 */
export function tick(
  state: CueCardTimerState,
  now: number,
  speakSeconds: number,
): CueCardTick {
  if (state.phase === "prep" && now >= state.endsAt) {
    return { state: skipPrep(now, speakSeconds), event: "prepEnded" };
  }
  if (state.phase === "speaking" && now >= state.endsAt) {
    return { state: { phase: "done" }, event: "speakingEnded" };
  }
  return { state, event: null };
}

/** Learner ends early (or the recorder stops): prep/speaking → done. */
export function stop(state: CueCardTimerState): CueCardTimerState {
  return state.phase === "idle" ? state : { phase: "done" };
}

export function isRunning(state: CueCardTimerState): boolean {
  return state.phase === "prep" || state.phase === "speaking";
}

/** Seconds left in the current timed phase (ceil, never negative; 0 when untimed). */
export function remainingSeconds(state: CueCardTimerState, now: number): number {
  if (state.phase !== "prep" && state.phase !== "speaking") return 0;
  return Math.max(0, Math.ceil((state.endsAt - now) / MS));
}

export function serialize(state: CueCardTimerState): string {
  return JSON.stringify(state);
}

/** Inverse of {@link serialize}; anything malformed yields `idle`. */
export function deserialize(raw: string | null | undefined): CueCardTimerState {
  if (typeof raw !== "string" || raw.length === 0) return CUE_CARD_IDLE;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return CUE_CARD_IDLE;
  }
  if (!parsed || typeof parsed !== "object") return CUE_CARD_IDLE;
  const record = parsed as { phase?: unknown; endsAt?: unknown };
  switch (record.phase) {
    case "idle":
      return CUE_CARD_IDLE;
    case "done":
      return { phase: "done" };
    case "prep":
    case "speaking":
      return typeof record.endsAt === "number" && Number.isFinite(record.endsAt)
        ? { phase: record.phase, endsAt: record.endsAt }
        : CUE_CARD_IDLE;
    default:
      return CUE_CARD_IDLE;
  }
}

export function cueCardStorageKey(attemptId: string, questionId: string): string {
  return `ielts:mock:${attemptId}:cue-card:${questionId}`;
}
