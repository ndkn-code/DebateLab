"use client";

/**
 * CD-IELTS two-pane layout: stimulus (passage / recording) on the left,
 * questions on the right, each scrolling on its own. On `lg+` the split is a
 * grid `[ratio] 8px [1-ratio]` with a draggable, keyboard-operable divider;
 * below `lg` the panes stack and the whole thing scrolls as one column.
 *
 * The ratio persists per attempt (`splitStorageKey`) so a learner who widens
 * the passage keeps it across parts and reloads. Results/review may reuse the
 * pane with `attemptId={null}` — nothing is persisted then.
 */
import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  SPLIT_DEFAULT,
  SPLIT_MAX,
  SPLIT_MIN,
  clampSplitRatio,
  parseStoredSplitRatio,
  splitStorageKey,
} from "@/lib/ielts/split-ratio";

const KEY_STEP = 0.02;

export interface ExamSplitPaneProps {
  /** Attempt the ratio is remembered for; `null`/omitted → no persistence. */
  attemptId?: string | null;
  left: ReactNode;
  right: ReactNode;
  /** Accessible names for the two scroll regions. */
  leftLabel: string;
  rightLabel: string;
  className?: string;
}

// ── Persisted ratio as an external store (hydration-safe, no effects) ────────
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function readStoredRatio(attemptId: string | null): number | null {
  if (!attemptId) return null;
  try {
    return parseStoredSplitRatio(
      window.localStorage.getItem(splitStorageKey(attemptId)),
    );
  } catch {
    return null;
  }
}

function writeStoredRatio(attemptId: string, ratio: number) {
  try {
    window.localStorage.setItem(splitStorageKey(attemptId), ratio.toFixed(3));
  } catch {
    // Private mode / quota — the split simply does not persist.
  }
  listeners.forEach((listener) => listener());
}

/** Server snapshot is "nothing stored" so SSR and the first client paint agree. */
function useStoredRatio(attemptId: string | null): number | null {
  return useSyncExternalStore(
    subscribe,
    () => readStoredRatio(attemptId),
    () => null,
  );
}

export function ExamSplitPane({
  attemptId = null,
  left,
  right,
  leftLabel,
  rightLabel,
  className,
}: ExamSplitPaneProps) {
  const t = useTranslations("ielts.player.exam");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const stored = useStoredRatio(attemptId);
  // Live value while dragging / after a keyboard step; the stored ratio seeds it.
  const [override, setRatio] = useState<number | null>(null);
  const ratio = override ?? stored ?? SPLIT_DEFAULT;

  const commit = useCallback(
    (next: number) => {
      const clamped = clampSplitRatio(next);
      setRatio(clamped);
      if (attemptId) writeStoredRatio(attemptId, clamped);
    },
    [attemptId],
  );

  const ratioFromPointer = (clientX: number): number | null => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    return (clientX - rect.left) / rect.width;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    const next = ratioFromPointer(event.clientX);
    if (next !== null) setRatio(clampSplitRatio(next));
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const next = ratioFromPointer(event.clientX);
    commit(next ?? ratio);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const actions: Record<string, () => void> = {
      ArrowLeft: () => commit(ratio - KEY_STEP),
      ArrowRight: () => commit(ratio + KEY_STEP),
      Home: () => commit(SPLIT_MIN),
      End: () => commit(SPLIT_MAX),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain lg:grid lg:overflow-hidden",
        className,
      )}
      style={{
        gridTemplateColumns: `minmax(0, ${ratio}fr) 8px minmax(0, ${1 - ratio}fr)`,
      }}
    >
      <section
        aria-label={leftLabel}
        className="min-h-0 scroll-smooth lg:overflow-y-auto lg:overscroll-contain"
      >
        {left}
      </section>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("splitDivider")}
        aria-valuemin={Math.round(SPLIT_MIN * 100)}
        aria-valuemax={Math.round(SPLIT_MAX * 100)}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        data-exam-control
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleKeyDown}
        onDoubleClick={() => commit(SPLIT_DEFAULT)}
        className="group relative hidden w-2 shrink-0 cursor-col-resize touch-none select-none items-center justify-center border-x border-outline-variant bg-surface-container transition-colors hover:bg-primary-container focus-visible:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:flex"
      >
        <span
          aria-hidden="true"
          className="h-10 w-0.5 rounded-full bg-outline transition-colors group-hover:bg-primary group-focus-visible:bg-primary"
        />
        {/* Wider hit target than the visible 8px bar. */}
        <span aria-hidden="true" className="absolute inset-y-0 -left-2 -right-2" />
      </div>
      <section
        aria-label={rightLabel}
        className="min-h-0 scroll-smooth border-t border-outline-variant lg:overflow-y-auto lg:overscroll-contain lg:border-t-0"
      >
        {right}
      </section>
    </div>
  );
}
