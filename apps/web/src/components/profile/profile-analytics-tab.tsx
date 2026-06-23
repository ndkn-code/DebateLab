"use client";

import Image from "next/image";
import { curveNatural } from "@visx/curve";
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
import {
  ChartTooltip,
  Grid,
  Line,
  LineChart,
  RadarArea,
  RadarAxis,
  RadarChart,
  RadarGrid,
  RadarLabels,
  Ring,
  RingCenter,
  RingChart,
  XAxis,
} from "@/components/charts";
import { ChartCard, ChartEmpty, SegmentedRange } from "@/components/data-viz";
import type { ProfileAnalyticsTabData } from "@/lib/profile-social/tab-model";
import type { PublicProfileShell } from "@/lib/profile-social/model";
import type {
  AnalyticsInsightCard,
  AnalyticsPageData,
  AnalyticsRangePreset,
  AnalyticsTrendPoint,
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
  const options = [
    { value: "7d", label: t("range_7d") },
    { value: "30d", label: t("range_30d") },
    { value: "90d", label: t("range_90d") },
  ] satisfies Array<{ value: AnalyticsRangePreset; label: string }>;

  return (
    <div
      aria-label={t("range_label")}
      aria-busy={isPending ? "true" : undefined}
      className={cn("transition-opacity duration-200", isPending ? "opacity-80" : "opacity-100")}
    >
      <SegmentedRange
        value={range}
        onChange={onRangeChange}
        options={options}
      />
    </div>
  );
}

