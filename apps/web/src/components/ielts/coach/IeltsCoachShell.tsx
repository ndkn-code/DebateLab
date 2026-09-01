"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import {
  BeautifulChatFrame,
  BeautifulContextCards,
  BeautifulFollowUps,
  BeautifulPromptBar,
  type BeautifulContextItem,
} from "@/components/beautifului";
import { Button } from "@/components/ui/button";
import { ProductIcon } from "@/components/ui/product-icon";
import { trackAnalyticsEvent } from "@/lib/hooks/useAnalyticsEventTracker";
import type { IeltsCoachResponseMetadata } from "@/lib/coach/ielts-api-contract";
import {
  IeltsCoachAssistantMessage,
  evidenceAuthorityLabel,
  evidenceTypeLabel,
  getIeltsEvidence,
  type IeltsCoachMessage,
} from "./IeltsCoachMessage";
import { IeltsCoachHeader, IeltsCoachRecommendation } from "./IeltsCoachPanels";
import { IELTS_COACH_COPY, type CoachLocale } from "./copy";
import { buildIeltsCoachChatRequest } from "./request";
import {
  IeltsCoachStreamError,
  readIeltsCoachStream,
  type IeltsCoachStreamEvent,
} from "./stream";

const GOOGLE_AI_CONSENT_STORAGE_KEY = "debatelab_google_ai_coach_consent_v1";

