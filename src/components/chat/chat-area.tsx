"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Menu, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatBubble } from "./chat-bubble";
import { TypingIndicator } from "./typing-indicator";
import { CoachBrief, CoachInsightsRail } from "./coach-insights-rail";
import type { ChatMessageLocal } from "./chat-shell";
import type { CoachContextEnvelope, CoachProfile } from "@/types";

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
    <div className="flex min-w-0 flex-1 bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-3 border-b border-outline-variant/12 bg-surface px-4 py-3 sm:px-5">
            <button
              onClick={onOpenSidebar}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container xl:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-on-surface">
                  {t("header_title")}
                </h2>
                <p className="text-xs text-on-surface-variant">
                  {coachEnvelope.focusTitle}
                </p>
              </div>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-5">
            <div className="mx-auto w-full max-w-5xl">
              {showWelcome ? (
                <div className="space-y-4">
                  <CoachBrief
                    profile={coachProfile}
                    envelope={coachEnvelope}
                    onPromptSelect={handleSubmit}
                  />
                  <div className="xl:hidden">
                    <CoachInsightsRail
                      profile={coachProfile}
                      envelope={coachEnvelope}
                      onPromptSelect={handleSubmit}
                      isLoading={isInsightsLoading}
                      compact
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="xl:hidden">
                    <CoachInsightsRail
                      profile={coachProfile}
                      envelope={coachEnvelope}
                      onPromptSelect={handleSubmit}
                      isLoading={isInsightsLoading}
                      compact
                    />
                  </div>
                  <div className="space-y-4">
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
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-outline-variant/12 bg-surface px-4 py-3 sm:px-5">
            <div className="mx-auto flex w-full max-w-5xl items-end gap-2.5">
              <div className="relative flex-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  placeholder={t("input_placeholder")}
                  rows={1}
                  className="w-full resize-none rounded-[22px] border border-outline-variant/16 bg-surface-container-low px-4 py-3 pr-12 text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none transition-colors focus:border-primary/35"
                  style={{ maxHeight: 160 }}
                />
              </div>
              <Button
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isLoading}
                size="icon"
                className="h-11 w-11 shrink-0 rounded-2xl bg-primary text-on-primary disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden w-[360px] shrink-0 border-l border-outline-variant/12 xl:block">
          <CoachInsightsRail
            profile={coachProfile}
            envelope={coachEnvelope}
            onPromptSelect={handleSubmit}
            isLoading={isInsightsLoading}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
