"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useLocale } from "next-intl";
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
  Users,
} from "@/components/ui/icons";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DurationControl } from "@/components/shared/duration-control";
import { PageTransition } from "@/components/shared/page-motion";
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
  PracticeLanguage,
} from "@/types";
import {
  DuelPreviewSidebar,
  formatDifficulty,
  formatMinutes,
} from "./duel-setup-flow";
import { DuelIllustration } from "@/components/debates/duel-illustration";

type TicketResponse = {
  ticket: DebateDuelMatchmakingTicket | null;
};

const difficultyOptions: {
  value: DebateDuelTopicDifficulty;
  label: string;
}[] = [
  { value: "beginner", label: "Easy" },
  { value: "intermediate", label: "Medium" },
  { value: "advanced", label: "Hard" },
];
const languageLabels: Record<PracticeLanguage, string> = {
  en: "English",
  vi: "Vietnamese",
};

function matchmakingError(language: PracticeLanguage, supportCode: string) {
  return language === "vi"
    ? `Không thể cập nhật hàng chờ lúc này. Vui lòng thử lại. Mã hỗ trợ: ${supportCode}`
    : `We couldn't update the queue. Try again. Support code: ${supportCode}`;
}

// Offer / auto-start an AI sparring partner after the queue runs this long with
// no human match (queue tickets last 600s, so elapsed = 600 - remaining).
const AI_BACKFILL_OFFER_SECONDS = 12;
const AI_BACKFILL_AUTO_SECONDS = 35;

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
  const practiceLanguage = coercePracticeLanguage(locale);
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
  const [pending, startTransition] = useTransition();

  const { data: polledTicket, mutate } = useSWR(
    !showcaseMode &&
      (localTicket?.status === "queued" || localTicket?.status === "matched")
      ? "/api/debate-duels/matchmaking/ticket"
      : null,
    fetchTicket,
    {
      refreshInterval: 2000,
      revalidateOnFocus: false,
    },
  );

  const activeTicket = polledTicket ?? localTicket;
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
    "Category";
  const timerControls = [
    {
      label: "Prep",
      value: prepTimeSeconds,
      setter: setPrepTimeSeconds,
      config: DUEL_PREP_DURATION,
    },
    {
      label: "Opening",
      value: openingTimeSeconds,
      setter: setOpeningTimeSeconds,
      config: DUEL_OPENING_DURATION,
    },
    {
      label: "Rebuttal",
      value: rebuttalTimeSeconds,
      setter: setRebuttalTimeSeconds,
      config: DUEL_REBUTTAL_DURATION,
    },
  ];

  useEffect(() => {
    if (!isSearching) {
      return;
    }
    const interval = window.setInterval(() => {
      setQueueRemaining(queueSecondsLeft(activeTicket));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [activeTicket, isSearching]);

  useEffect(() => {
    if (showcaseMode) return;
    if (!isMatched || !activeTicket?.shareCode) return;
    const timeout = window.setTimeout(() => {
      router.replace(`/debates/${activeTicket.shareCode}`);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [activeTicket?.shareCode, isMatched, router, showcaseMode]);

  // AI backfill: no human within the wait window -> match against the AI debater.
  const aiBackfillTriggeredRef = useRef(false);
  const triggerAiBackfill = useCallback(() => {
    if (showcaseMode || !previewTopic || aiBackfillTriggeredRef.current) return;
    aiBackfillTriggeredRef.current = true;
    startTransition(async () => {
      try {
        const response = await fetch(
          "/api/debate-duels/matchmaking/ai-backfill",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topicCategory: previewTopic.category,
              topicCategoryKey: effectiveTopicCategoryKey,
              topicKey: previewTopic.topicKey,
              topicTitle: previewTopic.title,
              topicDescription: previewTopic.context ?? "",
              topicDifficulty,
              practiceLanguage,
              prepTimeSeconds,
              openingTimeSeconds,
              rebuttalTimeSeconds,
            }),
          },
        );
        const payload = await response.json();
        if (!response.ok || !payload?.shareCode) {
          aiBackfillTriggeredRef.current = false;
          console.error("[DUEL-AI-MATCH-01] AI backfill rejected", {
            status: response.status,
            error: payload?.error,
          });
          setActionError(
            matchmakingError(practiceLanguage, "DUEL-AI-MATCH-01"),
          );
          return;
        }
        router.replace(`/debates/${payload.shareCode}`);
      } catch (error) {
        aiBackfillTriggeredRef.current = false;
        console.error("[DUEL-AI-MATCH-02] AI backfill failed", error);
        setActionError(matchmakingError(practiceLanguage, "DUEL-AI-MATCH-02"));
      }
    });
  }, [
    showcaseMode,
    previewTopic,
    effectiveTopicCategoryKey,
    topicDifficulty,
    practiceLanguage,
    prepTimeSeconds,
    openingTimeSeconds,
    rebuttalTimeSeconds,
    router,
  ]);

  useEffect(() => {
    if (
      !showcaseMode &&
      isSearching &&
      queueElapsed >= AI_BACKFILL_AUTO_SECONDS
    ) {
      triggerAiBackfill();
    }
  }, [showcaseMode, isSearching, queueElapsed, triggerAiBackfill]);

  const enterQueue = () => {
    setActionError(null);
    if (showcaseMode) {
      setActionError("Showcase mode keeps matchmaking actions disabled.");
      return;
    }

    if (!previewTopic) {
      setActionError("No active motions are available for this language yet.");
      return;
    }

    startTransition(async () => {
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
        const payload = (await response.json()) as
          | TicketResponse
          | {
              error?: string;
            };
        if (!response.ok || !("ticket" in payload) || !payload.ticket) {
          console.error("[DUEL-QUEUE-01] Queue entry rejected", {
            status: response.status,
            error: "error" in payload ? payload.error : undefined,
          });
          setActionError(matchmakingError(practiceLanguage, "DUEL-QUEUE-01"));
          return;
        }

        setLocalTicket(payload.ticket);
        setQueueRemaining(queueSecondsLeft(payload.ticket));
        await mutate(payload.ticket, { revalidate: true });
      } catch (error) {
        console.error("[DUEL-QUEUE-02] Queue entry failed", error);
        setActionError(matchmakingError(practiceLanguage, "DUEL-QUEUE-02"));
      }
    });
  };

  const cancelQueue = () => {
    setActionError(null);
    if (showcaseMode) {
      setLocalTicket(null);
      setQueueRemaining(0);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/debate-duels/matchmaking/ticket", {
          method: "DELETE",
        });
        const payload = (await response.json()) as
          | TicketResponse
          | {
              error?: string;
            };
        if (!response.ok) {
          console.error("[DUEL-QUEUE-03] Queue cancellation rejected", {
            status: response.status,
            error: "error" in payload ? payload.error : undefined,
          });
          setActionError(matchmakingError(practiceLanguage, "DUEL-QUEUE-03"));
          return;
        }
        setLocalTicket(null);
        setQueueRemaining(0);
        await mutate(null, { revalidate: false });
      } catch (error) {
        console.error("[DUEL-QUEUE-04] Queue cancellation failed", error);
        setActionError(matchmakingError(practiceLanguage, "DUEL-QUEUE-04"));
      }
    });
  };

  if (!previewTopic) {
    return (
      <PageTransition className="min-h-full bg-background">
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="rounded-[10px] border border-outline-variant/20 bg-surface p-6">
            <h1 className="type-heading-lg text-on-surface">
              No active motions available
            </h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              No motion is ready for this language. Choose another language or
              return to the arena.
            </p>
            <Button
              type="button"
              onClick={() => router.push("/debates")}
              className="mt-5 h-8 rounded-[10px]"
            >
              Back to arena
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <button
              type="button"
              onClick={() => router.push("/debates")}
              className="inline-flex h-8 items-center gap-2 rounded-[10px] px-2 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              1v1 Debate Arena
            </button>
            <h1 className="mt-2 type-heading-lg text-on-surface">
              Find a match
            </h1>
            <p className="mt-1 text-sm text-on-surface-variant">
              Queue for a human opponent. Hidden MMR helps us monitor match
              quality without showing public ranks.
            </p>
          </div>

          <div className="rounded-[10px] border border-primary/15 bg-primary/6 p-3">
            <div className="flex items-center gap-3">
              <Radar className="h-6 w-6 text-primary" />
              <div>
                <div className="font-semibold text-on-surface">
                  Beta matchmaking
                </div>
                <div className="text-sm text-on-surface-variant">
                  Human-only queue. Wait or cancel anytime.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="rounded-[12px] border border-outline-variant/15 bg-surface p-4 shadow-none">
            {isSearching || isMatched ? (
              <div className="min-h-[360px] rounded-[10px] border border-outline-variant/12 bg-surface-container-low p-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-center">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 type-eyebrow text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {isMatched ? "Match found" : "Searching"}
                    </div>
                    <h2 className="mt-3 type-heading-lg text-on-surface">
                      {isMatched
                        ? "Opponent found. Opening room..."
                        : "Looking for a fair opponent"}
                    </h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-on-surface-variant">
                      {isMatched
                        ? "Both debaters are being moved into the ready check."
                        : "We are matching category, difficulty, timers, and hidden skill profile. Keep this page open while the queue runs."}
                    </p>
                  </div>
                  <div className="rounded-[10px] border border-outline-variant/12 bg-surface p-3 text-center">
                    {isMatched ? (
                      <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Users className="h-11 w-11" />
                      </div>
                    ) : (
                      <DuelIllustration
                        name="thinkfy_duel_matchmaking_v1"
                        alt="Searching for an opponent"
                        className="mx-auto h-28 w-28"
                      />
                    )}
                    <div className="mt-4 text-3xl font-bold text-on-surface">
                      {isMatched ? "Ready" : formatQueueTimer(queueRemaining)}
                    </div>
                    <div className="mt-1 text-sm text-on-surface-variant">
                      {isMatched ? "Room created" : "Queue expires"}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    [
                      "Category",
                      activeTicket?.topicCategory ?? selectedCategoryLabel,
                    ],
                    [
                      "Language",
                      languageLabels[
                        activeTicket?.practiceLanguage ?? practiceLanguage
                      ],
                    ],
                    ["Difficulty", formatDifficulty(topicDifficulty)],
                    [
                      "Format",
                      `${formatMinutes(prepTimeSeconds)} prep / ${formatMinutes(openingTimeSeconds)} open / ${formatMinutes(rebuttalTimeSeconds)} rebuttal`,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[10px] border border-outline-variant/12 bg-surface px-3 py-2"
                    >
                      <div className="type-eyebrow text-on-surface-variant">
                        {label}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-on-surface">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {actionError && (
                  <div className="mt-5 rounded-[10px] border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
                    {actionError}
                  </div>
                )}

                <div className="mt-7 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelQueue}
                    disabled={pending || isMatched}
                    className="h-8 rounded-[10px] border-outline-variant/25 bg-surface text-primary"
                  >
                    Cancel queue
                  </Button>
                  <Button
                    type="button"
                    disabled
                    className="h-8 rounded-[10px] text-base"
                  >
                    {isMatched ? "Opening room..." : "Searching..."}
                    {!isMatched && <Loader2 className="h-4 w-4 animate-spin" />}
                  </Button>
                </div>

                {isSearching && queueElapsed >= AI_BACKFILL_OFFER_SECONDS && (
                  <button
                    type="button"
                    onClick={triggerAiBackfill}
                    disabled={pending}
                    className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-primary/25 bg-primary/6 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60"
                  >
                    <Bot className="h-4 w-4" />
                    No humans yet — practice against an AI sparring partner
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
                      Match preferences
                    </h2>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {categoryOptions.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setTopicCategoryKey(category.key)}
                        className={cn(
                          "min-h-10 rounded-[10px] border px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          effectiveTopicCategoryKey === category.key
                            ? "border-primary bg-primary/8 text-primary"
                            : "border-outline-variant/15 bg-surface text-on-surface hover:bg-surface-container-low",
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
                        className={cn(
                          "h-8 rounded-[10px] border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                          topicDifficulty === option.value
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline-variant/20 bg-surface text-on-surface-variant hover:bg-surface-container-low",
                        )}
                      >
                        {option.label}
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
                      Timer preset
                    </h2>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    {timerControls.map(({ label, value, setter, config }) => (
                      <DurationControl
                        key={label}
                        label={`${label} time`}
                        icon={<Clock3 className="h-4 w-4" />}
                        value={value}
                        config={config}
                        onChange={setter}
                        compact
                      />
                    ))}
                  </div>
                </section>

                <section className="rounded-[10px] border border-outline-variant/12 bg-surface-container-low p-4">
                  <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_160px] md:items-center">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <SlidersHorizontal className="h-4 w-4" />
                        Match sample
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

                {actionError && (
                  <div className="rounded-[10px] border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
                    {actionError}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={enterQueue}
                  disabled={pending}
                  className="h-8 w-full rounded-[10px] text-base"
                >
                  {pending ? "Entering queue..." : "Find opponent"}
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
            <div className="rounded-[10px] border border-success/20 bg-success/8 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-success" />
                <div className="font-semibold text-on-surface">
                  Monitored light fair play
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                We log tab switches, paste/shortcut events, reconnects, and
                speech quality signals. Repeated suspicious signals can exclude
                the match from hidden MMR.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
