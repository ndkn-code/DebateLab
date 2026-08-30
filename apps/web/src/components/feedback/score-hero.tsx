"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DebateScore } from "@/types/feedback";

const bandColors: Record<string, string> = {
  Expert: "text-success-dim bg-success-container border-success/30",
  Proficient: "text-secondary bg-secondary-container border-secondary/30",
  Competent: "text-on-warning-container bg-warning-container border-warning/30",
  Developing: "text-on-warning-container bg-warning-container border-warning/30",
  Novice: "text-error-dim bg-error-container border-error/30",
};

function getStrokeColor(band: string) {
  const map: Record<string, string> = {
    Expert: "var(--color-success)",
    Proficient: "var(--color-secondary)",
    Competent: "var(--color-warning)",
    Developing: "var(--color-warning)",
    Novice: "var(--color-error)",
  };
  return map[band] ?? "var(--color-secondary)";
}

interface ScoreHeroProps {
  feedback: DebateScore;
}

export function ScoreHero({ feedback }: ScoreHeroProps) {
  const [displayScore, setDisplayScore] = useState(0);

  // Animate count-up
  useEffect(() => {
    const target = feedback.totalScore;
    const duration = 1500;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * target));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [feedback.totalScore]);

  const circumference = 2 * Math.PI * 80;
  const strokeDashoffset =
    circumference * (1 - feedback.totalScore / 100);
  const strokeColor = getStrokeColor(feedback.overallBand);

  return (
    <div className="flex flex-col items-center gap-4 py-6" role="region" aria-label={`Overall score: ${feedback.totalScore} out of 100, band: ${feedback.overallBand}`}>
      {/* Score ring */}
      <div className="relative flex items-center justify-center" aria-hidden="true">
        <svg className="h-36 w-36 -rotate-90" viewBox="0 0 180 180">
          <circle
            cx="90"
            cy="90"
            r="80"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-outline-variant/20"
          />
          <motion.circle
            cx="90"
            cy="90"
            r="80"
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-4xl font-semibold text-on-surface">{displayScore}</span>
          <span className="text-sm text-on-surface-variant">/100</span>
        </div>
      </div>

      {/* Band badge */}
      <span
        className={cn(
          "inline-flex h-5 items-center rounded-[6px] border px-2.5 text-xs font-medium",
          bandColors[feedback.overallBand]
        )}
      >
        {feedback.overallBand}
      </span>

      {/* Summary */}
      <p className="max-w-lg text-center text-sm leading-relaxed text-on-surface-variant">
        {feedback.summary}
      </p>
    </div>
  );
}
