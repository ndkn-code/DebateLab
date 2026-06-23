"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import useSWR, { mutate as mutateSWR } from "swr";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Globe2,
  Mic,
  Scale,
  ShieldCheck,
  Star,
  Swords,
  Target,
  Trophy,
  UsersRound,
} from "@/components/ui/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { Progress } from "@/components/ui/progress";
import { Heading, Stat, Text } from "@/components/ui/typography";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageHeader,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { ChartCard, ChartEmpty, SegmentedRange } from "@/components/data-viz";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  BarXAxis,
  ChartTooltip,
  Grid,
  HeatmapCells,
  HeatmapChart,
  HeatmapInteractionBoundary,
  HeatmapInteractionProvider,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
  RadarArea,
  RadarAxis,
  RadarChart,
  RadarGrid,
  RadarLabels,
  Ring,
  RingCenter,
  RingChart,
  XAxis,
  type HeatmapColumn,
  type HeatmapLevelColors,
} from "@/components/charts";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { cn } from "@/lib/utils";
import fireAnimation from "../../../public/lottie/fire.json";
import type {
  AnalyticsInsightCard,
  AnalyticsPageData,
  AnalyticsRangePreset,
  AnalyticsRecentSession,
  AnalyticsTrendPoint,
  DebateSession,
} from "@/types";

const RANGE_PRESETS: AnalyticsRangePreset[] = ["7d", "30d", "90d"];
const ANALYTICS_DEDUPE_INTERVAL = 5 * 60 * 1000;
const LOCAL_SESSIONS_STORAGE_KEY = "debatelab_sessions";
const LOCAL_SESSIONS_UPDATE_EVENT = "debatelab:sessions-updated";
const TREND_BASE_DATE_MS = Date.UTC(2024, 0, 1, 12);
const DAY_MS = 24 * 60 * 60 * 1000;
const HEATMAP_WEEK_COUNT = 6;
const HEATMAP_DAYS_PER_WEEK = 7;
const FALLBACK_HEATMAP_END_DATE_MS = Date.UTC(2024, 0, 42, 12);
const HEATMAP_LEVEL_COLORS: HeatmapLevelColors = [
  "var(--color-surface-container-low)",
  "var(--color-chart-2)",
  "var(--color-chart-1)",
  "var(--color-chart-6)",
  "var(--color-chart-3)",
];
const SKILL_DOT_CLASS: Record<
  AnalyticsPageData["skillSnapshot"]["metrics"][number]["key"],
  string
> = {
  clarity: "bg-chart-1",
  logic: "bg-chart-3",
  rebuttal: "bg-chart-4",
  evidence: "bg-chart-5",
  delivery: "bg-chart-6",
};

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatTotalMinutes(
  totalMinutes: number,
  t: ReturnType<typeof useTranslations>,
) {
  if (totalMinutes < 60) return t("minutes_short", { count: totalMinutes });
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0
    ? t("hours_minutes_short", { hours, minutes })
    : t("hours_short", { count: hours });
}

function formatDuration(
  minutes: number | null,
  t: ReturnType<typeof useTranslations>,
) {
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
  key: T,
) {
  return insights.find((insight) => insight.key === key) as Extract<
    AnalyticsInsightCard,
    { key: T }
  >;
}

function getAnalyticsSummaryKey(
  range: AnalyticsRangePreset,
  practiceLanguage: string,
) {
  return `/api/analytics/summary?range=${range}&language=${practiceLanguage}`;
}

function getLocalSessionDurationMinutes(session: DebateSession) {
  if (!session.duration || session.duration <= 0) return null;
  return Math.max(1, Math.round(session.duration / 60));
}

function getLocalSessionsSnapshot() {
  if (typeof window === "undefined") return "[]";
  return window.localStorage.getItem(LOCAL_SESSIONS_STORAGE_KEY) ?? "[]";
}

function subscribeToLocalSessions(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === LOCAL_SESSIONS_STORAGE_KEY) {
      onStoreChange();
    }
  };

  window.addEventListener("storage", handleStorageChange);
  window.addEventListener(LOCAL_SESSIONS_UPDATE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", handleStorageChange);
    window.removeEventListener(LOCAL_SESSIONS_UPDATE_EVENT, onStoreChange);
  };
}

function parseLocalRecentSessions(snapshot: string, practiceLanguage: string) {
  try {
    return (JSON.parse(snapshot) as DebateSession[])
      .filter(
        (session) =>
          coercePracticeLanguage(session.practiceLanguage) === practiceLanguage,
      )
      .map(mapLocalRecentSession);
  } catch {
    return [];
  }
}

