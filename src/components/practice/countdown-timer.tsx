"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  timeLeft: number;
  totalTime: number;
  progress: number;
  isRunning: boolean;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getTimerColor(progress: number, timeLeft: number) {
  if (timeLeft <= 10) return "text-red-400";
  if (progress > 0.75) return "text-red-400";
  if (progress > 0.5) return "text-amber-400";
  return "text-primary";
}

function getStrokeColor(progress: number, timeLeft: number) {
  if (timeLeft <= 10) return "#f87171";
  if (progress > 0.75) return "#f87171";
  if (progress > 0.5) return "#fbbf24";
  return "#2f4fdd";
}

export function CountdownTimer({
  timeLeft,
  totalTime,
  progress,
  isRunning,
}: CountdownTimerProps) {
  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress);
  const timerColor = getTimerColor(progress, timeLeft);
  const strokeColor = getStrokeColor(progress, timeLeft);
  const isFlashing = timeLeft <= 10 && timeLeft > 0 && isRunning;

  return (
    <div
      role="timer"
      aria-label={`${formatTime(timeLeft)} remaining`}
      aria-live="polite"
      className="relative flex items-center justify-center"
    >
      {/* SVG Ring */}
      <svg
        className="h-64 w-64 -rotate-90 sm:h-72 sm:w-72"
        viewBox="0 0 260 260"
      >
        {/* Background ring */}
        <circle
          cx="130"
          cy="130"
          r="120"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-outline-variant/20"
        />
        {/* Progress ring */}
        <motion.circle
          cx="130"
          cy="130"
          r="120"
          fill="none"
          stroke={strokeColor}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          initial={false}
          animate={{ strokeDashoffset }}
          transition={{ duration: 0.5, ease: "linear" }}
        />
      </svg>

      {/* Time display */}
      <motion.div
        className={cn(
          "absolute text-6xl font-bold tabular-nums tracking-tight sm:text-7xl",
          timerColor
        )}
        animate={
          isFlashing
            ? { opacity: [1, 0.3, 1] }
            : isRunning
              ? { scale: [1, 1.02, 1] }
              : {}
        }
        transition={
          isFlashing
            ? { duration: 1, repeat: Infinity }
            : { duration: 1, repeat: Infinity, ease: "easeInOut" }
        }
      >
        {formatTime(timeLeft)}
      </motion.div>

      {/* Phase label */}
      <div className="absolute bottom-12 text-xs font-medium uppercase tracking-widest text-on-surface-variant sm:bottom-14">
        {timeLeft === 0
          ? "Time's up"
          : `${Math.ceil((timeLeft / totalTime) * 100)}% remaining`}
      </div>
    </div>
  );
}
