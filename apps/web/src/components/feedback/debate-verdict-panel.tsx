"use client";

import { useTranslations } from "next-intl";
import {
  Bot,
  CheckCircle2,
  MessageCircle,
  Scale,
  Sparkles,
  Star,
  Target,
  Trophy,
  UserRound,
  UsersRound,
} from "@/components/ui/icons";
import type { DebateSession } from "@/types";
import { cn } from "@/lib/utils";

interface DebateVerdictPanelProps {
  session: DebateSession;
}

function getVerdictCopy(winner: "user" | "ai" | "tie") {
  if (winner === "user") {
    return {
      eyebrowKey: "user.eyebrow",
      titleKey: "user.title",
      chip: "bg-[#EAF9EF] text-[#168A45] ring-[#CDEED9]",
      iconBg: "bg-[#EAF9EF] text-[#168A45]",
      hero: "border-[#BFEBD0] bg-[linear-gradient(135deg,#F8FFFB_0%,#F1FAF5_58%,#F8FBFF_100%)]",
      accent: "#34C759",
      softAccent: "#EAF9EF",
      Icon: Trophy,
    };
  }

  if (winner === "ai") {
    return {
      eyebrowKey: "ai.eyebrow",
      titleKey: "ai.title",
      chip: "bg-[#FFF5E2] text-[#B45309] ring-[#F9D889]",
      iconBg: "bg-[#FFF5E2] text-[#B45309]",
      hero: "border-[#F9D889] bg-[linear-gradient(135deg,#FFFDF8_0%,#FFF7E8_58%,#F8FBFF_100%)]",
      accent: "#F5B942",
      softAccent: "#FFF5E2",
      Icon: Bot,
    };
  }

  return {
    eyebrowKey: "tie.eyebrow",
    titleKey: "tie.title",
    chip: "bg-[#EAF1FF] text-[#245FD6] ring-[#CFE0FF]",
    iconBg: "bg-[#EAF1FF] text-[#245FD6]",
    hero: "border-[#CFE0FF] bg-[linear-gradient(135deg,#FFFFFF_0%,#F1F6FD_58%,#F8FBFF_100%)]",
    accent: "#4D86F7",
    softAccent: "#EAF1FF",
    Icon: Scale,
  };
}

const REASON_ICONS = [MessageCircle, UsersRound, Target] as const;

const CONFETTI = [
  "left-[3.5%] top-[23%] bg-[#F7C73E]",
  "left-[2.5%] bottom-[20%] bg-[#F36D7E]",
  "left-[11%] bottom-[12%] bg-[#F5A3CF]",
  "right-[31%] top-[18%] bg-[#EF6A6A]",
  "right-[30%] bottom-[32%] bg-[#6C99F6]",
] as const;

function ConfidenceRing({
  confidence,
  accent,
}: {
  confidence: number;
  accent: string;
}) {
  const percent = Math.round(confidence * 100);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, percent)) / 100);

  return (
    <div className="relative mx-auto h-[144px] w-[144px]">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 144 144">
        <circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke="#E5EDF9"
          strokeWidth="10"
        />
        <circle
          cx="72"
          cy="72"
          r={radius}
          fill="none"
          stroke={accent}
          strokeLinecap="round"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="text-4xl font-black tracking-tight text-[#071159]">
          {percent}%
        </span>
      </div>
    </div>
  );
}

