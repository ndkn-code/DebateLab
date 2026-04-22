"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Send, Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CoachQuickActions,
  type CoachQuickActionVariant,
} from "./coach-quick-actions";
import { ChatBubble } from "./chat-bubble";
import { TypingIndicator } from "./typing-indicator";
import type { ChatMessageLocal } from "./chat-shell";

interface ChatAreaProps {
  messages: ChatMessageLocal[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onOpenSidebar: () => void;
  hasConversation: boolean;
  context?: string;
  contextId?: string;
}

export function ChatArea({
  messages,
  isLoading,
  onSendMessage,
  onOpenSidebar,
  hasConversation,
  context,
  contextId,
}: ChatAreaProps) {
  const t = useTranslations("dashboard.chat");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
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
    // Reset textarea height
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

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  };

  const showWelcome = messages.length === 0 && !hasConversation;

  return (
    <div className="flex flex-1 flex-col min-w-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-outline-variant/10 px-4 py-3">
        <button
          onClick={onOpenSidebar}
          className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-surface-container lg:hidden"
        >
          <Menu className="h-5 w-5 text-on-surface-variant" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-on-surface">
              {t("header_title")}
            </h2>
            <p className="text-[10px] text-on-surface-variant">
              {t("header_subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-6 sm:px-4">
        {showWelcome ? (
          <WelcomeScreen
            onPromptClick={handleSubmit}
            t={t}
            actionVariant={getCoachQuickActionVariant(context, contextId)}
          />
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
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

      {/* Input Area */}
      <div className="sticky bottom-0 border-t border-outline-variant/10 bg-surface px-3 py-3 sm:px-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={t("input_placeholder")}
              rows={1}
              className="w-full resize-none rounded-2xl border border-outline-variant/20 bg-surface-container-lowest px-4 py-3 pr-12 text-sm text-on-surface placeholder-on-surface-variant/60 outline-none transition-colors focus:border-primary/40"
              style={{ maxHeight: 160 }}
            />
          </div>
          <Button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl bg-primary text-on-primary disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function getCoachQuickActionVariant(
  context?: string,
  contextId?: string
): CoachQuickActionVariant {
  if (context === "dashboard-home") {
    return "dashboard";
  }

  if (context === "course") {
    return "course";
  }

  if (context === "practice-feedback") {
    return contextId === "speaking" ? "speaking" : "debate";
  }

  return "general";
}

function WelcomeScreen({
  onPromptClick,
  t,
  actionVariant,
}: {
  onPromptClick: (text: string) => void;
  t: ReturnType<typeof useTranslations>;
  actionVariant: CoachQuickActionVariant;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="h-8 w-8 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-bold text-on-surface">
        {t("welcome_title")}
      </h2>
      <p className="mb-8 max-w-md text-center text-sm text-on-surface-variant">
        {t("welcome_subtitle")}
      </p>
      <CoachQuickActions
        variant={actionVariant}
        onSelect={onPromptClick}
        className="max-w-2xl justify-center"
      />
    </div>
  );
}
