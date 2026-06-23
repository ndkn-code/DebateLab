"use client";

import { motion, type HTMLMotionProps } from "framer-motion";

import { staggerContainer, staggerItem } from "@/lib/motion/variants";

/** Wrap a grid/list so its <StaggerItem> children animate in sequence. */
export function Stagger({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" {...props}>
      {children}
    </motion.div>
  );
}

/** Direct child of <Stagger>. Fades up on the shared timeline. */
export function StaggerItem({ children, ...props }: HTMLMotionProps<"div">) {
  return (
    <motion.div variants={staggerItem} {...props}>
      {children}
    </motion.div>
  );
}
