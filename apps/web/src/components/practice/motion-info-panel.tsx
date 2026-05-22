"use client";

import { BookOpenText, Lightbulb, Scale, ShieldCheck } from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import type { DebateTopic } from "@/types";
import { cn } from "@/lib/utils";

interface MotionInfoPanelProps {
  topic: DebateTopic;
  side: "proposition" | "opposition";
  className?: string;
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
  const t = useTranslations("dashboard.practice");
  const sideLabel = side === "proposition" ? t("for") : t("against");
  const difficultyLabel =
    topic.difficulty === "beginner"
      ? t("difficulty_beginner")
      : topic.difficulty === "advanced"
        ? t("difficulty_advanced")
        : t("difficulty_intermediate");
  const points = getSidePoints(topic, side);

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-lg border border-[#D9E6FA] bg-white shadow-[0_16px_42px_-34px_rgba(22,39,91,0.35)]",
        className
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-[#4D86F7]" />
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-[#EEF4FF] px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#3E78EC]">
            <BookOpenText className="h-3.5 w-3.5" />
            {t("session.motion")}
          </span>
          <span
            className={cn(
              "inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-bold",
              side === "proposition"
                ? "bg-[#EAF9EF] text-[#249B55]"
                : "bg-[#FDECEC] text-[#D95C5C]"
            )}
          >
            {sideLabel}
          </span>
          <span className="inline-flex h-7 items-center rounded-md bg-[#F7FAFE] px-2.5 text-[11px] font-semibold text-[#415069] ring-1 ring-[#DEE8F8]">
            {difficultyLabel}
          </span>
          <span className="inline-flex h-7 min-w-0 max-w-full items-center truncate rounded-md bg-white px-2.5 text-[11px] font-semibold text-[#415069] ring-1 ring-[#DEE8F8]">
            {topic.category}
          </span>
        </div>

        <h1 className="mt-3 text-[1.15rem] font-semibold leading-snug tracking-normal text-[#0B1424] md:text-[1.35rem]">
          {topic.title}
        </h1>

        <div className="mt-3 rounded-md border border-[#DEE8F8] bg-[#F7FAFE] px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#3E78EC]">
            <Scale className="h-3.5 w-3.5 text-[#4D86F7]" />
            {t("session.info")}
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-[#415069]">
            {topic.context ||
              t("session.motion_default_context")}
          </p>
        </div>

        {points.length > 0 ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#162033]">
              <Lightbulb className="h-4 w-4 text-[#4D86F7]" />
              {t("session.argument_anchors")}
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {points.map((point) => (
                <div
                  key={point}
                  className="flex min-h-[44px] gap-2 rounded-md border border-[#DEE8F8] bg-white px-3 py-2 text-sm leading-5 text-[#415069]"
                >
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34C759]" />
                  <span className="line-clamp-2">{point}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
