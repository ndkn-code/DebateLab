"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send } from "lucide-react";

const QUICK_PROMPTS = [
  "How to structure a rebuttal?",
  "Explain WSDC format",
  "Review my last debate",
];

export function AiCoachWidget() {
  const router = useRouter();
  const [input, setInput] = useState("");

  const handleSubmit = (message: string) => {
    if (!message.trim()) return;
    router.push(`/chat?q=${encodeURIComponent(message.trim())}`);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary-container/30 to-surface-container-lowest p-6 soft-shadow">
      {/* Accent glow */}
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />

      <div className="relative">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-on-surface">
              Ask your AI Coach
            </h3>
            <p className="text-xs text-on-surface-variant">
              Get instant help with debate techniques
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder="Ask anything about debate..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit(input);
            }}
            className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-lowest py-3 pl-4 pr-12 text-sm text-on-surface placeholder-on-surface-variant/60 outline-none transition-colors focus:border-primary/40"
          />
          <button
            onClick={() => handleSubmit(input)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-primary transition-colors hover:bg-primary/10"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>

        {/* Quick prompts */}
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSubmit(prompt)}
              className="rounded-lg bg-surface-container px-3 py-1.5 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
