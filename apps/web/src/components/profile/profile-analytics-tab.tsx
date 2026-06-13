"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import {
  ChevronRight,
  Mic2,
  Scale,
  TrendingDown,
  TrendingUp,
  UsersRound,
} from "@/components/ui/icons";
import {
  coerceLeagueTierId,
  LEADERBOARD_LEAGUE_ASSETS,
} from "@/lib/leaderboards/league-assets";
import { getLocalizedLeagueName } from "@/lib/leaderboards/replay";
import { Eyebrow, Stat } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ProfileAnalyticsTabData } from "@/lib/profile-social/tab-model";
import type { PublicProfileShell } from "@/lib/profile-social/model";
import type {
  AnalyticsInsightCard,
  AnalyticsPageData,
  AnalyticsRangePreset,
  SkillMetricKey,
} from "@/types";

const LEVEL_ICON_SRC = "/images/rewards/level-up.webp";

type PracticeMinutesInsight = Extract<
  AnalyticsInsightCard,
  { key: "practice-minutes" }
>;
type AverageScoreInsight = Extract<
  AnalyticsInsightCard,
  { key: "recent-average-score" }
>;
type MixInsight = Extract<AnalyticsInsightCard, { key: "speaking-vs-debate" }>;
type StrongestFocusInsight = Extract<
  AnalyticsInsightCard,
  { key: "strongest-focus" }
>;

function formatNumber(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function findInsight<T extends AnalyticsInsightCard["key"]>(
  insights: AnalyticsInsightCard[],
  key: T
) {
  return insights.find((insight) => insight.key === key) as
    | Extract<AnalyticsInsightCard, { key: T }>
    | undefined;
}

export function AnalyticsRangeControl({
  range,
  isPending,
  onRangeChange,
}: {
  range: AnalyticsRangePreset;
  isPending?: boolean;
  onRangeChange: (range: AnalyticsRangePreset) => void;
}) {
  const t = useTranslations("analyticsPage");
  const ranges: AnalyticsRangePreset[] = ["7d", "30d", "90d"];

  return (
    <div
      className={cn(
        "inline-flex rounded-full bg-surface-container p-1 transition-opacity duration-200",
        isPending ? "opacity-80" : "opacity-100"
      )}
      aria-label={t("range_label")}
      aria-busy={isPending ? "true" : undefined}
    >
      {ranges.map((item) => {
        const active = item === range;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={active}
            onClick={() => onRangeChange(item)}
            className={cn(
              "relative inline-flex h-9 min-w-[4.25rem] items-center justify-center rounded-full px-4 type-body-sm font-semibold transition-colors",
              active
                ? "text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            )}
          >
            {active ? (
              <motion.span
                layoutId="profile-range-pill"
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 rounded-full bg-primary shadow-token-primary"
              />
            ) : null}
            <span className="relative z-10">{t(`range_${item}`)}</span>
          </button>
        );
      })}
    </div>
  );
}

function BentoTile({
  title,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-[24px] border border-outline-variant bg-surface-container-lowest p-6 shadow-token-card sm:p-7",
        className
      )}
    >
      {title || action ? (
        <div className="mb-5 flex items-center justify-between gap-3">
          {title ? (
            <h2 className="type-body font-bold text-on-surface">{title}</h2>
          ) : null}
          {action}
        </div>
      ) : null}
      <div className={cn("min-h-0 flex-1", contentClassName)}>{children}</div>
    </section>
  );
}

const SKILL_AXIS_COLORS = {
  strongest: { dot: "#34C759", label: "fill-[#1E9E54] dark:fill-[#5DD984]" },
  focus: { dot: "#FFB020", label: "fill-[#C98A1B] dark:fill-[#FFD98A]" },
  default: { dot: "#00B8D9", label: "fill-[var(--color-on-surface-variant)]" },
} as const;

