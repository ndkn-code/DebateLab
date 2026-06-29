"use client";

import * as React from "react";
import { animate, useInView, useReducedMotion } from "framer-motion";

import { thinkfyMotion } from "@thinkfy/shared/design-system";
import { cn } from "@/lib/utils";

type AnimatedNumberProps = {
  value: number;
  /** Format the (possibly fractional, mid-tween) value into display text. */
  format?: (value: number) => string;
  /** Tween length in ms. Defaults to the `slow` motion token. */
  durationMs?: number;
  /** Start immediately on mount instead of waiting for viewport entry. */
  startOnMount?: boolean;
  /** Compose type/colour utilities here, e.g. "type-display-sm text-on-surface". */
  className?: string;
};

const defaultFormat = (value: number) => Math.round(value).toLocaleString();

/**
 * Count-up number (the transitions.dev "number pop-in"). Animates once it
 * scrolls into view; respects prefers-reduced-motion. WS-A1 can swap the
 * internals for `@number-flow/react` (bundled by bklit) without changing callers.
 */
export function AnimatedNumber({
  value,
  format = defaultFormat,
  durationMs,
  startOnMount = false,
  className,
}: AnimatedNumberProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const [display, setDisplay] = React.useState(() => format(0));
  const shouldAnimate = startOnMount || inView;

  React.useEffect(() => {
    if (!shouldAnimate) return;
    if (reduce) {
      setDisplay(format(value));
      return;
    }
    const controls = animate(0, value, {
      duration: (durationMs ?? thinkfyMotion.duration.slow * 1000) / 1000,
      ease: [...thinkfyMotion.ease.standard] as [number, number, number, number],
      onUpdate: (latest) => setDisplay(format(latest)),
    });
    return () => controls.stop();
  }, [shouldAnimate, reduce, value, durationMs, format]);

  return (
    <span ref={ref} className={cn("tabular-nums", className)}>
      {display}
    </span>
  );
}
