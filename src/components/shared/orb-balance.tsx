"use client";

import { cn } from "@/lib/utils";

interface OrbBalanceProps {
  balance: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

export function OrbBalance({
  balance,
  size = "md",
  showLabel = false,
  className,
}: OrbBalanceProps) {
  const isLow = balance <= 2;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5",
        isLow && "animate-pulse",
        className
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 font-bold text-white shadow-sm",
          size === "sm" && "h-5 w-5 text-[10px]",
          size === "md" && "h-6 w-6 text-xs",
          size === "lg" && "h-8 w-8 text-sm"
        )}
      >
        <OrbIcon className={cn(
          size === "sm" && "h-3 w-3",
          size === "md" && "h-3.5 w-3.5",
          size === "lg" && "h-4.5 w-4.5"
        )} />
      </div>
      <span
        className={cn(
          "font-semibold",
          size === "sm" && "text-xs",
          size === "md" && "text-sm",
          size === "lg" && "text-base",
          isLow ? "text-amber-500" : "text-on-surface"
        )}
      >
        {balance}
      </span>
      {showLabel && (
        <span className="text-xs text-on-surface-variant">Orbs</span>
      )}
    </div>
  );
}

function OrbIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.3" />
      <circle cx="12" cy="12" r="7" fill="currentColor" opacity="0.5" />
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <ellipse cx="9" cy="9" rx="2" ry="1.5" fill="white" opacity="0.6" transform="rotate(-30 9 9)" />
    </svg>
  );
}
