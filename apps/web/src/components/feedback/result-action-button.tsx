"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResultActionTone = "primary" | "coach" | "danger" | "neutral";

const toneClassNames: Record<ResultActionTone, string> = {
  primary:
    "border-outline-variant bg-primary text-white shadow-token-primary hover:bg-primary-dim",
  coach:
    "border-outline-variant bg-white text-primary-dim shadow-token-primary hover:bg-surface-container",
  danger:
    "border-outline-variant bg-white text-error shadow-token-card hover:bg-surface-container",
  neutral:
    "border-outline-variant bg-white text-on-surface shadow-token-card hover:bg-surface-container",
};

interface ResultActionButtonProps extends ComponentProps<typeof Button> {
  tone?: ResultActionTone;
}

export function ResultActionButton({
  tone = "neutral",
  className,
  variant = "outline",
  ...props
}: ResultActionButtonProps) {
  return (
    <Button
      variant={variant}
      className={cn(
        "min-h-[48px] rounded-2xl border px-5 type-body font-bold transition active:translate-y-[2px] active:shadow-token-card",
        toneClassNames[tone],
        className
      )}
      {...props}
    />
  );
}
