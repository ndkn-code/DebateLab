"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpenText,
  CheckCircle2,
  ChevronDown,
  Info,
  Lightbulb,
} from "@/components/ui/icons";
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

function normalizeForComparison(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function CoachBriefItem({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl bg-surface-container px-3.5 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 text-sm leading-6 text-on-surface">{text}</p>
    </div>
  );
}

/**
 * Motion card. Mirrors what real formats (WSDC, Trường Teen) hand to teams:
 * the motion plus an optional info slide. Burden / model / suggested points
 * are coaching aids, so they live in a collapsed "coach hints" drawer.
 */
export function MotionInfoPanel({
  topic,
  side,
  className,
}: MotionInfoPanelProps) {
  const t = useTranslations("dashboard.practice");
  const locale = useLocale();
  const [briefOpen, setBriefOpen] = useState(false);

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
  // The fallback brief generator copies context into scope — hide the dupe.
  const scope =
    normalizeForComparison(motionBrief.scope) ===
    normalizeForComparison(topic.context)
      ? null
      : motionBrief.scope;
  const infoLine = topic.context || t("session.motion_default_context");
  const hasCoachBrief = Boolean(
    sideBurden || motionBrief.modelClarification || scope || points.length > 0
  );

  return (
    <section
      className={cn(
        "rounded-[1.25rem] border border-outline-variant bg-surface p-5 shadow-token-card sm:p-6",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-primary-container px-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-primary-dim">
          <BookOpenText className="h-3 w-3" />
          {t("session.motion")}
        </span>
        <span
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold",
            side === "proposition"
              ? "bg-success-container text-success-dim"
              : "bg-error-container text-error-dim"
          )}
        >
          {sideLabel}
        </span>
        <span className="inline-flex h-6 items-center rounded-full bg-surface-container px-2.5 text-[11px] font-semibold text-on-surface-variant">
          {difficultyLabel}
        </span>
        <span className="hidden h-6 min-w-0 max-w-full items-center truncate rounded-full bg-surface-container px-2.5 text-[11px] font-semibold text-on-surface-variant sm:inline-flex">
          {topic.category}
        </span>
      </div>

      <h1 className="mt-3.5 text-balance text-[1.3rem] font-bold leading-snug tracking-[-0.01em] text-on-surface md:text-[1.5rem]">
        {topic.title}
      </h1>

      <p className="mt-3 flex gap-2 text-sm leading-6 text-on-surface-variant">
        <Info className="mt-1 h-4 w-4 shrink-0 text-primary" />
        <span>{infoLine}</span>
      </p>

      {hasCoachBrief ? (
        <div className="mt-4 border-t border-outline-variant/60 pt-3">
          <button
            type="button"
            onClick={() => setBriefOpen((open) => !open)}
            aria-expanded={briefOpen}
            className="inline-flex items-center gap-1.5 rounded-full px-1 py-0.5 text-[13px] font-bold text-primary transition-colors hover:text-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Lightbulb className="h-4 w-4" />
            {t("session.coach_brief")}
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                briefOpen && "rotate-180"
              )}
            />
          </button>

          <AnimatePresence initial={false}>
            {briefOpen ? (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="grid gap-2 pt-3 md:grid-cols-2">
                  {sideBurden ? (
                    <CoachBriefItem
                      label={t("session.your_burden")}
                      text={sideBurden}
                    />
                  ) : null}
                  {motionBrief.modelClarification ? (
                    <CoachBriefItem
                      label={t("session.model_clarification")}
                      text={motionBrief.modelClarification}
                    />
                  ) : null}
                  {scope ? (
                    <CoachBriefItem
                      label={t("session.motion_scope")}
                      text={scope}
                    />
                  ) : null}
                </div>

                {points.length > 0 ? (
                  <div className="pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-on-surface-variant">
                      {t("session.argument_anchors")}
                    </p>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {points.map((point) => (
                        <li
                          key={point}
                          className="flex gap-2 text-sm leading-6 text-on-surface"
                        >
                          <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-success" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </section>
  );
}
