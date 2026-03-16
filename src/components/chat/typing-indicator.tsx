"use client";

import { LottieAnimation } from "@/components/ui/lottie-animation";
import aiTypingAnimation from "../../../public/lottie/ai-typing.json";

export function TypingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <LottieAnimation
        animationData={aiTypingAnimation}
        className="w-8 h-8"
      />
      <span className="text-sm text-on-surface-variant">Coach is thinking...</span>
    </div>
  );
}
