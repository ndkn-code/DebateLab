"use client";

import { motion } from "framer-motion";

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
}

export function OnboardingProgress({
  currentStep,
  totalSteps,
}: OnboardingProgressProps) {
  const percent = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="h-1.5 w-full bg-outline-variant/50">
      <motion.div
        className="h-full rounded-full bg-primary"
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ type: "spring", stiffness: 100, damping: 20 }}
      />
    </div>
  );
}
