"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { ProductIcon } from "@/components/ui/product-icon";
import { cn } from "@/lib/utils";
import {
  IeltsCoachAssistantMessage,
  getIeltsEvidence,
  type IeltsCoachMessage,
} from "./IeltsCoachMessage";
import { IELTS_COACH_COPY, type CoachLocale } from "./copy";
import { readIeltsCoachStream, type IeltsCoachStreamEvent } from "./stream";

export function IeltsCoachShell() {
  const currentLocale = useLocale();
  const locale: CoachLocale = currentLocale === "vi" ? "vi" : "en";
  const copy = IELTS_COACH_COPY[locale];
  const [messages, setMessages] = useState<IeltsCoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const visibleEvidence = useMemo(
    () =>
      [...messages]
        .reverse()
        .find((message) => getIeltsEvidence(message.metadata).length > 0),
    [messages],
  );

  const applyStreamEvent = useCallback(
    (assistantId: string, event: IeltsCoachStreamEvent) => {
      if (event.conversationId) {
        conversationIdRef.current = event.conversationId;
      }
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                id: event.assistantMessageId ?? message.id,
                content: `${message.content}${event.text ?? ""}`,
                metadata: event.metadata ?? message.metadata,
                status: event.done ? "complete" : "streaming",
              }
            : message,
        ),
      );
    },
    [],
  );

  const sendMessage = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || isLoading) return;
      setLastQuestion(text);
      setInput("");
      const timestamp = Date.now();
      const assistantId = `ielts-assistant-${timestamp}`;
      setMessages((current) => [
        ...current,
        {
          id: `ielts-user-${timestamp}`,
          role: "user",
          content: text,
          status: "complete",
        },
        {
          id: assistantId,
          role: "assistant",
          content: "",
          metadata: null,
          status: "streaming",
        },
      ]);
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            conversationId: conversationIdRef.current,
            context: "ielts-coach",
            contextId: null,
            practiceLanguage: locale,
            googleAiConsent: false,
          }),
        });
        await readIeltsCoachStream(response, (event) =>
          applyStreamEvent(assistantId, event),
        );
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId && message.status === "streaming"
              ? { ...message, status: "complete" }
              : message,
          ),
        );
      } catch (error) {
        console.error("IELTS coach UI request failed", error);
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? { ...message, content: "", status: "error" }
              : message,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [applyStreamEvent, isLoading, locale],
  );

  const startNewConversation = () => {
    conversationIdRef.current = null;
    setMessages([]);
    setInput("");
    setLastQuestion(null);
  };

  return (
    <main className="mx-auto grid h-full min-h-0 w-full max-w-[1440px] gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-6">
      <section className="flex min-h-[620px] min-w-0 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface shadow-token-card">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="type-eyebrow text-primary">{copy.eyebrow}</p>
            <h1 className="mt-1 type-heading-lg text-on-surface">
              {copy.title}
            </h1>
            <p className="mt-1 type-body-sm text-on-surface-variant">
              {copy.intro}
            </p>
          </div>
          {messages.length > 0 ? (
            <Button
              variant="outline"
              disabled={isLoading}
              onClick={startNewConversation}
            >
              <ProductIcon name="plus" size="sm" />
              {copy.newChat}
            </Button>
          ) : null}
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5"
          aria-label={copy.conversationLabel}
        >
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-[360px] max-w-2xl flex-col justify-center">
              <span className="flex size-11 items-center justify-center rounded-xl bg-primary-container text-primary">
                <ProductIcon name="sparkles" size="lg" weight="duotone" />
              </span>
              <h2 className="mt-4 type-heading-lg text-on-surface">
                {copy.emptyTitle}
              </h2>
              <p className="mt-2 max-w-xl type-body-sm text-on-surface-variant">
                {copy.emptyBody}
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                {copy.prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void sendMessage(prompt)}
                    className="min-h-11 rounded-[10px] border border-outline-variant bg-surface-container-low px-3 py-2.5 text-left type-label text-on-surface transition-colors hover:border-primary/40 hover:bg-primary-container focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[86%] rounded-xl bg-primary px-4 py-3 type-body-sm text-on-primary sm:max-w-[72%]">
                      {message.content}
                    </div>
                  </div>
                ) : (
                  <IeltsCoachAssistantMessage
                    key={message.id}
                    message={message}
                    locale={locale}
                  />
                ),
              )}
              {!isLoading && messages.at(-1)?.status === "error" ? (
                <Button
                  variant="outline"
                  onClick={() => lastQuestion && void sendMessage(lastQuestion)}
                >
                  <ProductIcon name="refresh" size="sm" />
                  {copy.retry}
                </Button>
              ) : null}
              {!isLoading && messages.at(-1)?.status === "complete" ? (
                <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3">
                  <p className="type-label font-semibold text-on-surface">
                    {copy.followUps}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {copy.followUpPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => void sendMessage(prompt)}
                        className="min-h-8 rounded-[10px] border border-outline-variant bg-surface px-3 py-1.5 type-caption font-medium text-on-surface transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <form
          className="border-t border-outline-variant bg-surface-container-low/50 p-3 sm:p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendMessage(input);
          }}
        >
          <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-xl border border-outline-variant bg-surface p-2 focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-ring/20">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage(input);
                }
              }}
              rows={1}
              disabled={isLoading}
              placeholder={copy.placeholder}
              aria-label={copy.placeholder}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 type-body-sm text-on-surface outline-none placeholder:text-on-surface-variant disabled:opacity-60"
            />
            <Button
              type="submit"
              size="icon-lg"
              disabled={isLoading || !input.trim()}
              aria-label={copy.send}
            >
              <ProductIcon
                name={isLoading ? "loader" : "send"}
                size="sm"
                className={cn(
                  isLoading && "animate-spin motion-reduce:animate-none",
                )}
              />
            </Button>
          </div>
          <p className="mx-auto mt-2 max-w-3xl type-caption text-on-surface-variant">
            {copy.composerHint}
          </p>
        </form>
      </section>

      <aside
        className="space-y-4 lg:overflow-y-auto"
        aria-label={copy.sourcesTitle}
      >
        <section className="rounded-xl border border-outline-variant bg-surface p-4 shadow-token-card">
          <div className="flex items-center gap-2 type-title text-on-surface">
            <ProductIcon
              name="shieldCheck"
              size="sm"
              className="text-primary"
            />
            {copy.boundaryTitle}
          </div>
          <p className="mt-2 type-body-sm text-on-surface-variant">
            {copy.boundaryBody}
          </p>
        </section>

        <section className="rounded-xl border border-outline-variant bg-surface p-4 shadow-token-card">
          <div className="flex items-center gap-2 type-title text-on-surface">
            <ProductIcon name="book" size="sm" className="text-primary" />
            {copy.sourcesTitle}
          </div>
          {visibleEvidence ? (
            <div className="mt-3 space-y-2">
              {getIeltsEvidence(visibleEvidence.metadata)
                .slice(0, 3)
                .map((item) => (
                  <div
                    key={`${item.sourceId}-${item.version}`}
                    className="rounded-[10px] bg-surface-container-low p-3"
                  >
                    <p className="type-label font-semibold capitalize text-on-surface">
                      {item.itemType.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 type-caption text-on-surface-variant">
                      {item.authorityTier ?? copy.provisional} · v{item.version}
                    </p>
                  </div>
                ))}
            </div>
          ) : (
            <p className="mt-2 type-body-sm text-on-surface-variant">
              {copy.sourcesEmpty}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-primary/25 bg-primary-container/45 p-4">
          <p className="type-eyebrow text-primary">
            {copy.practiceShortcutTitle}
          </p>
          <p className="mt-3 type-body-sm text-on-surface-variant">
            {copy.practiceShortcutBody}
          </p>
          <Link
            href={`/${locale}/ielts/tests`}
            className={buttonVariants({ className: "mt-4 w-full" })}
          >
            {copy.startPractice}
            <ProductIcon name="arrowRight" size="sm" />
          </Link>
        </section>
      </aside>
    </main>
  );
}
