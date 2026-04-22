"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  ChevronRight,
  CircleHelp,
  Lightbulb,
  Menu,
  Send,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatBubble } from "./chat-bubble";
import { TypingIndicator } from "./typing-indicator";
import type { ChatMessageLocal } from "./chat-shell";
import type { CoachContextEnvelope, CoachProfile } from "@/types";
import { cn } from "@/lib/utils";

interface ChatAreaProps {
  messages: ChatMessageLocal[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onOpenSidebar: () => void;
  hasConversation: boolean;
  coachProfile: CoachProfile;
  coachEnvelope: CoachContextEnvelope;
  isInsightsLoading?: boolean;
}

const STARTER_STYLES = [
  {
    icon: CircleHelp,
    iconClassName: "text-primary",
    bubbleClassName: "bg-primary/10",
  },
  {
    icon: Lightbulb,
    iconClassName: "text-[#F5B942]",
    bubbleClassName: "bg-[#FFF4D9]",
  },
  {
    icon: BookOpen,
    iconClassName: "text-[#4D86F7]",
    bubbleClassName: "bg-[#EEF4FF]",
  },
  {
    icon: Target,
    iconClassName: "text-[#34C759]",
    bubbleClassName: "bg-[#EAF8EF]",
  },
  {
    icon: Sparkles,
    iconClassName: "text-[#3E78EC]",
    bubbleClassName: "bg-[#F1F6FD]",
  },
] as const;

function CoachEmptyState({
  coachProfile,
  coachEnvelope,
  onPromptSelect,
  isLoading,
}: {
  coachProfile: CoachProfile;
  coachEnvelope: CoachContextEnvelope;
  onPromptSelect: (prompt: string) => void;
  isLoading: boolean;
}) {
  const t = useTranslations("dashboard.chat");
  const subtitle =
    coachProfile.brief.nextMove ||
    coachEnvelope.focusSummary ||
    t("welcome_subtitle");

  return (
    <div className="flex flex-col items-center px-4 py-8 text-center sm:px-8 sm:py-12">
      <Image
        src="/coach/coach-pet-clean.png"
        alt="Debate Lab AI Coach"
        width={168}
        height={168}
        className="h-[132px] w-[132px] select-none object-contain sm:h-[168px] sm:w-[168px]"
        priority
      />

      <h1 className="mt-6 text-[1.8rem] font-semibold tracking-[-0.03em] text-on-surface sm:text-[2rem]">
        {t("welcome_title")}
      </h1>
      <p className="mt-2 max-w-[540px] text-[15px] leading-7 text-on-surface-variant">
        {subtitle}
      </p>

      <div className="mt-8 w-full max-w-[560px] space-y-3">
        {coachEnvelope.starterPrompts.slice(0, 5).map((prompt, index) => {
          const style = STARTER_STYLES[index % STARTER_STYLES.length];
          const Icon = style.icon;

          return (
            <button
              key={prompt}
              onClick={() => onPromptSelect(prompt)}
              disabled={isLoading}
              className="group flex w-full items-center justify-between gap-3 rounded-[18px] border border-outline-variant/16 bg-surface px-4 py-3 text-left shadow-[0_16px_32px_rgba(11,20,36,0.03)] transition-colors hover:border-primary/20 hover:bg-surface-container-low disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                    style.bubbleClassName
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px]", style.iconClassName)} />
                </div>
                <span className="truncate text-[15px] font-medium text-on-surface">
                  {prompt}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ChatArea({
  messages,
  isLoading,
  onSendMessage,
  onOpenSidebar,
  hasConversation,
  coachProfile,
  coachEnvelope,
  isInsightsLoading = false,
}: ChatAreaProps) {
  const t = useTranslations("dashboard.chat");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (text?: string) => {
    const msg = text ?? input;
    if (!msg.trim() || isLoading) return;
    onSendMessage(msg);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  };

  const showWelcome = messages.length === 0 && !hasConversation;

  return (
    <div className="relative flex min-w-0 flex-1 bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <button
          onClick={onOpenSidebar}
          className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div
          ref={scrollRef}
          className={cn(
            "flex-1 overflow-y-auto px-4 sm:px-6",
            showWelcome ? "pb-4 pt-10 sm:pb-6 sm:pt-12" : "pb-4 pt-6 sm:pb-6 sm:pt-8"
          )}
        >
          <div
            className={cn(
              "mx-auto w-full",
              showWelcome ? "max-w-[980px]" : "max-w-[860px]"
            )}
          >
            {showWelcome ? (
              <div className="flex min-h-full items-center justify-center">
                <CoachEmptyState
                  coachProfile={coachProfile}
                  coachEnvelope={coachEnvelope}
                  onPromptSelect={handleSubmit}
                  isLoading={isLoading || isInsightsLoading}
                />
              </div>
            ) : (
              <div className="space-y-4 pb-4">
                {messages.map((msg, i) => {
                  const isLastAssistant =
                    i === messages.length - 1 &&
                    msg.role === "assistant" &&
                    isLoading;
                  const isEmptyStreaming =
                    isLastAssistant && msg.content === "";

                  if (isEmptyStreaming) {
                    return <TypingIndicator key={msg.id} />;
                  }

                  return (
                    <ChatBubble
                      key={msg.id}
                      message={msg}
                      isStreaming={isLastAssistant && msg.content !== ""}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
          <div className="mx-auto w-full max-w-[760px]">
            <div className="flex items-end gap-3 rounded-[28px] border border-outline-variant/14 bg-surface px-4 py-3 shadow-[0_16px_36px_rgba(11,20,36,0.04)]">
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={t("input_placeholder")}
                rows={1}
                className="min-h-[28px] flex-1 resize-none bg-transparent px-1 py-1 text-[15px] text-on-surface placeholder:text-on-surface-variant/60 outline-none"
                style={{ maxHeight: 160 }}
              />
              <Button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-2xl bg-primary text-on-primary shadow-[0_12px_24px_rgba(77,134,247,0.28)] disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
