"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

type PageTransitionProps = HTMLMotionProps<"div">;

export function PageTransition({
  initial,
  animate,
  transition,
  ...props
}: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : initial ?? { opacity: 0, y: 10 }}
      animate={prefersReducedMotion ? { opacity: 1 } : animate ?? { opacity: 1, y: 0 }}
      transition={transition ?? { duration: 0.22, ease: "easeOut" }}
      {...props}
    />
  );
}

export function StaggeredContainer({
  initial,
  animate,
  transition,
  ...props
}: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : initial ?? { opacity: 0 }}
      animate={animate ?? { opacity: 1 }}
      transition={
        transition ??
        (prefersReducedMotion
          ? { duration: 0.12 }
          : { duration: 0.18, staggerChildren: 0.035 })
      }
      {...props}
    />
  );
}

export function FadeInItem({
  initial,
  animate,
  transition,
  ...props
}: PageTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 0 } : initial ?? { opacity: 0, y: 8 }}
      animate={prefersReducedMotion ? { opacity: 1 } : animate ?? { opacity: 1, y: 0 }}
      transition={transition ?? { duration: 0.2, ease: "easeOut" }}
      {...props}
    />
  );
}
