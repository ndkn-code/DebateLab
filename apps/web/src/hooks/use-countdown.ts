"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export function useCountdown(initialSeconds: number) {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  const endTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedTimeLeftRef = useRef(initialSeconds);

  const tick = useCallback(function tickFrame() {
    if (!endTimeRef.current) return;

    const remaining = Math.max(
      0,
      Math.ceil((endTimeRef.current - Date.now()) / 1000)
    );
    setTimeLeft(remaining);

    if (remaining <= 0) {
      setIsRunning(false);
      setIsFinished(true);
      endTimeRef.current = null;
      return;
    }

    rafRef.current = requestAnimationFrame(tickFrame);
  }, []);

  const start = useCallback(() => {
    endTimeRef.current = Date.now() + pausedTimeLeftRef.current * 1000;
    setIsRunning(true);
    setIsFinished(false);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = useCallback(() => {
    if (!endTimeRef.current) return;
    pausedTimeLeftRef.current = Math.max(
      0,
      Math.ceil((endTimeRef.current - Date.now()) / 1000)
    );
    endTimeRef.current = null;
    setIsRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const resume = useCallback(() => {
    if (isFinished || isRunning) return;
    endTimeRef.current = Date.now() + pausedTimeLeftRef.current * 1000;
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [isFinished, isRunning, tick]);

  const reset = useCallback(
    (newSeconds?: number) => {
      const seconds = newSeconds ?? initialSeconds;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      endTimeRef.current = null;
      pausedTimeLeftRef.current = seconds;
      setTimeLeft(seconds);
      setIsRunning(false);
      setIsFinished(false);
    },
    [initialSeconds]
  );

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const progress = 1 - timeLeft / initialSeconds;

  return { timeLeft, isRunning, isFinished, start, pause, resume, reset, progress };
}