export function DebateVerdictPanel({ session }: DebateVerdictPanelProps) {
  const t = useTranslations("sessionResult.verdictPanel");
  const verdict = session.feedback?.debateVerdict;

  if (!verdict) {
    return (
      <section className="rounded-2xl border border-[#DEE8F8] bg-white p-8 text-center shadow-[0_18px_45px_rgba(16,32,72,0.035)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF1FF] text-[#4D86F7]">
          <Trophy className="h-5 w-5" />
        </div>
        <h2 className="mt-4 text-2xl font-bold text-[#0B1424]">
          {t("fallback.title")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#718096]">
          {t("fallback.body")}
        </p>
      </section>
    );
  }

  const copy = getVerdictCopy(verdict.winner);
  const Icon = copy.Icon;
  const confidencePercent = Math.round(verdict.confidence * 100);
  const filledStars = Math.max(1, Math.min(5, Math.round(confidencePercent / 20)));

  return (
    <section className="rounded-[28px] border border-[#DEE8F8] bg-white p-5 shadow-[0_22px_60px_rgba(16,32,72,0.045)] sm:p-7">
      <div
        className={cn(
          "relative overflow-hidden rounded-[24px] border p-5 sm:p-7 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8",
          copy.hero
        )}
      >
        {CONFETTI.map((className) => (
          <span
            key={className}
            className={cn(
              "pointer-events-none absolute hidden h-3 w-3 rotate-45 rounded-[3px] lg:block",
              className
            )}
          />
        ))}

        <div className="relative flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center lg:gap-8">
          <div
            className={cn(
              "flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-white/80 shadow-[0_18px_36px_rgba(22,32,51,0.06)] sm:h-32 sm:w-32",
              copy.iconBg
            )}
          >
            <Icon className="h-16 w-16" strokeWidth={2.1} />
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black ring-1",
                  copy.chip
                )}
              >
                <CheckCircle2 className="h-4 w-4" />
                {t(copy.eyebrowKey)}
              </span>
            </div>
            <h2 className="mt-5 max-w-4xl text-4xl font-black leading-[1.05] tracking-normal text-[#071159] sm:text-5xl lg:text-[3.45rem]">
              {t(copy.titleKey)}
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[#52648A]">
              {verdict.summary}
            </p>
          </div>
        </div>

        <div className="relative mt-6 rounded-[22px] border border-[#DEE8F8] bg-white/90 p-5 shadow-[0_18px_36px_rgba(16,32,72,0.045)] lg:mt-0">
          <p className="text-center text-base font-bold text-[#415069]">
            {t("confidence")}
          </p>
          <ConfidenceRing confidence={verdict.confidence} accent="#4D86F7" />
          <div className="mt-3 border-t border-[#DEE8F8] pt-4">
            <div
              aria-label={t("confidenceStars", { count: filledStars })}
              className="flex justify-center gap-2 text-[#4D86F7]"
            >
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  className={cn(
                    "h-6 w-6",
                    index < filledStars
                      ? "fill-[#4D86F7] text-[#4D86F7]"
                      : "fill-white text-[#4D86F7]"
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_0.72fr]">
        <div className="rounded-[24px] border border-[#DEE8F8] bg-white p-5 shadow-[0_16px_36px_rgba(16,32,72,0.035)] sm:p-6">
          <div className="flex items-center gap-3 text-2xl font-black text-[#071159]">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF1FF] text-[#4D86F7]"
            >
              <Scale className="h-6 w-6" />
            </div>
            {t("whyDecision")}
          </div>

          <div className="relative mt-6 space-y-4 pl-12">
            <span className="absolute bottom-8 left-5 top-8 w-px bg-[#DEE8F8]" />
            {verdict.decidingReasons.length > 0 ? (
              verdict.decidingReasons.map((reason, index) => (
                <div
                  key={`${reason}-${index}`}
                  className="relative rounded-[18px] border border-[#DEE8F8] bg-[linear-gradient(180deg,#FFFFFF_0%,#FBFCFF_100%)] p-4 shadow-[0_10px_22px_rgba(16,32,72,0.025)] sm:grid sm:grid-cols-[56px_minmax(0,1fr)] sm:items-center sm:gap-4"
                >
                  <span className="absolute -left-[3.05rem] top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#4D86F7] text-sm font-black text-white shadow-[0_8px_18px_rgba(77,134,247,0.26)]">
                    {index + 1}
                  </span>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF4FF] text-[#4D86F7] sm:mb-0">
                    {(() => {
                      const ReasonIcon = REASON_ICONS[index % REASON_ICONS.length];
                      return <ReasonIcon className="h-5 w-5" />;
                    })()}
                  </div>
                  <span className="text-sm leading-6 text-[#415069]">
                    <span className="sr-only">
                      {t("reasonLabel", { number: index + 1 })}
                    </span>
                    {reason}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-[#30427A]">
                {t("emptyReasons")}
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-[#D9E6FF] bg-[linear-gradient(145deg,#FFFFFF_0%,#F1F6FD_100%)] p-5 shadow-[0_16px_36px_rgba(16,32,72,0.035)] sm:p-6">
          <div className="flex items-center gap-3 text-2xl font-black text-[#071159]">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF1FF] text-[#4D86F7]">
              <Sparkles className="h-6 w-6" />
            </div>
            {t("nextMove")}
          </div>

          <div className="mt-6 rounded-[20px] border border-[#D9E6FF] bg-white/80 p-5">
            <div className="flex gap-5">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#EAF1FF] text-[#4D86F7]">
                <Target className="h-10 w-10" />
              </div>
              <p className="text-xl font-black leading-8 text-[#071159]">
                {t("nextMovePrompt")}
              </p>
            </div>
            <div className="mt-6 border-t border-[#DEE8F8]" />
            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#EAF1FF] text-[#4D86F7]">
                <UserRound className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold leading-6 text-[#52648A]">
                {verdict.nextMove}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
