"use client";

/**
 * Poll an async IELTS scorer until a response settles (WS-5.2). Shared by the
 * Writing + Speaking capture surfaces: it owns the in-flight response id + the
 * latest poll view and derives the scored/failed/pending flags, so the renderers
 * stay thin. Polling stops once the response reaches a terminal status.
 */
import { useEffect, useState } from "react";
import { isPendingStatus, isScoredStatus } from "@/lib/ielts/capture/capture-format";

const POLL_MS = 2500;

export interface ScoringPoll<T> {
  view: T | null;
  responseId: string | null;
  scored: boolean;
  failed: boolean;
  /** A response is being scored (tracked, not yet settled) — show progress. */
  pending: boolean;
  /** Track a freshly submitted response id (clears any prior view). */
  begin: (id: string) => void;
  /** Forget the tracked response (e.g. on re-record). */
  clear: () => void;
}

export function useScoringPoll<T extends { status: string }>(
  initialId: string | null,
  poll: (id: string) => Promise<T>,
): ScoringPoll<T> {
  const [responseId, setResponseId] = useState<string | null>(initialId);
  const [view, setView] = useState<T | null>(null);

  const scored = view !== null && isScoredStatus(view.status);
  const failed = view !== null && view.status === "failed";
  const settled = view !== null && !isPendingStatus(view.status);
  const pending = responseId !== null && !settled;

  useEffect(() => {
    if (responseId === null || settled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const next = await poll(responseId);
        if (cancelled) return;
        setView(next);
        if (isPendingStatus(next.status)) timer = setTimeout(tick, POLL_MS);
      } catch {
        if (!cancelled) timer = setTimeout(tick, POLL_MS);
      }
    };
    timer = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [responseId, settled, poll]);

  return {
    view,
    responseId,
    scored,
    failed,
    pending,
    begin: (id: string) => {
      setView(null);
      setResponseId(id);
    },
    clear: () => {
      setView(null);
      setResponseId(null);
    },
  };
}