function SkillRadarHero({
  snapshot,
  strongestFocus,
}: {
  snapshot: AnalyticsPageData["skillSnapshot"];
  strongestFocus: StrongestFocusInsight | undefined;
}) {
  const t = useTranslations("analyticsPage");
  const metrics = snapshot.metrics.slice(0, 5);
  const strongestSkill =
    strongestFocus?.strongestSkill ?? snapshot.strongestSkill;
  const focusSkill = strongestFocus?.focusSkill ?? snapshot.weakestSkill;

  const overall =
    snapshot.overallScore != null ? Math.round(snapshot.overallScore) : null;
  const radarMetrics = metrics.map((metric) => ({
    key: metric.key,
    label: t(`skills.${metric.key}`),
  }));
  const radarValues = Object.fromEntries(
    metrics.map((metric) => [
      metric.key,
      Math.round(metric.coverage > 0 ? metric.value : 0),
    ])
  );
  const radarData = [
    {
      label: t("skill_snapshot_title"),
      values: radarValues,
      color: "var(--chart-line-primary)",
    },
  ];

  function skillScore(key: AnalyticsPageData["skillSnapshot"]["strongestSkill"]) {
    if (!key) return null;
    const metric = metrics.find((item) => item.key === key);
    return metric ? Math.round(metric.value) : null;
  }

  return (
    <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div className="flex justify-center">
        {metrics.length > 0 ? (
          <div className="relative flex size-[260px] items-center justify-center sm:size-[300px]">
            <RadarChart data={radarData} metrics={radarMetrics} size={260}>
              <RadarGrid />
              <RadarAxis />
              <RadarLabels fontSize={11} offset={18} />
              <RadarArea index={0} color="var(--chart-line-primary)" />
            </RadarChart>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="flex size-16 flex-col items-center justify-center rounded-full bg-surface-container-lowest text-center shadow-token-card ring-1 ring-outline-variant">
                <Stat size="title" as="p" className="font-extrabold leading-none text-on-surface">
                  {overall ?? "-"}
                </Stat>
                <span className="mt-0.5 type-caption font-semibold text-on-surface-variant">
                  /100
                </span>
              </div>
            </div>
          </div>
        ) : (
          <ChartEmpty title={t("skill_snapshot_empty_title")} />
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
        <div className="rounded-xl bg-success-container p-4">
          <Eyebrow className="text-success-dim">
            {t("cards.strongest_focus.strongest")}
          </Eyebrow>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <p className="type-title font-extrabold text-on-surface">
              {strongestSkill ? t(`skills.${strongestSkill}`) : "-"}
            </p>
            <Stat size="title" className="font-extrabold text-success-dim">
              {skillScore(strongestSkill) ?? ""}
            </Stat>
          </div>
        </div>

        <div className="rounded-xl bg-warning-container p-4">
          <Eyebrow className="text-on-warning-container">
            {t("cards.strongest_focus.focus_next")}
          </Eyebrow>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <p className="type-title font-extrabold text-on-surface">
              {focusSkill ? t(`skills.${focusSkill}`) : "-"}
            </p>
            <Stat size="title" className="font-extrabold text-on-warning-container">
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
          ? "bg-success-container text-success-dim"
          : "bg-error-container text-error"
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

function trendRows(series: AnalyticsTrendPoint[] | undefined) {
  return (series ?? []).map((point, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)),
    label: point.label,
    value: point.value,
  }));
}

function TrendLine({
  series,
  emptyTitle,
}: {
  series: AnalyticsTrendPoint[] | undefined;
  emptyTitle: string;
}) {
  const rows = trendRows(series);

  return (
    <div className="mt-5">
      {rows.length > 1 ? (
        <>
          <div className="h-40">
            <LineChart data={rows} margin={{ top: 18, right: 18, bottom: 30, left: 18 }}>
              <Grid horizontal />
              <Line
                dataKey="value"
                curve={curveNatural}
                stroke="var(--chart-line-primary)"
                showMarkers
              />
              <XAxis numTicks={3} />
              <ChartTooltip />
            </LineChart>
          </div>
          <div className="mt-1 flex justify-between gap-2 type-caption font-semibold text-on-surface-variant">
            <span className="truncate">{rows[0]?.label}</span>
            <span className="truncate text-right">{rows.at(-1)?.label}</span>
          </div>
        </>
      ) : (
        <ChartEmpty title={emptyTitle} />
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number | null }) {
  const bounded = score != null ? Math.max(0, Math.min(100, score)) : 0;
  const color =
    score == null
      ? "var(--color-chart-axis)"
      : bounded >= 80
        ? "var(--color-chart-3)"
        : bounded >= 55
          ? "var(--chart-line-primary)"
          : "var(--color-chart-4)";
  const data = [
    {
      label: "/100",
      value: Math.round(bounded),
      maxValue: 100,
      color,
    },
  ];

  return (
    <RingChart data={data} size={132} strokeWidth={14} baseInnerRadius={40}>
      <Ring index={0} color={color} />
      <RingCenter defaultLabel="/100" />
    </RingChart>
  );
}

function MixRing({
  debateCount,
  speakingCount,
  total,
  sessionsLabel,
}: {
  debateCount: number;
  speakingCount: number;
  total: number;
  sessionsLabel: string;
}) {
  const maxValue = Math.max(total, 1);
  const data = [
    {
      label: sessionsLabel,
      value: debateCount,
      maxValue,
      color: "var(--chart-line-primary)",
    },
    {
      label: sessionsLabel,
      value: speakingCount,
      maxValue,
      color: "var(--chart-line-secondary)",
    },
  ];

  return (
    <RingChart data={data} size={150} strokeWidth={13} baseInnerRadius={42}>
      {data.map((item, index) => (
        <Ring index={index} key={item.color} color={item.color} />
      ))}
      <RingCenter defaultLabel={sessionsLabel} />
    </RingChart>
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
          <Scale className="size-4 shrink-0 text-chart-1" />
          <span className="truncate">{tAnalytics("cards.mix.debate")}</span>
        </span>
        <span className="type-body-sm font-extrabold tabular-nums text-on-surface">
          {debatePercent}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-container px-3.5 py-2.5">
        <span className="inline-flex min-w-0 items-center gap-2 type-caption font-semibold text-on-surface">
          <Mic2 className="size-4 shrink-0 text-chart-2" />
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
    <ChartCard title={t("season_performance")} className={className}>
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
                <span className="rounded-full bg-warning-container px-3 py-1.5 type-caption font-bold tabular-nums text-on-warning-container">
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
    </ChartCard>
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
        <ChartCard
          title={t("skill_snapshot")}
          className="xl:col-span-7"
          bodyClassName="grid items-center"
        >
          <SkillRadarHero
            snapshot={analyticsData.skillSnapshot}
            strongestFocus={strongestFocus}
          />
        </ChartCard>

        <div className="grid min-w-0 content-start gap-5 xl:col-span-5">
          <ChartCard
            title={t("weekly_practice")}
            actions={
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
            <TrendLine
              series={practiceMinutes?.series}
              emptyTitle={t("weekly_practice")}
            />
          </ChartCard>

          <ChartCard title={t("average_score")}>
            <div className="flex items-center gap-6">
              <ScoreRing score={averageScore?.averageScore ?? null} />
              {averageScore?.deltaPoints != null ? (
                <p
                  className={cn(
                    "type-body-sm font-semibold leading-6",
                    averageScore.deltaPoints >= 0
                      ? "text-success-dim"
                      : "text-error"
                  )}
                >
                  {t("score_delta", {
                    count: Math.abs(Math.round(averageScore.deltaPoints)),
                  })}
                </p>
              ) : null}
            </div>
          </ChartCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <SeasonTile profile={profile} className="xl:col-span-7" />

        <ChartCard title={t("practice_mix")} className="xl:col-span-5">
          <div className="flex flex-wrap items-center gap-6">
            <MixRing
              debateCount={mix?.debateCount ?? 0}
              speakingCount={mix?.speakingCount ?? 0}
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
        </ChartCard>
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

        <ChartCard title={t("weekly_practice")} className="xl:col-span-5">
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
        </ChartCard>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <ChartCard title={t("average_score")}>
          <ScoreRing score={data?.averageScore ?? null} />
        </ChartCard>

        <ChartCard title={t("practice_mix")}>
          <div className="flex flex-wrap items-center gap-5">
            <MixRing
              debateCount={debateCount}
              speakingCount={speakingCount}
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
        </ChartCard>

        <ChartCard title={t("profile_level")}>
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
        </ChartCard>
      </div>
    </div>
  );
}
