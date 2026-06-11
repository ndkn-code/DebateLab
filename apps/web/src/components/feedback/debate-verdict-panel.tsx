"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Sparkles, Target, Trophy } from "@/components/ui/icons";
import type { DebateSession } from "@/types";
import { cn } from "@/lib/utils";

interface DebateVerdictPanelProps {
  session: DebateSession;
}

/**
 * Outcome styling uses design tokens only; the mascot pose carries the
 * emotion (placeholder assets from the illustration system — swappable).
 */
function getVerdictCopy(winner: "user" | "ai" | "tie") {
  if (winner === "user") {
    return {
      eyebrowKey: "user.eyebrow",
      titleKey: "user.title",
      chip: "bg-success-container text-success-dim",
      mascot: "/images/mascot/mascot-trophy.webp",
    };
  }

  if (winner === "ai") {
    return {
      eyebrowKey: "ai.eyebrow",
      titleKey: "ai.title",
      chip: "bg-primary-container text-primary-dim",
      mascot: "/images/mascot/mascot-oops.webp",
    };
  }

  return {
    eyebrowKey: "tie.eyebrow",
    titleKey: "tie.title",
    chip: "bg-surface-container text-on-surface-variant",
    mascot: "/images/mascot/mascot-thinking.webp",
  };
}

function ConfidenceRing({ confidence }: { confidence: number }) {
  const percent = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent / 100);

  return (
    <div className="relative h-20 w-20">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--color-surface-container-high)"
          strokeWidth="8"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="var(--color-primary)"
          strokeLinecap="round"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-lg font-extrabold text-on-surface">
        {percent}%
      </span>
    </div>
  );
}

export function DebateVerdictPanel({ session }: DebateVerdictPanelProps) {
  const t = useTranslations("sessionResult.verdictPanel");
  const verdict = session.feedback?.debateVerdict;

  if (!verdict) {
    return (
      <section className="rounded-[1.5rem] border border-outline-variant bg-surface p-10 text-center shadow-token-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-container text-primary">
          <Trophy className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-xl font-extrabold text-on-surface">
          {t("fallback.title")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
          {t("fallback.body")}
        </p>
      </section>
    );
  }

  const copy = getVerdictCopy(verdict.winner);

  return (
    // Container queries: the review shell's main column can be much narrower
    // than the viewport, so layout decisions key off the panel's own width.
    <div className="@container flex flex-col gap-5">
      {/* Hero */}
      <section className="rounded-[1.5rem] border border-outline-variant bg-surface p-6 shadow-token-card sm:p-10">
        <div className="flex flex-col items-center gap-7 text-center @3xl:flex-row @3xl:items-center @3xl:gap-10 @3xl:text-left">
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center @3xl:h-44 @3xl:w-44">
            <span
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-surface-container"
            />
            <Image
              src={copy.mascot}
              alt=""
              aria-hidden="true"
              width={1254}
              height={1254}
              className="relative h-auto w-32 object-contain @3xl:w-40"
              sizes="160px"
            />
          </div>

          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3.5 py-1.5 text-[12.5px] font-extrabold",
                copy.chip
              )}
            >
              {t(copy.eyebrowKey)}
            </span>
            <h2 className="mt-3 text-balance text-3xl font-extrabold leading-[1.1] tracking-[-0.01em] text-on-surface @3xl:text-4xl">
              {t(copy.titleKey)}
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-on-surface @3xl:mx-0">
              {verdict.summary}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center gap-2">
            <ConfidenceRing confidence={verdict.confidence} />
            <p className="max-w-[120px] text-center text-[12px] font-bold text-on-surface-variant">
              {t("confidence")}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-5 @5xl:grid-cols-[minmax(0,1fr)_0.66fr]">
        {/* Why this decision */}
        <section className="rounded-[1.5rem] border border-outline-variant bg-surface p-6 shadow-token-card sm:p-7">
          <h3 className="text-lg font-extrabold text-on-surface">
            {t("whyDecision")}
          </h3>

          <ol className="mt-5 flex flex-col gap-3">
            {verdict.decidingReasons.length > 0 ? (
              verdict.decidingReasons.map((reason, index) => (
                <li
                  key={`${reason}-${index}`}
                  className="flex items-start gap-3.5 rounded-2xl bg-surface-container/60 p-4"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-extrabold text-on-primary">
                    {index + 1}
                  </span>
                  <p className="text-[15px] leading-7 text-on-surface">
                    <span className="sr-only">
                      {t("reasonLabel", { number: index + 1 })}
                    </span>
                    {reason}
                  </p>
                </li>
              ))
            ) : (
              <p className="text-sm leading-6 text-on-surface-variant">
                {t("emptyReasons")}
              </p>
            )}
          </ol>
        </section>

        {/* Next move */}
        <section className="flex flex-col rounded-[1.5rem] border border-outline-variant bg-surface p-6 shadow-token-card sm:p-7">
          <h3 className="inline-flex items-center gap-2 text-lg font-extrabold text-on-surface">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("nextMove")}
          </h3>

          <div className="mt-5 flex flex-1 flex-col rounded-2xl bg-primary-container/50 p-5">
            <p className="inline-flex items-start gap-3 text-[15px] font-extrabold leading-7 text-on-surface">
              <Target className="mt-1 h-5 w-5 shrink-0 text-primary" />
              {t("nextMovePrompt")}
            </p>
            <p className="mt-4 text-[15px] leading-7 text-on-surface">
              {verdict.nextMove}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
