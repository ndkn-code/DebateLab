"use client";

import { cn } from "@/lib/utils";

interface MiniScoreRingProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function getScoreColor(score: number) {
  if (score >= 75) return { stroke: "#34d399", text: "text-emerald-400" };
  if (score >= 40) return { stroke: "#fbbf24", text: "text-amber-400" };
  return { stroke: "#f87171", text: "text-red-400" };
}

export function MiniScoreRing({
  score,
  size = 44,
  strokeWidth = 3,
  className,
}: MiniScoreRingProps) {
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const color = getScoreColor(score);

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-outline-variant/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color.stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className={cn(
          "absolute text-xs font-bold tabular-nums",
          color.text
        )}
      >
        {score}
      </span>
    </div>
  );
}
