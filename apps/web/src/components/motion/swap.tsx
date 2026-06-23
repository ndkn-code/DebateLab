"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";

import { cn } from "@/lib/utils";

type SwapProps = {
  /** Change this key to cross-fade to new content (icon/text/number swaps). */
  swapKey: React.Key;
  children: React.ReactNode;
  className?: string;
};

/** Cross-fade between keyed children in place (transitions.dev text/icon swap). */
export function Swap({ swapKey, children, className }: SwapProps) {
  return (
    <span className={cn("relative inline-grid", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={swapKey}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="col-start-1 row-start-1"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
