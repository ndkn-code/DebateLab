"use client";

import type { HTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Adapted from Magic UI's Border Beam component.
 * Source: https://magicui.design/docs/components/border-beam
 * License: MIT, Copyright (c) Magic UI
 */
export function BorderBeam({
  className,
  duration = 8,
  delay = 0,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  duration?: number;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]",
        className,
      )}
      {...props}
    >
      <motion.div
        className="absolute -inset-[75%]"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0 76%, var(--color-secondary) 84%, var(--color-success) 89%, transparent 96%)",
        }}
        initial={{ rotate: reduceMotion ? 24 : 0 }}
        animate={{ rotate: reduceMotion ? 24 : 360 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration, delay, repeat: Infinity, ease: "linear" }
        }
      />
      <div className="absolute inset-px rounded-[11px] bg-surface" />
    </div>
  );
}
