"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "@/i18n/navigation";
import { ArrowRight, Copy, Scale, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { topics } from "@/lib/topics";
import { DUEL_ENTRY_COST } from "@/lib/debate-duels/shared";

interface DuelCreatePageProps {
  initialTopicTitle?: string;
}

export function DuelCreatePage({ initialTopicTitle }: DuelCreatePageProps) {
  const router = useRouter();
  const initialTopic =
    topics.find((topic) => topic.title === initialTopicTitle) ?? topics[0];
  const [topicId, setTopicId] = useState(initialTopic.id);
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

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === topicId) ?? topics[0],
    [topicId]
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
        | { shareCode: string }
        | { error?: string };

      if (!response.ok || !("shareCode" in payload)) {
        setError(
          ("error" in payload && payload.error) || "Failed to create duel room."
        );
        return;
      }

      router.push(`/debates/${payload.shareCode}`);
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8 max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
            <Users className="h-3.5 w-3.5" />
            1v1 Debate
          </div>
          <h1 className="text-3xl font-bold text-on-surface sm:text-4xl">
            Create a shared duel room
          </h1>
          <p className="mt-3 text-base text-on-surface-variant">
            Set the motion, timers, and side assignment. You’ll get a share code
            for your opponent to join on their own device.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[28px] border border-outline-variant/15 bg-surface p-6 shadow-[0_18px_45px_rgba(11,20,66,0.06)]">
            <h2 className="text-lg font-semibold text-on-surface">Format</h2>
            <div className="mt-5 space-y-5">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-on-surface">
                  Motion
                </span>
                <select
                  value={topicId}
                  onChange={(event) => setTopicId(event.target.value)}
                  className="h-12 w-full rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
                >
                  {topics.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.title}
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-on-surface">
                    Prep time
                  </span>
                  <select
                    value={prepTimeSeconds}
                    onChange={(event) =>
                      setPrepTimeSeconds(Number(event.target.value))
                    }
                    className="h-12 w-full rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
                  >
                    <option value={60}>1 minute</option>
                    <option value={120}>2 minutes</option>
                    <option value={180}>3 minutes</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-on-surface">
                    Opening speech
                  </span>
                  <select
                    value={openingTimeSeconds}
                    onChange={(event) =>
                      setOpeningTimeSeconds(Number(event.target.value))
                    }
                    className="h-12 w-full rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
                  >
                    <option value={120}>2 minutes</option>
                    <option value={180}>3 minutes</option>
                    <option value={240}>4 minutes</option>
                  </select>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium text-on-surface">
                    Rebuttal speech
                  </span>
                  <select
                    value={rebuttalTimeSeconds}
                    onChange={(event) =>
                      setRebuttalTimeSeconds(Number(event.target.value))
                    }
                    className="h-12 w-full rounded-2xl border border-outline-variant/25 bg-surface-container-lowest px-4 text-sm text-on-surface outline-none transition-colors focus:border-primary/40"
                  >
                    <option value={60}>1 minute</option>
                    <option value={90}>1.5 minutes</option>
                    <option value={120}>2 minutes</option>
                  </select>
                </label>
              </div>

              <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-on-surface">
                  <Scale className="h-4 w-4 text-primary" />
                  Side assignment
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSideAssignmentMode("random")}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      sideAssignmentMode === "random"
                        ? "border-primary/35 bg-primary/10 text-primary"
                        : "border-outline-variant/15 bg-surface-container-lowest text-on-surface"
                    }`}
                  >
                    <div className="font-medium">Random sides</div>
                    <div className="mt-1 text-sm text-on-surface-variant">
                      Roles are assigned when the duel starts.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSideAssignmentMode("choose")}
                    className={`rounded-2xl border px-4 py-3 text-left transition-colors ${
                      sideAssignmentMode === "choose"
                        ? "border-primary/35 bg-primary/10 text-primary"
                        : "border-outline-variant/15 bg-surface-container-lowest text-on-surface"
                    }`}
                  >
                    <div className="font-medium">Choose my side</div>
                    <div className="mt-1 text-sm text-on-surface-variant">
                      Lock your side before your opponent joins.
                    </div>
                  </button>
                </div>

                {sideAssignmentMode === "choose" && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCreatorSidePreference("proposition")}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                        creatorSidePreference === "proposition"
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-outline-variant/15 bg-surface-container-lowest text-on-surface"
                      }`}
                    >
                      Proposition
                    </button>
                    <button
                      type="button"
                      onClick={() => setCreatorSidePreference("opposition")}
                      className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                        creatorSidePreference === "opposition"
                          ? "border-primary/35 bg-primary/10 text-primary"
                          : "border-outline-variant/15 bg-surface-container-lowest text-on-surface"
                      }`}
                    >
                      Opposition
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="rounded-[28px] border border-outline-variant/15 bg-surface p-6 shadow-[0_18px_45px_rgba(11,20,66,0.06)]">
            <h2 className="text-lg font-semibold text-on-surface">
              Duel summary
            </h2>
            <div className="mt-5 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                {selectedTopic.category}
              </p>
              <h3 className="mt-2 text-xl font-semibold text-on-surface">
                {selectedTopic.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                {selectedTopic.context ||
                  "Debate the same motion on two devices, then let the AI judge compare the full exchange."}
              </p>
            </div>

            <div className="mt-5 space-y-3 rounded-2xl border border-outline-variant/15 bg-surface-container-low p-5 text-sm text-on-surface-variant">
              <div className="flex items-center justify-between">
                <span>Shared prep</span>
                <span>{Math.round(prepTimeSeconds / 60)} min</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Opening speeches</span>
                <span>{Math.round(openingTimeSeconds / 60)} min each</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Rebuttals</span>
                <span>{rebuttalTimeSeconds / 60} min each</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Entry cost</span>
                <span>{DUEL_ENTRY_COST} Credits each</span>
              </div>
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-error/20 bg-error/8 px-4 py-3 text-sm text-error">
                {error}
              </div>
            )}

            <Button
              onClick={handleCreate}
              disabled={pending}
              className="mt-6 h-12 w-full gap-2 rounded-2xl bg-primary text-on-primary hover:bg-primary/90"
            >
              {pending ? "Creating room..." : "Create duel room"}
              <ArrowRight className="h-4 w-4" />
            </Button>

            <p className="mt-3 flex items-center gap-2 text-xs text-on-surface-variant">
              <Copy className="h-3.5 w-3.5" />
              Share code appears right after creation.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
