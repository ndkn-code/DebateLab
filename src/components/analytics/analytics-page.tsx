"use client";

import { useMemo, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Flame,
  MessageCircleMore,
  Mic,
  Scale,
  Swords,
  Target,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type {
  AnalyticsInsightCard,
  AnalyticsPageData,
  AnalyticsRangePreset,
  AnalyticsRecentSession,
  AnalyticsSkillMetric,
  SkillMetricKey,
} from "@/types";

const RANGE_PRESETS: AnalyticsRangePreset[] = ["7d", "30d", "90d"];

const SKILL_ICONS: Record<SkillMetricKey, typeof MessageCircleMore> = {
  clarity: MessageCircleMore,
  logic: Scale,
  rebuttal: Swords,
  evidence: BookOpen,
  delivery: Mic,
};

const TRACK_ICONS = {
  speaking: Mic,
  debate: Scale,
  duel: Swords,
} as const;

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTotalMinutes(totalMinutes: number) {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatDuration(minutes: number | null, t: ReturnType<typeof useTranslations>) {
  if (!minutes || minutes <= 0) return t("duration_unknown");
  if (minutes < 60) return t("minutes_short", { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (remainder === 0) return `${hours}h`;
  return `${hours}h ${remainder}m`;
}

function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function findInsight<T extends AnalyticsInsightCard["key"]>(
  insights: AnalyticsInsightCard[],
  key: T
) {
  return insights.find((insight) => insight.key === key) as Extract<
    AnalyticsInsightCard,
    { key: T }
  >;
}

function MiniBarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values, 1);

  return (
    <div className="mt-4">
      <div className="flex h-24 items-end gap-2">
        {values.map((value, index) => (
          <div key={`${labels[index]}-${index}`} className="flex flex-1 items-end">
            <div
              className={cn(
                "w-full rounded-full bg-primary/20 transition-all",
                value > 0 && "bg-primary"
              )}
              style={{
                height: `${Math.max(12, (value / max) * 96)}px`,
              }}
            />
          </div>
        ))}
      </div>
      {labels.some(Boolean) ? (
        <div className="mt-2 flex gap-2">
          {labels.map((label, index) => (
            <div
              key={`${label}-${index}`}
              className="flex-1 text-center text-[11px] font-medium text-on-surface-variant"
            >
              {label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MiniLineChart({ values }: { values: number[] }) {
  if (values.length === 0) {
    return (
      <div className="mt-5 flex h-24 items-center justify-center rounded-2xl bg-surface-container-low text-sm text-on-surface-variant">
        —
      </div>
    );
  }

  const width = 220;
  const height = 92;
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const stepX = values.length === 1 ? 0 : width / (values.length - 1);

  const points = values
    .map((value, index) => {
      const x = index * stepX;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const finalPoint = values.length - 1;
  const lastX = finalPoint * stepX;
  const lastY = height - ((values[finalPoint] - min) / range) * height;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl bg-surface-container-low px-2 py-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-24 w-full">
        <polyline
          fill="none"
          stroke="rgba(77,134,247,0.22)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <polyline
          fill="none"
          stroke="#4D86F7"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <circle cx={lastX} cy={lastY} r="6" fill="#4D86F7" />
        <circle cx={lastX} cy={lastY} r="11" fill="rgba(77,134,247,0.18)" />
      </svg>
    </div>
  );
}

function DonutRing({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="rgba(169,198,251,0.28)"
          strokeWidth="12"
        />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#4D86F7"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-semibold text-on-surface">{clamped}%</div>
        <div className="text-sm text-on-surface-variant">{label}</div>
      </div>
    </div>
  );
}

function RangeLinks({ currentRange }: { currentRange: AnalyticsRangePreset }) {
  const t = useTranslations("analyticsPage");

  return (
    <div className="inline-flex rounded-full border border-outline-variant/20 bg-surface p-1 shadow-sm">
      {RANGE_PRESETS.map((preset) => (
        <Link
          key={preset}
          href={`/profile?range=${preset}`}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            currentRange === preset
              ? "bg-primary text-on-primary"
              : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          )}
        >
          {t(`range_${preset}`)}
        </Link>
      ))}
    </div>
  );
}

function HeroStat({
  icon,
  value,
  label,
  tone,
}: {
  icon: ReactNode;
  value: string | number;
  label: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline-variant/12 bg-surface-container-low px-4 py-3">
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          tone
        )}
      >
        {icon}
      </div>
      <div>
        <div className="text-[1.35rem] font-semibold leading-none text-on-surface">
          {value}
        </div>
        <div className="mt-1 text-sm text-on-surface-variant">{label}</div>
      </div>
    </div>
  );
}

function SkillRow({
  metric,
}: {
  metric: AnalyticsSkillMetric;
}) {
  const t = useTranslations("analyticsPage");
  const Icon = SKILL_ICONS[metric.key];

  return (
    <div className="flex items-center gap-4">
      <div className="flex w-28 items-center gap-3 text-on-surface">
        <Icon className="h-4.5 w-4.5 text-primary" />
        <span className="text-sm font-medium">{t(`skills.${metric.key}`)}</span>
      </div>
      <div className="flex-1">
        <Progress
          value={metric.scoreOutOf100}
          className="w-full gap-0"
        />
      </div>
      <div className="w-16 text-right text-sm font-semibold text-on-surface">
        {metric.scoreOutOf100}
        <span className="ml-1 text-on-surface-variant">/100</span>
      </div>
    </div>
  );
}

function RecentSessionCard({
  session,
}: {
  session: AnalyticsRecentSession;
}) {
  const t = useTranslations("analyticsPage");
  const locale = useLocale();
  const TrackIcon = TRACK_ICONS[session.kind === "duel" ? "duel" : session.practiceTrack];

  return (
    <div className="rounded-[1.6rem] border border-outline-variant/12 bg-surface px-5 py-4 shadow-[0_10px_28px_rgba(11,20,36,0.04)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <TrackIcon className="h-4.5 w-4.5" />
            </div>
            <span className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-medium text-on-surface-variant">
              {session.kind === "duel"
                ? t("recent_duel_badge")
                : session.practiceTrack === "speaking"
                  ? t("recent_speaking_badge")
                  : t("recent_debate_badge")}
            </span>
            {session.resultLabel ? (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  session.kind === "duel"
                    ? session.resultLabel === "Won"
                      ? "bg-emerald-500/12 text-emerald-600"
                      : session.resultLabel === "Lost"
                        ? "bg-rose-500/12 text-rose-500"
                        : "bg-primary/10 text-primary"
                    : "bg-primary/10 text-primary"
                )}
              >
                {session.kind === "duel"
                  ? session.resultLabel === "Won"
                    ? t("recent_won")
                    : session.resultLabel === "Lost"
                      ? t("recent_lost")
                      : t("recent_completed")
                  : session.resultLabel}
              </span>
            ) : null}
          </div>
          <h3 className="mt-3 line-clamp-2 text-lg font-semibold text-on-surface">
            {session.topicTitle}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-on-surface-variant">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {formatDate(session.createdAt, locale)}
            </div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              {formatDuration(session.durationMinutes, t)}
            </div>
            {session.confidencePercent != null ? (
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t("confidence", { count: session.confidencePercent })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session.score != null ? (
            <div className="rounded-2xl bg-primary/8 px-4 py-3 text-center">
              <div className="text-2xl font-semibold text-on-surface">
                {Math.round(session.score)}
              </div>
              <div className="text-xs text-on-surface-variant">/100</div>
            </div>
          ) : null}
          <Link href={session.href}>
            <Button
              variant="outline"
              className="h-11 rounded-2xl border-outline-variant/20 bg-surface-container-low px-5"
            >
              {t("review")}
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AnalyticsPage({ data }: { data: AnalyticsPageData }) {
  const t = useTranslations("analyticsPage");
  const skillSnapshot = data.skillSnapshot;
  const practiceMinutesCard = useMemo(
    () => findInsight(data.insights, "practice-minutes"),
    [data.insights]
  );
  const mixCard = useMemo(
    () => findInsight(data.insights, "speaking-vs-debate"),
    [data.insights]
  );
  const averageCard = useMemo(
    () => findInsight(data.insights, "recent-average-score"),
    [data.insights]
  );
  const strongestFocusCard = useMemo(
    () => findInsight(data.insights, "strongest-focus"),
    [data.insights]
  );

  return (
    <div className="mx-auto max-w-[1400px] px-6 py-8 sm:px-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-on-surface">
            {t("title")}
          </h1>
          <p className="mt-2 max-w-2xl text-lg text-on-surface-variant">
            {t("subtitle")}
          </p>
        </div>
        <RangeLinks currentRange={data.range} />
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[2rem] border border-outline-variant/15 bg-surface p-6 shadow-[0_18px_40px_rgba(11,20,36,0.05)]">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <Avatar size="lg" className="h-28 w-28">
              {data.hero.avatarUrl ? (
                <AvatarImage src={data.hero.avatarUrl} alt={data.hero.displayName} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-3xl font-semibold text-primary">
                {getInitials(data.hero.displayName)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-semibold text-on-surface">
                  {data.hero.displayName}
                </h2>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                  {data.hero.title ?? t("default_title")}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
                <span>{t("level", { level: data.hero.level })}</span>
                <span>•</span>
                <span>{t("xp_total", { count: data.hero.xp })}</span>
              </div>
              <p className="mt-4 max-w-2xl text-lg leading-8 text-on-surface-variant">
                {data.hero.statusLine}
              </p>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-on-surface">
                    {t("xp_progress", {
                      current: data.hero.xpInLevel,
                      total: data.hero.xpToNextLevel,
                    })}
                  </span>
                  <span className="text-on-surface-variant">
                    {data.hero.xpProgressPercent}%
                  </span>
                </div>
                <Progress value={data.hero.xpProgressPercent} className="w-full gap-0" />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <HeroStat
              icon={<Flame className="h-5 w-5 text-[#F97316]" />}
              value={data.hero.streak}
              label={t("hero_streak")}
              tone="bg-[#FFF3E8]"
            />
            <HeroStat
              icon={<BarChart3 className="h-5 w-5 text-primary" />}
              value={data.hero.totalSessions}
              label={t("hero_sessions")}
              tone="bg-primary/10"
            />
            <HeroStat
              icon={<Clock3 className="h-5 w-5 text-[#34C759]" />}
              value={formatTotalMinutes(data.hero.totalPracticeMinutes)}
              label={t("hero_practice_time")}
              tone="bg-[#EAF8EF]"
            />
          </div>
        </section>

        <section className="rounded-[2rem] border border-outline-variant/15 bg-surface p-6 shadow-[0_18px_40px_rgba(11,20,36,0.05)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-semibold text-on-surface">
                {t("skill_snapshot_title")}
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                {t("skill_snapshot_subtitle")}
              </p>
            </div>
            <div className="rounded-full bg-surface-container-low px-3 py-1 text-xs font-semibold text-primary">
              {t("lifetime")}
            </div>
          </div>

          <div className="mt-6 space-y-5">
            {skillSnapshot.metrics.map((metric) => (
              <SkillRow key={metric.key} metric={metric} />
            ))}
          </div>

          <div className="mt-6 rounded-[1.4rem] bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
            <span className="font-medium text-on-surface">{skillSnapshot.note}</span>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-4">
        <section className="rounded-[1.8rem] border border-outline-variant/15 bg-surface p-5 shadow-[0_16px_32px_rgba(11,20,36,0.04)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface">
              {t("cards.practice_minutes.title")}
            </h3>
            <Clock3 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="mt-5 flex items-end gap-2">
            <div className="text-4xl font-semibold text-on-surface">
              {practiceMinutesCard.totalMinutes}
            </div>
            <div className="pb-1 text-sm text-on-surface-variant">
              {t("cards.practice_minutes.unit")}
            </div>
          </div>
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              practiceMinutesCard.deltaPercent != null && practiceMinutesCard.deltaPercent >= 0
                ? "text-emerald-600"
                : "text-on-surface-variant"
            )}
          >
            {practiceMinutesCard.deltaPercent != null
              ? t("cards.practice_minutes.delta", {
                  count: Math.abs(practiceMinutesCard.deltaPercent),
                  sign: practiceMinutesCard.deltaPercent >= 0 ? "+" : "-",
                })
              : t("cards.practice_minutes.no_delta")}
          </p>
          <MiniBarChart
            values={practiceMinutesCard.series.map((entry) => entry.value)}
            labels={practiceMinutesCard.series.map((entry) => entry.label)}
          />
        </section>

        <section className="rounded-[1.8rem] border border-outline-variant/15 bg-surface p-5 shadow-[0_16px_32px_rgba(11,20,36,0.04)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface">
              {t("cards.mix.title")}
            </h3>
            <Scale className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="mt-4 flex items-center gap-5">
            <DonutRing value={mixCard.debatePercent} label={t("cards.mix.debate")} />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2 text-on-surface">
                  <span className="h-3 w-3 rounded-full bg-primary" />
                  {t("cards.mix.debate")}
                </div>
                <span className="font-semibold text-on-surface">
                  {mixCard.debatePercent}%
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <div className="flex items-center gap-2 text-on-surface">
                  <span className="h-3 w-3 rounded-full bg-primary/25" />
                  {t("cards.mix.speaking")}
                </div>
                <span className="font-semibold text-on-surface">
                  {mixCard.speakingPercent}%
                </span>
              </div>
              <p className="text-on-surface-variant">
                {t("cards.mix.breakdown", {
                  debate: mixCard.debateCount,
                  speaking: mixCard.speakingCount,
                })}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-outline-variant/15 bg-surface p-5 shadow-[0_16px_32px_rgba(11,20,36,0.04)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface">
              {t("cards.average_score.title")}
            </h3>
            <BarChart3 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="mt-5 flex items-end gap-2">
            <div className="text-4xl font-semibold text-on-surface">
              {averageCard.averageScore != null
                ? Math.round(averageCard.averageScore)
                : "—"}
            </div>
            <div className="pb-1 text-sm text-on-surface-variant">/100</div>
          </div>
          <p
            className={cn(
              "mt-2 text-sm font-medium",
              averageCard.deltaPoints != null && averageCard.deltaPoints >= 0
                ? "text-emerald-600"
                : "text-on-surface-variant"
            )}
          >
            {averageCard.deltaPoints != null
              ? t("cards.average_score.delta", {
                  count: Math.abs(Math.round(averageCard.deltaPoints)),
                  sign: averageCard.deltaPoints >= 0 ? "+" : "-",
                })
              : t("cards.average_score.no_delta")}
          </p>
          <MiniLineChart values={averageCard.series.map((entry) => entry.value)} />
        </section>

        <section className="rounded-[1.8rem] border border-outline-variant/15 bg-surface p-5 shadow-[0_16px_32px_rgba(11,20,36,0.04)]">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-on-surface">
              {t("cards.strongest_focus.title")}
            </h3>
            <Target className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-[1.35rem] border border-outline-variant/12 bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-on-surface-variant">
                    {t("cards.strongest_focus.strongest")}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-on-surface">
                    {strongestFocusCard.strongestSkill
                      ? t(`skills.${strongestFocusCard.strongestSkill}`)
                      : t("empty_title")}
                  </div>
                </div>
                <div className="text-right text-on-surface">
                  <div className="text-xl font-semibold">
                    {strongestFocusCard.strongestScore ?? "—"}
                  </div>
                  {strongestFocusCard.strongestScore != null ? (
                    <div className="text-sm text-on-surface-variant">/100</div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="rounded-[1.35rem] border border-outline-variant/12 bg-surface-container-low p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-on-surface-variant">
                    {t("cards.strongest_focus.focus_next")}
                  </div>
                  <div className="mt-1 text-xl font-semibold text-on-surface">
                    {strongestFocusCard.focusSkill
                      ? t(`skills.${strongestFocusCard.focusSkill}`)
                      : t("empty_title")}
                  </div>
                </div>
                <div className="text-right text-on-surface">
                  <div className="text-xl font-semibold">
                    {strongestFocusCard.focusScore ?? "—"}
                  </div>
                  {strongestFocusCard.focusScore != null ? (
                    <div className="text-sm text-on-surface-variant">/100</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-[2rem] border border-outline-variant/15 bg-surface p-6 shadow-[0_18px_40px_rgba(11,20,36,0.05)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-2xl font-semibold text-on-surface">
              {t("recent_sessions_title")}
            </h3>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t("recent_sessions_subtitle")}
            </p>
          </div>
          <Link href="/history" className="text-sm font-medium text-primary hover:underline">
            {t("view_all")}
          </Link>
        </div>

        {data.recentSessions.length > 0 ? (
          <div className="mt-5 space-y-4">
            {data.recentSessions.map((session) => (
              <RecentSessionCard key={`${session.kind}-${session.id}`} session={session} />
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[1.6rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="mt-4 text-xl font-semibold text-on-surface">
              {t("empty_title")}
            </h4>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-on-surface-variant">
              {t("empty_body")}
            </p>
            <Link href="/practice" className="mt-5 inline-flex">
              <Button className="h-11 rounded-2xl px-5">
                {t("start_practicing")}
              </Button>
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}
