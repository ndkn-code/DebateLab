"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  Bookmark,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  MessageCircle,
  Mic2,
  MoreVertical,
  Quote,
  Scale,
  Share2,
  Sparkles,
  Sprout,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DebateTimeline } from "@/components/feedback/debate-timeline";
import { buildSessionResultViewModel } from "@/lib/results/session-result";
import { cn } from "@/lib/utils";
import type { DebateSession } from "@/types";

interface SessionResultDashboardProps {
  session: DebateSession;
  backHref?: string;
  backLabel?: string;
  shareUrl?: string | null;
  actionBar?: React.ReactNode;
  afterPanel?: React.ReactNode;
}

const BAND_STYLES = {
  novice: {
    stroke: "#F87171",
    chip: "bg-[#FDECEC] text-[#C63B3B]",
  },
  developing: {
    stroke: "#FB923C",
    chip: "bg-[#FFF1E7] text-[#C96A18]",
  },
  competent: {
    stroke: "#F5B942",
    chip: "bg-[#FFF7E5] text-[#B88300]",
  },
  proficient: {
    stroke: "#2F76EF",
    chip: "bg-[#EAF9EF] text-[#1A9153]",
  },
  expert: {
    stroke: "#34C759",
    chip: "bg-[#EAF9EF] text-[#1A9153]",
  },
} as const;

const SKILL_ICONS: Partial<Record<string, LucideIcon>> = {
  clarity: MessageCircle,
  logic: Scale,
  rebuttal: Sprout,
  evidence: FileText,
  delivery: Mic2,
};

const HERO_CONFETTI = [
  "left-2 top-10 bg-[#F7C73E]",
  "left-0 top-[42%] bg-[#F36D7E]",
  "left-5 bottom-12 bg-[#6C99F6]",
  "left-14 bottom-24 bg-[#F5A3CF]",
  "right-8 top-4 bg-[#F7C73E]",
  "right-2 top-[38%] bg-[#F36D7E]",
  "right-7 bottom-16 bg-[#B9CBFA]",
] as const;

function toDisplayLocale(locale: string) {
  return locale === "vi" ? "vi-VN" : "en-US";
}

function toBandKey(band: string) {
  return String(band).toLowerCase() as keyof typeof BAND_STYLES;
}

