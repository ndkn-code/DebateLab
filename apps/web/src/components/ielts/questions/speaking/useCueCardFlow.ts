"use client";

/**
 * Binds the cue-card clock to the recorder for Speaking Part 2: prep ending
 * (or being skipped) starts recording, the speaking clock ending stops it, and
 * a refused microphone stops the clock. Non-Part-2 questions keep the machine
 * idle and every return value inert.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { CueCardTimerState } from "@/lib/ielts/speaking/cue-card-timer";
import type { SpeakingRecorder } from "../useSpeakingRecorder";
import { useCueCardTimer } from "./useCueCardTimer";

export interface CueCardFlow {
  state: CueCardTimerState;
  phase: CueCardTimerState["phase"];
  remaining: number;
  /** The speaking clock (not the learner) stopped the last recording. */
  endedByTimer: boolean;
  startPrep: () => void;
  skipPrep: () => void;
  /** Learner stops early: stop the recorder and the clock together. */
  stop: () => void;
  /** Back to idle (re-record): clears persisted clock state. */
  reset: () => void;
}

export function useCueCardFlow({
  enabled,
  attemptId,
  questionId,
  prepSeconds,
  speakSeconds,
  recorder,
}: {
  enabled: boolean;
  attemptId: string | null;
  questionId: string;
  prepSeconds: number;
  speakSeconds: number;
  recorder: SpeakingRecorder;
}): CueCardFlow {
  const recorderRef = useRef(recorder);
  useEffect(() => {
    recorderRef.current = recorder;
  }, [recorder]);
  const [endedByTimer, setEndedByTimer] = useState(false);

  const startRecording = useCallback(() => {
    setEndedByTimer(false);
    void recorderRef.current.start();
  }, []);
  const stopRecordingByTimer = useCallback(() => {
    setEndedByTimer(true);
    recorderRef.current.stop();
  }, []);

  const timer = useCueCardTimer({
    enabled,
    attemptId,
    questionId,
    prepSeconds,
    speakSeconds,
    onPrepEnded: startRecording,
    onSpeakingEnded: stopRecordingByTimer,
    onSpeakingResumed: startRecording,
  });

  // The mic was refused after prep ended: do not let the speaking clock run on nothing.
  const phase = timer.state.phase;
  const stopTimer = timer.stop;
  useEffect(() => {
    if (recorder.status === "error" && phase === "speaking") stopTimer();
  }, [recorder.status, phase, stopTimer]);

  const stop = useCallback(() => {
    recorderRef.current.stop();
    stopTimer();
  }, [stopTimer]);

  const resetTimer = timer.reset;
  const reset = useCallback(() => {
    setEndedByTimer(false);
    resetTimer();
  }, [resetTimer]);

  return {
    state: timer.state,
    phase,
    remaining: timer.remaining,
    endedByTimer,
    startPrep: timer.startPrep,
    skipPrep: timer.skipPrep,
    stop,
    reset,
  };
}
