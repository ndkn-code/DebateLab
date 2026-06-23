"use client";

import { curveNatural } from "@visx/curve";
import { Bot, User } from "@/components/ui/icons";
import { ChartTooltip, Grid, Line, LineChart } from "@/components/charts";
import { SuccessCheck } from "@/components/motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { DebateRound } from "@/types";

interface RoundProgressProps {
  rounds: DebateRound[];
  currentRound: number;
}

function getTimelineDate(index: number) {
  return new Date(Date.UTC(2026, 0, index + 1));
}

function getStatusValue(roundNumber: number, currentRound: number) {
  if (roundNumber < currentRound) return 1;
  if (roundNumber === currentRound) return 0.66;
  return 0.2;
}

export function RoundProgress({ rounds, currentRound }: RoundProgressProps) {
  const t = useTranslations("dashboard.practice");
  const getRoundLabel = (label: string) => {
    if (label === "Opening Statement") return t("session.round_opening");
    if (label === "AI Rebuttal") return t("session.round_ai_rebuttal");
    if (label === "Counter-Rebuttal")
      return t("session.round_counter_rebuttal");
    if (label === "AI Closing") return t("session.round_ai_closing");
    if (label === "Closing Statement") return t("session.round_closing");
    return label;
  };

  const timelineData = rounds.map((round, index) => {
    return {
      date: getTimelineDate(index),
      status: getStatusValue(round.roundNumber, currentRound),
      label: getRoundLabel(round.label),
      roundNumber: round.roundNumber,
    };
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-2.5">
      {timelineData.length > 1 && (
        <div className="h-20">
          <LineChart
            data={timelineData}
            margin={{ top: 12, right: 22, bottom: 10, left: 22 }}
            xDataKey="date"
          >
            <Grid
              horizontal
              rowTickValues={[0.2, 0.66, 1]}
              stroke="var(--chart-grid)"
            />
            <Line
              dataKey="status"
              curve={curveNatural}
              showMarkers
              stroke="var(--chart-line-primary)"
              strokeWidth={3}
            />
            <ChartTooltip
              showDatePill={false}
              rows={(point) => [
                {
                  color: "var(--chart-line-primary)",
                  label: String(point.label),
                  value: `#${point.roundNumber}`,
                },
              ]}
            />
          </LineChart>
        </div>
      )}

      <div className="flex w-full items-start justify-center overflow-x-auto pb-1">
        {rounds.map((round, i) => {
          const isActive = round.roundNumber === currentRound;
          const isCompleted = round.roundNumber < currentRound;
          const isUserRound = round.type === "user-speech";

          return (
            <div
              key={round.roundNumber}
              className="flex min-w-[104px] flex-1 items-start last:flex-none"
            >
              <div className="flex min-w-[86px] flex-col items-center">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border transition-all",
                    isCompleted
                      ? "border-secondary bg-secondary-container text-secondary-dim"
                      : isActive
                        ? "border-primary bg-primary-container text-primary shadow-token-primary"
                        : "border-outline-variant/70 bg-surface text-outline",
                  )}
                >
                  {isCompleted ? (
                    <SuccessCheck size={22} />
                  ) : isUserRound ? (
                    <User className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    "mt-1.5 max-w-[86px] text-center text-xs leading-tight",
                    isActive
                      ? "font-medium text-primary"
                      : isCompleted
                        ? "text-on-surface-variant"
                        : "text-outline-variant",
                  )}
                >
                  {getRoundLabel(round.label)}
                </span>
              </div>

              {i < rounds.length - 1 && (
                <div
                  className={cn(
                    "mx-2 mt-[18px] h-0.5 flex-1 rounded-full border-t border-dashed",
                    round.roundNumber < currentRound
                      ? "border-primary"
                      : "border-outline-variant",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
