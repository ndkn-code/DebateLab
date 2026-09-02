"use client";

/**
 * Tiny per-part controller shared by the review question list (right pane)
 * and the source pane (left pane): "jump to" a located answer scrolls its
 * highlight into view, flashes it, and — for Listening items with a timestamp
 * — seeks the part's replay. One provider wraps each part's split pane.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface ReviewJumpTarget {
  questionId: string;
  /** Seconds into the part's audio, when the item carries a timestamp. */
  seconds: number | null;
  /** Increments on every jump so repeated jumps to the same item re-flash. */
  token: number;
}

export interface ReviewSourceController {
  target: ReviewJumpTarget | null;
  jumpTo: (questionId: string, seconds: number | null) => void;
}

const NOOP_CONTROLLER: ReviewSourceController = {
  target: null,
  jumpTo: () => {},
};

const ReviewSourceContext = createContext<ReviewSourceController>(NOOP_CONTROLLER);

export function ReviewSourceProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ReviewJumpTarget | null>(null);
  const jumpTo = useCallback((questionId: string, seconds: number | null) => {
    setTarget((previous) => ({
      questionId,
      seconds,
      token: (previous?.token ?? 0) + 1,
    }));
  }, []);
  const value = useMemo(() => ({ target, jumpTo }), [target, jumpTo]);
  return (
    <ReviewSourceContext.Provider value={value}>{children}</ReviewSourceContext.Provider>
  );
}

/** Outside a provider this is a no-op controller (plain-row fallbacks). */
export function useReviewSourceController(): ReviewSourceController {
  return useContext(ReviewSourceContext);
}
