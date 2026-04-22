"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle, Send } from "lucide-react";
import { CoachQuickActions } from "@/components/chat/coach-quick-actions";

export function AiCoachWidget() {
  const router = useRouter();
  const t = useTranslations("dashboard.home");
  const [input, setInput] = useState("");

  const handleSubmit = (message: string) => {
    if (!message.trim()) return;
    router.push(`/chat?message=${encodeURIComponent(message.trim())}`);
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
              {t("ask_ai_coach")}
            </h3>
            <p className="text-xs text-on-surface-variant">
              {t("ask_ai_coach_subtitle")}
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="relative mb-3">
          <input
            type="text"
            placeholder={t("ask_placeholder")}
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
        <CoachQuickActions variant="general" onSelect={handleSubmit} compact />
      </div>
    </div>
  );
}
