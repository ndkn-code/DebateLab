"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { MessageSquareText, Sparkles } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Heading, Text } from "@/components/ui/typography";
import {
  BeautifulChatFrame,
  BeautifulLoadingState,
  BeautifulPromptBar,
} from "@/components/beautifului";
import { ChatBubble } from "./chat-bubble";
import { CoachQuickActions } from "./coach-quick-actions";
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
      <Heading
        level={2}
        as="h1"
        className="max-w-[420px] text-balance font-semibold"
      >
        {t("welcome_title")}
      </Heading>

      <p className="mt-2 max-w-[390px] text-sm text-on-surface-variant">
        {t("input_placeholder")}
      </p>
      <CoachQuickActions
        variant="general"
        onSelect={onPromptSelect}
        prompts={coachEnvelope.starterPrompts}
        disabled={isLoading}
        layout="cards"
        className="mt-7"
      />
    </div>
  );
}

function ChatLoadError({ onRetryLoad }: { onRetryLoad?: () => void }) {
  const t = useTranslations("dashboard.chat");

  return (
    <div className="mx-auto flex min-h-[360px] max-w-[420px] flex-col items-center justify-center px-4 text-center">
      <Heading level={4} className="text-on-surface">
        {t("load_error_title")}
      </Heading>
      <Text variant="body-sm" className="mt-2 text-on-surface-variant">
        {t("load_error_body")}
      </Text>
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
  const t = useTranslations("dashboard.chat");
  return (
    <div className="mx-auto flex min-h-64 max-w-[720px] items-center justify-center px-1 py-4">
      <BeautifulLoadingState
        label={t("coach.refreshing_insights")}
        variant="orbit"
      />
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
  };

  const focusComposer = () => {
    window.requestAnimationFrame(() => {
      const composer = document.querySelector<HTMLTextAreaElement>(
        '[data-debate-coach-composer="true"] textarea',
      );
      composer?.focus();
    });
  };

  const handleDraftMessage = (text: string) => {
    setInput((current) => (current.length > 0 ? current : text));
    focusComposer();
  };

  const showWelcome = messages.length === 0 && !hasConversation;
  const showConversationLoading =
    isLoading && hasConversation && messages.length === 0;

  return (
    <BeautifulChatFrame
      className="relative min-w-0 flex-1 bg-transparent"
      header={
        <header className="flex min-h-14 items-center gap-3 border-b border-outline-variant bg-surface px-3 sm:px-4">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="flex size-8 items-center justify-center rounded-[10px] text-on-surface-variant transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-label={t("conversations")}
          >
            <MessageSquareText className="size-4" />
          </button>
          <span className="flex size-8 items-center justify-center rounded-[10px] bg-primary-container text-primary">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h1 className="truncate type-title font-semibold text-on-surface">
              {t("header_title")}
            </h1>
            <p className="truncate type-caption text-on-surface-variant">
              {t("header_subtitle")}
            </p>
          </div>
        </header>
      }
      composer={
        <div className="border-t border-outline-variant bg-surface-container-low/35 px-3 py-3 sm:px-6">
          <div
            className="mx-auto w-full max-w-[800px]"
            data-debate-coach-composer="true"
          >
            <BeautifulPromptBar
              value={input}
              onValueChange={setInput}
              onSubmit={handleSubmit}
              placeholder={t("input_placeholder")}
              submitLabel={t("send")}
              disabled={isLoading}
            />
          </div>
        </div>
      }
    >
      <div
        ref={scrollRef}
        className={cn(
          "h-full overflow-y-auto px-4 sm:px-6",
          showWelcome
            ? "pb-4 pt-5 sm:pb-6 sm:pt-8"
            : "pb-4 pt-6 sm:pb-6 sm:pt-8",
        )}
      >
        <div
          className={cn(
            "mx-auto w-full",
            showWelcome ? "max-w-[720px]" : "max-w-[880px]",
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
                    return (
                      <TypingIndicator
                        key={msg.id}
                        label={t("coach.refreshing_insights")}
                      />
                    );
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
    </BeautifulChatFrame>
  );
}
