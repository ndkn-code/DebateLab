"use client";

import { LottieAnimation } from "@/components/ui/lottie-animation";
import aiTypingAnimation from "../../../public/lottie/ai-typing.json";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/12 bg-surface shadow-none">
        <LottieAnimation animationData={aiTypingAnimation} className="h-8 w-8" />
      </div>
      <div className="rounded-xl border border-outline-variant bg-surface px-4 py-3 shadow-none">
        <span className="text-sm font-medium text-on-surface-variant">
          Coach is preparing your answer...
        </span>
      </div>
    </div>
  );
}
