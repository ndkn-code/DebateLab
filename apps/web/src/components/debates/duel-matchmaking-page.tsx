"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Clock3,
  Loader2,
  Radar,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from "@/components/ui/icons";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DurationControl } from "@/components/shared/duration-control";
import { PageTransition } from "@/components/shared/page-motion";
import { PageContainer } from "@/components/shared/product-layout";
import {
  getLocalizedCategoryOptions,
  getTopicCategoryKey,
  type CategoryKey,
} from "@/lib/topics";
import { coercePracticeLanguage } from "@/lib/practice-language";
import {
  DUEL_OPENING_DURATION,
  DUEL_PREP_DURATION,
  DUEL_REBUTTAL_DURATION,
} from "@/lib/practice-durations";
import { cn } from "@/lib/utils";
import type {
  DebateDuelMatchmakingTicket,
  DebateDuelTopicDifficulty,
  DebateTopic,
} from "@/types";
import { DuelPreviewSidebar } from "./duel-setup-flow";
import { createMatchmakingRequestGuard } from "@/lib/debate-duels/matchmaking-client-state";

type TicketResponse = {
  ticket: DebateDuelMatchmakingTicket | null;
};

const difficultyOptions: {
  value: DebateDuelTopicDifficulty;
  label: "easy" | "medium" | "hard";
}[] = [
  { value: "beginner", label: "easy" },
  { value: "intermediate", label: "medium" },
  { value: "advanced", label: "hard" },
];

const AI_BACKFILL_OFFER_SECONDS = 12;

async function fetchTicket(url: string) {
  const response = await fetch(url, { credentials: "include" });
  const payload = (await response.json()) as
    | TicketResponse
    | { error?: string };
  if (!response.ok || !("ticket" in payload)) {
    throw new Error(
      "error" in payload
        ? payload.error || "Failed to load queue."
        : "Failed to load queue.",
    );
  }
  return payload.ticket;
}

function queueSecondsLeft(ticket: DebateDuelMatchmakingTicket | null) {
  if (!ticket || ticket.status !== "queued") return 0;
  return Math.max(
    0,
    Math.ceil((new Date(ticket.expiresAt).getTime() - Date.now()) / 1000),
  );
}

function formatQueueTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function DuelMatchmakingPage({
  initialTopics,
  showcaseMode = false,
}: {
  initialTopics: DebateTopic[];
  showcaseMode?: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("duelMatchmaking");
  const practiceLanguage = coercePracticeLanguage(locale);
  const formatMinutes = (seconds: number) =>
    t("minutes", { count: seconds / 60 });
  const localizedTopics = useMemo(() => initialTopics, [initialTopics]);
  const categoryOptions = useMemo(
    () =>
      getLocalizedCategoryOptions(practiceLanguage).filter(
        (category): category is { key: CategoryKey; label: string } =>
          category.key !== "all" &&
          localizedTopics.some(
            (topic) => getTopicCategoryKey(topic) === category.key,
          ),
      ),
    [localizedTopics, practiceLanguage],
  );
  const defaultCategoryKey = categoryOptions[0]?.key ?? "education";
  const [topicCategoryKey, setTopicCategoryKey] =
    useState<CategoryKey>(defaultCategoryKey);
  const effectiveTopicCategoryKey = categoryOptions.some(
    (category) => category.key === topicCategoryKey,
  )
    ? topicCategoryKey
    : defaultCategoryKey;
  const [topicDifficulty, setTopicDifficulty] =
    useState<DebateDuelTopicDifficulty>("beginner");
  const [prepTimeSeconds, setPrepTimeSeconds] = useState(120);
  const [openingTimeSeconds, setOpeningTimeSeconds] = useState(180);
  const [rebuttalTimeSeconds, setRebuttalTimeSeconds] = useState(120);
  const [localTicket, setLocalTicket] =
    useState<DebateDuelMatchmakingTicket | null>(null);
  const [queueRemaining, setQueueRemaining] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [recoveryShareCode, setRecoveryShareCode] = useState<string | null>(
    null,
  );
  const [operation, setOperation] = useState<
    "idle" | "entry" | "ai" | "cancel" | "cancel-failed"
  >("idle");
  const operationRef = useRef(operation);
  const requestGuardRef = useRef(createMatchmakingRequestGuard());
  const ticketRef = useRef<DebateDuelMatchmakingTicket | null>(null);
  const cancellationRequestedRef = useRef(false);
  const mountedRef = useRef(true);
  const setOperationState = (next: typeof operation) => {
    operationRef.current = next;
    setOperation(next);
  };
  const isCancellationPending = () => operationRef.current === "cancel";
  const pending =
    operation === "entry" || operation === "ai" || operation === "cancel";

  const { data: polledTicket, error: pollError } = useSWR(
    !showcaseMode &&
      operation === "idle" &&
      !cancellationRequestedRef.current &&
      localTicket?.id &&
      (localTicket?.status === "queued" || localTicket?.status === "matched")
      ? ["/api/debate-duels/matchmaking/ticket", localTicket.id]
      : null,
    async ([url, ticketId]) => {
      const request = requestGuardRef.current.begin("poll");
      const result = await fetchTicket(url);
      return requestGuardRef.current.isCurrent(request) &&
        result?.id === ticketId
        ? result
        : null;
    },
    {
      refreshInterval: 2000,
      revalidateOnFocus: false,
    },
  );

  const activeTicket =
    polledTicket?.id === localTicket?.id ? polledTicket : localTicket;
  const isSearching = activeTicket?.status === "queued";
  const isMatched =
    activeTicket?.status === "matched" && !!activeTicket.shareCode;
  const queueElapsed = Math.max(0, 600 - queueRemaining);

  const previewTopic = useMemo(() => {
    return (
      localizedTopics.find(
        (topic) =>
          getTopicCategoryKey(topic) === effectiveTopicCategoryKey &&
          topic.difficulty === topicDifficulty,
      ) ??
      localizedTopics.find(
        (topic) => getTopicCategoryKey(topic) === effectiveTopicCategoryKey,
      ) ??
      localizedTopics[0] ??
      null
    );
  }, [effectiveTopicCategoryKey, localizedTopics, topicDifficulty]);
  const selectedCategoryLabel =
    categoryOptions.find(
      (category) => category.key === effectiveTopicCategoryKey,
    )?.label ??
    previewTopic?.category ??
    t("category");
  const timerControls = [
    {
      label: t("prepLabel"),
      value: prepTimeSeconds,
      setter: setPrepTimeSeconds,
      config: DUEL_PREP_DURATION,
    },
    {
      label: t("openingLabel"),
      value: openingTimeSeconds,
      setter: setOpeningTimeSeconds,
      config: DUEL_OPENING_DURATION,
    },
    {
      label: t("rebuttalLabel"),
      value: rebuttalTimeSeconds,
      setter: setRebuttalTimeSeconds,
      config: DUEL_REBUTTAL_DURATION,
    },
  ];

  useEffect(() => {
    const guard = requestGuardRef.current;
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      guard.invalidate();
      const ticket = ticketRef.current;
      if (ticket)
        void fetch(
          `/api/debate-duels/matchmaking/ticket?id=${encodeURIComponent(ticket.id)}`,
          { method: "DELETE", keepalive: true },
        ).catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!isSearching) return;
    const interval = window.setInterval(() => {
      const remaining = queueSecondsLeft(activeTicket);
      setQueueRemaining(remaining);
      if (remaining === 0 && operationRef.current === "idle") {
        requestGuardRef.current.invalidate();
        ticketRef.current = null;
        setLocalTicket(null);
        setActionError(t("queueExpired"));
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTicket, isSearching, t]);

  useEffect(() => {
    if (
      showcaseMode ||
      !isMatched ||
      !activeTicket?.shareCode ||
      operation !== "idle" ||
      cancellationRequestedRef.current
    )
      return;
    const request = requestGuardRef.current.begin("poll");
    const timeout = window.setTimeout(() => {
      if (
        !requestGuardRef.current.isCurrent(request) ||
        cancellationRequestedRef.current
      )
        return;
      ticketRef.current = null;
      requestGuardRef.current.invalidate();
      router.replace(`/debates/${activeTicket.shareCode}`);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [activeTicket?.shareCode, isMatched, router, showcaseMode, operation]);

  const leaveArena = () => {
    cancellationRequestedRef.current = true;
    requestGuardRef.current.invalidate();
    router.push("/debates");
  };

  const triggerAiBackfill = async () => {
    const ticket = activeTicket;
    if (
      showcaseMode ||
      !previewTopic ||
      ticket?.status !== "queued" ||
      operationRef.current !== "idle" ||
      cancellationRequestedRef.current
    )
      return;
    const request = requestGuardRef.current.begin("ai");
    setActionError(null);
    setOperationState("ai");
    try {
      const response = await fetch(
        "/api/debate-duels/matchmaking/ai-backfill",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            opponent: "ai",
            ticketId: ticket.id,
            consent: true,
            topicCategory: previewTopic.category,
            topicCategoryKey: effectiveTopicCategoryKey,
            topicKey: previewTopic.topicKey,
            topicTitle: previewTopic.title,
            topicDescription: previewTopic.context ?? "",
            topicDifficulty,
            practiceLanguage: ticket.practiceLanguage,
            prepTimeSeconds: ticket.config.prepTimeSeconds,
            openingTimeSeconds: ticket.config.openingTimeSeconds,
            rebuttalTimeSeconds: ticket.config.rebuttalTimeSeconds,
          }),
        },
      );
      const payload = await response.json();
      if (!requestGuardRef.current.isCurrent(request)) return;
      if (!response.ok || !payload?.shareCode) {
        setActionError(t("errors.aiStart", { code: "DUEL-AI-MATCH-01" }));
        return;
      }
      ticketRef.current = null;
      requestGuardRef.current.invalidate();
      router.replace(`/debates/${payload.shareCode}`);
    } catch {
      if (requestGuardRef.current.isCurrent(request))
        setActionError(t("errors.aiStart", { code: "DUEL-AI-MATCH-02" }));
    } finally {
      if (requestGuardRef.current.isCurrent(request)) setOperationState("idle");
    }
  };

  const enterQueue = async () => {
    if (operationRef.current !== "idle" || ticketRef.current) return;
    setActionError(null);
    if (showcaseMode || !previewTopic) {
      setActionError(t(showcaseMode ? "showcaseDisabled" : "noMotionsError"));
      return;
    }
    cancellationRequestedRef.current = false;
    setRecoveryShareCode(null);
    const request = requestGuardRef.current.begin("entry");
    setOperationState("entry");
    try {
      const response = await fetch("/api/debate-duels/matchmaking/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicCategoryKey: effectiveTopicCategoryKey,
          topicDifficulty,
          practiceLanguage,
          prepTimeSeconds,
          openingTimeSeconds,
          rebuttalTimeSeconds,
        }),
      });
      const payload = (await response.json()) as TicketResponse;
      if (!requestGuardRef.current.isCurrent(request)) {
        // A POST may commit after leaving. Cancel that specific returned ticket,
        // never a newer queue attempt belonging to this account.
        if (payload.ticket?.id) {
          const cancelled = await fetch(
            `/api/debate-duels/matchmaking/ticket?id=${encodeURIComponent(payload.ticket.id)}`,
            { method: "DELETE", keepalive: true },
          ).catch(() => null);
          if (mountedRef.current && isCancellationPending()) {
            if (cancelled?.ok) {
              const result = (await cancelled.json()) as TicketResponse;
              setRecoveryShareCode(result.ticket?.shareCode ?? null);
              setOperationState("idle");
            } else {
              ticketRef.current = payload.ticket;
              setLocalTicket(payload.ticket);
              setOperationState("cancel-failed");
              setActionError(
                t("errors.queueUpdate", { code: "DUEL-QUEUE-03" }),
              );
            }
          }
        } else if (mountedRef.current && isCancellationPending())
          setOperationState("idle");
        return;
      }
      if (!response.ok || !payload.ticket) {
        setActionError(t("errors.queueUpdate", { code: "DUEL-QUEUE-01" }));
        setOperationState("idle");
        return;
      }
      setOperationState("idle");
      requestGuardRef.current.activateTicket(payload.ticket.id);
      ticketRef.current = payload.ticket;
      setLocalTicket(payload.ticket);
      setQueueRemaining(queueSecondsLeft(payload.ticket));
    } catch {
      if (
        requestGuardRef.current.isCurrent(request) ||
        (mountedRef.current && isCancellationPending())
      ) {
        setActionError(t("errors.queueUpdate", { code: "DUEL-QUEUE-02" }));
        setOperationState("idle");
      }
    }
  };

  const cancelQueue = async () => {
    if (operationRef.current === "cancel") return;
    cancellationRequestedRef.current = true;
    requestGuardRef.current.invalidate();
    const request = requestGuardRef.current.begin("cancel");
    const ticket = ticketRef.current;
    setActionError(null);
    setOperationState("cancel");
    if (!ticket) {
      // An in-flight entry response cleans up its own ticket when it arrives.
      setLocalTicket(null);
      return;
    }
    try {
      const response = await fetch(
        `/api/debate-duels/matchmaking/ticket?id=${encodeURIComponent(ticket.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as TicketResponse;
      if (!requestGuardRef.current.isCurrent(request)) return;
      if (!response.ok) throw new Error("cancel failed");
      setRecoveryShareCode(payload.ticket?.shareCode ?? null);
      ticketRef.current = null;
      setLocalTicket(null);
      setQueueRemaining(0);
      setOperationState("idle");
    } catch {
      if (requestGuardRef.current.isCurrent(request)) {
        setActionError(t("errors.queueUpdate", { code: "DUEL-QUEUE-03" }));
        setOperationState("cancel-failed");
      }
    }
  };

  if (!previewTopic) {
    return (
      <PageTransition className="min-h-full bg-background">
        <PageContainer size="focused" className="py-16 text-center">
          <div className="rounded-control border border-outline-variant bg-surface p-6">
            <h1 className="type-heading-lg text-on-surface">
              {t("noMotionsTitle")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              {t("noMotionsBody")}
            </p>
            <Button
              type="button"
              onClick={leaveArena}
              className="mt-5 h-8 rounded-control"
            >
              {t("backToArena")}
            </Button>
          </div>
        </PageContainer>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-full bg-background">
      <PageContainer size="wide">
        <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <button
              type="button"
              onClick={leaveArena}
              className="inline-flex h-8 items-center gap-2 rounded-control px-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("back")}
            </button>
            <h1 className="mt-2 type-heading-lg text-on-surface">
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t("description")}
            </p>
          </div>

          <div className="rounded-control border border-primary bg-primary-container p-3">
            <div className="flex items-center gap-3">
              <Radar className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold text-on-surface">
                  {t("betaTitle")}
                </div>
                <div className="text-sm text-on-surface-variant">
                  {t("betaDescription")}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="rounded-control border border-outline-variant bg-surface p-4 shadow-none">
            {recoveryShareCode && (
              <div className="mt-5 rounded-control border border-info bg-info-container px-4 py-3 text-sm text-on-surface">
                <p>{t("roomCreatedDuringCancel")}</p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3 h-8 rounded-control"
                  onClick={() => router.push(`/debates/${recoveryShareCode}`)}
                >
                  {t("openRoom")}
                </Button>
              </div>
            )}
            {isSearching || isMatched ? (
              <div className="min-h-[360px] rounded-control border border-outline-variant bg-surface-container-low p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px] sm:items-start">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary-container px-3 py-1 type-eyebrow text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {isMatched ? t("matchFound") : t("searching")}
                    </div>
                    <h2 className="mt-3 type-heading-lg text-on-surface">
                      {operation === "ai"
                        ? t("aiStarting")
                        : cancellationRequestedRef.current
                          ? t("cancelStatus")
                          : isMatched
                            ? t("openingRoom")
                            : t("lookingForOpponent")}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                      {isMatched
                        ? t("matchedDescription")
                        : t("searchDescription")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-control bg-surface p-3 sm:block sm:text-center">
                    <div className="type-title text-on-surface">
                      {isMatched
                        ? t("ready")
                        : formatQueueTimer(queueRemaining)}
                    </div>
                    <div className="mt-1 text-sm text-on-surface-variant">
                      {isMatched ? t("roomCreated") : t("queueExpires")}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-x-4 sm:grid-cols-2">
                  {[
                    [t("category"), selectedCategoryLabel],
                    [
                      t("language"),
                      (activeTicket?.practiceLanguage ?? practiceLanguage) ===
                      "vi"
                        ? t("vietnamese")
                        : t("english"),
                    ],
                    [t("difficulty"), t(topicDifficulty)],
                    [
                      t("format"),
                      `${formatMinutes(prepTimeSeconds)} ${t("prep")} / ${formatMinutes(openingTimeSeconds)} ${t("opening")} / ${formatMinutes(rebuttalTimeSeconds)} ${t("rebuttal")}`,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex min-w-0 items-start justify-between gap-3 border-b border-outline-variant py-2"
                    >
                      <div className="shrink-0 type-caption text-on-surface-variant">
                        {label}
                      </div>
                      <div className="text-right type-body text-on-surface">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {(actionError || pollError) && (
                  <div className="mt-5 rounded-control border border-error bg-error-container px-4 py-3 text-sm text-error">
                    {actionError ??
                      t("errors.queueUpdate", { code: "DUEL-QUEUE-POLL" })}
                  </div>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelQueue}
                    disabled={operation === "cancel"}
                    className="h-8 rounded-control border-outline-variant bg-surface text-primary"
                  >
                    {operation === "cancel"
                      ? t("cancelling")
                      : t("cancelQueue")}
                  </Button>
                  <div
                    role="status"
                    className="flex items-center gap-2 type-caption text-on-surface-variant"
                  >
                    {operation === "ai"
                      ? t("aiStarting")
                      : operation === "cancel"
                        ? t("cancelling")
                        : operation === "cancel-failed"
                          ? t("cancelFailed")
                          : isMatched
                            ? t("openingButton")
                            : t("searchingButton")}
                    {!isMatched && operation !== "cancel-failed" && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                </div>

                {isSearching &&
                  !cancellationRequestedRef.current &&
                  queueElapsed >= AI_BACKFILL_OFFER_SECONDS && (
                    <button
                      type="button"
                      onClick={triggerAiBackfill}
                      disabled={pending}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-control border border-primary bg-primary-container px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary-container disabled:opacity-60"
                    >
                      <Bot className="h-4 w-4" />
                      {operation === "ai" ? t("aiStarting") : t("aiOffer")}
                    </button>
                  )}
              </div>
            ) : (
              <div className="space-y-5">
                <section>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                      1
                    </div>
                    <h2 className="text-xl font-bold text-on-surface">
                      {t("matchPreferences")}
                    </h2>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {categoryOptions.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setTopicCategoryKey(category.key)}
                        disabled={pending}
                        className={cn(
                          "min-h-10 rounded-control border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          effectiveTopicCategoryKey === category.key
                            ? "border-primary bg-primary-container text-primary"
                            : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container-low",
                        )}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {difficultyOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTopicDifficulty(option.value)}
                        disabled={pending}
                        className={cn(
                          "h-8 rounded-control border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          topicDifficulty === option.value
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low",
                        )}
                      >
                        {t(option.label)}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                      2
                    </div>
                    <h2 className="text-xl font-bold text-on-surface">
                      {t("timerPreset")}
                    </h2>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    {timerControls.map(({ label, value, setter, config }) => (
                      <DurationControl
                        key={label}
                        label={t("timeLabel", { label })}
                        icon={<Clock3 className="h-4 w-4" />}
                        value={value}
                        config={config}
                        onChange={(value) => {
                          if (!pending) setter(value);
                        }}
                        disabled={pending}
                        labels={{
                          decrease: t("decreaseTime", { label }),
                          increase: t("increaseTime", { label }),
                          minutes: t("minuteUnit"),
                          minuteShort: t("minuteUnit"),
                          preset: formatMinutes,
                        }}
                        compact
                      />
                    ))}
                  </div>
                </section>

                <section className="rounded-control border border-outline-variant bg-surface-container-low p-4">
                  <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_160px] md:items-center">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <SlidersHorizontal className="h-4 w-4" />
                        {t("matchSample")}
                      </div>
                      <h3 className="mt-2 break-words type-heading-md text-on-surface">
                        {previewTopic.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                        {previewTopic.context}
                      </p>
                    </div>
                    <Image
                      src="/images/debates/topic-backpack.png"
                      width={160}
                      height={160}
                      alt=""
                      className="mx-auto h-32 w-32 object-contain"
                    />
                  </div>
                </section>

                {(actionError || pollError) && (
                  <div className="rounded-control border border-error bg-error-container px-4 py-3 text-sm text-error">
                    {actionError ??
                      t("errors.queueUpdate", { code: "DUEL-QUEUE-POLL" })}
                  </div>
                )}

                {(operation === "entry" || operation === "cancel") && (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={operation === "cancel"}
                    onClick={cancelQueue}
                  >
                    {operation === "cancel"
                      ? t("cancelling")
                      : t("cancelQueue")}
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={enterQueue}
                  disabled={pending}
                  className="h-8 w-full rounded-control text-base"
                >
                  {pending ? t("enteringQueue") : t("findOpponent")}
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </main>

          <div className="space-y-4">
            <DuelPreviewSidebar
              topicTitle={previewTopic.title}
              topicCategory={selectedCategoryLabel}
              prepTimeSeconds={prepTimeSeconds}
              openingTimeSeconds={openingTimeSeconds}
              rebuttalTimeSeconds={rebuttalTimeSeconds}
            />
            <div className="rounded-control border border-success bg-success-container p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-success" />
                <div className="font-semibold text-on-surface">
                  {t("fairPlayTitle")}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                {t("fairPlayBody")}
              </p>
            </div>
          </div>
        </div>
      </PageContainer>
    </PageTransition>
  );
}
