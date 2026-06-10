"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay, ease: EASE_OUT },
  }),
};

interface RevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  /** Negative viewport margin so reveals trigger slightly before fully in view. */
  margin?: string;
}

/** Fade-and-rise scroll reveal, fires once. */
export function Reveal({ children, delay = 0, className, margin = "-80px" }: RevealProps) {
  return (
    <motion.div
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      custom={delay}
      viewport={{ once: true, margin }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerProps {
  children: ReactNode;
  className?: string;
  /** Delay between children, seconds. */
  gap?: number;
  delay?: number;
  margin?: string;
}

/** Parent that staggers all <StaggerItem> children when scrolled into view. */
export function Stagger({ children, className, gap = 0.1, delay = 0, margin = "-80px" }: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  y = 24,
}: {
  children: ReactNode;
  className?: string;
  y?: number;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y },
        visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE_OUT } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface FloatProps {
  children: ReactNode;
  className?: string;
  /** Vertical travel in px. */
  distance?: number;
  duration?: number;
  delay?: number;
}

/** Gentle continuous bobbing, disabled under reduced motion. */
export function Float({ children, className, distance = 7, duration = 3.4, delay = 0 }: FloatProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      animate={reduceMotion ? undefined : { y: [0, -distance, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Four-point sparkle that twinkles in place. */
export function Sparkle({
  className,
  size = 16,
  delay = 0,
  color = "var(--color-reward)",
}: {
  className?: string;
  size?: number;
  delay?: number;
  color?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      animate={reduceMotion ? undefined : { scale: [0.6, 1, 0.6], opacity: [0.35, 1, 0.35], rotate: [0, 18, 0] }}
      transition={{ duration: 2.6, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      <path
        d="M12 2c.7 4.5 2.7 6.7 7.6 7.4.5.07.5.85 0 .92-4.9.7-6.9 2.9-7.6 7.4-.08.5-.9.5-1 0-.7-4.5-2.7-6.7-7.6-7.4-.5-.07-.5-.85 0-.92 4.9-.7 6.9-2.9 7.6-7.4.1-.5.92-.5 1 0Z"
        fill={color}
      />
    </motion.svg>
  );
}

/** Subtle paper-grain overlay for large color fields. */
export function Grain({ className, opacity = 0.05 }: { className?: string; opacity?: number }) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        opacity,
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")",
      }}
    />
  );
}
