import type { Transition, Variants } from "framer-motion";

import { thinkfyMotion } from "@thinkfy/shared/design-system";

// Cubic-bezier control points from the motion tokens (mutable tuples for framer-motion).
const easeStandard = [...thinkfyMotion.ease.standard] as [number, number, number, number];
const easeEmphasized = [...thinkfyMotion.ease.emphasized] as [number, number, number, number];

/**
 * Reusable framer-motion transitions wired to the Thinkfy motion tokens
 * (`thinkfyMotion` in @thinkfy/shared). Use these instead of inline timing so
 * motion stays consistent the same way colour/type tokens keep visuals consistent.
 */
export const transitions = {
  base: { duration: thinkfyMotion.duration.base, ease: easeStandard },
  fast: { duration: thinkfyMotion.duration.fast, ease: easeEmphasized },
  slow: { duration: thinkfyMotion.duration.slow, ease: easeStandard },
  soft: { ...thinkfyMotion.spring.soft },
  snappy: { ...thinkfyMotion.spring.snappy },
} satisfies Record<string, Transition>;

/** Surface a card/panel: fade up. Pairs with <PageTransition>. */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: transitions.base },
  exit: { opacity: 0, y: -8, transition: transitions.fast },
};

/** Pop a small element (badge, stat, icon) in with a gentle overshoot. */
export const popIn: Variants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1, transition: transitions.snappy },
};

/** Crossfade content (tab panels, async swaps). */
export const crossfade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: transitions.base },
  exit: { opacity: 0, transition: transitions.fast },
};

/** Parent for a staggered list/grid of <StaggerItem>s. */
export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** Child of <Stagger> — fades up in sequence. */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: transitions.soft },
};
