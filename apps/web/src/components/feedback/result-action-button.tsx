"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResultActionTone = "primary" | "coach" | "danger" | "neutral";

const toneClassNames: Record<ResultActionTone, string> = {
  primary:
    "border-primary bg-primary text-on-primary shadow-none hover:bg-primary-dim",
  coach:
    "border-outline-variant bg-surface text-secondary shadow-none hover:bg-secondary-container",
  danger:
    "border-outline-variant bg-surface text-error shadow-none hover:bg-error-container",
  neutral:
    "border-outline-variant bg-surface text-on-surface shadow-none hover:bg-surface-container",
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
        "h-8 rounded-control border px-3 type-body font-medium transition active:translate-y-px",
        toneClassNames[tone],
        className
      )}
      {...props}
    />
  );
}
