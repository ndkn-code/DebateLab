"use client";

import { useEffect, useMemo, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

const DRIVE_DELAYS = Array.from({ length: 9 }, (_, index) => {
  const row = Math.floor(index / 3);
  return ((index % 3) + Math.abs(row - 1)) * 90;
});
const ORBIT_ORDER = [0, 1, 2, 5, 8, 7, 6, 3];

/**
 * Adapted from Beautiful UI's pixel-grid Loading State.
 * Original source Copyright (c) 2026 Shane Levine, MIT License.
 */
export function BeautifulLoadingState({
  label,
  variant = "drive",
  showElapsed = true,
  className,
}: {
  label?: string;
  variant?: "drive" | "dots" | "orbit";
  showElapsed?: boolean;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [deciseconds, setDeciseconds] = useState(0);
  const delays = useMemo(() => {
    if (variant !== "orbit") return DRIVE_DELAYS;
    return Array.from({ length: 9 }, (_, index) => {
      const orderIndex = ORBIT_ORDER.indexOf(index);
      return orderIndex < 0 ? null : orderIndex * 110;
    });
  }, [variant]);

  useEffect(() => {
    if (!showElapsed) return;
    const timer = window.setInterval(
      () => setDeciseconds((current) => current + 1),
      100,
    );
    return () => window.clearInterval(timer);
  }, [showElapsed]);

  const seconds = deciseconds / 10;
  const elapsed =
    seconds < 60
      ? `${seconds.toFixed(1)}s`
      : `${Math.floor(seconds / 60)}m ${(seconds % 60).toFixed(1)}s`;

  return (
    <div
      role="status"
      aria-label={label || undefined}
      className={cn("flex w-fit items-center gap-2.5", className)}
    >
      <span
        aria-hidden="true"
        className="grid shrink-0 grid-cols-[repeat(3,4px)] gap-[1.5px]"
      >
        {delays.map((delay, index) => (
          <span
            key={index}
            className={cn(
              "size-1 bg-on-surface",
              variant === "dots" ? "rounded-full" : "rounded-[1px]",
              !shouldReduceMotion && delay !== null && "animate-pulse",
            )}
            style={{
              opacity: delay === null ? 0.08 : shouldReduceMotion ? 0.5 : 0.2,
              animationDelay:
                !shouldReduceMotion && delay !== null
                  ? `${delay}ms`
                  : undefined,
              animationDuration: variant === "orbit" ? "950ms" : "650ms",
            }}
          />
        ))}
      </span>
      {label ? (
        <span
          className={cn(
            "type-label font-medium text-on-surface-variant",
            !shouldReduceMotion &&
              "bg-gradient-to-r from-on-surface-variant via-on-surface to-on-surface-variant bg-[length:200%_100%] bg-clip-text text-transparent motion-safe:animate-pulse",
          )}
        >
          {label}
        </span>
      ) : null}
      {showElapsed ? (
        <span
          aria-hidden="true"
          className="type-caption tabular-nums text-on-surface-variant"
        >
          {elapsed}
        </span>
      ) : null}
    </div>
  );
}
