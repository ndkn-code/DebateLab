"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { thinkfyMotion } from "@thinkfy/shared/design-system";
import { cn } from "@/lib/utils";

/**
 * Scroll reveal for editorial blocks, deliberately additive-only.
 *
 * Content renders in its final state by default. The animation is armed on
 * mount for elements that start below the fold, so anything already on screen —
 * including a section reached by an in-page anchor from the header nav — is
 * never left invisible waiting for an animation frame. `prefers-reduced-motion`
 * skips the motion path entirely.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Seconds. Keep small so nothing feels sequenced-in. */
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || reduceMotion) return;
    // One question, answered by the observer: was this block off screen when we
    // first saw it? Only then is the reveal worth arming.
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (!entry.isIntersecting) setArmed(true);
      observer.disconnect();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [reduceMotion]);

  if (reduceMotion || !armed) {
    return (
      <div ref={ref} className={cn(className)}>
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={cn(className)}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: thinkfyMotion.duration.slow,
        ease: thinkfyMotion.ease.standard,
        delay,
      }}
    >
      {children}
    </motion.div>
  );
}
