"use client";

import { BookOpenText, Lightbulb, Scale, ShieldCheck } from "lucide-react";
import type { DebateTopic } from "@/types";
import { cn } from "@/lib/utils";

interface MotionInfoPanelProps {
  topic: DebateTopic;
  side: "proposition" | "opposition";
  className?: string;
}

function getDifficultyLabel(difficulty: DebateTopic["difficulty"]) {
  if (difficulty === "beginner") return "Beginner";
  if (difficulty === "advanced") return "Advanced";
  return "Intermediate";
}

function getSidePoints(
  topic: DebateTopic,
  side: "proposition" | "opposition"
) {
  const points =
    side === "proposition"
      ? topic.suggestedPoints?.proposition
      : topic.suggestedPoints?.opposition;

  return points?.filter(Boolean).slice(0, 3) ?? [];
}

export function MotionInfoPanel({
  topic,
  side,
  className,
}: MotionInfoPanelProps) {
  const sideLabel = side === "proposition" ? "FOR" : "AGAINST";
  const points = getSidePoints(topic, side);

  return (
    <section
      className={cn(
        "rounded-lg border border-[#DEE8F8] bg-white p-5 shadow-[0_18px_42px_-36px_rgba(34,67,138,0.42)]",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-md bg-[#EEF4FF] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-[#3E78EC]">
          <BookOpenText className="h-3.5 w-3.5" />
          Motion
        </span>
        <span
          className={cn(
            "inline-flex rounded-md px-3 py-1.5 text-xs font-bold",
            side === "proposition"
              ? "bg-[#EAF9EF] text-[#249B55]"
              : "bg-[#FDECEC] text-[#D95C5C]"
          )}
        >
          {sideLabel}
        </span>
        <span className="inline-flex rounded-md bg-[#F7FAFE] px-3 py-1.5 text-xs font-semibold text-[#415069] ring-1 ring-[#DEE8F8]">
          {getDifficultyLabel(topic.difficulty)}
        </span>
      </div>

      <h1 className="mt-4 text-[1.7rem] font-bold leading-tight tracking-normal text-[#0B1424] md:text-[2rem]">
        {topic.title}
      </h1>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
        <div className="rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#162033]">
            <Scale className="h-4 w-4 text-[#4D86F7]" />
            Info slide
          </div>
          <p className="mt-2 text-sm leading-6 text-[#415069]">
            {topic.context ||
              "Use this motion to define the clash, choose your strongest burden, and explain why your side matters more."}
          </p>
        </div>

        <div className="rounded-lg border border-[#DEE8F8] bg-white px-4 py-3 md:min-w-[190px]">
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-[#718096]">
            Category
          </div>
          <div className="mt-1 text-sm font-bold leading-5 text-[#162033]">
            {topic.category}
          </div>
        </div>
      </div>

      {points.length > 0 ? (
        <div className="mt-4 rounded-lg border border-[#DEE8F8] bg-white p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-[#162033]">
            <Lightbulb className="h-4 w-4 text-[#4D86F7]" />
            Argument anchors
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {points.map((point) => (
              <div
                key={point}
                className="rounded-md border border-[#DEE8F8] bg-[#F7FAFE] px-3 py-2 text-sm leading-5 text-[#415069]"
              >
                <ShieldCheck className="mb-1 h-3.5 w-3.5 text-[#34C759]" />
                {point}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
