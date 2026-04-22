"use client";

import { useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowRight, RotateCcw, Scale, Sparkles, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDebateDuelRoom } from "@/hooks/use-debate-duel-room";

interface DuelResultPageProps {
  shareCode: string;
}

export function DuelResultPage({ shareCode }: DuelResultPageProps) {
  const { data: room, error, isLoading } = useDebateDuelRoom(shareCode, "result");

  const participantsByRole = useMemo(() => {
    if (!room) return { proposition: null, opposition: null };
    return {
      proposition:
        room.participants.find((participant) => participant.role === "proposition") ??
        null,
      opposition:
        room.participants.find((participant) => participant.role === "opposition") ??
        null,
    };
  }, [room]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !room || !room.judgment) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[30px] border border-outline-variant/15 bg-surface p-6 text-center shadow-[0_18px_45px_rgba(11,20,66,0.06)]">
          <h1 className="text-2xl font-semibold text-on-surface">
            Duel result unavailable
          </h1>
          <p className="mt-3 text-on-surface-variant">
            {error instanceof Error
              ? error.message
              : "We couldn't load the judged result for this duel."}
          </p>
        </div>
      </div>
    );
  }

  const judgment = room.judgment;
  const winner =
    judgment.winnerSide === "proposition"
      ? participantsByRole.proposition
      : participantsByRole.opposition;

  const emptyFeedback = {
    summary: "No individual feedback was generated for this side.",
    strengths: [] as string[],
    improvements: [] as string[],
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-[32px] border border-outline-variant/15 bg-surface p-8 shadow-[0_18px_45px_rgba(11,20,66,0.06)]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Trophy className="h-3.5 w-3.5" />
                AI verdict
              </div>
              <h1 className="mt-4 text-3xl font-bold text-on-surface sm:text-4xl">
                {winner?.displayName || "Winner decided"}
              </h1>
              <p className="mt-2 text-lg text-on-surface-variant">
                {judgment.winnerSide === "proposition"
                  ? "Proposition wins the duel."
                  : "Opposition wins the duel."}
              </p>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-on-surface-variant">
                {judgment.decisionSummary}
              </p>
            </div>

            <div className="rounded-2xl border border-outline-variant/15 bg-surface-container-low px-5 py-4">
              <div className="text-xs uppercase tracking-[0.16em] text-on-surface-variant">
                Confidence
              </div>
              <div className="mt-2 text-3xl font-semibold text-on-surface">
                {Math.round(judgment.confidence * 100)}%
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {(["proposition", "opposition"] as const).map((side) => {
              const participant = participantsByRole[side];
              const feedback = judgment.participantFeedback[side] ?? emptyFeedback;
              const isWinner = judgment.winnerSide === side;
              return (
                <div
                  key={side}
                  className={`rounded-[28px] border p-6 ${
                    isWinner
                      ? "border-primary/25 bg-primary/8"
                      : "border-outline-variant/15 bg-surface-container-low"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                        {side}
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-on-surface">
                        {participant?.displayName || side}
                      </h2>
                    </div>
                    {isWinner && (
                      <div className="rounded-full bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-on-primary">
                        Winner
                      </div>
                    )}
                  </div>

                  <p className="mt-4 text-sm leading-7 text-on-surface-variant">
                    {feedback.summary}
                  </p>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-sm font-semibold text-on-surface">
                        Strengths
                      </div>
                      <ul className="mt-2 space-y-2 text-sm text-on-surface-variant">
                        {feedback.strengths.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-on-surface">
                        Improve next
                      </div>
                      <ul className="mt-2 space-y-2 text-sm text-on-surface-variant">
                        {feedback.improvements.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6">
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                <Scale className="h-4 w-4" />
                Comparative ballot
              </div>
              <div className="mt-5 space-y-3">
                {Object.entries(judgment.comparativeBallot).map(
                  ([criterion, value]) => (
                    <div
                      key={criterion}
                      className="rounded-2xl border border-outline-variant/12 bg-surface px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium capitalize text-on-surface">
                          {criterion}
                        </div>
                        <div className="text-sm font-semibold text-primary">
                          {value.winnerSide === "tie"
                            ? "Tie"
                            : value.winnerSide === "proposition"
                              ? "Prop"
                              : "Opp"}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-on-surface-variant">
                        {value.reason}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6">
                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="h-4 w-4" />
                  Round breakdown
                </div>
                <div className="mt-4 space-y-3">
                  {judgment.roundBreakdown.map((round) => (
                    <div
                      key={round.roundNumber}
                      className="rounded-2xl border border-outline-variant/12 bg-surface px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-on-surface">
                          {round.label}
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          {round.winnerSide === "tie"
                            ? "Tie"
                            : round.winnerSide === "proposition"
                              ? "Prop"
                              : "Opp"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-on-surface-variant">
                        {round.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[28px] border border-outline-variant/15 bg-surface-container-low p-6">
                <div className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
                  Next move
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link href={`/debates/new?topic=${encodeURIComponent(room.topicTitle)}`}>
                    <Button className="h-11 rounded-2xl bg-primary text-on-primary hover:bg-primary/90">
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Rematch
                    </Button>
                  </Link>
                  <Link
                    href={`/chat?message=${encodeURIComponent(
                      `Help me review my 1v1 debate duel on "${room.topicTitle}".`
                    )}&context=duel-review&contextId=${encodeURIComponent(room.shareCode)}`}
                  >
                    <Button
                      variant="outline"
                      className="h-11 rounded-2xl border-outline-variant/25 bg-surface text-on-surface"
                    >
                      Ask AI Coach
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
