"use client";

import { useMemo } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowRight, RotateCcw, Scale, Sparkles, Trophy } from "@/components/ui/icons";
import { DuelClashMap } from "@/components/debates/duel-clash-map";
import { DuelTranscriptTab } from "@/components/debates/duel-transcript-tab";
import { DuelIllustration } from "@/components/debates/duel-illustration";
import {
  SessionReviewShell,
  type SessionReviewTab,
} from "@/components/feedback/session-review-shell";
import { AiQualityRatingWidget } from "@/components/ai-quality/ai-quality-rating-widget";
import { Button } from "@/components/ui/button";
import { useDebateDuelRoom } from "@/hooks/use-debate-duel-room";
import { cn } from "@/lib/utils";
import type { DebateDuelRoomView } from "@/types";
import type { DebateDuelParticipant } from "@/types";

interface DuelResultPageProps {
  shareCode: string;
}

interface DuelResultContentProps {
  room: DebateDuelRoomView;
  initialTab?: SessionReviewTab;
}

function ParticipantProfileName({
  participant,
  fallback,
  className,
}: {
  participant: DebateDuelParticipant | null | undefined;
  fallback: string;
  className?: string;
}) {
  const label = participant?.displayName || fallback;

  if (!participant?.profileHref) {
    return <span className={className}>{label}</span>;
  }

  return (
    <Link
      href={participant.profileHref}
      className={cn("transition hover:text-primary hover:underline", className)}
    >
      {label}
    </Link>
  );
}

export function DuelResultPage({ shareCode }: DuelResultPageProps) {
  const { data: room, error, isLoading } = useDebateDuelRoom(shareCode, "result");

  if (isLoading) {
    return (
      <div className="flex min-h-full items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-full bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[30px] border border-outline-variant/15 bg-surface p-6 text-center shadow-token-card">
          <h1 className="text-2xl font-semibold text-on-surface">
            Duel result unavailable
          </h1>
          <p className="mt-3 text-on-surface-variant">
            {error instanceof Error
              ? error.message
              : "We couldn't load the result for this duel."}
          </p>
        </div>
      </div>
    );
  }

  if (!room.judgment) {
    if (room.outcomeReason === "forfeit" || room.outcomeReason === "abandoned") {
      return <DuelForfeitResult room={room} />;
    }
    return (
      <div className="min-h-full bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[30px] border border-outline-variant/15 bg-surface p-6 text-center shadow-token-card">
          <h1 className="text-2xl font-semibold text-on-surface">
            Judging the duel…
          </h1>
          <p className="mt-3 text-on-surface-variant">
            The AI verdict appears here as soon as it’s ready.
          </p>
        </div>
      </div>
    );
  }

  return <DuelResultContent room={room} />;
}

function DuelForfeitResult({ room }: { room: DebateDuelRoomView }) {
  const forfeitedBy = room.forfeitedBy ?? null;
  const viewerForfeited = !!forfeitedBy && forfeitedBy === room.viewer.id;
  const cancelled = room.outcomeReason === "abandoned";
  const winner =
    room.participants.find((participant) => participant.userId !== forfeitedBy) ??
    null;

  return (
    <div className="min-h-full bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-[32px] border border-outline-variant/15 bg-surface p-8 text-center shadow-token-card">
        <div className="mb-6 flex justify-center">
          <DuelIllustration
            name={cancelled ? "thinkfy_duel_rematch_v1" : "thinkfy_duel_victory_v1"}
            alt={cancelled ? "Duel ended" : "Won by forfeit"}
            className="h-[160px] w-[220px]"
          />
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 type-eyebrow text-primary">
          <Trophy className="h-3.5 w-3.5" />
          {cancelled ? "Duel ended" : "Won by forfeit"}
        </div>
        <h1 className="mt-4 text-3xl font-bold text-on-surface sm:text-4xl">
          {cancelled
            ? "This duel was cancelled."
            : viewerForfeited
              ? "You forfeited this duel."
              : `${winner?.displayName ?? "You"} win by forfeit.`}
        </h1>
        <p className="mt-3 text-on-surface-variant">
          {cancelled
            ? "No credits were charged."
            : viewerForfeited
              ? "Your opponent was refunded their entry. There’s no AI verdict for a forfeited duel."
              : "Your opponent left, so the round goes to you. No AI verdict is generated for a forfeit."}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href={`/debates/new?topic=${encodeURIComponent(room.topicTitle)}`}>
            <Button className="h-11 rounded-2xl bg-primary text-on-primary hover:bg-primary/90">
              <RotateCcw className="mr-2 h-4 w-4" />
              Rematch
            </Button>
          </Link>
          <Link href="/debates">
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-outline-variant/25 bg-surface text-on-surface"
            >
              Back to duels
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DuelResultContent({
  room,
  initialTab = "overall",
}: DuelResultContentProps) {
  const participantsByRole = useMemo(() => {
    return {
      proposition:
        room.participants.find((participant) => participant.role === "proposition") ??
        null,
      opposition:
        room.participants.find((participant) => participant.role === "opposition") ??
        null,
    };
  }, [room]);

  if (!room.judgment) {
    return (
      <div className="min-h-full bg-background px-4 py-10">
        <div className="mx-auto max-w-3xl rounded-[30px] border border-outline-variant/15 bg-surface p-6 text-center shadow-token-card">
          <h1 className="text-2xl font-semibold text-on-surface">
            Duel result unavailable
          </h1>
          <p className="mt-3 text-on-surface-variant">
            We could not load the judged result for this duel.
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
    <div className="min-h-full bg-background">
      <SessionReviewShell
        initialTab={initialTab}
        transcript={<DuelTranscriptTab room={room} />}
        clashMap={<DuelClashMap room={room} />}
        overall={
          <section className="rounded-[32px] border border-outline-variant/15 bg-surface p-8 shadow-token-card">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant/20 bg-surface-container-low px-3 py-1 type-eyebrow text-primary">
                <Trophy className="h-3.5 w-3.5" />
                AI verdict
              </div>
              <h1 className="mt-4 text-3xl font-bold text-on-surface sm:text-4xl">
                <ParticipantProfileName
                  participant={winner}
                  fallback="Winner decided"
                />
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
              <div className="type-eyebrow text-on-surface-variant">
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
                      <div className="type-eyebrow text-primary">
                        {side}
                      </div>
                      <h2 className="mt-2 text-2xl font-semibold text-on-surface">
                        <ParticipantProfileName
                          participant={participant}
                          fallback={side}
                        />
                      </h2>
                    </div>
                    {isWinner && (
                      <div className="rounded-full bg-primary px-3 py-1 type-eyebrow text-on-primary">
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
              <div className="flex items-center gap-2 type-eyebrow text-primary">
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
                <div className="flex items-center gap-2 type-eyebrow text-primary">
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
                <div className="type-eyebrow text-primary">
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
                    )}&context=duel-review&contextId=${room.id}`}
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
        }
      />
      <AiQualityRatingWidget
        runId={judgment.aiQualityRunId}
        outputType="duel_judging"
        locale={room.practiceLanguage}
      />
    </div>
  );
}
