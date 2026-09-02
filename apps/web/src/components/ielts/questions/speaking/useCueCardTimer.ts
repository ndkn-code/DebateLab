"use client";

/**
 * Drives the pure cue-card timer machine (`lib/ielts/speaking/cue-card-timer`)
 * with a 250 ms interval and persists the state in `sessionStorage` under
 * `cueCardStorageKey(attemptId, questionId)` so a reload resumes mid-prep or
 * mid-speech. Phase transitions surface as callbacks so the renderer can start
 * / stop the recorder; the hook never touches the recorder itself.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  CUE_CARD_IDLE,
  cueCardStorageKey,
  deserialize,
  isRunning,
  remainingSeconds,
  serialize,
  skipPrep as skipPrepState,
  startPrep as startPrepState,
  stop as stopState,
  tick,
  type CueCardTimerState,
} from "@/lib/ielts/speaking/cue-card-timer";

const TICK_MS = 250;

export interface UseCueCardTimerOptions {
  /** `false` for non-cue-card questions: no storage read, machine stays idle. */
  enabled: boolean;
  attemptId: string | null;
  questionId: string;
  prepSeconds: number;
  speakSeconds: number;
  /** Prep expired (or was skipped) — start recording. */
  onPrepEnded: () => void;
  /** Speaking time expired — stop recording. */
  onSpeakingEnded: () => void;
  /** Mounted into a persisted `speaking` phase (reload) — restart recording. */
  onSpeakingResumed?: () => void;
}

export interface CueCardTimer {
  state: CueCardTimerState;
  /** Seconds left in the current timed phase (0 when idle/done). */
  remaining: number;
  startPrep: () => void;
  skipPrep: () => void;
  stop: () => void;
  reset: () => void;
}

function readStored(key: string | null): CueCardTimerState {
  if (!key || typeof window === "undefined") return CUE_CARD_IDLE;
  try {
    return deserialize(window.sessionStorage.getItem(key));
  } catch {
    return CUE_CARD_IDLE;
  }
}

function writeStored(key: string | null, state: CueCardTimerState) {
  if (!key || typeof window === "undefined") return;
  try {
    if (state.phase === "idle") window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, serialize(state));
  } catch {
    // Storage may be unavailable (private mode / quota); the in-memory state still runs.
  }
}

export function useCueCardTimer({
  enabled,
  attemptId,
  questionId,
  prepSeconds,
  speakSeconds,
  onPrepEnded,
  onSpeakingEnded,
  onSpeakingResumed,
}: UseCueCardTimerOptions): CueCardTimer {
  const storageKey =
    enabled && attemptId ? cueCardStorageKey(attemptId, questionId) : null;

  const [state, setState] = useState<CueCardTimerState>(() =>
    enabled ? readStored(storageKey) : CUE_CARD_IDLE,
  );
  const [now, setNow] = useState(() => Date.now());

  const stateRef = useRef(state);
  const callbacksRef = useRef({ onPrepEnded, onSpeakingEnded, onSpeakingResumed });
  useEffect(() => {
    callbacksRef.current = { onPrepEnded, onSpeakingEnded, onSpeakingResumed };
  }, [onPrepEnded, onSpeakingEnded, onSpeakingResumed]);

  const apply = useCallback(
    (next: CueCardTimerState) => {
      stateRef.current = next;
      setState(next);
      setNow(Date.now());
      writeStored(storageKey, next);
    },
    [storageKey],
  );

  // A reload that lands mid-speech: the recorder is gone, so ask for it back.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    resumedRef.current = true;
    if (stateRef.current.phase === "speaking") {
      callbacksRef.current.onSpeakingResumed?.();
    }
  }, []);

  useEffect(() => {
    if (!isRunning(state)) return;
    const id = window.setInterval(() => {
      const current = Date.now();
      const result = tick(stateRef.current, current, speakSeconds);
      if (result.event) {
        apply(result.state);
        if (result.event === "prepEnded") callbacksRef.current.onPrepEnded();
        else callbacksRef.current.onSpeakingEnded();
        return;
      }
      setNow(current);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [state, speakSeconds, apply]);

  const startPrep = useCallback(() => {
    if (stateRef.current.phase !== "idle") return;
    apply(startPrepState(Date.now(), prepSeconds));
  }, [apply, prepSeconds]);

  const skipPrep = useCallback(() => {
    if (stateRef.current.phase !== "prep") return;
    apply(skipPrepState(Date.now(), speakSeconds));
    callbacksRef.current.onPrepEnded();
  }, [apply, speakSeconds]);

  const stop = useCallback(() => {
    if (!isRunning(stateRef.current)) return;
    apply(stopState(stateRef.current));
  }, [apply]);

  const reset = useCallback(() => {
    apply(CUE_CARD_IDLE);
  }, [apply]);

  return {
    state,
    remaining: remainingSeconds(state, now),
    startPrep,
    skipPrep,
    stop,
    reset,
  };
}
