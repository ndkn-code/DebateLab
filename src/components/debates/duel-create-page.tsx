"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Gauge,
  Lock,
  Minus,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/page-motion";
import { useDebateDuelRoom } from "@/hooks/use-debate-duel-room";
import { CATEGORIES, topics, type Category } from "@/lib/topics";
import { DUEL_ENTRY_COST } from "@/lib/debate-duels/shared";
import { cn } from "@/lib/utils";
import type { DebateDuelRoomView, DebateDuelTopicDifficulty } from "@/types";
import {
  DuelFlowStepper,
  DuelLobbySetupView,
  DuelPreviewSidebar,
  formatDifficulty,
  formatMinutes,
} from "./duel-setup-flow";

interface DuelCreatePageProps {
  initialTopicTitle?: string;
  initialRoomShareCode?: string;
}

type CategoryFilter = "All" | Category;
type DifficultyFilter = "all" | DebateDuelTopicDifficulty;

const difficultyOptions: { value: DifficultyFilter; label: string }[] = [
  { value: "all", label: "Difficulty" },
  { value: "beginner", label: "Easy" },
  { value: "intermediate", label: "Medium" },
  { value: "advanced", label: "Hard" },
];

const categoryFilters: CategoryFilter[] = ["All", ...CATEGORIES];

