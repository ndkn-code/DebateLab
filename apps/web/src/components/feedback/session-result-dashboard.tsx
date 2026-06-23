"use client";

import { curveNatural } from "@visx/curve";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  BookOpenText,
  Bookmark,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Clock3,
  Dumbbell,
  FileText,
  Lightbulb,
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
} from "@/components/ui/icons";
import type { LucideIcon } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Eyebrow, Heading } from "@/components/ui/typography";
import {
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  Ring,
  RingCenter,
  RingChart,
} from "@/components/charts";
import { ChartCard } from "@/components/data-viz";
import { SuccessCheck } from "@/components/motion";
import { AnnotatedTranscript } from "@/components/feedback/annotated-transcript";
import { DebateTimeline } from "@/components/feedback/debate-timeline";
import {
  buildSessionResultViewModel,
  getFullRoundWinnerResult,
} from "@/lib/results/session-result";
import { cn } from "@/lib/utils";
import type { DebateRound, DebateSession } from "@/types";

interface SessionResultDashboardProps {
  session: DebateSession;
  backHref?: string;
  backLabel?: string;
  shareUrl?: string | null;
  actionBar?: React.ReactNode;
  afterPanel?: React.ReactNode;
  defaultShowTranscript?: boolean;
  defaultShowTimeline?: boolean;
  showInlineReviewControls?: boolean;
  className?: string;
}

const BAND_STYLES = {
  novice: {
    ring: "var(--color-chart-7)",
    chip: "bg-error-container text-on-surface-variant",
  },
  developing: {
    ring: "var(--color-chart-4)",
    chip: "bg-surface-container text-on-surface-variant",
  },
  competent: {
    ring: "var(--color-chart-4)",
    chip: "bg-surface-container text-on-surface-variant",
  },
  proficient: {
    ring: "var(--chart-line-secondary)",
    chip: "bg-surface-container text-on-surface-variant",
  },
  expert: {
    ring: "var(--chart-line-primary)",
    chip: "bg-surface-container text-on-surface-variant",
  },
} as const;

const CHART_SERIES_COLORS = [
  "var(--chart-line-primary)",
  "var(--chart-line-secondary)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
] as const;

const SKILL_ICONS: Partial<Record<string, LucideIcon>> = {
  clarity: MessageCircle,
  logic: Scale,
  rebuttal: Sprout,
  evidence: FileText,
  delivery: Mic2,
};

const HERO_CONFETTI = [
  "left-2 top-10 bg-surface-container",
  "left-0 top-[42%] bg-surface-container",
  "left-5 bottom-12 bg-surface-container-high",
  "left-14 bottom-24 bg-surface-container",
  "right-8 top-4 bg-surface-container",
  "right-2 top-[38%] bg-surface-container",
  "right-7 bottom-16 bg-surface-container-high",
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
  t: ReturnType<typeof useTranslations<"sessionResult.duration">>,
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

function formatTimeBoxLabel(
  seconds: number | undefined,
  t: ReturnType<typeof useTranslations<"sessionResult.coaching">>,
) {
  if (!seconds) return null;
  if (seconds < 60) return t("seconds", { count: seconds });
  return t("minutes", { count: Math.round(seconds / 60) });
}

function getSeriesColor(index: number) {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}

function buildRoundTimelineData(rounds: DebateRound[]) {
  return rounds.map((round, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)),
    progress: index + 1,
    label: round.label,
    duration: round.duration ?? 0,
    roundNumber: round.roundNumber,
  }));
}

function getTrackLabel(
  session: DebateSession,
  t: ReturnType<typeof useTranslations<"sessionResult.tracks">>,
) {
  const practiceTrack =
    session.feedback?.practiceTrack ?? session.practiceTrack ?? "debate";
  return t(practiceTrack);
}

