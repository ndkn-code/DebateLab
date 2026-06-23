"use client";

import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

type ShimmerProps = {
  className?: string;
  /** Tailwind rounding utility, e.g. "rounded-md". */
  rounded?: string;
};

/**
 * Skeleton shimmer block (transitions.dev shimmer). Token-only: a muted
 * container with a light surface sweep. Static when reduced motion is on.
 */
export function Shimmer({ className, rounded = "rounded-lg" }: ShimmerProps) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("relative overflow-hidden bg-surface-container", rounded, className)}>
      {!reduce && (
        <motion.div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-transparent via-surface-container-lowest to-transparent"
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "linear" }}
        />
      )}
    </div>
  );
}
