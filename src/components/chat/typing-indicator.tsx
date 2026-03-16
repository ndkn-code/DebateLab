"use client";

import { LottieAnimation } from "@/components/ui/lottie-animation";
import aiTypingAnimation from "../../../public/lottie/ai-typing.json";

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <LottieAnimation animationData={aiTypingAnimation} className="w-6 h-6" />
      </div>
      <div className="flex items-center gap-2 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 soft-shadow">
        <LottieAnimation animationData={aiTypingAnimation} className="w-10 h-10" />
        <span className="text-xs text-on-surface-variant">Coach is thinking...</span>
      </div>
    </div>
  );
}
