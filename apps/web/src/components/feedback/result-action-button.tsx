"use client";

import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResultActionTone = "primary" | "coach" | "danger" | "neutral";

const toneClassNames: Record<ResultActionTone, string> = {
  primary:
    "border-[#2F76EF] bg-[#4D86F7] text-white shadow-[0_4px_0_#2F64D8,0_14px_26px_rgba(77,134,247,0.22)] hover:bg-[#3E78EC]",
  coach:
    "border-[#CFE0FF] bg-white text-[#3E78EC] shadow-[0_4px_0_#DCE8FF,0_14px_26px_rgba(77,134,247,0.12)] hover:bg-[#F8FAFF]",
  danger:
    "border-[#F5B8B8] bg-white text-[#EF6A6A] shadow-[0_4px_0_#F8D1D1,0_14px_26px_rgba(239,106,106,0.12)] hover:bg-[#FFF7F7]",
  neutral:
    "border-[#D9E5F4] bg-white text-[#162033] shadow-[0_4px_0_#E4ECF8,0_14px_26px_rgba(16,32,72,0.08)] hover:bg-[#F8FAFF]",
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
        "min-h-[48px] rounded-2xl border px-5 text-[0.94rem] font-bold transition active:translate-y-[2px] active:shadow-[0_2px_0_rgba(16,32,72,0.18)]",
        toneClassNames[tone],
        className
      )}
      {...props}
    />
  );
}