function mapLocalRecentSession(session: DebateSession): AnalyticsRecentSession {
  const practiceTrack =
    session.practiceTrack ?? session.feedback?.practiceTrack ?? "debate";

  return {
    id: session.id,
    kind: "practice",
    topicTitle: session.topic.title,
    topicCategory: session.topic.category,
    practiceTrack,
    mode: session.mode,
    side: session.side,
    score: session.feedback?.totalScore ?? null,
    resultLabel: session.feedback?.overallBand ?? null,
    confidencePercent: null,
    durationMinutes: getLocalSessionDurationMinutes(session),
    createdAt: session.date,
    href: `/history/${session.id}`,
  };
}

function mergeRecentSessions(
  remoteSessions: AnalyticsRecentSession[],
  localSessions: AnalyticsRecentSession[],
) {
  return [...remoteSessions, ...localSessions]
    .filter((session, index, sessions) => {
      const firstMatchIndex = sessions.findIndex(
        (candidate) =>
          candidate.kind === session.kind && candidate.id === session.id,
      );
      return firstMatchIndex === index;
    })
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );
}

async function fetchAnalyticsSummary(key: string): Promise<AnalyticsPageData> {
  const response = await fetch(key, { credentials: "include" });
  if (!response.ok) {
    throw new Error("Unable to load analytics summary.");
  }

  return response.json();
}

