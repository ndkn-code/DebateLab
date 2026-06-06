"use client";

import { BookOpenText, Lightbulb, Scale, ShieldCheck } from "@/components/ui/icons";
import { useLocale, useTranslations } from "next-intl";
import type { DebateTopic } from "@/types";
import { getMotionBrief } from "@/lib/motion-brief";
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
  const locale = useLocale();
  const sideLabel = side === "proposition" ? t("for") : t("against");
  const difficultyLabel =
    topic.difficulty === "beginner"
      ? t("difficulty_beginner")
      : topic.difficulty === "advanced"
        ? t("difficulty_advanced")
        : t("difficulty_intermediate");
  const points = getSidePoints(topic, side);
  const motionBrief = getMotionBrief(topic, locale === "vi" ? "vi" : "en");
  const sideBurden =
    side === "proposition"
      ? motionBrief.propositionBurden
      : motionBrief.oppositionBurden;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-lg border border-outline-variant bg-white shadow-token-card",
        className
      )}
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-primary" />
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary-container px-2.5 text-[11px] font-bold uppercase tracking-[0.08em] text-primary-dim">
            <BookOpenText className="h-3.5 w-3.5" />
            {t("session.motion")}
          </span>
          <span
            className={cn(
              "inline-flex h-7 items-center rounded-md px-2.5 text-[11px] font-bold",
              side === "proposition"
                ? "bg-surface-container text-success-dim"
                : "bg-error-container text-on-surface-variant"
            )}
          >
            {sideLabel}
          </span>
          <span className="inline-flex h-7 items-center rounded-md bg-background px-2.5 text-[11px] font-semibold text-on-surface-variant ring-1 ring-outline-variant">
            {difficultyLabel}
          </span>
          <span className="inline-flex h-7 min-w-0 max-w-full items-center truncate rounded-md bg-white px-2.5 text-[11px] font-semibold text-on-surface-variant ring-1 ring-outline-variant">
            {topic.category}
          </span>
        </div>

        <h1 className="mt-3 text-[1.15rem] font-semibold leading-snug tracking-normal text-on-surface md:text-[1.35rem]">
          {topic.title}
        </h1>

        <div className="mt-3 rounded-md border border-outline-variant bg-background px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-primary-dim">
            <Scale className="h-3.5 w-3.5 text-primary" />
            {t("session.info")}
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-on-surface-variant">
            {topic.context ||
              t("session.motion_default_context")}
          </p>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <div className="rounded-md border border-outline-variant bg-white px-3 py-2.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary-dim">
              {t("session.motion_scope")}
            </div>
            <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-on-surface-variant">
              {motionBrief.scope}
            </p>
          </div>
          <div className="rounded-md border border-outline-variant bg-white px-3 py-2.5">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary-dim">
              {t("session.your_burden")}
            </div>
            <p className="mt-1.5 line-clamp-3 text-sm leading-5 text-on-surface-variant">
              {sideBurden}
            </p>
          </div>
        </div>

        <div className="mt-3 rounded-md border border-outline-variant bg-surface-container px-3 py-2.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-primary-dim">
            {t("session.model_clarification")}
          </div>
          <p className="mt-1.5 text-sm leading-5 text-on-surface-variant">
            {motionBrief.modelClarification}
          </p>
        </div>

        {points.length > 0 ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-on-surface">
              <Lightbulb className="h-4 w-4 text-primary" />
              {t("session.argument_anchors")}
            </div>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              {points.map((point) => (
                <div
                  key={point}
                  className="flex min-h-[44px] gap-2 rounded-md border border-outline-variant bg-white px-3 py-2 text-sm leading-5 text-on-surface-variant"
                >
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
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
