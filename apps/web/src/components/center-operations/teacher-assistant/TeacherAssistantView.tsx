"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  History,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { BeautifulChatFrame } from "@/components/beautifului";
import { cn } from "@/lib/utils";
import {
  getTeacherAssistantCopy,
  type TeacherAssistantLocale,
  type TeacherAssistantStage,
} from "./copy";
import { TeacherComposer } from "./TeacherComposer";

export interface TeacherAssistantConversation {
  id: string;
  title: string;
  updatedAt: string;
  status?: string;
}

export interface TeacherAssistantViewProps {
  locale: TeacherAssistantLocale;
  organizationName: string;
  conversations: Array<TeacherAssistantConversation>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  loadingHistory: boolean;
  historyError: boolean;
  onRetryHistory: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  running: boolean;
  stopping: boolean;
  stage: string | null;
  elapsedSeconds: number;
  error: string | null;
  canRetry?: boolean;
  onRetry: () => void;
  prompts: string[];
  children: ReactNode;
  hasMessages: boolean;
}

function formatElapsed(seconds: number) {
  const minutes = Math.floor(Math.max(seconds, 0) / 60);
  const remainder = Math.max(seconds, 0) % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

function getConversationStatus(
  status: string | undefined,
  copy: ReturnType<typeof getTeacherAssistantCopy>,
) {
  if (!status) return null;
  return (
    copy.conversationStatus[status as keyof typeof copy.conversationStatus] ??
    null
  );
}

function HistoryRail({
  copy,
  locale,
  conversations,
  selectedId,
  loadingHistory,
  historyError,
  onRetryHistory,
  onSelect,
  onNew,
  onClose,
  mobile = false,
}: {
  copy: ReturnType<typeof getTeacherAssistantCopy>;
  locale: TeacherAssistantLocale;
  conversations: Array<TeacherAssistantConversation>;
  selectedId: string | null;
  loadingHistory: boolean;
  historyError: boolean;
  onRetryHistory: () => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose?: () => void;
  mobile?: boolean;
}) {
  return (
    <aside
      className={cn(
        "flex min-h-0 w-[208px] shrink-0 flex-col border-r border-outline-variant bg-surface-container-low",
        mobile &&
          "absolute inset-y-0 left-0 z-20 w-[min(86vw,280px)] shadow-token-card",
      )}
      aria-label={copy.history}
    >
      <div className="flex items-center justify-between gap-2 border-b border-outline-variant p-3">
        <span className="type-label text-on-surface">{copy.history}</span>
        {onClose ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {copy.hideHistory}
          </Button>
        ) : null}
      </div>
      <div className="p-3">
        <Button
          type="button"
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => {
            onNew();
            onClose?.();
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {copy.newConversation}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <p className="px-2 py-2 type-caption text-on-surface-variant">
          {copy.recentConversations}
        </p>
        {loadingHistory ? (
          <p
            className="px-2 py-4 type-caption text-on-surface-variant"
            aria-busy="true"
          >
            {copy.loadingHistory}
          </p>
        ) : historyError ? (
          <div className="space-y-2 px-2 py-3">
            <p className="type-caption text-error" role="alert">
              {copy.historyError}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetryHistory}
            >
              <RefreshCw className="size-3.5" aria-hidden="true" />
              {copy.retry}
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-2 py-4 type-caption text-on-surface-variant">
            {copy.emptyHistory}
          </p>
        ) : (
          <div className="space-y-1">
            {conversations.map((conversation) => {
              const selected = conversation.id === selectedId;
              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => {
                    onSelect(conversation.id);
                    onClose?.();
                  }}
                  className={cn(
                    "flex w-full min-w-0 items-start gap-2 rounded-md px-2 py-2 text-left transition-colors",
                    selected
                      ? "bg-primary-container text-primary-dim"
                      : "text-on-surface hover:bg-surface-container",
                  )}
                  aria-current={selected ? "page" : undefined}
                >
                  <MessageSquare
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 break-words">
                    <span
                      className="block line-clamp-2 break-words type-label"
                      title={conversation.title || copy.untitled}
                    >
                      {conversation.title || copy.untitled}
                    </span>
                    <span className="block truncate type-caption text-on-surface-variant">
                      {new Intl.DateTimeFormat(
                        locale === "vi" ? "vi-VN" : "en-US",
                        { month: "short", day: "numeric" },
                      ).format(new Date(conversation.updatedAt))}
                      {getConversationStatus(conversation.status, copy)
                        ? ` · ${getConversationStatus(conversation.status, copy)}`
                        : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

export function TeacherAssistantView(props: TeacherAssistantViewProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const copy = getTeacherAssistantCopy(props.locale);
  const statusLabel = props.stage
    ? (copy.status[props.stage as TeacherAssistantStage] ?? null)
    : null;
  const runningLabel = statusLabel
    ? `${statusLabel} · ${formatElapsed(props.elapsedSeconds)}`
    : null;

  useEffect(() => {
    if (!historyOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => [
      ...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [tabindex="0"]',
      ) ?? []),
    ];
    focusable()[0]?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setHistoryOpen(false);
      }
      if (event.key === "Tab") {
        const items = focusable();
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [historyOpen]);

  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript || !nearBottomRef.current) return;
    transcript.scrollTop = transcript.scrollHeight;
  }, [props.children]);

  return (
    <BeautifulChatFrame
      className="relative h-[calc(100dvh-16rem)] min-h-[420px]"
      sidebar={
        <>
          <div className="hidden lg:flex">
            <HistoryRail
              {...props}
              copy={copy}
              locale={props.locale}
              onClose={undefined}
            />
          </div>
          {historyOpen ? (
            <div
              className="absolute inset-0 z-10 bg-surface lg:hidden"
              onClick={() => setHistoryOpen(false)}
            >
              <div
                onClick={(event) => event.stopPropagation()}
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label={copy.history}
                className="relative h-full w-[min(86vw,280px)]"
              >
                <HistoryRail
                  {...props}
                  copy={copy}
                  locale={props.locale}
                  mobile
                  onClose={() => setHistoryOpen(false)}
                />
              </div>
            </div>
          ) : null}
        </>
      }
      header={
        <header className="flex min-w-0 flex-col items-start justify-between gap-2 border-b border-outline-variant bg-surface px-3 py-3 sm:flex-row sm:items-center sm:gap-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="size-4" aria-hidden="true" />
              {copy.showHistory}
            </Button>
            <div className="min-w-0">
              <h2 className="truncate type-title text-on-surface">
                {copy.assistant}
              </h2>
              <p className="truncate type-caption text-on-surface-variant">
                {copy.scopedTo} {props.organizationName}
              </p>
            </div>
          </div>
          {runningLabel ? (
            <span
              className="max-w-full type-caption text-primary sm:max-w-[45%] sm:text-right"
              aria-live="polite"
            >
              {runningLabel}
            </span>
          ) : null}
        </header>
      }
      composer={
        <TeacherComposer
          locale={props.locale}
          draft={props.draft}
          onDraftChange={props.onDraftChange}
          onSend={props.onSend}
          onStop={props.onStop}
          running={props.running}
          stopping={props.stopping}
        />
      }
    >
      <div
        ref={transcriptRef}
        className="flex h-full min-h-0 flex-col overflow-y-auto"
        onScroll={(event) => {
          const target = event.currentTarget;
          nearBottomRef.current =
            target.scrollHeight - target.scrollTop - target.clientHeight < 80;
        }}
      >
        {props.error ? (
          <div
            className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 border-b border-error bg-error-container px-3 py-2 type-body text-on-error-container sm:px-5"
            role="alert"
          >
            <span>{props.error || copy.error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!props.canRetry}
              onClick={props.onRetry}
            >
              {copy.retryRequest}
            </Button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 px-3 py-4 sm:px-5">
          <div className="mx-auto w-full max-w-3xl">{props.children}</div>
          {!props.hasMessages ? (
            <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-2 py-6 text-center">
              <Sparkles className="size-6 text-primary" aria-hidden="true" />
              <p className="mt-3 type-heading-md text-on-surface">
                {copy.noMessages}
              </p>
              <p className="mt-2 type-body text-on-surface-variant">
                {copy.suggestions}
              </p>
              <div className="mt-4 flex w-full flex-col gap-2">
                {props.prompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => props.onDraftChange(prompt)}
                    className="rounded-md border border-outline-variant bg-surface-container-low px-3 py-2 text-left type-body text-on-surface transition-colors hover:border-primary hover:bg-primary-container"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </BeautifulChatFrame>
  );
}
