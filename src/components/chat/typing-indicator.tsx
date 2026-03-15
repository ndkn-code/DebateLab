"use client";

import { Sparkles } from "lucide-react";

export function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <Sparkles className="h-4 w-4 text-primary" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest px-4 py-3 soft-shadow">
        <span className="text-xs text-on-surface-variant">AI Coach is thinking</span>
        <span className="flex gap-0.5 ml-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}
