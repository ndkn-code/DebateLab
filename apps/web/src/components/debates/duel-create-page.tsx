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
  showcaseMode?: boolean;
}

type DifficultyFilter = "all" | DebateDuelTopicDifficulty;

const difficultyOptions: { value: DifficultyFilter; label: string }[] = [
  { value: "all", label: "Difficulty" },
  { value: "beginner", label: "Easy" },
  { value: "intermediate", label: "Medium" },
  { value: "advanced", label: "Hard" },
];

function difficultyTone(difficulty: DebateDuelTopicDifficulty) {
  if (difficulty === "beginner")
    return "bg-surface-container text-on-surface-variant";
  if (difficulty === "intermediate")
    return "bg-surface-container text-on-surface-variant";
  return "bg-error-container text-on-surface-variant";
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
  showcaseMode = false,
}: DuelCreatePageProps) {
  const router = useRouter();
  const locale = useLocale();
  const practiceLanguage = coercePracticeLanguage(locale);
  const safeCreateError =
    locale === "vi"
      ? "Chưa thể tạo phòng tranh biện. Hãy thử lại. Mã hỗ trợ: DUEL-CREATE-01."
      : "We couldn’t create the debate room. Try again. Support code: DUEL-CREATE-01.";
  const localizedTopics = useMemo(() => initialTopics, [initialTopics]);
  const categoryFilters = useMemo(
    () => getLocalizedCategoryOptions(practiceLanguage),
    [practiceLanguage],
  );
  const initialTopic =
    localizedTopics.find((topic) => topic.title === initialTopicTitle) ??
    localizedTopics[0];
  const [activeRoomCode, setActiveRoomCode] = useState(
    initialRoomShareCode?.trim().toUpperCase() || null,
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
    [localizedTopics, topicId],
  );

  const filteredTopics = useMemo(() => {
    const matches = localizedTopics.filter((topic) => {
      const categoryMatches =
        categoryFilter === "all" ||
        getTopicCategoryKey(topic) === categoryFilter;
      const difficultyMatches =
        difficultyFilter === "all" || topic.difficulty === difficultyFilter;
      return categoryMatches && difficultyMatches;
    });

    return matches.length > 0 ? matches : localizedTopics;
  }, [categoryFilter, difficultyFilter, localizedTopics]);

  useEffect(() => {
    if (showcaseMode) return;
    if (activeRoom && activeRoom.status !== "lobby") {
      router.replace(`/debates/${activeRoom.shareCode}`);
    }
  }, [activeRoom, router, showcaseMode]);

  const handleCreate = () => {
    setError(null);
    if (showcaseMode) {
      setError("Showcase mode keeps duel creation disabled.");
      return;
    }

    if (!selectedTopic) {
      setError("No active motions are available for this language yet.");
      return;
    }

    startTransition(async () => {
      try {
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
          console.error("Duel room creation rejected", {
            status: response.status,
            supportCode: "DUEL-CREATE-01",
          });
          setError(safeCreateError);
          return;
        }

        setActiveRoomCode(payload.shareCode);
        if (payload.room) {
          await mutate(payload.room, { revalidate: false });
        }
        router.replace(`/debates/new?room=${payload.shareCode}`);
      } catch (cause) {
        console.error("Duel room creation failed", {
          cause,
          supportCode: "DUEL-CREATE-01",
        });
        setError(safeCreateError);
      }
    });
  };

  const editFromRoom = () => {
    if (activeRoom) {
      const matchingTopic = localizedTopics.find(
        (topic) =>
          getTopicStableKey(topic) === activeRoom.topicKey ||
          topic.title === activeRoom.topicTitle,
      );
      if (matchingTopic) setTopicId(matchingTopic.id);
      setPrepTimeSeconds(activeRoom.config.prepTimeSeconds);
      setOpeningTimeSeconds(activeRoom.config.openingTimeSeconds);
      setRebuttalTimeSeconds(activeRoom.config.rebuttalTimeSeconds);
      setSideAssignmentMode(activeRoom.sideAssignmentMode);
      setCreatorSidePreference(
        activeRoom.creatorSidePreference ?? "proposition",
      );
    }
    setActiveRoomCode(null);
    router.replace("/debates/new");
  };

  if (activeRoomCode) {
    if (roomLoading) {
      return (
        <div className="flex min-h-full items-center justify-center bg-background">
          <div className="rounded-[10px] border border-outline-variant/15 bg-surface px-5 py-4 text-sm text-on-surface-variant">
            Loading duel room...
          </div>
        </div>
      );
    }

    if (roomError || !activeRoom) {
      return (
        <div className="min-h-full bg-background px-4 py-10">
          <div className="mx-auto max-w-xl rounded-[10px] border border-outline-variant/20 bg-surface p-6 text-center">
            <h1 className="text-2xl font-bold text-on-surface">
              Duel room unavailable
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant">
              {locale === "vi"
                ? "Chưa thể tải phòng tranh biện. Hãy thử lại từ sảnh. Mã hỗ trợ: DUEL-ROOM-01."
                : "We couldn’t load this debate room. Try again from the arena. Support code: DUEL-ROOM-01."}
            </p>
            <Button
              type="button"
              onClick={() => {
                setActiveRoomCode(null);
                router.replace("/debates/new");
              }}
              className="mt-5 h-8 rounded-[10px]"
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
          <div className="rounded-[10px] border border-outline-variant/20 bg-surface p-6">
            <h1 className="text-2xl font-bold text-on-surface">
              No active motions available
            </h1>
            <p className="mt-2 type-body-sm text-on-surface-variant">
              {locale === "vi"
                ? "Hiện chưa có chủ đề nào sẵn sàng. Hãy quay lại sau."
                : "No motions are ready right now. Check back soon."}
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
      <div className="mx-auto max-w-[1180px] px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-end">
          <div>
            <button
              type="button"
              onClick={() => router.push("/debates")}
              className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              1v1 Debate Arena
            </button>
            <h1 className="mt-2 max-w-2xl type-heading-lg font-semibold text-on-surface">
              Create a duel room
            </h1>
            <p className="mt-1 type-body-sm text-on-surface-variant">
              Set up your debate, choose the format, and invite your opponent.
            </p>
          </div>
          <DuelFlowStepper mode="configure" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <main className="rounded-xl border border-outline-variant bg-surface p-4 shadow-none sm:p-5">
            <section>
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                  1
                </div>
                <div>
                  <h2 className="type-title font-semibold text-on-surface">
                    Choose a motion
                  </h2>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-3">
                  {categoryFilters.slice(0, 5).map((category) => (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => setCategoryFilter(category.key)}
                      className={cn(
                        "h-8 rounded-[10px] border px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        categoryFilter === category.key
                          ? "border-primary bg-primary text-on-primary"
                          : "border-outline-variant/30 bg-surface text-on-surface-variant hover:bg-surface-container-low",
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
                  className="h-8 w-full rounded-[10px] border border-outline-variant/30 bg-surface px-4 text-sm font-medium text-on-surface outline-none focus:border-primary/50 lg:w-[150px]"
                >
                  {difficultyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {filteredTopics.slice(0, 4).map((topic) => {
                  const selected = topic.id === selectedTopic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setTopicId(topic.id)}
                      className={cn(
                        "group relative flex min-h-[120px] flex-col rounded-[10px] border bg-surface p-3 text-left transition-colors duration-150",
                        selected
                          ? "border-primary shadow-none"
                          : "border-outline-variant hover:border-outline-variant hover:shadow-none",
                      )}
                    >
                      {selected && (
                        <span className="absolute right-4 top-4 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-primary text-on-primary">
                          <Check className="h-[13px] w-[13px]" />
                        </span>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pr-8">
                        <span className="inline-flex h-5 items-center rounded-[6px] bg-primary-container px-2 type-caption font-semibold text-on-surface-variant">
                          {shortCategoryLabel(topic.category)}
                        </span>
                        <span
                          className={cn(
                            "inline-flex h-5 items-center rounded-[6px] px-2 type-caption font-semibold",
                            difficultyTone(topic.difficulty),
                          )}
                        >
                          {formatDifficulty(topic.difficulty)}
                        </span>
                      </div>

                      <div className="mt-3 flex-1">
                        <h3 className="line-clamp-3 break-words type-label font-semibold text-on-surface">
                          {topic.title}
                        </h3>
                      </div>

                      {!selected && (
                        <span className="mt-auto flex justify-end pt-4 text-on-surface-variant transition-colors group-hover:text-primary">
                          <Star className="h-[17px] w-[17px]" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-6 border-t border-outline-variant pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                    2
                  </div>
                  <div>
                    <h2 className="type-title font-semibold text-on-surface">
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
                  className="inline-flex h-8 items-center gap-2 rounded-[10px] border border-outline-variant/25 bg-surface px-4 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low"
                >
                  <SlidersHorizontal className="h-4 w-4 text-primary" />
                  Presets
                </button>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-3">
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

            <section className="mt-6 border-t border-outline-variant pt-5">
              <div className="flex items-start gap-4">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                  3
                </div>
                <div>
                  <h2 className="type-title font-semibold text-on-surface">
                    Side assignment
                  </h2>
                </div>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSideAssignmentMode("random")}
                  className={cn(
                    "rounded-[10px] border p-3 text-left transition-colors",
                    sideAssignmentMode === "random"
                      ? "border-primary bg-primary/6"
                      : "border-outline-variant/25 bg-surface",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-8 items-center justify-center rounded-[8px] bg-primary-container text-primary">
                      <Scale className="h-4 w-4" />
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
                    "rounded-[10px] border p-3 text-left transition-colors",
                    sideAssignmentMode === "choose"
                      ? "border-primary bg-primary/6"
                      : "border-outline-variant/25 bg-surface",
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="flex size-8 items-center justify-center rounded-[8px] bg-primary-container text-primary">
                      <ShieldCheck className="h-4 w-4" />
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
                        "rounded-[10px] border px-4 py-3 text-sm font-semibold capitalize transition-colors",
                        creatorSidePreference === side
                          ? "border-primary bg-primary/8 text-primary"
                          : "border-outline-variant/15 bg-surface text-on-surface",
                      )}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              )}
            </section>

            {error && (
              <div className="mt-5 rounded-[10px] border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
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
                className="h-8 rounded-[10px] border-outline-variant/25 bg-surface text-primary"
              >
                <Mail className="h-4 w-4" />
                Preview invite
              </Button>
              <Button
                type="button"
                onClick={handleCreate}
                disabled={pending}
                className="h-8 rounded-[10px] text-base"
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
