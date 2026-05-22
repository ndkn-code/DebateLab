"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import useSWR from "swr";
import {
  ArrowLeft,
  ArrowRight,
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
  getLocalizedTopics,
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
  PracticeLanguage,
} from "@/types";
import {
  DuelPreviewSidebar,
  formatDifficulty,
  formatMinutes,
} from "./duel-setup-flow";

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

async function fetchTicket(url: string) {
  const response = await fetch(url, { credentials: "include" });
  const payload = (await response.json()) as TicketResponse | { error?: string };
  if (!response.ok || !("ticket" in payload)) {
    throw new Error(
      "error" in payload ? payload.error || "Failed to load queue." : "Failed to load queue."
    );
  }
  return payload.ticket;
}

function queueSecondsLeft(ticket: DebateDuelMatchmakingTicket | null) {
  if (!ticket || ticket.status !== "queued") return 0;
  return Math.max(
    0,
    Math.ceil((new Date(ticket.expiresAt).getTime() - Date.now()) / 1000)
  );
}

function formatQueueTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function DuelMatchmakingPage() {
  const router = useRouter();
  const locale = useLocale();
  const practiceLanguage = coercePracticeLanguage(locale);
  const localizedTopics = useMemo(
    () => getLocalizedTopics(practiceLanguage),
    [practiceLanguage]
  );
  const categoryOptions = useMemo(
    () =>
      getLocalizedCategoryOptions(practiceLanguage).filter(
        (category): category is { key: CategoryKey; label: string } =>
          category.key !== "all"
      ),
    [practiceLanguage]
  );
  const [topicCategoryKey, setTopicCategoryKey] =
    useState<CategoryKey>("education");
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
    localTicket?.status === "queued" || localTicket?.status === "matched"
      ? "/api/debate-duels/matchmaking/ticket"
      : null,
    fetchTicket,
    {
      refreshInterval: 2000,
      revalidateOnFocus: false,
    }
  );

  const activeTicket = polledTicket ?? localTicket;
  const isSearching = activeTicket?.status === "queued";
  const isMatched = activeTicket?.status === "matched" && !!activeTicket.shareCode;

  const previewTopic = useMemo(() => {
    return (
      localizedTopics.find(
        (topic) =>
          getTopicCategoryKey(topic) === topicCategoryKey &&
          topic.difficulty === topicDifficulty
      ) ??
      localizedTopics.find(
        (topic) => getTopicCategoryKey(topic) === topicCategoryKey
      ) ??
      localizedTopics[0]
    );
  }, [localizedTopics, topicCategoryKey, topicDifficulty]);
  const selectedCategoryLabel =
    categoryOptions.find((category) => category.key === topicCategoryKey)?.label ??
    previewTopic.category;
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
    if (!isMatched || !activeTicket?.shareCode) return;
    const timeout = window.setTimeout(() => {
      router.replace(`/debates/${activeTicket.shareCode}`);
    }, 900);
    return () => window.clearTimeout(timeout);
  }, [activeTicket?.shareCode, isMatched, router]);

  const enterQueue = () => {
    setActionError(null);
    startTransition(async () => {
      const response = await fetch("/api/debate-duels/matchmaking/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicCategoryKey,
          topicDifficulty,
          practiceLanguage,
          prepTimeSeconds,
          openingTimeSeconds,
          rebuttalTimeSeconds,
        }),
      });
      const payload = (await response.json()) as TicketResponse | { error?: string };
      if (!response.ok || !("ticket" in payload) || !payload.ticket) {
        setActionError(
          "error" in payload ? payload.error || "Failed to enter queue." : "Failed to enter queue."
        );
        return;
      }

      setLocalTicket(payload.ticket);
      setQueueRemaining(queueSecondsLeft(payload.ticket));
      await mutate(payload.ticket, { revalidate: true });
    });
  };

  const cancelQueue = () => {
    setActionError(null);
    startTransition(async () => {
      const response = await fetch("/api/debate-duels/matchmaking/ticket", {
        method: "DELETE",
      });
      const payload = (await response.json()) as TicketResponse | { error?: string };
      if (!response.ok) {
        setActionError(
          "error" in payload ? payload.error || "Failed to cancel queue." : "Failed to cancel queue."
        );
        return;
      }
      setLocalTicket(null);
      setQueueRemaining(0);
      await mutate(null, { revalidate: false });
    });
  };

  return (
    <PageTransition className="min-h-full bg-background">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div>
            <button
              type="button"
              onClick={() => router.push("/debates")}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              1v1 Debate Arena
            </button>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-on-surface">
              Find a match
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant sm:text-base">
              Queue for a human opponent. Hidden MMR helps us monitor match quality
              without showing public ranks.
            </p>
          </div>

          <div className="rounded-[24px] border border-primary/15 bg-primary/6 p-5">
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

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <main className="rounded-[30px] border border-outline-variant/15 bg-surface p-5 shadow-[0_18px_45px_rgba(11,20,66,0.06)] lg:p-6">
            {isSearching || isMatched ? (
              <div className="min-h-[560px] rounded-[28px] border border-outline-variant/12 bg-surface-container-low p-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-center">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {isMatched ? "Match found" : "Searching"}
                    </div>
                    <h2 className="mt-5 text-3xl font-bold text-on-surface">
                      {isMatched
                        ? "Opponent found. Opening room..."
                        : "Looking for a fair opponent"}
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-on-surface-variant">
                      {isMatched
                        ? "Both debaters are being moved into the ready check."
                        : "We are matching category, difficulty, timers, and hidden skill profile. Keep this page open while the queue runs."}
                    </p>
                  </div>
                  <div className="rounded-[26px] border border-outline-variant/12 bg-surface p-5 text-center">
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary/10 text-primary">
                      {isMatched ? (
                        <Users className="h-11 w-11" />
                      ) : (
                        <Loader2 className="h-11 w-11 animate-spin" />
                      )}
                    </div>
                    <div className="mt-4 text-3xl font-bold text-on-surface">
                      {isMatched ? "Ready" : formatQueueTimer(queueRemaining)}
                    </div>
                    <div className="mt-1 text-sm text-on-surface-variant">
                      {isMatched ? "Room created" : "Queue expires"}
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {[
                    ["Category", activeTicket?.topicCategory ?? selectedCategoryLabel],
                    ["Language", languageLabels[activeTicket?.practiceLanguage ?? practiceLanguage]],
                    ["Difficulty", formatDifficulty(topicDifficulty)],
                    [
                      "Format",
                      `${formatMinutes(prepTimeSeconds)} prep / ${formatMinutes(openingTimeSeconds)} open / ${formatMinutes(rebuttalTimeSeconds)} rebuttal`,
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[22px] border border-outline-variant/12 bg-surface px-4 py-4"
                    >
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                        {label}
                      </div>
                      <div className="mt-2 text-sm font-semibold text-on-surface">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                {actionError && (
                  <div className="mt-5 rounded-2xl border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
                    {actionError}
                  </div>
                )}

                <div className="mt-7 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={cancelQueue}
                    disabled={pending || isMatched}
                    className="h-12 rounded-2xl border-outline-variant/25 bg-surface text-primary"
                  >
                    Cancel queue
                  </Button>
                  <Button
                    type="button"
                    disabled
                    className="h-12 rounded-2xl text-base"
                  >
                    {isMatched ? "Opening room..." : "Searching..."}
                    {!isMatched && <Loader2 className="h-4 w-4 animate-spin" />}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <section>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                      1
                    </div>
                    <h2 className="text-xl font-bold text-on-surface">
                      Match preferences
                    </h2>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {categoryOptions.map((category) => (
                      <button
                        key={category.key}
                        type="button"
                        onClick={() => setTopicCategoryKey(category.key)}
                        className={cn(
                          "rounded-[20px] border px-4 py-4 text-left text-sm font-semibold transition-all",
                          topicCategoryKey === category.key
                            ? "border-primary bg-primary/8 text-primary"
                            : "border-outline-variant/15 bg-surface text-on-surface hover:bg-surface-container-low"
                        )}
                      >
                        {category.label}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {difficultyOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setTopicDifficulty(option.value)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
                          topicDifficulty === option.value
                            ? "border-primary bg-primary text-on-primary"
                            : "border-outline-variant/20 bg-surface text-on-surface-variant hover:bg-surface-container-low"
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

                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
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

                <section className="rounded-[24px] border border-outline-variant/12 bg-surface-container-low p-5">
                  <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_160px] md:items-center">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <SlidersHorizontal className="h-4 w-4" />
                        Match sample
                      </div>
                      <h3 className="mt-3 break-words text-xl font-bold text-on-surface">
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
                  <div className="rounded-2xl border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
                    {actionError}
                  </div>
                )}

                <Button
                  type="button"
                  onClick={enterQueue}
                  disabled={pending}
                  className="h-12 w-full rounded-2xl text-base"
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
            <div className="rounded-[24px] border border-success/20 bg-success/8 p-5">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-success" />
                <div className="font-semibold text-on-surface">
                  Monitored light fair play
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                We log tab switches, paste/shortcut events, reconnects, and speech
                quality signals. Repeated suspicious signals can exclude the match
                from hidden MMR.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
