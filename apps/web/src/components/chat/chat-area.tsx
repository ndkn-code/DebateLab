"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  ChevronRight,
  MessageSquareText,
  Send,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { ChatBubble } from "./chat-bubble";
import { TypingIndicator } from "./typing-indicator";
import type { ChatMessageLocal } from "./chat-shell";
import type { CoachContextEnvelope } from "@/types";
import { cn } from "@/lib/utils";

interface ChatAreaProps {
  messages: ChatMessageLocal[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  onOpenSidebar: () => void;
  hasConversation: boolean;
  coachEnvelope: CoachContextEnvelope;
  isInsightsLoading?: boolean;
  loadError?: boolean;
  visualizingMessageId?: string | null;
  onRequestVisualize?: (messageId: string) => void;
  onRetryLoad?: () => void;
}

function CoachEmptyState({
  coachEnvelope,
  onPromptSelect,
  isLoading,
}: {
  coachEnvelope: CoachContextEnvelope;
  onPromptSelect: (prompt: string) => void;
  isLoading: boolean;
}) {
  const t = useTranslations("dashboard.chat");

  return (
    <div className="flex w-full min-w-0 max-w-[620px] flex-col items-center px-4 py-7 text-center sm:px-6 sm:py-10">
      <Image
        src="/brand/thinkfy/thinkfy-mascot-book.png"
        alt="Thinkfy AI Coach"
        width={512}
        height={654}
        className="h-24 w-24 select-none object-contain drop-shadow-[0_14px_24px_rgba(35,64,96,0.14)] sm:h-28 sm:w-28"
        priority
      />

      <h1 className="mt-5 max-w-[320px] text-balance text-[1.45rem] font-semibold leading-tight text-on-surface sm:max-w-full sm:text-[1.6rem]">
        {t("welcome_title")}
      </h1>

      <div className="mt-7 w-full min-w-0 space-y-1.5">
        {coachEnvelope.starterPrompts.slice(0, 5).map((prompt) => (
          <button
            key={prompt}
            onClick={() => onPromptSelect(prompt)}
            disabled={isLoading}
            className="group flex min-h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl border border-outline-variant/14 bg-surface px-3.5 py-2.5 text-left transition-colors hover:border-primary/22 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="min-w-0 text-[14px] font-medium leading-5 text-on-surface">
              {prompt}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant/55 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatLoadError({ onRetryLoad }: { onRetryLoad?: () => void }) {
  const t = useTranslations("dashboard.chat");

  return (
    <div className="mx-auto flex min-h-[360px] max-w-[420px] flex-col items-center justify-center px-4 text-center">
      <div className="text-base font-semibold text-on-surface">
        {t("load_error_title")}
      </div>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
        {t("load_error_body")}
      </p>
      {onRetryLoad ? (
        <Button
          type="button"
          onClick={onRetryLoad}
          className="mt-5 h-9 rounded-xl bg-primary px-4 text-sm text-on-primary"
        >
          {t("retry")}
        </Button>
      ) : null}
    </div>
  );
}

function ChatConversationLoading() {
  return (
    <div className="mx-auto max-w-[720px] space-y-4 px-1 py-4">
      <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-surface-container-high/70" />
      <div className="ml-5 space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-surface-container-high/70" />
        <div className="h-4 w-full animate-pulse rounded bg-surface-container-high/45" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-surface-container-high/45" />
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
  coachEnvelope,
  isInsightsLoading = false,
  loadError = false,
  visualizingMessageId = null,
  onRequestVisualize,
  onRetryLoad,
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

  const resizeAndFocusComposer = () => {
    window.requestAnimationFrame(() => {
      if (!inputRef.current) return;
      inputRef.current.focus();
      inputRef.current.style.height = "auto";
      inputRef.current.style.height = `${Math.min(
        inputRef.current.scrollHeight,
        160
      )}px`;
    });
  };

  const handleDraftMessage = (text: string) => {
    setInput((current) => (current.length > 0 ? current : text));
    resizeAndFocusComposer();
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
  const showConversationLoading = isLoading && hasConversation && messages.length === 0;

  return (
    <div className="relative flex min-w-0 flex-1 bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <button
          onClick={onOpenSidebar}
          className="absolute left-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container lg:hidden"
          aria-label={t("conversations")}
        >
          <MessageSquareText className="h-5 w-5" />
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
              showWelcome ? "max-w-[680px]" : "max-w-[800px]"
            )}
          >
            {loadError ? (
              <ChatLoadError onRetryLoad={onRetryLoad} />
            ) : showConversationLoading ? (
              <ChatConversationLoading />
            ) : showWelcome ? (
              <div className="flex min-h-full items-center justify-center">
                <CoachEmptyState
                  coachEnvelope={coachEnvelope}
                  onPromptSelect={handleSubmit}
                  isLoading={isLoading || isInsightsLoading}
                />
              </div>
            ) : (
              <div className="pb-4">
                <div className="space-y-5">
                  {messages.map((msg) => {
                    const isStreamingAssistant =
                      msg.role === "assistant" && msg.status === "streaming";
                    const isWaitingForFirstToken =
                      isStreamingAssistant && msg.content.length === 0;

                    if (isWaitingForFirstToken) {
                      return <TypingIndicator key={msg.id} />;
                    }

                    return (
                      <ChatBubble
                        key={msg.id}
                        message={msg}
                        isStreaming={isStreamingAssistant}
                        onSendMessage={handleSubmit}
                        onDraftMessage={handleDraftMessage}
                        actionsDisabled={isLoading || isInsightsLoading}
                        renderStructuredMetadata
                        isVisualizing={visualizingMessageId === msg.id}
                        onRequestVisualize={onRequestVisualize}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
          <div className="mx-auto w-full max-w-[720px]">
            <div className="flex items-end gap-2.5 rounded-[18px] border border-outline-variant/16 bg-surface px-3 py-2.5 shadow-[0_10px_26px_rgba(11,20,36,0.035)]">
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
                className="h-9 w-9 shrink-0 rounded-xl bg-primary text-on-primary shadow-[0_10px_18px_rgba(77,134,247,0.22)] disabled:opacity-40"
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