function replaceRangeInUrl(range: AnalyticsRangePreset) {
  const url = new URL(window.location.href);
  url.searchParams.set("range", range);
  window.history.replaceState(
    null,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function trendDate(index: number) {
  return new Date(TREND_BASE_DATE_MS + index * DAY_MS);
}

function toTrendChartData(series: AnalyticsTrendPoint[]) {
  return series.map((entry, index) => ({
    date: trendDate(index),
    label: entry.label,
    value: Math.round(entry.value),
  }));
}

function toPracticeMinutesData(series: AnalyticsTrendPoint[]) {
  return series.map((entry) => ({
    label: entry.label,
    minutes: Math.round(entry.value),
  }));
}

function buildActivityHeatmap(
  sessions: AnalyticsRecentSession[],
): HeatmapColumn[] {
  const counts = new Map<string, number>();
  const sessionTimes: number[] = [];

  sessions.forEach((session) => {
    const date = new Date(session.createdAt);
    if (Number.isNaN(date.getTime())) return;
    const key = date.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
    sessionTimes.push(date.getTime());
  });

  const latestSessionTime =
    sessionTimes.length > 0
      ? Math.max(...sessionTimes)
      : FALLBACK_HEATMAP_END_DATE_MS;
  const latestDate = new Date(latestSessionTime);
  latestDate.setUTCHours(12, 0, 0, 0);
  const firstDateMs =
    latestDate.getTime() -
    (HEATMAP_WEEK_COUNT * HEATMAP_DAYS_PER_WEEK - 1) * DAY_MS;

  return Array.from({ length: HEATMAP_WEEK_COUNT }, (_, week) => ({
    bin: week,
    bins: Array.from({ length: HEATMAP_DAYS_PER_WEEK }, (_, day) => {
      const index = week * HEATMAP_DAYS_PER_WEEK + day;
      const date = new Date(firstDateMs + index * DAY_MS);
      const key = date.toISOString().slice(0, 10);

      return {
        bin: day,
        count: counts.get(key) ?? 0,
        date,
      };
    }),
  }));
}

function getHeatmapLevelColor(count: number | null | undefined) {
  if (!count || count <= 0) return HEATMAP_LEVEL_COLORS[0];
  if (count === 1) return HEATMAP_LEVEL_COLORS[1];
  if (count === 2) return HEATMAP_LEVEL_COLORS[2];
  if (count === 3) return HEATMAP_LEVEL_COLORS[3];
  return HEATMAP_LEVEL_COLORS[4];
}

function getAnalyticsScoreMeta(
  score: number | null,
  t?: ReturnType<typeof useTranslations>,
) {
  if (score == null) {
    return {
      status: t?.("score_status.completed") ?? "Completed",
      note: t?.("score_note.reviewed") ?? "Reviewed",
      badgeClassName: "bg-surface-container-low text-on-surface-variant",
    };
  }

  if (score >= 80) {
    return {
      status: t?.("score_status.proficient") ?? "Proficient",
      note:
        score >= 90
          ? (t?.("score_note.excellent") ?? "Excellent")
          : (t?.("score_note.very_good") ?? "Very Good"),
      badgeClassName: "bg-surface-container text-on-surface-variant",
    };
  }

  if (score >= 70) {
    return {
      status: t?.("score_status.competent") ?? "Competent",
      note:
        score >= 74
          ? (t?.("score_note.good") ?? "Good")
          : (t?.("score_note.solid") ?? "Solid"),
      badgeClassName: "bg-surface-container text-primary",
    };
  }

  return {
    status: t?.("score_status.developing") ?? "Developing",
    note: t?.("score_note.keep_going") ?? "Keep going",
    badgeClassName: "bg-warning-container text-on-surface-variant",
  };
}

function getSessionVisual(session: AnalyticsRecentSession, index: number) {
  const category = (session.topicCategory ?? "").toLowerCase();

  if (session.kind === "duel") {
    return {
      Icon: Swords,
      iconClassName: "text-warning",
      iconWrapClassName: "bg-warning-container",
    };
  }

  if (session.practiceTrack === "speaking") {
    const isPublicSpeaking = category.includes("public");
    return {
      Icon: isPublicSpeaking ? UsersRound : Mic,
      iconClassName: isPublicSpeaking
        ? "text-on-surface-variant"
        : "text-primary",
      iconWrapClassName: isPublicSpeaking
        ? "bg-surface-container"
        : "bg-surface-container",
    };
  }

  const title = session.topicTitle.toLowerCase();
  if (
    title.includes("climate") ||
    category.includes("environment") ||
    category.includes("sustainability")
  ) {
    return {
      Icon: Globe2,
      iconClassName: "text-on-surface-variant",
      iconWrapClassName: "bg-surface-container",
    };
  }

  const visuals = [
    {
      Icon: Building2,
      iconClassName: "text-on-surface-variant",
      iconWrapClassName: "bg-surface-container",
    },
    {
      Icon: Scale,
      iconClassName: "text-primary",
      iconWrapClassName: "bg-surface-container",
    },
  ];

  return visuals[index % visuals.length];
}

function getSessionDetail(
  session: AnalyticsRecentSession,
  t: ReturnType<typeof useTranslations>,
) {
  if (session.kind === "duel") return t("recent_duel_badge");
  if (session.practiceTrack === "speaking") {
    return t("recent_speaking_badge");
  }

  if (session.mode === "full") return t("recent_full_debate");
  return session.side === "opposition"
    ? t("recent_rebuttal")
    : t("recent_constructive");
}

function getScoreChartColor(score: number) {
  if (score >= 80) return "var(--color-chart-3)";
  if (score >= 70) return "var(--chart-line-primary)";
  return "var(--color-chart-4)";
}

function AnalyticsScoreRing({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <div className="flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-full bg-surface-container-low text-sm font-semibold text-on-surface-variant">
        -
      </div>
    );
  }

  const value = clampPercent(score);
  const color = getScoreChartColor(value);
  const ringData = [{ label: "Score", value, maxValue: 100, color }];

  return (
    <div className="flex h-[3.8rem] w-[3.8rem] items-center justify-center">
      <RingChart
        data={ringData}
        size={58}
        strokeWidth={5}
        ringGap={0}
        baseInnerRadius={18}
      >
        <Ring index={0} color={color} showGlow={false} />
        <RingCenter
          defaultLabel=""
          labelClassName="sr-only"
          valueClassName="type-label tabular-nums text-on-surface"
        />
      </RingChart>
    </div>
  );
}

function PracticeMinutesBarChart({
  series,
}: {
  series: AnalyticsTrendPoint[];
}) {
  const chartData = toPracticeMinutesData(series);

  return (
    <div className="h-28">
      <BarChart
        aspectRatio="auto"
        barGap={0.35}
        className="h-full"
        data={chartData}
        margin={{ top: 8, right: 8, bottom: 28, left: 8 }}
        xDataKey="label"
      >
        <Bar
          dataKey="minutes"
          fill="var(--chart-line-primary)"
          lineCap="round"
          minBarHeight={3}
        />
        <BarXAxis maxLabels={4} />
        <ChartTooltip
          rows={(point) => [
            {
              color: "var(--chart-line-primary)",
              label: String(point.label ?? ""),
              value: point.minutes as number,
            },
          ]}
          showDatePill={false}
        />
      </BarChart>
    </div>
  );
}

function ScoreTrendAreaChart({
  series,
  emptyTitle,
}: {
  series: AnalyticsTrendPoint[];
  emptyTitle: string;
}) {
  const chartData = toTrendChartData(series);
  const hasData = chartData.some((entry) => entry.value > 0);

  if (!hasData) {
    return <ChartEmpty className="h-28" title={emptyTitle} />;
  }

  return (
    <div className="h-28">
      <AreaChart
        aspectRatio="auto"
        className="h-full"
        data={chartData}
        margin={{ top: 10, right: 10, bottom: 28, left: 10 }}
        style={{ height: "100%" }}
      >
        <Grid horizontal />
        <Area
          dataKey="value"
          fill="var(--chart-line-primary)"
          fillOpacity={0.24}
          gradientToOpacity={0}
          showMarkers
          stroke="var(--chart-line-primary)"
          strokeWidth={2.5}
        />
        <XAxis numTicks={3} />
        <ChartTooltip
          rows={(point) => [
            {
              color: "var(--chart-line-primary)",
              label: String(point.label ?? ""),
              value: `${point.value}/100`,
            },
          ]}
          showDatePill={false}
        />
      </AreaChart>
    </div>
  );
}

function PercentRingChart({ value, label }: { value: number; label: string }) {
  const clamped = clampPercent(value);
  const ringData = [
    {
      label,
      value: clamped,
      maxValue: 100,
      color: "var(--chart-line-primary)",
    },
  ];

  return (
    <div className="flex h-36 w-36 shrink-0 items-center justify-center">
      <RingChart
        data={ringData}
        size={136}
        strokeWidth={12}
        ringGap={0}
        baseInnerRadius={40}
      >
        <Ring index={0} color="var(--chart-line-primary)" />
        <RingCenter
          defaultLabel={label}
          suffix="%"
          valueClassName="type-heading-lg font-semibold text-on-surface"
        />
      </RingChart>
    </div>
  );
}

function OverallRingChart({
  score,
  label,
}: {
  score: number | null;
  label: string;
}) {
  if (score == null) {
    return <ChartEmpty className="h-48" title="-" />;
  }

  const value = clampPercent(score);
  const color = getScoreChartColor(value);
  const ringData = [{ label, value, maxValue: 100, color }];

  return (
    <div className="flex h-52 items-center justify-center">
      <RingChart
        data={ringData}
        size={192}
        strokeWidth={14}
        ringGap={0}
        baseInnerRadius={56}
      >
        <Ring index={0} color={color} />
        <RingCenter
          defaultLabel={label}
          valueClassName="type-display-sm text-on-surface"
        />
      </RingChart>
    </div>
  );
}

function ActivityHeatmapCard({
  sessions,
}: {
  sessions: AnalyticsRecentSession[];
}) {
  const t = useTranslations("analyticsPage");
  const locale = useLocale();
  const heatmapData = useMemo(() => buildActivityHeatmap(sessions), [sessions]);
  const hasActivity = heatmapData.some((column) =>
    column.bins.some((bin) => bin.count > 0),
  );

  return (
    <ChartCard
      title={t("activity.title")}
      subtitle={t("activity.subtitle")}
      className="overflow-hidden"
    >
      {hasActivity ? (
        <HeatmapInteractionProvider>
          <HeatmapInteractionBoundary>
            <div className="flex flex-col gap-3">
              <HeatmapChart
                className="w-full"
                data={heatmapData}
                layout="fluid"
                levelColors={HEATMAP_LEVEL_COLORS}
                margin={{ top: 26, right: 10, bottom: 0, left: 34 }}
              >
                <HeatmapCells />
                <HeatmapXAxis />
                <HeatmapYAxis />
                <HeatmapTooltip
                  formatLabel={(count, date) =>
                    t("activity.tooltip", {
                      count,
                      date: formatDate(date.toISOString(), locale),
                    })
                  }
                />
              </HeatmapChart>
              <HeatmapLegend
                colorScale={getHeatmapLevelColor}
                lessLabel={t("activity.less")}
                moreLabel={t("activity.more")}
              />
            </div>
          </HeatmapInteractionBoundary>
        </HeatmapInteractionProvider>
      ) : (
        <ChartEmpty className="h-40" title={t("activity.empty")} />
      )}
    </ChartCard>
  );
}

function RangeControl({
  currentRange,
  isPending,
  onRangeChange,
}: {
  currentRange: AnalyticsRangePreset;
  isPending: boolean;
  onRangeChange: (range: AnalyticsRangePreset) => void;
}) {
  const t = useTranslations("analyticsPage");
  const options = RANGE_PRESETS.map((preset) => ({
    value: preset,
    label: t(`range_${preset}`),
  }));

  return (
    <div className="flex flex-wrap items-center gap-3">
      <SegmentedRange
        className="shadow-sm"
        onChange={onRangeChange}
        options={options}
        value={currentRange}
      />
      <span
        className={cn(
          "text-xs font-medium text-on-surface-variant transition-opacity",
          isPending ? "opacity-100" : "opacity-0",
        )}
        aria-live="polite"
      >
        {t("loading_range")}
      </span>
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
    <div className="flex min-h-[5rem] min-w-0 w-full items-center justify-center gap-2.5 px-3.5 py-3.5">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          tone,
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <Stat
          size="heading-md"
          as="div"
          className="whitespace-nowrap text-on-surface"
        >
          {value}
        </Stat>
        <Text
          variant="body-sm"
          as="div"
          className="mt-1 whitespace-nowrap text-on-surface-variant"
        >
          {label}
        </Text>
      </div>
    </div>
  );
}

function AnalyticsSkillSnapshotCard({
  metrics,
  overallScore,
  note,
  sourceSessions,
  confidence,
}: AnalyticsPageData["skillSnapshot"]) {
  const t = useTranslations("analyticsPage");
  const radarMetrics = metrics.map((metric) => ({
    key: metric.key,
    label: t(`skills.${metric.key}`),
  }));
  const radarData = [
    {
      label: t("overall_score"),
      color: "var(--chart-line-primary)",
      values: Object.fromEntries(
        metrics.map((metric) => [
          metric.key,
          metric.coverage > 0 ? clampPercent(metric.value) : 0,
        ]),
      ),
    },
  ];

  return (
    <ChartCard
      actions={
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {t("confidence", { count: confidence })}
        </span>
      }
      className="min-w-0 overflow-hidden"
      title={t("skill_snapshot_title")}
    >
      {sourceSessions === 0 ? (
        <ChartEmpty
          className="h-[250px] rounded-xl border border-dashed border-outline-variant/20 bg-surface-container-low px-5"
          description={t("empty_body")}
          title={t("empty_title")}
        />
      ) : (
        <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(300px,1.04fr)_minmax(250px,0.96fr)]">
          <div className="flex min-h-[294px] items-center justify-center rounded-xl bg-surface-container-low px-3 py-4">
            <RadarChart data={radarData} metrics={radarMetrics} size={284}>
              <RadarGrid />
              <RadarAxis />
              <RadarLabels fontSize={10} offset={16} />
              <RadarArea index={0} color="var(--chart-line-primary)" />
            </RadarChart>
          </div>

          <div className="grid gap-4">
            <OverallRingChart
              label={t("overall_score")}
              score={overallScore != null ? Math.round(overallScore) : null}
            />

            <div className="divide-y divide-outline-variant/16">
              {metrics.map((metric) => (
                <div
                  key={metric.key}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full",
                        SKILL_DOT_CLASS[metric.key],
                      )}
                    />
                    <span className="type-body font-medium text-on-surface">
                      {t(`skills.${metric.key}`)}
                    </span>
                  </div>
                  <p className="shrink-0 text-right">
                    <Stat size="title" className="text-on-surface">
                      {metric.coverage > 0 ? Math.round(metric.value) : "—"}
                    </Stat>
                    {metric.coverage > 0 ? (
                      <span className="ml-1 text-sm text-on-surface-variant">
                        /100
                      </span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[1.15rem] bg-surface-container-low px-4 py-3 xl:col-span-2 xl:-mt-4">
            <Star className="h-4.5 w-4.5 shrink-0 fill-primary text-primary" />
            <Text variant="body-sm" className="min-w-0 text-on-surface-variant">
              {note}
            </Text>
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function RecentSessionCard({
  session,
  index,
}: {
  session: AnalyticsRecentSession;
  index: number;
}) {
  const t = useTranslations("analyticsPage");
  const locale = useLocale();
  const score = session.score != null ? Math.round(session.score) : null;
  const scoreMeta = getAnalyticsScoreMeta(score, t);
  const visual = getSessionVisual(session, index);
  const StatusIcon =
    scoreMeta.status === "Proficient" ? BadgeCheck : ShieldCheck;
  const tag =
    session.kind === "duel"
      ? t("recent_duel_badge")
      : session.practiceTrack === "speaking"
        ? t("recent_speaking_badge")
        : t("recent_debate_badge");

  return (
    <div className="grid min-h-[104px] items-center gap-4 rounded-[1.35rem] border border-outline-variant/22 bg-surface-container-lowest px-4 py-3.5 shadow-token-panel md:grid-cols-[56px_minmax(0,1fr)_66px_116px_116px_108px]">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-[1.1rem]",
          visual.iconWrapClassName,
        )}
      >
        <visual.Icon
          className={cn("h-7 w-7 stroke-[2.25]", visual.iconClassName)}
        />
      </div>

      <div className="min-w-0">
        <h3 className="line-clamp-1 type-body font-semibold text-on-surface">
          {session.topicTitle}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold",
              session.kind === "duel"
                ? "bg-warning-container text-warning"
                : session.practiceTrack === "speaking"
                  ? "bg-surface-container text-primary"
                  : "bg-surface-container text-on-surface-variant",
            )}
          >
            {tag}
          </span>
          <span className="min-w-0 text-sm font-medium leading-5 text-on-surface-variant">
            {getSessionDetail(session, t)}
          </span>
        </div>
      </div>

      <AnalyticsScoreRing score={score} />

      <div className="flex min-w-0 flex-col gap-2">
        <span
          className={cn(
            "inline-flex h-8 w-fit max-w-full items-center gap-1.5 truncate rounded-full px-2.5 text-xs font-semibold",
            scoreMeta.badgeClassName,
          )}
        >
          <StatusIcon className="h-4 w-4 shrink-0" />
          {session.kind === "duel" && session.resultLabel
            ? session.resultLabel === "Won"
              ? t("recent_won")
              : session.resultLabel === "Lost"
                ? t("recent_lost")
                : t("recent_completed")
            : (session.resultLabel ?? scoreMeta.status)}
        </span>
        <span className="pl-2 text-sm font-medium text-on-surface-variant">
          {scoreMeta.note}
        </span>
      </div>

      <div className="flex min-w-0 flex-col gap-3 text-sm font-medium text-on-surface-variant">
        <span className="inline-flex items-center gap-2">
          <Clock3 className="h-4 w-4 shrink-0 text-primary" />
          {formatDuration(session.durationMinutes, t)}
        </span>
        <span className="inline-flex items-center gap-2 whitespace-nowrap">
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          {formatDate(session.createdAt, locale)}
        </span>
      </div>

      <Link href={session.href}>
        <Button
          type="button"
          className="h-11 min-w-0 rounded-2xl bg-primary px-4 text-sm font-semibold text-on-primary shadow-none hover:bg-primary-dim"
        >
          {t("review")}
          <ArrowRight className="ml-1 h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}

export function AnalyticsPage({
  data: initialData,
}: {
  data: AnalyticsPageData;
}) {
  const t = useTranslations("analyticsPage");
  const locale = useLocale();
  const practiceLanguage = coercePracticeLanguage(locale);
  const [selectedRange, setSelectedRange] = useState(initialData.range);
  const prefetchedRangesRef = useRef(
    new Set<AnalyticsRangePreset>([initialData.range]),
  );
  const localSessionsSnapshot = useSyncExternalStore(
    subscribeToLocalSessions,
    getLocalSessionsSnapshot,
    () => "[]",
  );
  const analyticsKey = getAnalyticsSummaryKey(selectedRange, practiceLanguage);
  const { data: fetchedData, isValidating } = useSWR<AnalyticsPageData>(
    analyticsKey,
    fetchAnalyticsSummary,
    {
      fallbackData:
        selectedRange === initialData.range ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: ANALYTICS_DEDUPE_INTERVAL,
    },
  );
  const data = fetchedData ?? initialData;
  const isPending = data.range !== selectedRange || isValidating;
  const prefetchRange = useCallback(
    (range: AnalyticsRangePreset) => {
      if (prefetchedRangesRef.current.has(range)) return;
      prefetchedRangesRef.current.add(range);
      const key = getAnalyticsSummaryKey(range, practiceLanguage);
      mutateSWR(key, fetchAnalyticsSummary(key), {
        populateCache: true,
        revalidate: false,
      });
    },
    [practiceLanguage],
  );
  const handleRangeChange = useCallback(
    (range: AnalyticsRangePreset) => {
      if (range === selectedRange) return;
      setSelectedRange(range);
      replaceRangeInUrl(range);
      prefetchRange(range);
    },
    [prefetchRange, selectedRange, setSelectedRange],
  );

  useEffect(() => {
    for (const range of RANGE_PRESETS) {
      if (range !== initialData.range) {
        prefetchRange(range);
      }
    }
  }, [initialData.range, prefetchRange]);

  const practiceMinutesCard = useMemo(
    () => findInsight(data.insights, "practice-minutes"),
    [data.insights],
  );
  const mixCard = useMemo(
    () => findInsight(data.insights, "speaking-vs-debate"),
    [data.insights],
  );
  const averageCard = useMemo(
    () => findInsight(data.insights, "recent-average-score"),
    [data.insights],
  );
  const strongestFocusCard = useMemo(
    () => findInsight(data.insights, "strongest-focus"),
    [data.insights],
  );
  const practiceMinutesDisplay = practiceMinutesCard;
  const mixDisplay = mixCard;
  const averageScoreDisplay = averageCard;
  const recentSessionsDisplay = useMemo(
    () =>
      mergeRecentSessions(
        data.recentSessions,
        parseLocalRecentSessions(localSessionsSnapshot, practiceLanguage),
      ),
    [data.recentSessions, localSessionsSnapshot, practiceLanguage],
  );

  return (
    <PageTransition className="min-h-full bg-background">
      <ProductPageShell>
        <PageContainer
          size="standard"
          className="flex min-w-0 flex-col py-5 lg:py-6"
        >
          <ProductPageHeader
            title={t("title")}
            icon={<BarChart3 />}
            actions={
              <RangeControl
                currentRange={selectedRange}
                isPending={isPending}
                onRangeChange={handleRangeChange}
              />
            }
          />

          <div className="grid gap-4">
            <div className="grid min-w-0 gap-4 2xl:grid-cols-[1.02fr_0.98fr]">
              <section className="min-w-0 overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface p-5 pb-4 shadow-token-card lg:p-6">
                <div className="grid h-full min-w-0 grid-cols-1 gap-x-6 md:grid-cols-[7rem_minmax(0,1fr)] md:grid-rows-[auto_auto]">
                  <Avatar className="h-28 w-28 shrink-0 ring-2 ring-primary-container shadow-token-card">
                    {data.hero.avatarUrl ? (
                      <AvatarImage
                        src={data.hero.avatarUrl}
                        alt={data.hero.displayName}
                      />
                    ) : null}
                    <AvatarFallback className="bg-primary-container type-heading-lg font-semibold text-primary">
                      {getInitials(data.hero.displayName)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="mt-5 min-w-0 md:mt-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <Heading level={1} as="h2" className="font-semibold">
                        {data.hero.displayName}
                      </Heading>
                      <span className="rounded-full bg-primary/10 px-3 py-1 type-body font-medium text-primary">
                        {data.hero.title ?? t("default_title")}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
                      <span>{t("level", { level: data.hero.level })}</span>
                      <span>•</span>
                      <span>{t("xp_total", { count: data.hero.xp })}</span>
                    </div>

                    <Text
                      variant="body"
                      className="mt-4 max-w-[42rem] break-words text-on-surface-variant"
                    >
                      {data.hero.statusLine}
                    </Text>

                    <div className="mt-6">
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
                      <Progress
                        value={data.hero.xpProgressPercent}
                        className="w-full gap-0"
                      />
                    </div>
                  </div>

                  <div className="col-span-full mt-9 grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
                    <HeroStat
                      icon={
                        <LottieAnimation
                          animationData={fireAnimation}
                          className="h-8 w-8"
                          loop
                        />
                      }
                      value={data.hero.streak}
                      label={t("hero_streak")}
                      tone="bg-surface-container"
                    />
                    <HeroStat
                      icon={<BarChart3 className="h-5 w-5 text-primary" />}
                      value={data.hero.totalSessions}
                      label={t("hero_sessions")}
                      tone="bg-primary/10"
                    />
                    <HeroStat
                      icon={<Clock3 className="h-5 w-5 text-success" />}
                      value={formatTotalMinutes(
                        data.hero.totalPracticeMinutes,
                        t,
                      )}
                      label={t("hero_practice_time")}
                      tone="bg-surface-container"
                    />
                  </div>
                </div>
              </section>

              <AnalyticsSkillSnapshotCard {...data.skillSnapshot} />
            </div>

            <div className="grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
              <ChartCard
                bodyClassName="flex flex-1 flex-col"
                className="min-h-[210px]"
                subtitle={t("cards.practice_minutes.scope")}
                title={t("cards.practice_minutes.title")}
              >
                <div className="flex flex-1 flex-col gap-4">
                  <div className="flex items-end gap-2">
                    <Stat
                      size="heading-xl"
                      as="div"
                      className="text-on-surface"
                    >
                      {practiceMinutesDisplay.totalMinutes}
                    </Stat>
                    <div className="pb-1 text-sm text-on-surface-variant">
                      {t("cards.practice_minutes.unit")}
                    </div>
                  </div>
                  <p
                    className={cn(
                      "text-sm font-medium leading-5",
                      practiceMinutesDisplay.deltaPercent != null &&
                        practiceMinutesDisplay.deltaPercent >= 0
                        ? "text-success"
                        : "text-on-surface-variant",
                    )}
                  >
                    {practiceMinutesDisplay.deltaPercent != null
                      ? t("cards.practice_minutes.delta", {
                          count: Math.abs(practiceMinutesDisplay.deltaPercent),
                          sign:
                            practiceMinutesDisplay.deltaPercent >= 0
                              ? "+"
                              : "-",
                        })
                      : t("cards.practice_minutes.no_delta")}
                  </p>
                  <PracticeMinutesBarChart
                    series={practiceMinutesDisplay.series}
                  />
                </div>
              </ChartCard>

              <ChartCard
                bodyClassName="flex flex-1 flex-col"
                className="min-h-[210px]"
                subtitle={t("cards.mix.scope")}
                title={t("cards.mix.title")}
              >
                <div className="flex flex-1 items-center gap-6">
                  <PercentRingChart
                    value={mixDisplay.debatePercent}
                    label={t("cards.mix.debate")}
                  />
                  <div className="min-w-0 flex-1 space-y-3.5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-on-surface">
                        <span className="h-2.5 w-2.5 rounded-full bg-chart-1" />
                        {t("cards.mix.debate")}
                      </div>
                      <span className="font-semibold text-on-surface">
                        {mixDisplay.debatePercent}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-on-surface">
                        <span className="h-2.5 w-2.5 rounded-full bg-chart-2" />
                        {t("cards.mix.speaking")}
                      </div>
                      <span className="font-semibold text-on-surface">
                        {mixDisplay.speakingPercent}%
                      </span>
                    </div>
                  </div>
                </div>
                <Link
                  href="/profile?tab=activities"
                  className="mt-3 inline-flex items-center gap-2 self-end text-sm font-medium text-primary hover:underline"
                >
                  {t("cards.mix.view_breakdown")}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </ChartCard>

              <ChartCard
                bodyClassName="flex flex-1 flex-col"
                className="min-h-[210px]"
                subtitle={t("cards.average_score.scope")}
                title={t("cards.average_score.title")}
              >
                <div className="flex items-end gap-2">
                  <Stat size="heading-xl" as="div" className="text-on-surface">
                    {averageScoreDisplay.averageScore != null
                      ? Math.round(averageScoreDisplay.averageScore)
                      : "-"}
                  </Stat>
                  <div className="pb-1 text-sm text-on-surface-variant">
                    /100
                  </div>
                </div>
                <p
                  className={cn(
                    "mt-2 text-sm font-medium",
                    averageScoreDisplay.deltaPoints != null &&
                      averageScoreDisplay.deltaPoints >= 0
                      ? "text-success"
                      : "text-on-surface-variant",
                  )}
                >
                  {averageScoreDisplay.deltaPoints != null
                    ? t("cards.average_score.delta", {
                        count: Math.abs(
                          Math.round(averageScoreDisplay.deltaPoints),
                        ),
                        sign: averageScoreDisplay.deltaPoints >= 0 ? "+" : "-",
                      })
                    : t("cards.average_score.no_delta")}
                </p>
                <div className="mt-auto">
                  <ScoreTrendAreaChart
                    emptyTitle={t("cards.average_score.no_delta")}
                    series={averageScoreDisplay.series}
                  />
                </div>
              </ChartCard>

              <ChartCard
                bodyClassName="flex flex-1 flex-col justify-center"
                className="min-h-[210px]"
                subtitle={t("cards.strongest_focus.scope")}
                title={t("cards.strongest_focus.title")}
              >
                <div className="flex flex-1 flex-col justify-center gap-3">
                  <div className="rounded-xl bg-surface-container-low px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/16 text-success">
                          <Trophy className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-on-surface-variant">
                            {t("cards.strongest_focus.strongest")}
                          </div>
                          <div className="mt-0.5 truncate type-title text-on-surface">
                            {strongestFocusCard.strongestSkill
                              ? t(`skills.${strongestFocusCard.strongestSkill}`)
                              : t("empty_title")}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-[5.5rem] shrink-0 items-end justify-end text-right text-on-surface">
                        <Stat size="heading-lg" className="font-semibold">
                          {strongestFocusCard.strongestScore ?? "-"}
                        </Stat>
                        {strongestFocusCard.strongestScore != null ? (
                          <span className="ml-1 pb-[1px] text-sm leading-none text-on-surface-variant">
                            /100
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-surface-container-low px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-warning/18 text-on-surface-variant">
                          <Target className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-on-surface-variant">
                            {t("cards.strongest_focus.focus_next")}
                          </div>
                          <div className="mt-0.5 truncate type-title text-on-surface">
                            {strongestFocusCard.focusSkill
                              ? t(`skills.${strongestFocusCard.focusSkill}`)
                              : t("empty_title")}
                          </div>
                        </div>
                      </div>
                      <div className="flex w-[5.5rem] shrink-0 items-end justify-end text-right text-on-surface">
                        <Stat size="heading-lg" className="font-semibold">
                          {strongestFocusCard.focusScore ?? "-"}
                        </Stat>
                        {strongestFocusCard.focusScore != null ? (
                          <span className="ml-1 pb-[1px] text-sm leading-none text-on-surface-variant">
                            /100
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </ChartCard>
            </div>

            <ActivityHeatmapCard sessions={recentSessionsDisplay} />

            <section className="flex min-w-0 flex-col overflow-hidden rounded-[1.8rem] border border-outline-variant/15 bg-surface p-5 shadow-token-card lg:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Heading level={4} as="h3">
                    {t("recent_sessions_title")}
                  </Heading>
                </div>
                <Link
                  href="/profile?tab=activities"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {t("view_all")}
                </Link>
              </div>

              {recentSessionsDisplay.length > 0 ? (
                <div className="mt-4 space-y-3 rounded-[1.35rem] bg-surface px-1">
                  {recentSessionsDisplay.slice(0, 4).map((session, index) => (
                    <RecentSessionCard
                      key={`${session.kind}-${session.id}`}
                      session={session}
                      index={index}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-5 flex min-h-[220px] items-center rounded-[1.6rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-10 text-center">
                  <div className="mx-auto">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <CheckCircle2 className="h-6 w-6" />
                    </div>
                    <h4 className="mt-4 type-heading-md text-on-surface">
                      {t("empty_title")}
                    </h4>
                    <Text
                      variant="body-sm"
                      className="mx-auto mt-2 max-w-xl text-on-surface-variant"
                    >
                      {t("empty_body")}
                    </Text>
                    <Link href="/practice" className="mt-5 inline-flex">
                      <Button className="h-11 rounded-2xl px-5">
                        {t("start_practicing")}
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
