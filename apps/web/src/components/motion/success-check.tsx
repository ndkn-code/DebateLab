"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type SuccessCheckProps = {
  size?: number;
  className?: string;
  /** Flip to replay the draw-in. */
  play?: boolean;
};

const drawEase: [number, number, number, number] = [0.3, 0, 0, 1];

/** Animated success check (transitions.dev success state). Stroke uses the success token. */
export function SuccessCheck({ size = 48, className, play = true }: SuccessCheckProps) {
  const reduce = useReducedMotion();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      role="img"
      aria-label="Success"
      className={cn("text-success", className)}
    >
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        className="stroke-success"
        strokeWidth="3"
        fill="none"
        initial={reduce ? false : { pathLength: 0, opacity: 0 }}
        animate={play ? { pathLength: 1, opacity: 1 } : undefined}
        transition={{ duration: reduce ? 0 : 0.5, ease: drawEase }}
      />
      <motion.path
        d="M16 27 l7 7 l13 -14"
        className="stroke-success"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        initial={reduce ? false : { pathLength: 0 }}
        animate={play ? { pathLength: 1 } : undefined}
        transition={{ duration: reduce ? 0 : 0.4, ease: drawEase, delay: reduce ? 0 : 0.35 }}
      />
    </svg>
  );
}
