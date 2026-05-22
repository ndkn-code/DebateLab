"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clock3,
  Mail,
  Scale,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Users,
} from "@/components/ui/icons";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { DurationControl } from "@/components/shared/duration-control";
import { PageTransition } from "@/components/shared/page-motion";
import { useDebateDuelRoom } from "@/hooks/use-debate-duel-room";
import {
  getLocalizedCategoryOptions,
  getTopicCategoryKey,
  getTopicStableKey,
  type CategoryFilterKey,
} from "@/lib/topics";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { DUEL_ENTRY_COST } from "@/lib/debate-duels/shared";
import {
  DUEL_OPENING_DURATION,
  DUEL_PREP_DURATION,
  DUEL_REBUTTAL_DURATION,
} from "@/lib/practice-durations";
import { cn } from "@/lib/utils";
import type {
  DebateDuelRoomView,
  DebateDuelTopicDifficulty,
  DebateTopic,
} from "@/types";
import {
  DuelFlowStepper,
  DuelLobbySetupView,
  DuelPreviewSidebar,
  formatDifficulty,
} from "./duel-setup-flow";

interface DuelCreatePageProps {
  initialTopics: DebateTopic[];
  initialTopicTitle?: string;
  initialRoomShareCode?: string;
}

type DifficultyFilter = "all" | DebateDuelTopicDifficulty;

const difficultyOptions: { value: DifficultyFilter; label: string }[] = [
  { value: "all", label: "Difficulty" },
  { value: "beginner", label: "Easy" },
  { value: "intermediate", label: "Medium" },
  { value: "advanced", label: "Hard" },
];

function difficultyTone(difficulty: DebateDuelTopicDifficulty) {
  if (difficulty === "beginner") return "bg-[#edf8ef] text-[#4aa05f]";
  if (difficulty === "intermediate") return "bg-[#fff6e8] text-[#da9b2d]";
  return "bg-[#fff0f0] text-[#dd666b]";
}

function shortCategoryLabel(category: string) {
  if (category === "Technology & Social Media") return "Technology";
  if (category === "Society & Culture") return "Society";
  if (category === "Education & School Life") return "Education";
  if (category === "Environment & Sustainability") return "Environment";
  return category;
}