function formatDateLabel(iso: string, locale: string) {
  return new Intl.DateTimeFormat(toDisplayLocale(locale), {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatTimeLabel(iso: string, locale: string) {
  return new Intl.DateTimeFormat(toDisplayLocale(locale), {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function formatDurationLabel(
  seconds: number,
  t: ReturnType<typeof useTranslations<"sessionResult.duration">>
) {
  if (seconds < 60) {
    return t("seconds", { count: seconds });
  }

  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) {
    return t("minutes", { count: totalMinutes });
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (minutes === 0) {
    return t("hours", { count: hours });
  }

  return t("hoursMinutes", { hours, minutes });
}

function getTrackLabel(
  session: DebateSession,
  t: ReturnType<typeof useTranslations<"sessionResult.tracks">>
) {
  const practiceTrack =
    session.feedback?.practiceTrack ?? session.practiceTrack ?? "debate";
  return t(practiceTrack);
}

function getModeLabel(
  session: DebateSession,
  t: ReturnType<typeof useTranslations<"sessionResult.modes">>
) {
  const practiceTrack =
    session.feedback?.practiceTrack ?? session.practiceTrack ?? "debate";
  if (practiceTrack === "speaking") {
    return t("singleSpeech");
  }

  return session.mode === "full" ? t("full") : t("quick");
}

function ResultList({
  title,
  icon: Icon,
  iconClassName,
  dotClassName,
  items,
  emptyMessage,
}: {
  title: string;
  icon: typeof CheckCircle2;
  iconClassName: string;
  dotClassName: string;
  items: string[];
  emptyMessage: string;
}) {
  return (
    <div className="min-w-0 px-0 py-1">
      <div className="flex items-center gap-3 text-base font-semibold text-[#071159]">
        <Icon className={cn("h-5 w-5", iconClassName)} />
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item} className="flex gap-3 text-[0.92rem] leading-6 text-[#30427A]">
              <span className={cn("mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full", dotClassName)} />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-[#30427A]">{emptyMessage}</p>
      )}
    </div>
  );
}

export function SessionResultDashboard({
  session,
  backHref,
  backLabel,
  shareUrl,
  actionBar,
  afterPanel,
}: SessionResultDashboardProps) {
  const t = useTranslations("sessionResult");
  const tSkills = useTranslations("analyticsPage.skills");
  const tDuration = useTranslations("sessionResult.duration");
  const tTracks = useTranslations("sessionResult.tracks");
  const tModes = useTranslations("sessionResult.modes");
  const locale = useLocale();
  const [displayScore, setDisplayScore] = useState(0);
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">("idle");
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const viewModel = useMemo(() => buildSessionResultViewModel(session), [session]);

  useEffect(() => {
    if (!viewModel) return;

    const target = viewModel.feedback.totalScore;
    const duration = 900;
    const startTime = performance.now();
    let frame = 0;

    const tick = (time: number) => {
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(eased * target));

      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [viewModel]);

  useEffect(() => {
    if (shareState === "idle") return;
    const timeout = window.setTimeout(() => setShareState("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [shareState]);

  if (!viewModel) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[#DFE8F8] bg-white p-6 text-center text-[#30427A] shadow-[0_18px_45px_rgba(16,32,72,0.035)]">
          {t("noFeedback")}
        </div>
      </div>
    );
  }

  const bandKey = toBandKey(viewModel.feedback.overallBand);
  const bandStyle = BAND_STYLES[bandKey];
  const circumference = 2 * Math.PI * 92;
  const strokeDashoffset =
    circumference * (1 - viewModel.feedback.totalScore / 100);
  const strongestMetric = viewModel.strongest.metric;
  const weakestMetric = viewModel.weakest.metric;
  const focusMetric = viewModel.focus.metric;

  const handleShare = async () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const resolvedUrl =
      typeof window !== "undefined"
        ? shareUrl
          ? new URL(shareUrl, baseUrl).toString()
          : window.location.href
        : shareUrl ?? "";
    const text = t("shareText", {
      score: viewModel.feedback.totalScore,
      topic: session.topic.title,
    });

    if (navigator.share) {
      try {
        await navigator.share({
          title: t("shareTitle"),
          text,
          url: resolvedUrl,
        });
        setShareState("shared");
        return;
      } catch {
        // Fall back to clipboard when share is cancelled or unavailable.
      }
    }

    const clipboardValue = resolvedUrl ? `${text} ${resolvedUrl}` : text;
    await navigator.clipboard.writeText(clipboardValue);
    setShareState("copied");
  };

  const metaItems = [
    {
      label: t("cards.side"),
      value: t(`sides.${session.side}`),
      icon: Target,
    },
    {
      label: t("cards.track"),
      value: getTrackLabel(session, tTracks),
      icon: Trophy,
    },
    {
      label: t("cards.mode"),
      value: getModeLabel(session, tModes),
      icon: UserRound,
    },
    {
      label: t("cards.category"),
      value: session.topic.category,
      icon: Bot,
    },
  ];
  const timelineItems = [
    {
      key: "date",
      value: formatDateLabel(session.date, locale),
      icon: CalendarDays,
    },
    {
      key: "time",
      value: formatTimeLabel(session.date, locale),
      icon: Clock3,
    },
    ...(session.duration > 0
      ? [
          {
            key: "duration",
            value: formatDurationLabel(session.duration, tDuration),
            icon: Clock3,
          },
        ]
      : []),
    ...(viewModel.practiceTrack === "debate" && session.aiDifficulty
      ? [
          {
            key: "difficulty",
            value: t(`difficulty.${session.aiDifficulty}`),
            icon: Sparkles,
          },
        ]
      : []),
  ];

  return (
    <div className="mx-auto max-w-[1560px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="inline-flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-[#0B185A] transition-colors hover:bg-white hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            {backLabel}
          </Link>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleShare}
            className="h-12 rounded-xl border-[#E1E8F7] bg-white px-5 text-[#0B185A] shadow-none hover:bg-[#F8FAFF]"
          >
            {shareState === "copied" || shareState === "shared" ? (
              <Check className="mr-2 h-4 w-4 text-primary" />
            ) : (
              <Share2 className="mr-2 h-4 w-4 text-primary" />
            )}
            {shareState === "idle" ? t("share") : t("shareCopied")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 w-12 rounded-xl border-[#E1E8F7] bg-white p-0 text-[#0B185A] shadow-none hover:bg-[#F8FAFF]"
            aria-label="More result actions"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <section className="rounded-2xl border border-[#DFE8F8] bg-white p-5 shadow-[0_18px_45px_rgba(16,32,72,0.035)] sm:p-6">
        <div className="grid gap-7 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)]">
          <div className="relative flex min-h-[245px] flex-col items-center justify-center overflow-hidden px-4 py-2">
            {HERO_CONFETTI.map((className) => (
              <span
                key={className}
                className={cn(
                  "absolute h-3 w-3 rotate-45 rounded-[3px]",
                  className
                )}
              />
            ))}

            <div className="relative flex h-[218px] w-[218px] items-center justify-center">
              <svg className="h-[218px] w-[218px] -rotate-90" viewBox="0 0 220 220" aria-hidden="true">
                <circle
                  cx="110"
                  cy="110"
                  r="92"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="10"
                  className="text-[#E8EEF9]"
                />
                <circle
                  cx="110"
                  cy="110"
                  r="92"
                  fill="none"
                  stroke={bandStyle.stroke}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-[stroke-dashoffset] duration-1000 ease-out"
                />
              </svg>

              <div className="absolute flex flex-col items-center">
                <span className="text-sm font-medium text-[#33457E]">
                  {t("scoreLabel")}
                </span>
                <span className="mt-1 text-[4rem] font-bold leading-none tracking-tight text-[#071159]">
                  {displayScore}
                </span>
                <span className="mt-2 text-lg text-[#33457E]">/100</span>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full px-4 py-1.5 text-sm font-semibold",
                  bandStyle.chip
                )}
              >
                {t(`encouragement.${bandKey}`)}
              </span>
            </div>
          </div>

          <div className="relative min-w-0 py-2 pr-0 sm:pr-6">
            <Button
              type="button"
              variant="ghost"
              className="absolute right-0 top-0 hidden h-10 w-10 rounded-xl p-0 text-[#243A78] hover:bg-[#F3F6FC] sm:flex"
              aria-label="Save result"
            >
              <Bookmark className="h-6 w-6" />
            </Button>

            <div className="flex flex-wrap items-start justify-between gap-4 pr-0 sm:pr-12">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight text-[#071159] sm:text-[1.7rem]">
                  {session.topic.title}
                </h1>
                <p className="mt-3 max-w-4xl text-[0.95rem] leading-6 text-[#30427A]">
                  {viewModel.feedback.summary}
                </p>
              </div>
            </div>

            <div className="mt-6 border-y border-[#E6ECF8] py-5">
              <div className="grid gap-y-5 sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-[#E6ECF8]">
                {metaItems.map(({ label, value, icon: Icon }) => (
                  <div key={label} className="flex gap-3 xl:px-8 xl:first:pl-0">
                    <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#243A78]" />
                    <div>
                      <p className="text-sm text-[#465B91]">{label}</p>
                      <p className="mt-1 text-[0.96rem] font-bold leading-6 text-[#071159]">
                        {value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-[#33457E]">
              {timelineItems.map(({ key, value, icon: Icon }, index) => (
                <span key={key} className="inline-flex items-center gap-2">
                  {index > 0 && (
                    <span className="-ml-2 mr-2 h-1 w-1 rounded-full bg-[#B6C4E2]" />
                  )}
                  {key === "difficulty" ? (
                    <>
                      <span className="rounded-md bg-[#EAF1FF] px-2 py-1 text-xs font-bold text-primary">
                        AI
                      </span>
                      <span>{value}</span>
                    </>
                  ) : (
                    <>
                      <Icon className="h-4 w-4 text-[#243A78]" />
                      {value}
                    </>
                  )}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-[#DFE8F8] bg-white p-5 shadow-[0_14px_34px_rgba(16,32,72,0.025)]">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#EAF9EF] text-[#1A9153]">
              <TrendingUp className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1A9153]">
                {t("insights.strongest")}
              </p>
              <p className="mt-2 text-xl font-bold text-[#071159]">
                {strongestMetric ? tSkills(strongestMetric.key) : "-"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#30427A]">
                {viewModel.strongest.note ?? t("fallbacks.strongest")}
              </p>
              {strongestMetric && (
                <span className="mt-4 inline-flex rounded-lg bg-[#EAF9EF] px-3 py-1.5 text-sm font-bold text-[#1A9153]">
                  {strongestMetric.score} /100
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DFE8F8] bg-white p-5 shadow-[0_14px_34px_rgba(16,32,72,0.025)]">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#FFF2E2] text-[#FF8A1F]">
              <TrendingDown className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#FF7A00]">
                {t("insights.needsWork")}
              </p>
              <p className="mt-2 text-xl font-bold text-[#071159]">
                {weakestMetric ? tSkills(weakestMetric.key) : "-"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#30427A]">
                {viewModel.weakest.note ?? t("fallbacks.needsWork")}
              </p>
              {weakestMetric && (
                <span className="mt-4 inline-flex rounded-lg bg-[#FFF1E1] px-3 py-1.5 text-sm font-bold text-[#FF7A00]">
                  {weakestMetric.score} /100
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#DFE8F8] bg-white p-5 shadow-[0_14px_34px_rgba(16,32,72,0.025)]">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-primary">
              <Target className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">
                {t("insights.nextFocus")}
              </p>
              <p className="mt-2 text-xl font-bold text-[#071159]">
                {focusMetric ? tSkills(focusMetric.key) : "-"}
              </p>
              <p className="mt-2 text-sm leading-6 text-[#30427A]">
                {viewModel.focus.note ?? t("fallbacks.focus")}
              </p>
              <div className="mt-4 inline-flex rounded-lg bg-[#EAF1FF] px-4 py-2 text-sm font-bold text-primary">
                {t("insights.focusCta")}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <h2 className="text-base font-bold text-[#071159]">
          {t("skillBreakdown")}
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {viewModel.metrics.map((metric) => {
            const Icon = SKILL_ICONS[metric.key] ?? Sparkles;
            const isWeakest = metric.key === weakestMetric?.key;

            return (
              <div
                key={metric.key}
                className="rounded-2xl border border-[#DFE8F8] bg-white p-5 shadow-[0_12px_30px_rgba(16,32,72,0.022)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isWeakest ? "text-[#FF7A00]" : "text-primary"
                      )}
                    />
                    <span className="text-sm font-bold text-[#071159]">
                      {tSkills(metric.key)}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "text-lg font-bold",
                      isWeakest ? "text-[#FF7A00]" : "text-[#071159]"
                    )}
                  >
                    {metric.score}
                    <span className="ml-1 text-sm font-medium text-[#465B91]">
                      /100
                    </span>
                  </span>
                </div>

                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#E8EEF9]">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width] duration-700 ease-out",
                      isWeakest ? "bg-[#FF8A1F]" : metric.progressClassName
                    )}
                    style={{ width: `${metric.score}%` }}
                  />
                </div>

                <p className="mt-4 text-sm leading-6 text-[#30427A]">
                  {t(`skillDescriptions.${metric.descriptionKey}`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[#DFE8F8] bg-white p-5 shadow-[0_14px_34px_rgba(16,32,72,0.025)] sm:p-6">
        <h2 className="text-base font-bold text-[#071159]">
          {t("detail.heading")}
        </h2>
        <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_1fr_1.05fr] xl:divide-x xl:divide-[#E6ECF8]">
          <div className="xl:pr-6">
            <ResultList
              title={t("detail.strengths")}
              icon={CheckCircle2}
              iconClassName="text-[#1A9153]"
              dotClassName="bg-[#1A9153]"
              items={viewModel.strengths}
              emptyMessage={t("detail.emptyStrengths")}
            />
          </div>
          <div className="xl:px-6">
            <ResultList
              title={t("detail.improvements")}
              icon={Target}
              iconClassName="text-[#FF7A00]"
              dotClassName="bg-[#FF7A00]"
              items={viewModel.improvements}
              emptyMessage={t("detail.emptyImprovements")}
            />
          </div>
          <div className="rounded-xl bg-[#F1F5FE] p-5 xl:ml-6">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <Quote className="h-5 w-5" />
              {viewModel.modelAnswerKind === "stronger-rebuild"
                ? t("detail.strongerRebuild")
                : t("detail.modelAnswer")}
            </div>
            <p className="mt-4 text-sm leading-7 text-[#29406F]">
              {viewModel.modelAnswer ?? viewModel.feedback.summary}
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[#E6ECF8] pt-5">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowTranscript((value) => !value)}
            className="min-h-[44px] rounded-xl px-4 text-primary hover:bg-[#EAF1FF]"
          >
            <FileText className="mr-2 h-4 w-4" />
            {showTranscript ? t("detail.hideTranscript") : t("detail.showTranscript")}
            {showTranscript ? (
              <ChevronUp className="ml-2 h-4 w-4" />
            ) : (
              <ChevronDown className="ml-2 h-4 w-4" />
            )}
          </Button>

          {viewModel.rounds.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowTimeline((value) => !value)}
              className="min-h-[44px] rounded-xl px-4 text-primary hover:bg-[#EAF1FF]"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {showTimeline ? t("detail.hideTimeline") : t("detail.showTimeline")}
              {showTimeline ? (
                <ChevronUp className="ml-2 h-4 w-4" />
              ) : (
                <ChevronDown className="ml-2 h-4 w-4" />
              )}
            </Button>
          )}
        </div>

        {showTranscript && (
          <div className="mt-4 rounded-xl border border-[#E6ECF8] bg-[#FBFCFF] p-5">
            <h3 className="text-base font-semibold text-[#071159]">
              {t("detail.transcript")}
            </h3>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#30427A]">
              {viewModel.transcript || t("detail.emptyTranscript")}
            </p>
          </div>
        )}

        {showTimeline && viewModel.rounds.length > 0 && (
          <div className="mt-4 rounded-xl border border-[#E6ECF8] bg-[#FBFCFF] p-5">
            <h3 className="mb-4 text-base font-semibold text-[#071159]">
              {t("detail.timeline")}
            </h3>
            <DebateTimeline rounds={viewModel.rounds} />
          </div>
        )}
      </div>

      {actionBar && <div className="mt-5">{actionBar}</div>}

      {afterPanel ? <div className="mt-6 space-y-4">{afterPanel}</div> : null}
    </div>
  );
}