function SkillRadarHero({
  snapshot,
  strongestFocus,
}: {
  snapshot: AnalyticsPageData["skillSnapshot"];
  strongestFocus: StrongestFocusInsight | undefined;
}) {
  const t = useTranslations("analyticsPage");
  const prefersReducedMotion = useReducedMotion();
  const metrics = snapshot.metrics.slice(0, 5);
  const strongestSkill =
    strongestFocus?.strongestSkill ?? snapshot.strongestSkill;
  const focusSkill = strongestFocus?.focusSkill ?? snapshot.weakestSkill;
  const centerX = 170;
  const centerY = 134;
  const radius = 88;

  function point(index: number, value: number, extra = 0) {
    const angle =
      -Math.PI / 2 + (index * Math.PI * 2) / Math.max(metrics.length, 1);
    const scaled = radius * (value / 100) + extra;
    return {
      x: centerX + Math.cos(angle) * scaled,
      y: centerY + Math.sin(angle) * scaled,
    };
  }

  function axisTone(key: SkillMetricKey) {
    if (key === strongestSkill) return SKILL_AXIS_COLORS.strongest;
    if (key === focusSkill) return SKILL_AXIS_COLORS.focus;
    return SKILL_AXIS_COLORS.default;
  }

  const polygon = metrics
    .map((metric, index) => {
      const p = point(index, metric.coverage > 0 ? metric.value : 0);
      return `${p.x},${p.y}`;
    })
    .join(" ");

  const overall =
    snapshot.overallScore != null ? Math.round(snapshot.overallScore) : null;

  function skillScore(key: SkillMetricKey | null) {
    if (!key) return null;
    const metric = metrics.find((item) => item.key === key);
    return metric ? Math.round(metric.value) : null;
  }

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="flex justify-center">
        <svg
          viewBox="0 0 340 268"
          className="h-auto w-full max-w-[400px]"
          aria-hidden="true"
        >
          {[25, 50, 75, 100].map((value) => (
            <polygon
              key={value}
              points={metrics
                .map((_, index) => {
                  const p = point(index, value);
                  return `${p.x},${p.y}`;
                })
                .join(" ")}
              fill={value === 100 ? "rgba(0,184,217,0.04)" : "transparent"}
              stroke="var(--color-outline-variant)"
              strokeWidth="1"
              strokeLinejoin="round"
            />
          ))}
          {metrics.map((_, index) => {
            const p = point(index, 100);
            return (
              <line
                key={index}
                x1={centerX}
                y1={centerY}
                x2={p.x}
                y2={p.y}
                stroke="var(--color-outline-variant)"
                strokeWidth="1"
              />
            );
          })}

          <motion.polygon
            points={polygon}
            fill="rgba(0,184,217,0.18)"
            stroke="#00B8D9"
            strokeWidth="2.5"
            strokeLinejoin="round"
            initial={
              prefersReducedMotion ? false : { opacity: 0, scale: 0.82 }
            }
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: `${centerX}px ${centerY}px` }}
          />

          {metrics.map((metric, index) => {
            const tone = axisTone(metric.key);
            const p = point(index, metric.coverage > 0 ? metric.value : 0);
            const emphasized =
              metric.key === strongestSkill || metric.key === focusSkill;
            return (
              <g key={`dot-${metric.key}`}>
                {emphasized ? (
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={9}
                    fill={tone.dot}
                    opacity={0.18}
                  />
                ) : null}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={4.5}
                  fill={tone.dot}
                  stroke="var(--color-surface-container-lowest)"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          <circle
            cx={centerX}
            cy={centerY}
            r={27}
            fill="var(--color-surface-container-lowest)"
            stroke="var(--color-outline-variant)"
            strokeWidth="1"
          />
          {overall != null ? (
            <text
              x={centerX}
              y={centerY}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--color-on-surface)"
              className="type-heading-lg font-extrabold"
            >
              {overall}
            </text>
          ) : (
            <circle
              cx={centerX}
              cy={centerY}
              r={4}
              fill="var(--color-outline-variant)"
            />
          )}

          {metrics.map((metric, index) => {
            const tone = axisTone(metric.key);
            const labelPoint = point(index, 100, 25);
            const anchor =
              Math.abs(labelPoint.x - centerX) < 10
                ? "middle"
                : labelPoint.x > centerX
                  ? "start"
                  : "end";
            return (
              <text
                key={`label-${metric.key}`}
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={anchor}
                dominantBaseline="central"
              >
                <tspan
                  x={labelPoint.x}
                  dy="-0.4em"
                  className={cn("type-caption font-semibold", tone.label)}
                >
                  {t(`skills.${metric.key}`)}
                </tspan>
                <tspan
                  x={labelPoint.x}
                  dy="1.4em"
                  fill="var(--color-on-surface)"
                  className="type-caption font-extrabold"
                >
                  {Math.round(metric.value)}
                </tspan>
              </text>
            );
          })}
        </svg>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div className="rounded-2xl bg-[#E5F6EC] p-4 dark:bg-[#34C759]/12">
          <Eyebrow className="text-[#1E9E54] dark:text-[#5DD984]">
            {t("cards.strongest_focus.strongest")}
          </Eyebrow>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <p className="type-title font-extrabold text-on-surface">
              {strongestSkill ? t(`skills.${strongestSkill}`) : "-"}
            </p>
            <Stat size="title" className="font-extrabold text-[#1E9E54] dark:text-[#5DD984]">
              {skillScore(strongestSkill) ?? ""}
            </Stat>
          </div>
        </div>

        <div className="rounded-2xl bg-[#FFF3DC] p-4 dark:bg-[#FFD166]/12">
          <Eyebrow className="text-[#C98A1B] dark:text-[#FFD98A]">
            {t("cards.strongest_focus.focus_next")}
          </Eyebrow>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <p className="type-title font-extrabold text-on-surface">
              {focusSkill ? t(`skills.${focusSkill}`) : "-"}
            </p>
            <Stat size="title" className="font-extrabold text-[#C98A1B] dark:text-[#FFD98A]">
              {skillScore(focusSkill) ?? ""}
            </Stat>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeltaPill({
  delta,
  label,
}: {
  delta: number | null | undefined;
  label: string;
}) {
  if (delta == null) return null;
  const positive = delta >= 0;

  return (
    <span
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 type-caption font-bold tabular-nums",
        positive
          ? "bg-[#E5F6EC] text-[#1E9E54] dark:bg-[#34C759]/15 dark:text-[#5DD984]"
          : "bg-[#FFEAEA] text-[#D6494E] dark:bg-[#FF5A5F]/15 dark:text-[#FF9398]"
      )}
    >
      {positive ? (
        <TrendingUp className="size-3.5" />
      ) : (
        <TrendingDown className="size-3.5" />
      )}
      {Math.abs(Math.round(delta))}%
    </span>
  );
}

function WeeklyBars({ insight }: { insight: PracticeMinutesInsight | undefined }) {
  const prefersReducedMotion = useReducedMotion();
  const visibleSeries = insight?.series.slice(-7) ?? [];
  const values =
    visibleSeries.length > 0
      ? visibleSeries.map((point) => point.value)
      : [0, 0, 0, 0, 0, 0, 0];
  const max = Math.max(...values, 1);
  const peakIndex = values.indexOf(Math.max(...values));

  return (
    <div className="mt-6 flex h-[132px] items-end gap-3">
      {values.map((value, index) => (
        <div
          key={`${value}-${index}`}
          className="flex h-full flex-1 flex-col items-center justify-end gap-2"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{
              duration: 0.45,
              delay: index * 0.05,
              ease: [0.22, 1, 0.36, 1],
            }}
            style={{
              height: `${Math.max(10, (value / max) * 100)}px`,
              transformOrigin: "bottom",
            }}
            className={cn(
              "w-full max-w-[22px] rounded-full",
              index === peakIndex && value > 0
                ? "bg-[linear-gradient(180deg,#34D5EE_0%,#00B8D9_100%)]"
                : "bg-[#00B8D9]/25 dark:bg-[#00B8D9]/35"
            )}
          />
          <span className="type-caption font-semibold text-on-surface-variant">
            {visibleSeries[index]?.label ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function ScoreGauge({ score }: { score: number | null }) {
  const prefersReducedMotion = useReducedMotion();
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const bounded = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const tone =
    score == null
      ? "#CDECF3"
      : bounded >= 80
        ? "#34C759"
        : bounded >= 55
          ? "#00B8D9"
          : "#FFB020";

  return (
    <div className="relative inline-flex">
      <svg viewBox="0 0 128 128" className="size-[124px] -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="11"
          stroke="var(--color-surface-container-high)"
        />
        <motion.circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={
            prefersReducedMotion
              ? false
              : { strokeDashoffset: circumference }
          }
          animate={{
            strokeDashoffset: circumference * (1 - bounded / 100),
          }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Stat size="heading-lg" as="p" className="font-extrabold leading-none text-on-surface">
          {score != null ? Math.round(score) : "-"}
        </Stat>
        <p className="mt-0.5 type-caption font-semibold text-on-surface-variant">
          /100
        </p>
      </div>
    </div>
  );
}

function MixDonut({
  debatePercent,
  total,
  sessionsLabel,
}: {
  debatePercent: number;
  total: number;
  sessionsLabel: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const debateLength = circumference * (Math.max(0, Math.min(100, debatePercent)) / 100);

  return (
    <div className="relative inline-flex">
      <svg viewBox="0 0 120 120" className="size-[118px] -rotate-90">
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          strokeWidth="13"
          stroke="#8BE8F7"
          className="dark:opacity-60"
        />
        <motion.circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#00B8D9"
          strokeWidth="13"
          strokeLinecap={debatePercent > 0 && debatePercent < 100 ? "round" : "butt"}
          strokeDasharray={`${debateLength} ${circumference}`}
          initial={
            prefersReducedMotion ? false : { strokeDasharray: `0 ${circumference}` }
          }
          animate={{ strokeDasharray: `${debateLength} ${circumference}` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Stat size="heading-lg" as="p" className="font-extrabold leading-none text-on-surface">
          {total}
        </Stat>
        <p className="mt-0.5 type-caption font-semibold text-on-surface-variant">
          {sessionsLabel}
        </p>
      </div>
    </div>
  );
}

function MixLegend({
  debatePercent,
  speakingPercent,
}: {
  debatePercent: number;
  speakingPercent: number;
}) {
  const tAnalytics = useTranslations("analyticsPage");

  return (
    <div className="grid w-full gap-2.5">
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container px-3.5 py-2.5">
        <span className="inline-flex min-w-0 items-center gap-2 type-caption font-semibold text-on-surface">
          <Scale className="size-4 shrink-0 text-[#00B8D9]" />
          <span className="truncate">{tAnalytics("cards.mix.debate")}</span>
        </span>
        <span className="type-body-sm font-extrabold tabular-nums text-on-surface">
          {debatePercent}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container px-3.5 py-2.5">
        <span className="inline-flex min-w-0 items-center gap-2 type-caption font-semibold text-on-surface">
          <Mic2 className="size-4 shrink-0 text-[#56CBE0]" />
          <span className="truncate">{tAnalytics("cards.mix.speaking")}</span>
        </span>
        <span className="type-body-sm font-extrabold tabular-nums text-on-surface">
          {speakingPercent}%
        </span>
      </div>
    </div>
  );
}

function SeasonTile({
  profile,
  className,
}: {
  profile: PublicProfileShell;
  className?: string;
}) {
  const t = useTranslations("profileSocial.analytics");
  const locale = useLocale();
  const prefersReducedMotion = useReducedMotion();
  const seasonXp = profile.season?.seasonXp ?? 0;
  const nextTarget = Math.max(1000, Math.ceil((seasonXp + 1) / 1000) * 1000);
  const remaining = Math.max(0, nextTarget - seasonXp);
  const progress = Math.min(100, Math.round((seasonXp / nextTarget) * 100));
  const tierId = coerceLeagueTierId(profile.season?.leagueTier);
  const leagueName = getLocalizedLeagueName(tierId, locale).name;

  return (
    <BentoTile title={t("season_performance")} className={className}>
      <Link
        href="/leaderboards"
        aria-label={t("view_leaderboard")}
        className="group block"
      >
        <div className="flex items-center gap-5">
          <Image
            src={LEADERBOARD_LEAGUE_ASSETS[tierId]}
            alt=""
            width={176}
            height={176}
            unoptimized
            draggable={false}
            className="size-20 shrink-0 object-contain drop-shadow-token-card transition-transform duration-300 group-hover:scale-105 sm:size-24"
          />
          <div className="min-w-0 flex-1">
            <p className="type-heading-md font-extrabold leading-tight text-on-surface">
              {leagueName}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-container px-3 py-1.5 type-caption font-bold tabular-nums text-on-surface">
                {formatNumber(seasonXp)} {t("season_xp")}
              </span>
              {profile.season?.rank ? (
                <span className="rounded-full bg-[#FFF3DC] px-3 py-1.5 type-caption font-bold tabular-nums text-[#C98A1B] dark:bg-[#FFD166]/15 dark:text-[#FFD98A]">
                  #{profile.season.rank}
                </span>
              ) : null}
            </div>
          </div>
          <ChevronRight className="size-5 shrink-0 text-on-surface-variant transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>

        <div className="mt-6">
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-container-high">
            <motion.div
              initial={prefersReducedMotion ? false : { width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="h-full rounded-full bg-primary"
            />
          </div>
          <p className="mt-2.5 type-caption font-semibold text-on-surface-variant">
            {t("xp_to_next_rank", { count: remaining })}
          </p>
        </div>
      </Link>
    </BentoTile>
  );
}

export function ProfileAnalyticsTab({
  analyticsData,
  profile,
  range,
  isRangePending,
  onRangeChange,
}: {
  analyticsData: AnalyticsPageData;
  profile: PublicProfileShell;
  range: AnalyticsRangePreset;
  isRangePending?: boolean;
  onRangeChange: (range: AnalyticsRangePreset) => void;
}) {
  const t = useTranslations("profileSocial.analytics");
  const practiceMinutes = findInsight(analyticsData.insights, "practice-minutes");
  const averageScore = findInsight(
    analyticsData.insights,
    "recent-average-score"
  ) as AverageScoreInsight | undefined;
  const strongestFocus = findInsight(analyticsData.insights, "strongest-focus");
  const mix = findInsight(analyticsData.insights, "speaking-vs-debate") as
    | MixInsight
    | undefined;
  const totalMix = (mix?.speakingCount ?? 0) + (mix?.debateCount ?? 0);

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        <AnalyticsRangeControl
          range={range}
          isPending={isRangePending}
          onRangeChange={onRangeChange}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <BentoTile
          title={t("skill_snapshot")}
          className="xl:col-span-7"
          contentClassName="grid items-center"
        >
          <SkillRadarHero
            snapshot={analyticsData.skillSnapshot}
            strongestFocus={strongestFocus}
          />
        </BentoTile>

        <div className="grid min-w-0 content-start gap-5 xl:col-span-5">
          <BentoTile
            title={t("weekly_practice")}
            action={
              <DeltaPill
                delta={practiceMinutes?.deltaPercent}
                label={
                  practiceMinutes?.deltaPercent != null
                    ? t("practice_delta", {
                        count: Math.abs(practiceMinutes.deltaPercent),
                      })
                    : ""
                }
              />
            }
          >
            <div className="flex items-baseline gap-2">
              <Stat size="heading-xl" as="p" className="font-extrabold leading-none text-on-surface">
                {formatNumber(practiceMinutes?.totalMinutes ?? 0)}
              </Stat>
              <p className="type-body-sm font-semibold text-on-surface-variant">
                {t("minutes")}
              </p>
            </div>
            <WeeklyBars insight={practiceMinutes} />
          </BentoTile>

          <BentoTile title={t("average_score")}>
            <div className="flex items-center gap-6">
              <ScoreGauge score={averageScore?.averageScore ?? null} />
              {averageScore?.deltaPoints != null ? (
                <p
                  className={cn(
                    "type-body-sm font-semibold leading-6",
                    averageScore.deltaPoints >= 0
                      ? "text-[#1E9E54] dark:text-[#5DD984]"
                      : "text-[#D6494E] dark:text-[#FF9398]"
                  )}
                >
                  {t("score_delta", {
                    count: Math.abs(Math.round(averageScore.deltaPoints)),
                  })}
                </p>
              ) : null}
            </div>
          </BentoTile>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <SeasonTile profile={profile} className="xl:col-span-7" />

        <BentoTile title={t("practice_mix")} className="xl:col-span-5">
          <div className="flex flex-wrap items-center gap-6">
            <MixDonut
              debatePercent={mix?.debatePercent ?? 0}
              total={totalMix}
              sessionsLabel={t("sessions")}
            />
            <div className="min-w-[180px] flex-1">
              <MixLegend
                debatePercent={mix?.debatePercent ?? 0}
                speakingPercent={mix?.speakingPercent ?? 0}
              />
            </div>
          </div>
        </BentoTile>
      </div>
    </div>
  );
}

export function PublicProfileAnalyticsTab({
  profile,
  data,
  range,
  isRangePending,
  onRangeChange,
}: {
  profile: PublicProfileShell;
  data: ProfileAnalyticsTabData | null | undefined;
  range: AnalyticsRangePreset;
  isRangePending?: boolean;
  onRangeChange: (range: AnalyticsRangePreset) => void;
}) {
  const t = useTranslations("profileSocial.analytics");
  const tHeader = useTranslations("profileSocial.header");
  const speakingCount = data?.speakingCount ?? 0;
  const debateCount = data?.debateCount ?? 0;
  const totalMix = speakingCount + debateCount;
  const debatePercent = totalMix > 0 ? Math.round((debateCount / totalMix) * 100) : 0;
  const speakingPercent = totalMix > 0 ? 100 - debatePercent : 0;

  return (
    <div className="grid gap-5">
      <div className="flex justify-end">
        <AnalyticsRangeControl
          range={range}
          isPending={isRangePending}
          onRangeChange={onRangeChange}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <SeasonTile profile={profile} className="xl:col-span-7" />

        <BentoTile title={t("weekly_practice")} className="xl:col-span-5">
          <div className="flex items-baseline gap-2">
            <Stat size="heading-xl" as="p" className="font-extrabold leading-none text-on-surface">
              {formatNumber(data?.totalPracticeMinutes ?? 0)}
            </Stat>
            <p className="type-body-sm font-semibold text-on-surface-variant">
              {t("minutes")}
            </p>
          </div>
          <p className="mt-4 type-body-sm font-semibold text-on-surface-variant">
            {t("sessions_in_range", { count: data?.totalSessions ?? 0 })}
          </p>
        </BentoTile>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <BentoTile title={t("average_score")}>
          <ScoreGauge score={data?.averageScore ?? null} />
        </BentoTile>

        <BentoTile title={t("practice_mix")}>
          <div className="flex flex-wrap items-center gap-5">
            <MixDonut
              debatePercent={debatePercent}
              total={totalMix}
              sessionsLabel={t("sessions")}
            />
            <div className="min-w-[150px] flex-1">
              <MixLegend
                debatePercent={debatePercent}
                speakingPercent={speakingPercent}
              />
            </div>
          </div>
        </BentoTile>

        <BentoTile title={t("profile_level")}>
          <div className="flex items-center gap-4">
            <Image
              src={LEVEL_ICON_SRC}
              alt=""
              width={88}
              height={88}
              unoptimized
              draggable={false}
              className="size-16 shrink-0 object-contain drop-shadow-token-card"
            />
            <div className="min-w-0">
              <p className="type-heading-lg font-extrabold leading-tight text-on-surface">
                {data?.level != null
                  ? tHeader("level_value", { level: data.level })
                  : tHeader("hidden")}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 type-caption font-semibold text-on-surface-variant">
                <UsersRound className="size-4" />
                {t("friends")}: {profile.friendCounts.friends}
              </p>
            </div>
          </div>
        </BentoTile>
      </div>
    </div>
  );
}