function clampTimer(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function TimerStepper({
  label,
  icon,
  value,
  min,
  max,
  step,
  color,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  color: "purple" | "green" | "orange";
  onChange: (value: number) => void;
}) {
  const progress = ((value - min) / (max - min)) * 100;
  const iconTone =
    color === "purple"
      ? "text-tertiary"
      : color === "green"
        ? "text-success"
        : "text-warning";

  return (
    <div className="rounded-[22px] border border-outline-variant/15 bg-surface p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-on-surface-variant">
        <span className={iconTone}>{icon}</span>
        {label}
      </div>
      <div className="mt-4 flex items-center justify-between gap-4">
        <div className="text-3xl font-bold text-on-surface">
          {formatMinutes(value).replace(" min", "")}
          <span className="ml-1 text-base font-medium text-on-surface-variant">
            min
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(clampTimer(value - step, min, max))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-low text-on-surface transition-colors hover:bg-surface-container-high"
            aria-label={`Decrease ${label}`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onChange(clampTimer(value + step, min, max))}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/20 bg-surface-container-low text-on-surface transition-colors hover:bg-surface-container-high"
            aria-label={`Increase ${label}`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-5 h-2 rounded-full bg-surface-container-high">
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            color === "purple" && "bg-tertiary",
            color === "green" && "bg-success",
            color === "orange" && "bg-warning"
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function difficultyTone(difficulty: DebateDuelTopicDifficulty) {
  if (difficulty === "beginner") return "bg-success/12 text-success";
  if (difficulty === "intermediate") return "bg-warning/12 text-warning";
  return "bg-error/12 text-error";
}

export function DuelCreatePage({
  initialTopicTitle,
  initialRoomShareCode,
}: DuelCreatePageProps) {
  const router = useRouter();
  const initialTopic =
    topics.find((topic) => topic.title === initialTopicTitle) ?? topics[0];
  const [activeRoomCode, setActiveRoomCode] = useState(
    initialRoomShareCode?.trim().toUpperCase() || null
  );
  const [topicId, setTopicId] = useState(initialTopic.id);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All");
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
    () => topics.find((topic) => topic.id === topicId) ?? topics[0],
    [topicId]
  );

  const filteredTopics = useMemo(() => {
    const matches = topics.filter((topic) => {
      const categoryMatches =
        categoryFilter === "All" || topic.category === categoryFilter;
      const difficultyMatches =
        difficultyFilter === "all" || topic.difficulty === difficultyFilter;
      return categoryMatches && difficultyMatches;
    });

    return matches.length > 0 ? matches : topics;
  }, [categoryFilter, difficultyFilter]);

  useEffect(() => {
    if (activeRoom && activeRoom.status !== "lobby") {
      router.replace(`/debates/${activeRoom.shareCode}`);
    }
  }, [activeRoom, router]);

  const estimatedMinutes = Math.round(
    (prepTimeSeconds + openingTimeSeconds * 2 + rebuttalTimeSeconds * 2) / 60
  );

  const handleCreate = () => {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/debate-duels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topicTitle: selectedTopic.title,
          topicCategory: selectedTopic.category,
          topicDifficulty: selectedTopic.difficulty,
          topicDescription: selectedTopic.context ?? "",
          prepTimeSeconds,
          openingTimeSeconds,
          rebuttalTimeSeconds,
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
      const matchingTopic = topics.find(
        (topic) => topic.title === activeRoom.topicTitle
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
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="rounded-2xl border border-outline-variant/15 bg-surface px-5 py-4 text-sm text-on-surface-variant">
            Loading duel room...
          </div>
        </div>
      );
    }

    if (roomError || !activeRoom) {
      return (
        <div className="min-h-screen bg-background px-4 py-10">
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

  return (
    <PageTransition className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-end">
          <div>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-2 text-sm font-medium text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              1v1 Debate Arena
            </button>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-on-surface">
              Create a duel room
            </h1>
            <p className="mt-3 text-sm text-on-surface-variant sm:text-base">
              Set up your debate, configure the format, and invite your opponent.
            </p>
          </div>
          <DuelFlowStepper mode="configure" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <main className="rounded-[30px] border border-outline-variant/15 bg-surface p-5 shadow-[0_18px_45px_rgba(11,20,66,0.06)] lg:p-6">
            <section>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                  1
                </div>
                <h2 className="text-xl font-bold text-on-surface">
                  Choose a motion
                </h2>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {categoryFilters.slice(0, 5).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setCategoryFilter(category)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                      categoryFilter === category
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant/20 bg-surface text-on-surface-variant hover:bg-surface-container-low"
                    )}
                  >
                    {category === "Technology & Social Media"
                      ? "Technology"
                      : category === "Society & Culture"
                        ? "Society"
                        : category === "Education & School Life"
                          ? "Education"
                          : category}
                  </button>
                ))}
                <select
                  value={difficultyFilter}
                  onChange={(event) =>
                    setDifficultyFilter(event.target.value as DifficultyFilter)
                  }
                  className="h-10 rounded-full border border-outline-variant/20 bg-surface px-4 text-sm font-medium text-on-surface outline-none focus:border-primary/50"
                >
                  {difficultyOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {filteredTopics.slice(0, 4).map((topic) => {
                  const selected = topic.id === selectedTopic.id;
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      onClick={() => setTopicId(topic.id)}
                      className={cn(
                        "group rounded-[22px] border bg-surface p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(11,20,66,0.08)]",
                        selected
                          ? "border-primary bg-primary/6 shadow-[0_14px_30px_rgba(66,133,244,0.12)]"
                          : "border-outline-variant/15"
                      )}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            difficultyTone(topic.difficulty)
                          )}
                        >
                          {formatDifficulty(topic.difficulty)}
                        </span>
                        <Star
                          className={cn(
                            "h-5 w-5",
                            selected ? "fill-primary text-primary" : "text-on-surface-variant"
                          )}
                        />
                      </div>
                      <Image
                        src="/images/debates/topic-backpack.png"
                        width={120}
                        height={120}
                        alt=""
                        className="mx-auto mt-3 h-24 w-24 object-contain"
                      />
                      <div className="mt-3 min-h-[48px] text-sm font-semibold leading-6 text-on-surface">
                        {topic.title}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                    2
                  </div>
                  <h2 className="text-xl font-bold text-on-surface">
                    Configure format & timers
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPrepTimeSeconds(120);
                    setOpeningTimeSeconds(180);
                    setRebuttalTimeSeconds(120);
                  }}
                  className="rounded-full border border-outline-variant/20 bg-surface px-4 py-2 text-sm font-medium text-on-surface-variant"
                >
                  Presets
                </button>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <TimerStepper
                  label="Prep time"
                  icon={<Clock3 className="h-4 w-4" />}
                  value={prepTimeSeconds}
                  min={60}
                  max={180}
                  step={60}
                  color="purple"
                  onChange={setPrepTimeSeconds}
                />
                <TimerStepper
                  label="Opening speech"
                  icon={<Users className="h-4 w-4" />}
                  value={openingTimeSeconds}
                  min={120}
                  max={240}
                  step={60}
                  color="green"
                  onChange={setOpeningTimeSeconds}
                />
                <TimerStepper
                  label="Rebuttal speech"
                  icon={<ShieldCheck className="h-4 w-4" />}
                  value={rebuttalTimeSeconds}
                  min={60}
                  max={120}
                  step={30}
                  color="orange"
                  onChange={setRebuttalTimeSeconds}
                />
              </div>

              <div className="mt-5 grid gap-3 rounded-[22px] border border-outline-variant/15 bg-surface-container-low p-4 text-sm sm:grid-cols-4">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-5 w-5 text-on-surface-variant" />
                  <div>
                    <div className="text-xs text-on-surface-variant">
                      Estimated duel length
                    </div>
                    <div className="font-semibold text-on-surface">
                      ~{estimatedMinutes} min
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-on-surface-variant" />
                  <div>
                    <div className="text-xs text-on-surface-variant">Format</div>
                    <div className="font-semibold text-on-surface">Structured 1v1</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Gauge className="h-5 w-5 text-on-surface-variant" />
                  <div>
                    <div className="text-xs text-on-surface-variant">
                      Skill matching
                    </div>
                    <div className="font-semibold text-on-surface">Balanced</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Lock className="h-5 w-5 text-on-surface-variant" />
                  <div>
                    <div className="text-xs text-on-surface-variant">Late join</div>
                    <div className="font-semibold text-on-surface">Locked</div>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary">
                  3
                </div>
                <h2 className="text-xl font-bold text-on-surface">
                  Side assignment
                </h2>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSideAssignmentMode("random")}
                  className={cn(
                    "rounded-[22px] border p-5 text-left transition-all",
                    sideAssignmentMode === "random"
                      ? "border-primary bg-primary/6"
                      : "border-outline-variant/15 bg-surface"
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
                        <span className="rounded-full bg-success/10 px-2 py-1 text-xs font-semibold text-success">
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
                    "rounded-[22px] border p-5 text-left transition-all",
                    sideAssignmentMode === "choose"
                      ? "border-primary bg-primary/6"
                      : "border-outline-variant/15 bg-surface"
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
                <Sparkles className="h-4 w-4" />
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