export function DuelCreatePage({
  initialTopics,
  initialTopicTitle,
  initialRoomShareCode,
}: DuelCreatePageProps) {
  const router = useRouter();
  const locale = useLocale();
  const practiceLanguage = coercePracticeLanguage(locale);
  const localizedTopics = useMemo(
    () => initialTopics,
    [initialTopics]
  );
  const categoryFilters = useMemo(
    () => getLocalizedCategoryOptions(practiceLanguage),
    [practiceLanguage]
  );
  const initialTopic =
    localizedTopics.find((topic) => topic.title === initialTopicTitle) ??
    localizedTopics[0];
  const [activeRoomCode, setActiveRoomCode] = useState(
    initialRoomShareCode?.trim().toUpperCase() || null
  );
  const [topicId, setTopicId] = useState(initialTopic?.id ?? "");
  const [categoryFilter, setCategoryFilter] =
    useState<CategoryFilterKey>("all");
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilter>("all");
  const [prepTimeSeconds, setPrepTimeSeconds] = useState(120);
  const [openingTimeSeconds, setOpeningTimeSeconds] = useState(180);
  const [rebuttalTimeSeconds, setRebuttalTimeSeconds] = useState(120);
  const [sideAssignmentMode, setSideAssignmentMode] = useState<
    "random" | "choose"
  >("random");
  const [creatorSidePreference, setCreatorSidePreference] = useState<
    "proposition" | "opposition"
  >("proposition");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    data: activeRoom,
    error: roomError,
    isLoading: roomLoading,
    mutate,
  } = useDebateDuelRoom(activeRoomCode);

  const selectedTopic = useMemo(
    () =>
      localizedTopics.find((topic) => topic.id === topicId) ??
      localizedTopics[0] ??
      null,
    [localizedTopics, topicId]
  );

  const filteredTopics = useMemo(() => {
    const matches = localizedTopics.filter((topic) => {
      const categoryMatches =
        categoryFilter === "all" || getTopicCategoryKey(topic) === categoryFilter;
      const difficultyMatches =
        difficultyFilter === "all" || topic.difficulty === difficultyFilter;
      return categoryMatches && difficultyMatches;
    });

    return matches.length > 0 ? matches : localizedTopics;
  }, [categoryFilter, difficultyFilter, localizedTopics]);

  useEffect(() => {
    if (activeRoom && activeRoom.status !== "lobby") {
      router.replace(`/debates/${activeRoom.shareCode}`);
    }
  }, [activeRoom, router]);

  const handleCreate = () => {
    setError(null);
    if (!selectedTopic) {
      setError("No active motions are available for this language yet.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/debate-duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicTitle: selectedTopic.title,
          topicKey: getTopicStableKey(selectedTopic),
          topicCategory: selectedTopic.category,
          topicCategoryKey: getTopicCategoryKey(selectedTopic),
          topicDifficulty: selectedTopic.difficulty,
          topicDescription: selectedTopic.context ?? "",
          prepTimeSeconds,
          openingTimeSeconds,
          rebuttalTimeSeconds,
          practiceLanguage,
          sideAssignmentMode,
          creatorSidePreference:
            sideAssignmentMode === "choose" ? creatorSidePreference : null,
        }),
      });

      const payload = (await response.json()) as
        | { shareCode: string; room?: DebateDuelRoomView | null }
        | { error?: string };

      if (!response.ok || !("shareCode" in payload)) {
        setError(
          ("error" in payload && payload.error) || "Failed to create duel room."
        );
        return;
      }

      setActiveRoomCode(payload.shareCode);
      if (payload.room) {
        await mutate(payload.room, { revalidate: false });
      }
      router.replace(`/debates/new?room=${payload.shareCode}`);
    });
  };

  const editFromRoom = () => {
    if (activeRoom) {
      const matchingTopic = localizedTopics.find(
        (topic) =>
          getTopicStableKey(topic) === activeRoom.topicKey ||
          topic.title === activeRoom.topicTitle
      );
      if (matchingTopic) setTopicId(matchingTopic.id);
      setPrepTimeSeconds(activeRoom.config.prepTimeSeconds);
      setOpeningTimeSeconds(activeRoom.config.openingTimeSeconds);
      setRebuttalTimeSeconds(activeRoom.config.rebuttalTimeSeconds);
      setSideAssignmentMode(activeRoom.sideAssignmentMode);
      setCreatorSidePreference(activeRoom.creatorSidePreference ?? "proposition");
    }
    setActiveRoomCode(null);
    router.replace("/debates/new");
  };

  if (activeRoomCode) {
    if (roomLoading) {
      return (
        <div className="flex min-h-full items-center justify-center bg-background">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface px-5 py-4 text-sm text-on-surface-variant">
            Loading duel room...
          </div>
        </div>
      );
    }

    if (roomError || !activeRoom) {
      return (
        <div className="min-h-full bg-background px-4 py-10">
          <div className="mx-auto max-w-xl rounded-[28px] border border-outline-variant/20 bg-surface p-6 text-center">
            <h1 className="text-2xl font-bold text-on-surface">
              Duel room unavailable
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant">
              {roomError instanceof Error
                ? roomError.message
                : "We could not load this duel room."}
            </p>
            <Button
              type="button"
              onClick={() => {
                setActiveRoomCode(null);
                router.replace("/debates/new");
              }}
              className="mt-5 h-11 rounded-2xl"
            >
              Create a new room
            </Button>
          </div>
        </div>
      );
    }

    return (
      <DuelLobbySetupView
        room={activeRoom}
        mutate={mutate}
        onEditSetup={activeRoom.viewer.isCreator ? editFromRoom : undefined}
      />
    );
  }

  if (!selectedTopic) {
    return (
      <PageTransition className="min-h-full bg-background">
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          <div className="rounded-[28px] border border-outline-variant/20 bg-surface p-6">
            <h1 className="text-2xl font-bold text-on-surface">
              No active motions available
            </h1>
            <p className="mt-3 text-sm leading-6 text-on-surface-variant">
              Import the Calico catalog or enable at least one motion before
              creating a duel room.
            </p>
            <Button
              type="button"
              onClick={() => router.push("/debates")}
              className="mt-5 h-11 rounded-2xl"
            >
              Back to arena
            </Button>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition className="min-h-full bg-[linear-gradient(180deg,#F7FAFE_0%,#EEF4FF_45%,#F7FAFE_100%)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        <div className="mb-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end">
          <div>
            <button
              type="button"
              onClick={() => router.push("/debates")}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              1v1 Debate Arena
            </button>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-on-surface sm:text-5xl">
              Create a duel room
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant sm:text-base">
              Set up your debate, choose the format, and invite your opponent.
            </p>
          </div>
          <DuelFlowStepper mode="configure" />
        </div>

        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
          <main className="rounded-[28px] border border-outline-variant/20 bg-surface p-6 shadow-[0_24px_70px_-30px_rgba(11,20,66,0.22)] sm:p-7 lg:p-8">
            <section>
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                  1
                </div>
                <div>
                  <h2 className="text-xl font-bold text-on-surface">
                    Choose a motion
                  </h2>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-3">
                  {categoryFilters.slice(0, 5).map((category) => (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => setCategoryFilter(category.key)}
                      className={cn(
                        "h-10 rounded-full border px-5 text-sm font-medium transition-colors",
                        categoryFilter === category.key
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant/30 bg-surface text-on-surface-variant hover:bg-surface-container-low"
                      )}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
                <select
                  value={difficultyFilter}
                  onChange={(event) =>
                    setDifficultyFilter(event.target.value as DifficultyFilter)
                  }
                  className="h-11 w-full rounded-2xl border border-outline-variant/30 bg-surface px-4 text-sm font-medium text-on-surface outline-none focus:border-primary/50 lg:w-[150px]"
                >
                  {difficultyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {filteredTopics.slice(0, 4).map((topic) => {
                  const selected = topic.id === selectedTopic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setTopicId(topic.id)}
                      className={cn(
                        "group relative flex min-h-[174px] flex-col rounded-[14px] border bg-surface-container-lowest p-4 text-left transition-all duration-200 hover:-translate-y-0.5",
                        selected
                          ? "border-primary shadow-[0_12px_24px_-22px_rgba(77,134,247,0.85)]"
                          : "border-[#e3ebf8] hover:border-[#c9d8f7] hover:shadow-[0_12px_22px_-24px_rgba(22,39,91,0.22)]"
                      )}
                    >
                      {selected && (
                        <span className="absolute right-4 top-4 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-on-primary">
                          <Check className="h-[13px] w-[13px]" />
                        </span>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pr-8">
                        <span className="rounded-full bg-[#eef4ff] px-2.5 py-[4px] text-[10px] font-semibold leading-none text-[#3d70df]">
                          {shortCategoryLabel(topic.category)}
                        </span>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-[4px] text-[10px] font-semibold leading-none",
                            difficultyTone(topic.difficulty)
                          )}
                        >
                          {formatDifficulty(topic.difficulty)}
                        </span>
                      </div>

                      <div className="mt-4 flex-1">
                        <h3 className="line-clamp-4 break-words text-[0.98rem] font-semibold leading-[1.38] text-on-surface">
                          {topic.title}
                        </h3>
                      </div>

                      {!selected && (
                        <span className="mt-auto flex justify-end pt-4 text-[#7a89a8] transition-colors group-hover:text-primary">
                          <Star className="h-[17px] w-[17px]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-10 border-t border-outline-variant/15 pt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                    2
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-on-surface">
                      Configure format & timers
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrepTimeSeconds(120);
                    setOpeningTimeSeconds(180);
                    setRebuttalTimeSeconds(120);
                  }}
                  className="inline-flex h-11 items-center gap-2 rounded-2xl border border-outline-variant/25 bg-surface px-4 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
                >
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Presets
                </button>
              </div>

              <div className="mt-7 grid gap-5 lg:grid-cols-3">
                <DurationControl
                  label="Prep time"
                  icon={<Clock3 className="h-4 w-4" />}
                  value={prepTimeSeconds}
                  config={DUEL_PREP_DURATION}
                  onChange={setPrepTimeSeconds}
                />
                <DurationControl
                  label="Opening speech"
                  icon={<Users className="h-4 w-4" />}
                  value={openingTimeSeconds}
                  config={DUEL_OPENING_DURATION}
                  onChange={setOpeningTimeSeconds}
                />
                <DurationControl
                  label="Rebuttal speech"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  value={rebuttalTimeSeconds}
                  config={DUEL_REBUTTAL_DURATION}
                  onChange={setRebuttalTimeSeconds}
                />
              </div>

            </section>

            <section className="mt-10 border-t border-outline-variant/15 pt-8">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                  3
                </div>
                <div>
                  <h2 className="text-xl font-bold text-on-surface">
                    Side assignment
                  </h2>
                </div>
              </div>

              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSideAssignmentMode("random")}
                  className={cn(
                    "rounded-[20px] border p-5 text-left transition-all",
                    sideAssignmentMode === "random"
                      ? "border-primary bg-primary/6"
                      : "border-outline-variant/25 bg-surface"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <Scale className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-on-surface">
                          Random sides
                        </span>
                        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">
                          Recommended
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        Roles are assigned when the opponent joins.
                      </p>
                    </div>
                    {sideAssignmentMode === "random" && (
                      <div className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
                        <Check className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSideAssignmentMode("choose")}
                  className={cn(
                    "rounded-[20px] border p-5 text-left transition-all",
                    sideAssignmentMode === "choose"
                      ? "border-primary bg-primary/6"
                      : "border-outline-variant/25 bg-surface"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <ShieldCheck className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-on-surface">
                        Choose my side
                      </div>
                      <p className="mt-1 text-sm text-on-surface-variant">
                        Lock your side before your opponent joins.
                      </p>
                    </div>
                    {sideAssignmentMode === "choose" && (
                      <div className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
                        <Check className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                </button>
              </div>

              {sideAssignmentMode === "choose" && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {(["proposition", "opposition"] as const).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setCreatorSidePreference(side)}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-sm font-semibold capitalize transition-colors",
                        creatorSidePreference === side
                          ? "border-primary bg-primary/8 text-primary"
                          : "border-outline-variant/15 bg-surface text-on-surface"
                      )}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {error && (
              <div className="mt-5 rounded-2xl border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}

            <div className="mt-7 grid gap-3 sm:grid-cols-[220px_minmax(0,1fr)]">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  document
                    .getElementById("duel-preview")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="h-12 rounded-2xl border-outline-variant/25 bg-surface text-primary"
              >
                <Mail className="h-4 w-4" />
                Preview invite
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={pending}
                className="h-12 rounded-2xl text-base"
              >
                {pending ? "Creating room..." : "Create duel room"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </main>

          <DuelPreviewSidebar
            topicTitle={selectedTopic.title}
            topicCategory={selectedTopic.category}
            prepTimeSeconds={prepTimeSeconds}
            openingTimeSeconds={openingTimeSeconds}
            rebuttalTimeSeconds={rebuttalTimeSeconds}
            entryCost={DUEL_ENTRY_COST}
          />
        </div>
      </div>
    </PageTransition>
  );
}
