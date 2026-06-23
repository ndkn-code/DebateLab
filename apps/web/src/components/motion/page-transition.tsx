"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";

import { fadeInUp } from "@/lib/motion/variants";

/** Page/section enter transition (fade up). Honours prefers-reduced-motion. */
export function PageTransition({ children, ...props }: HTMLMotionProps<"div">) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={fadeInUp}
      initial={reduce ? false : "initial"}
      animate="animate"
      exit="exit"
      {...props}
    >
      {children}
    </motion.div>
  );
}