export function IeltsCoachShell() {
  const currentLocale = useLocale();
  const locale: CoachLocale = currentLocale === "vi" ? "vi" : "en";
  const copy = IELTS_COACH_COPY[locale];
  const router = useRouter();
  const [messages, setMessages] = useState<IeltsCoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const conversationIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastRequestRef = useRef<{
    question: string;
    requestId: string;
  } | null>(null);

  const latestAssistant = useMemo(
    () =>
      [...messages]
        .reverse()
        .find(
          (message) =>
            message.role === "assistant" && message.status === "complete",
        ),
    [messages],
  );
  const evidence = useMemo(
    () => getIeltsEvidence(latestAssistant?.metadata),
    [latestAssistant],
  );
  const contextItems = useMemo<BeautifulContextItem[]>(
    () =>
      evidence.slice(0, 3).map((item) => ({
        id: `${item.evidenceId}-${item.version}`,
        title: evidenceTypeLabel(item.sourceType, locale),
        body: (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>{copy.sourceAuthority}</dt>
            <dd className="text-right font-medium text-on-surface">
              {evidenceAuthorityLabel(item.sourceType, locale)}
            </dd>
            <dt>{copy.sourceVersion}</dt>
            <dd className="text-right font-medium text-on-surface">
              {item.version}
            </dd>
          </dl>
        ),
        sourceLabel: item.sourceLocator,
        sourceKind: evidenceAuthorityLabel(item.sourceType, locale),
        meta: `v${item.version}`,
      })),
    [copy.sourceAuthority, copy.sourceVersion, evidence, locale],
  );

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [messages]);

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
    async (question: string, requestId = crypto.randomUUID()) => {
      const text = question.trim();
      if (!text || isLoading) return;
      let googleAiConsent = false;
      try {
        const savedConsent = window.localStorage.getItem(
          GOOGLE_AI_CONSENT_STORAGE_KEY,
        );
        const declinedThisSession =
          window.sessionStorage.getItem(GOOGLE_AI_CONSENT_STORAGE_KEY) ===
          "declined";
        if (savedConsent !== "granted" && !declinedThisSession) {
          const granted = window.confirm(copy.googleAiConsent);
          if (granted) {
            window.localStorage.setItem(
              GOOGLE_AI_CONSENT_STORAGE_KEY,
              "granted",
            );
            googleAiConsent = true;
          } else {
            window.sessionStorage.setItem(
              GOOGLE_AI_CONSENT_STORAGE_KEY,
              "declined",
            );
          }
        } else {
          googleAiConsent = savedConsent === "granted";
        }
      } catch {
        // Storage can be unavailable in privacy mode. In that case, the
        // request remains on the non-Google provider path.
      }
      lastRequestRef.current = { question: text, requestId };
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
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            buildIeltsCoachChatRequest({
              message: text,
              conversationId: conversationIdRef.current,
              requestId,
              locale,
              googleAiConsent,
            }),
          ),
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
        const errorMessage =
          error instanceof IeltsCoachStreamError ? error.message : copy.error;
        setMessages((current) =>
          current.map((message) =>
            message.id === assistantId
              ? {
                  ...message,
                  content: "",
                  status: "error",
                  errorMessage,
                }
              : message,
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [applyStreamEvent, copy.error, copy.googleAiConsent, isLoading, locale],
  );

  const startNewConversation = () => {
    conversationIdRef.current = null;
    lastRequestRef.current = null;
    setMessages([]);
    setInput("");
  };

  const trackStartedAction = useCallback(
    (metadata: IeltsCoachResponseMetadata) => {
      const { action } = metadata.coach;
      trackAnalyticsEvent({
        eventName: "ielts_ai_coach_started_task",
        featureArea: "ielts",
        route: `/${locale}/ielts/coach`,
        metadata: {
          recommendation_id: metadata.runId,
          task_id: action.resourceId,
          action_kind: action.kind,
          skill: action.skill,
          criterion: action.criterion ?? null,
          prompt_version: metadata.promptVersion,
          rubric_version: metadata.rubricVersion,
        },
      });
      try {
        window.sessionStorage.setItem(
          "ielts_coach_action_attribution_v1",
          JSON.stringify({
            version: 1,
            recommendationId: metadata.runId,
            taskId: action.resourceId,
            actionKind: action.kind,
            startedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // Attribution must never block the learner's chosen action.
      }
    },
    [locale],
  );

  const header = (
    <IeltsCoachHeader
      copy={copy}
      hasMessages={messages.length > 0}
      isLoading={isLoading}
      onNewConversation={startNewConversation}
    />
  );

  const composer = (
    <div className="border-t border-outline-variant bg-surface-container-low/45 p-3 sm:px-5 sm:py-4">
      <BeautifulPromptBar
        value={input}
        onValueChange={setInput}
        onSubmit={(value) => void sendMessage(value)}
        placeholder={copy.placeholder}
        submitLabel={copy.send}
        disabled={isLoading}
        className="mx-auto max-w-3xl"
        footer={
          <span className="px-1 type-caption text-on-surface-variant">
            {copy.composerHint}
          </span>
        }
      />
    </div>
  );

  return (
    <main className="grid h-full min-h-0 w-full gap-4 p-3 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-6">
      <BeautifulChatFrame
        header={header}
        composer={composer}
        className="min-h-[620px] rounded-xl border border-outline-variant shadow-token-card"
      >
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto px-4 py-5 sm:px-5"
          role="log"
          aria-label={copy.conversationLabel}
          aria-busy={isLoading}
        >
          {messages.length === 0 ? (
            <div className="mx-auto flex min-h-[360px] max-w-2xl flex-col justify-center">
              <span className="flex size-10 items-center justify-center rounded-[10px] bg-primary-container text-primary">
                <ProductIcon name="sparkles" size="md" weight="duotone" />
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
                    className="min-h-11 rounded-[10px] border border-outline-variant bg-surface px-3 py-2.5 text-left type-label text-on-surface transition-[border-color,background-color,transform] duration-150 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((message) =>
                message.role === "user" ? (
                  <div key={message.id} className="flex justify-end">
                    <div className="max-w-[88%] rounded-xl bg-surface-container px-4 py-2.5 type-body-sm text-on-surface sm:max-w-[72%]">
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
                  onClick={() => {
                    const request = lastRequestRef.current;
                    if (request) {
                      void sendMessage(request.question, request.requestId);
                    }
                  }}
                >
                  <ProductIcon name="refresh" size="sm" />
                  {copy.retry}
                </Button>
              ) : null}
              {!isLoading && messages.at(-1)?.status === "complete" ? (
                <BeautifulFollowUps
                  label={copy.followUps}
                  items={copy.followUpPrompts.map((prompt, index) => ({
                    id: `ielts-follow-up-${index}`,
                    label: prompt,
                    value: prompt,
                  }))}
                  onSelect={(item) => void sendMessage(item.value)}
                />
              ) : null}
            </div>
          )}
        </div>
      </BeautifulChatFrame>

      <aside
        className="space-y-3 lg:overflow-y-auto"
        aria-label={copy.sourcesTitle}
      >
        <section className="rounded-xl border border-outline-variant bg-surface p-4">
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

        {contextItems.length > 0 ? (
          <BeautifulContextCards
            label={copy.sourcesTitle}
            countLabel={`${contextItems.length}`}
            items={contextItems}
          />
        ) : (
          <section className="rounded-xl border border-dashed border-outline-variant bg-surface-container-low/35 p-4">
            <div className="flex items-center gap-2 type-title text-on-surface">
              <ProductIcon name="book" size="sm" className="text-primary" />
              {copy.sourcesTitle}
            </div>
            <p className="mt-2 type-body-sm text-on-surface-variant">
              {copy.sourcesEmpty}
            </p>
          </section>
        )}

        <IeltsCoachRecommendation
          copy={copy}
          locale={locale}
          metadata={latestAssistant?.metadata}
          disabled={isLoading}
          onAction={(destination) => {
            if (latestAssistant?.metadata) {
              trackStartedAction(latestAssistant.metadata);
            }
            if (destination.external) {
              window.location.href = destination.href;
              return;
            }
            router.push(destination.href);
          }}
        />
      </aside>
    </main>
  );
}
