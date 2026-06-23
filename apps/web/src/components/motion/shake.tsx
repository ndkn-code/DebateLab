"use client";

import * as React from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";

type ShakeProps = {
  /** Shake fires whenever this value changes (e.g. an error counter/timestamp). */
  trigger: unknown;
  children: React.ReactNode;
  className?: string;
};

/** Error-shake wrapper (transitions.dev error state). No-op on first render / reduced motion. */
export function Shake({ trigger, children, className }: ShakeProps) {
  const controls = useAnimationControls();
  const reduce = useReducedMotion();
  const isFirst = React.useRef(true);

  React.useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    if (reduce) return;
    void controls.start({ x: [0, -6, 6, -4, 4, 0], transition: { duration: 0.4 } });
  }, [trigger, controls, reduce]);

  return (
    <motion.div animate={controls} className={className}>
      {children}
    </motion.div>
  );
}