function getModeLabel(
  session: DebateSession,
  t: ReturnType<typeof useTranslations<"sessionResult.modes">>,
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
      <div className="flex items-center gap-3 text-base font-semibold text-on-surface">
        <Icon className={cn("h-5 w-5", iconClassName)} />
        {title}
      </div>
      {items.length > 0 ? (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li
              key={item}
              className="flex gap-3 type-body-sm leading-6 text-on-surface-variant"
            >
              <span
                className={cn(
                  "mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full",
                  dotClassName,
                )}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm leading-6 text-on-surface-variant">
          {emptyMessage}
        </p>
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
  defaultShowTranscript = false,
  defaultShowTimeline = false,
  showInlineReviewControls = true,
  className,
}: SessionResultDashboardProps) {
  const t = useTranslations("sessionResult");
  const tSkills = useTranslations("analyticsPage.skills");
  const tDuration = useTranslations("sessionResult.duration");
  const tTracks = useTranslations("sessionResult.tracks");
  const tModes = useTranslations("sessionResult.modes");
  const tCoaching = useTranslations("sessionResult.coaching");
  const locale = useLocale();
  const [shareState, setShareState] = useState<"idle" | "copied" | "shared">(
    "idle",
  );
  const [showTranscript, setShowTranscript] = useState(defaultShowTranscript);
  const [showTimeline, setShowTimeline] = useState(defaultShowTimeline);
  const viewModel = useMemo(
    () => buildSessionResultViewModel(session),
    [session],
  );

  useEffect(() => {
    if (shareState === "idle") return;
    const timeout = window.setTimeout(() => setShareState("idle"), 2200);
    return () => window.clearTimeout(timeout);
  }, [shareState]);

  if (!viewModel) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-outline-variant bg-white p-6 text-center text-on-surface-variant shadow-token-card">
          {t("noFeedback")}
        </div>
      </div>
    );
  }

  const bandKey = toBandKey(viewModel.feedback.overallBand);
  const bandStyle = BAND_STYLES[bandKey];
  const overallRingData = [
    {
      label: t("scoreLabel"),
      value: viewModel.feedback.totalScore,
      maxValue: 100,
      color: bandStyle.ring,
    },
  ];
  const winnerResult = getFullRoundWinnerResult(
    session,
    viewModel.practiceTrack,
  );
  const strongestMetric = viewModel.strongest.metric;
  const weakestMetric = viewModel.weakest.metric;
  const focusMetric = viewModel.focus.metric;
  const roundTimelineData = buildRoundTimelineData(viewModel.rounds);
  const caseworkItems = [
    {
      label: t("casework.caseSummary"),
      value: viewModel.feedback.caseSummary,
      icon: Scale,
    },
    {
      label: t("casework.stance"),
      value: viewModel.feedback.stanceFeedback,
      icon: Target,
    },
    {
      label: t("casework.weighing"),
      value: viewModel.feedback.weighingFeedback,
      icon: Trophy,
    },
    {
      label: t("casework.clash"),
      value: viewModel.feedback.clashFeedback,
      icon: MessageCircle,
    },
  ].filter((item): item is { label: string; value: string; icon: LucideIcon } =>
    Boolean(item.value),
  );
  const argumentBreakdowns = viewModel.feedback.argumentBreakdowns ?? [];
  const scoreRationale = viewModel.feedback.scoreRationale;
  const scoreRationaleCategories = scoreRationale
    ? [
        {
          key: "content" as const,
          value: scoreRationale.content,
          icon: Scale,
        },
        {
          key: "structure" as const,
          value: scoreRationale.structure,
          icon: Target,
        },
        {
          key: "language" as const,
          value: scoreRationale.language,
          icon: Mic2,
        },
        {
          key: "persuasion" as const,
          value: scoreRationale.persuasion,
          icon: Trophy,
        },
      ]
    : [];
  const hasCasework =
    viewModel.practiceTrack === "debate" &&
    (caseworkItems.length > 0 || argumentBreakdowns.length > 0);
  const hasNoteReview = Boolean(viewModel.prepNotes);
  const hasImprovementPlan = viewModel.improvementPlan.length > 0;
  const hasShadowExamples = viewModel.shadowExamples.length > 0;
  const hasLearningReview =
    hasNoteReview || hasImprovementPlan || hasShadowExamples;

  const handleShare = async () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    const resolvedUrl =
      typeof window !== "undefined"
        ? shareUrl
          ? new URL(shareUrl, baseUrl).toString()
          : window.location.href
        : (shareUrl ?? "");
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
    <div
      className={cn("mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8", className)}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {backHref && backLabel ? (
          <Link
            href={backHref}
            className="inline-flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white hover:text-primary"
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
            className="h-12 rounded-xl border-outline-variant bg-white px-5 text-on-surface-variant shadow-none hover:bg-surface-container"
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
            className="h-12 w-12 rounded-xl border-outline-variant bg-white p-0 text-on-surface-variant shadow-none hover:bg-surface-container"
            aria-label="More result actions"
          >
            <MoreVertical className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <section className="rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card sm:p-6">
        <div className="grid gap-7 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)]">
          <div className="relative flex min-h-[245px] flex-col items-center justify-center overflow-hidden px-4 py-2">
            {HERO_CONFETTI.map((className) => (
              <span
                key={className}
                className={cn(
                  "absolute h-3 w-3 rotate-45 rounded-[3px]",
                  className,
                )}
              />
            ))}

            <div
              className="relative flex h-[218px] w-[218px] items-center justify-center"
              aria-label={`${viewModel.feedback.totalScore} out of 100`}
            >
              <RingChart
                data={overallRingData}
                size={218}
                strokeWidth={12}
                baseInnerRadius={74}
                ringGap={0}
              >
                <Ring index={0} color={bandStyle.ring} />
                <RingCenter defaultLabel={t("scoreLabel")} />
              </RingChart>
              <SuccessCheck
                className="absolute right-3 top-3 rounded-full bg-[var(--card-bg)] p-1 shadow-token-card"
                size={40}
              />
              <span className="sr-only">out of 100</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              <span
                className={cn(
                  "inline-flex rounded-full px-4 py-1.5 text-sm font-semibold",
                  bandStyle.chip,
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
              className="absolute right-0 top-0 hidden h-10 w-10 rounded-xl p-0 text-on-surface-variant hover:bg-surface-container sm:flex"
              aria-label="Save result"
            >
              <Bookmark className="h-6 w-6" />
            </Button>

            <div className="flex flex-wrap items-start justify-between gap-4 pr-0 sm:pr-12">
              <div className="min-w-0">
                <Heading as="h1" level={2}>
                  {session.topic.title}
                </Heading>
                <p className="mt-3 max-w-4xl text-base leading-8 text-on-surface">
                  {viewModel.feedback.summary}
                </p>
                {winnerResult && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-2 rounded-xl bg-primary-container px-3 py-2 text-sm font-bold text-primary ring-1 ring-outline-variant">
                      <Trophy className="h-4 w-4" />
                      {winnerResult.kind === "tie"
                        ? `${t("winner.tieLabel")}: ${t("winner.tie")}`
                        : `${t("winner.label")}: ${t(
                            `winner.sides.${winnerResult.side}`,
                          )}`}
                    </span>
                    <span className="rounded-xl bg-background px-3 py-2 text-xs font-semibold text-on-surface-variant ring-1 ring-outline-variant">
                      {t("winner.confidence", {
                        confidence: Math.round(winnerResult.confidence * 100),
                      })}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Session facts as one quiet chip row — replaces the cramped
                divided meta grid + separate timeline line. */}
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-outline-variant pt-5">
              {metaItems.map(({ label, value, icon: Icon }) => (
                <span
                  key={label}
                  className="inline-flex max-w-full items-center gap-2 rounded-full bg-surface-container px-3.5 py-2 type-caption font-bold text-on-surface"
                >
                  <Icon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate">{value}</span>
                </span>
              ))}
              {timelineItems.map(({ key, value, icon: Icon }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-2 rounded-full bg-surface-container px-3.5 py-2 type-caption font-semibold text-on-surface-variant"
                >
                  {key === "difficulty" ? (
                    <span className="rounded bg-primary-container px-1.5 py-0.5 type-caption font-extrabold text-primary-dim">
                      AI
                    </span>
                  ) : (
                    <Icon className="h-4 w-4 shrink-0" />
                  )}
                  {value}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-success-container text-success-dim">
              <TrendingUp className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-on-surface">
                {t("insights.strongest")}
              </p>
              <p className="mt-2 text-xl font-bold text-on-surface">
                {strongestMetric ? tSkills(strongestMetric.key) : "-"}
              </p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {viewModel.strongest.note ?? t("fallbacks.strongest")}
              </p>
              {strongestMetric && (
                <span className="mt-4 inline-flex rounded-lg bg-surface-container px-3 py-1.5 text-sm font-bold text-on-surface">
                  {strongestMetric.score}
                  <span className="sr-only"> out of 100</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-warning-container text-on-warning-container">
              <TrendingDown className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-on-surface">
                {t("insights.needsWork")}
              </p>
              <p className="mt-2 text-xl font-bold text-on-surface">
                {weakestMetric ? tSkills(weakestMetric.key) : "-"}
              </p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {viewModel.weakest.note ?? t("fallbacks.needsWork")}
              </p>
              {weakestMetric && (
                <span className="mt-4 inline-flex rounded-lg bg-surface-container px-3 py-1.5 text-sm font-bold text-on-surface">
                  {weakestMetric.score}
                  <span className="sr-only"> out of 100</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary">
              <Target className="h-9 w-9" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-primary">
                {t("insights.nextFocus")}
              </p>
              <p className="mt-2 text-xl font-bold text-on-surface">
                {focusMetric ? tSkills(focusMetric.key) : "-"}
              </p>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {viewModel.focus.note ?? t("fallbacks.focus")}
              </p>
              <div className="mt-4 inline-flex rounded-lg bg-primary-container px-4 py-2 text-sm font-bold text-primary">
                {t("insights.focusCta")}
              </div>
            </div>
          </div>
        </div>
      </div>

      {roundTimelineData.length > 1 && (
        <ChartCard
          className="mt-5"
          eyebrow={t("detail.timeline")}
          title={t("detail.timeline")}
          subtitle={t("detail.showTimeline")}
        >
          <div className="h-48">
            <LineChart
              data={roundTimelineData}
              margin={{ top: 28, right: 28, bottom: 20, left: 28 }}
              xDataKey="date"
            >
              <Grid horizontal />
              <Line
                dataKey="progress"
                curve={curveNatural}
                showMarkers
                stroke="var(--chart-line-primary)"
                strokeWidth={3}
              />
              <ChartTooltip
                showDatePill={false}
                rows={(point) => {
                  const duration =
                    typeof point.duration === "number" && point.duration > 0
                      ? formatDurationLabel(point.duration, tDuration)
                      : `#${point.roundNumber}`;

                  return [
                    {
                      color: "var(--chart-line-primary)",
                      label: String(point.label),
                      value: duration,
                    },
                  ];
                }}
              />
            </LineChart>
          </div>
          <div
            className="mt-3 grid gap-2 text-center type-caption font-semibold text-on-surface-variant"
            style={{
              gridTemplateColumns: `repeat(${roundTimelineData.length}, minmax(0, 1fr))`,
            }}
          >
            {roundTimelineData.map((round) => (
              <span key={round.roundNumber} className="truncate">
                {round.label}
              </span>
            ))}
          </div>
        </ChartCard>
      )}

      {hasLearningReview && (
        <section className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          {viewModel.prepNotes && (
            <div className="rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-base font-bold text-on-surface">
                    <BookOpenText className="h-5 w-5 text-primary" />
                    {tCoaching("notes.heading")}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                    {tCoaching("notes.meta", {
                      count: viewModel.prepNotes.wordCount,
                    })}
                  </p>
                </div>
                <span className="rounded-xl bg-surface-container px-3 py-2 text-xs font-bold text-on-surface-variant ring-1 ring-outline-variant">
                  {tCoaching("notes.saved")}
                </span>
              </div>

              <div
                className="mt-4 max-h-[280px] min-h-[120px] overflow-y-auto rounded-xl border border-outline-variant bg-surface-container p-4 text-sm leading-7 text-on-surface-variant [overflow-wrap:anywhere] [&_a]:font-semibold [&_a]:text-primary [&_li]:ml-5 [&_ol]:list-decimal [&_strong]:text-on-surface [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: viewModel.prepNotes.html }}
              />

              {viewModel.feedback.noteTakingFeedback && (
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-xl bg-success-container/40 p-4 ring-1 ring-outline-variant">
                    <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
                      <CheckCircle2 className="h-4 w-4 text-success-dim" />
                      {tCoaching("notes.whatHelped")}
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-on-surface-variant">
                      {viewModel.feedback.noteTakingFeedback.whatHelped.map(
                        (item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-success-dim" />
                            <span>{item}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-warning-container/35 p-4 ring-1 ring-outline-variant">
                    <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
                      <Target className="h-4 w-4 text-on-warning-container" />
                      {tCoaching("notes.missed")}
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-on-surface-variant">
                      {viewModel.feedback.noteTakingFeedback.missedOpportunities.map(
                        (item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                            <span>{item}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl bg-surface-container p-4 ring-1 ring-outline-variant">
                    <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      {tCoaching("notes.nextTemplate")}
                    </div>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-on-surface-variant">
                      {viewModel.feedback.noteTakingFeedback.nextSessionTemplate.map(
                        (item) => (
                          <li key={item} className="flex gap-2">
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            <span>{item}</span>
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            className={cn(
              "rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card sm:p-6",
              !viewModel.prepNotes && "xl:col-span-2",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-base font-bold text-on-surface">
                  <Dumbbell className="h-5 w-5 text-primary" />
                  {tCoaching("plan.heading")}
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-on-surface-variant">
                  {viewModel.feedback.noteTakingFeedback?.summary ??
                    tCoaching("plan.subheading")}
                </p>
              </div>
            </div>

            {hasImprovementPlan && (
              <div className="mt-4 grid gap-3 lg:grid-cols-3">
                {viewModel.improvementPlan.map((step, index) => {
                  const timeBox = formatTimeBoxLabel(
                    step.timeBoxSeconds,
                    tCoaching,
                  );
                  return (
                    <article
                      key={`${step.title}-${index}`}
                      className="rounded-xl border border-outline-variant bg-surface-container p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-container text-sm font-extrabold text-primary">
                          {index + 1}
                        </div>
                        {timeBox && (
                          <span className="rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-on-surface-variant ring-1 ring-outline-variant">
                            {timeBox}
                          </span>
                        )}
                      </div>
                      <h3 className="mt-3 text-sm font-bold leading-6 text-on-surface">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                        {step.whyItMatters}
                      </p>
                      <p className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-on-surface-variant ring-1 ring-outline-variant">
                        {step.howToPractice}
                      </p>
                      {step.shadowExample && (
                        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                          <span className="font-bold text-on-surface">
                            {tCoaching("plan.shadow")}{" "}
                          </span>
                          {step.shadowExample}
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {hasShadowExamples && (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {viewModel.shadowExamples.map((example, index) => (
                  <article
                    key={`${example.label}-${index}`}
                    className="rounded-xl border border-outline-variant bg-white p-4"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-primary">
                      <ClipboardList className="h-4 w-4" />
                      {example.label}
                    </div>
                    {example.before && (
                      <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                        <span className="font-bold text-on-surface">
                          {tCoaching("shadow.before")}{" "}
                        </span>
                        {example.before}
                      </p>
                    )}
                    <p className="mt-3 rounded-lg bg-primary-container p-3 text-sm leading-6 text-primary">
                      <span className="font-bold">
                        {tCoaching("shadow.after")}{" "}
                      </span>
                      {example.after}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                      {example.why}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <ChartCard
        className="mt-5"
        eyebrow={t("scoreLabel")}
        title={t("skillBreakdown")}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {viewModel.metrics.map((metric, index) => {
            const Icon = SKILL_ICONS[metric.key] ?? Sparkles;
            const isWeakest = metric.key === weakestMetric?.key;
            const chartColor = getSeriesColor(index);
            const ringData = [
              {
                label: tSkills(metric.key),
                value: metric.score,
                maxValue: 100,
                color: chartColor,
              },
            ];

            return (
              <div
                key={metric.key}
                className="rounded-xl border border-outline-variant bg-surface-container p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isWeakest ? "text-on-surface-variant" : "text-primary",
                      )}
                    />
                    <span className="text-sm font-bold text-on-surface">
                      {tSkills(metric.key)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex h-32 items-center justify-center">
                  <RingChart
                    data={ringData}
                    size={128}
                    strokeWidth={10}
                    baseInnerRadius={38}
                    ringGap={0}
                  >
                    <Ring index={0} color={chartColor} />
                    <RingCenter defaultLabel={tSkills(metric.key)} />
                  </RingChart>
                </div>

                <p className="mt-4 text-sm leading-6 text-on-surface-variant">
                  {t(`skillDescriptions.${metric.descriptionKey}`)}
                </p>
              </div>
            );
          })}
        </div>
      </ChartCard>

      {scoreRationale && (
        <section className="mt-5 rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {t("scoreRationale.heading")}
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-on-surface-variant">
                {scoreRationale.overall}
              </p>
            </div>
            <span className="rounded-xl bg-primary-container px-3 py-2 text-sm font-bold text-primary ring-1 ring-outline-variant">
              {t("scoreRationale.total", {
                score: viewModel.feedback.totalScore,
              })}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {scoreRationaleCategories.map(({ key, value, icon: Icon }) => (
              <article
                key={key}
                className="rounded-xl border border-outline-variant bg-surface-container p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
                    <Icon className="h-4 w-4 text-primary" />
                    {t(`scoreRationale.categories.${key}`)}
                  </div>
                  <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-bold text-on-surface ring-1 ring-outline-variant">
                    {value.score}/{value.maxScore}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                  {value.rationale}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-container p-3 ring-1 ring-outline-variant">
                    <Eyebrow className="text-on-surface-variant">
                      {t("scoreRationale.whyNotHigher")}
                    </Eyebrow>
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      {value.whyNotHigher}
                    </p>
                  </div>
                  <div className="rounded-lg bg-surface-container p-3 ring-1 ring-outline-variant">
                    <Eyebrow className="text-on-surface-variant">
                      {t("scoreRationale.nextStep")}
                    </Eyebrow>
                    <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                      {value.nextStep}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {hasCasework && (
        <div className="mt-5 rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-on-surface">
                {t("casework.heading")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                {t("casework.subheading")}
              </p>
            </div>
          </div>

          {caseworkItems.length > 0 && (
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {caseworkItems.map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-xl border border-outline-variant bg-surface-container p-4"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
                    <Icon className="h-4 w-4 text-primary" />
                    {label}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {argumentBreakdowns.length > 0 && (
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {argumentBreakdowns.map((argument, index) => (
                <article
                  key={`${argument.name}-${index}`}
                  className="rounded-xl border border-outline-variant bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-primary">
                        {t("casework.argument", { number: index + 1 })}
                      </p>
                      <h3 className="mt-1 text-base font-bold leading-6 text-on-surface-variant">
                        {argument.name}
                      </h3>
                    </div>
                    <span className="rounded-md bg-primary-container px-2.5 py-1 text-xs font-bold text-primary">
                      {t("casework.rebuild")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                    {argument.summary}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg bg-surface-container p-3 ring-1 ring-outline-variant">
                      <Eyebrow className="text-on-surface-variant">
                        {t("casework.worked")}
                      </Eyebrow>
                      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                        {argument.whatWorked}
                      </p>
                    </div>
                    <div className="rounded-lg bg-surface-container p-3 ring-1 ring-outline-variant">
                      <Eyebrow className="text-on-surface-variant">
                        {t("casework.missing")}
                      </Eyebrow>
                      <p className="mt-2 text-sm leading-6 text-on-surface-variant">
                        {argument.missingLayer}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 rounded-lg bg-surface-container p-4 text-sm leading-6 text-on-surface-variant">
                    <span className="font-bold text-on-surface">
                      {t("casework.betterVersion")}:{" "}
                    </span>
                    {argument.betterVersion}
                  </p>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-outline-variant bg-white p-5 shadow-token-card sm:p-6">
        <h2 className="text-base font-bold text-on-surface">
          {t("detail.heading")}
        </h2>
        <div className="mt-4 grid gap-5 xl:grid-cols-[1fr_1fr_1.05fr] xl:divide-x xl:divide-outline-variant">
          <div className="xl:pr-6">
            <ResultList
              title={t("detail.strengths")}
              icon={CheckCircle2}
              iconClassName="text-on-surface-variant"
              dotClassName="bg-surface-container-high"
              items={viewModel.strengths}
              emptyMessage={t("detail.emptyStrengths")}
            />
          </div>
          <div className="xl:px-6">
            <ResultList
              title={t("detail.improvements")}
              icon={Target}
              iconClassName="text-on-surface-variant"
              dotClassName="bg-surface-container"
              items={viewModel.improvements}
              emptyMessage={t("detail.emptyImprovements")}
            />
          </div>
          <div className="rounded-xl bg-surface-container p-5 xl:ml-6">
            <div className="flex items-center gap-2 text-sm font-bold text-primary">
              <Quote className="h-5 w-5" />
              {viewModel.modelAnswerKind === "stronger-rebuild"
                ? t("detail.strongerRebuild")
                : t("detail.modelAnswer")}
            </div>
            <p className="mt-4 text-sm leading-7 text-on-surface-variant">
              {viewModel.modelAnswer ?? viewModel.feedback.summary}
            </p>
          </div>
        </div>

        {showInlineReviewControls && (
          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-outline-variant pt-5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowTranscript((value) => !value)}
              className="min-h-[44px] rounded-xl px-4 text-primary hover:bg-primary-container"
            >
              <FileText className="mr-2 h-4 w-4" />
              {showTranscript
                ? t("detail.hideTranscript")
                : t("detail.showTranscript")}
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
                className="min-h-[44px] rounded-xl px-4 text-primary hover:bg-primary-container"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {showTimeline
                  ? t("detail.hideTimeline")
                  : t("detail.showTimeline")}
                {showTimeline ? (
                  <ChevronUp className="ml-2 h-4 w-4" />
                ) : (
                  <ChevronDown className="ml-2 h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        )}

        {showInlineReviewControls && showTranscript && (
          <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container p-5">
            <h3 className="text-base font-semibold text-on-surface">
              {t("detail.transcript")}
            </h3>
            <AnnotatedTranscript
              transcript={viewModel.transcript || ""}
              annotations={viewModel.feedback.transcriptAnnotations}
              emptyLabel={t("detail.emptyTranscript")}
              suggestionLabel={t("annotations.suggestion")}
              unmatchedLabel={t("annotations.unmatched")}
              roundLabel={(roundNumber) =>
                t("annotations.round", { round: roundNumber })
              }
              durationSeconds={session.duration || session.speechTime}
            />
          </div>
        )}

        {showInlineReviewControls &&
          showTimeline &&
          viewModel.rounds.length > 0 && (
            <div className="mt-4 rounded-xl border border-outline-variant bg-surface-container p-5">
              <h3 className="mb-4 text-base font-semibold text-on-surface">
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
