"use client";

import { motion, useReducedMotion } from "framer-motion";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
}: OnboardingProgressProps) {
  const prefersReducedMotion = useReducedMotion();
  const percent = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalSteps}
      aria-valuenow={currentStep + 1}
      className="h-1.5 w-full bg-outline-variant/50"
    >
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { duration: 0.15, ease: "easeOut" }
        }
      />
    </div>
  );
}
