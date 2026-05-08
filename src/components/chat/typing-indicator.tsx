"use client";

import { LottieAnimation } from "@/components/ui/lottie-animation";
import aiTypingAnimation from "../../../public/lottie/ai-typing.json";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/12 bg-white shadow-[0_10px_22px_rgba(77,134,247,0.12)]">
        <LottieAnimation animationData={aiTypingAnimation} className="h-8 w-8" />
      </div>
      <div className="rounded-[18px] border border-outline-variant/14 bg-white px-4 py-3 shadow-[0_14px_32px_rgba(11,20,36,0.04)]">
        <span className="text-sm font-medium text-on-surface-variant">
          Coach is preparing your answer...
        </span>
      </div>
    </div>
  );
}
