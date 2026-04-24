"use client";

import { useMemo, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import useSWR from "swr";
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
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { Progress } from "@/components/ui/progress";
import { SKILL_UI_META } from "@/lib/analytics/skill-metadata";
import { storage, supabaseStorage } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import fireAnimation from "../../../public/lottie/fire.json";
import type {
  AnalyticsInsightCard,
  AnalyticsPageData,
  AnalyticsRangePreset,
  AnalyticsRecentSession,
  DebateSession,
} from "@/types";

const RANGE_PRESETS: AnalyticsRangePreset[] = ["7d", "30d", "90d"];

const RANGE_DAYS: Record<AnalyticsRangePreset, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const CHART_SIZE = 330;
const CHART_CENTER = CHART_SIZE / 2;
const CHART_MAX_RADIUS = 106;

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

function getAnalyticsDateKey(date: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(date));
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

function labelPositionForIndex(index: number) {
  const radius = CHART_MAX_RADIUS + 28;
  const angle = -Math.PI / 2 + (index * (Math.PI * 2)) / 5;
  const x = CHART_CENTER + Math.cos(angle) * radius;
  const y = CHART_CENTER + Math.sin(angle) * radius;

  if (index === 0) return { x, y, textAnchor: "middle" as const };
  if (index === 1 || index === 2) return { x, y, textAnchor: "start" as const };
  return { x, y, textAnchor: "end" as const };
}

function pointForValue(index: number, value: number) {
  const radius = CHART_MAX_RADIUS * (value / 100);
  const angle = -Math.PI / 2 + (index * (Math.PI * 2)) / 5;

  return {
    x: CHART_CENTER + Math.cos(angle) * radius,
    y: CHART_CENTER + Math.sin(angle) * radius,
  };
}

function polygonPoints(values: number[]) {
  return values
    .map((value, index) => {
      const point = pointForValue(index, value);
      return `${point.x},${point.y}`;
    })
    .join(" ");
}

function buildPracticeSeriesFromSessions(
  range: AnalyticsRangePreset,
  sessions: DebateSession[]
) {
  const labels = ["M", "T", "W", "T", "F", "S", "S"];
  const totalDays = RANGE_DAYS[range];
  const keys = Array.from({ length: totalDays }, (_, index) => {
    const current = new Date();
    current.setDate(current.getDate() - (totalDays - 1 - index));
    return getAnalyticsDateKey(current.toISOString());
  });

  const byDate = new Map<string, number>();

  sessions.forEach((session) => {
    const key = getAnalyticsDateKey(session.date);
    const minutes = Math.max(1, Math.round(session.duration / 60));
    byDate.set(key, (byDate.get(key) ?? 0) + minutes);
  });

  if (range === "7d") {
    return keys.map((key, index) => ({
      label: labels[index] ?? "",
      value: byDate.get(key) ?? 0,
    }));
  }

  const sums = Array.from({ length: 7 }, () => 0);
  const counts = Array.from({ length: 7 }, () => 0);

  keys.forEach((key) => {
    const date = new Date(`${key}T00:00:00Z`);
    const weekday = date.getUTCDay();
    const mondayFirstIndex = weekday === 0 ? 6 : weekday - 1;
    sums[mondayFirstIndex] += byDate.get(key) ?? 0;
    counts[mondayFirstIndex] += 1;
  });

  return labels.map((label, index) => ({
    label,
    value: counts[index] > 0 ? Math.round(sums[index] / counts[index]) : 0,
  }));
}

function mapLocalRecentSession(session: DebateSession): AnalyticsRecentSession {
  return {
    id: session.id,
    kind: "practice",
    topicTitle: session.topic.title,
    topicCategory: session.topic.category,
    practiceTrack: session.practiceTrack ?? session.feedback?.practiceTrack ?? "debate",
    mode: session.mode,
    side: session.side,
    score: session.feedback?.totalScore ?? null,
    resultLabel: session.feedback?.overallBand ?? null,
    confidencePercent: null,
    durationMinutes: Math.max(1, Math.round(session.duration / 60)),
    createdAt: session.date,
    href: `/history/${session.id}`,
  };
}

function getRangeStart(range: AnalyticsRangePreset) {
  const start = new Date();
  start.setDate(start.getDate() - (RANGE_DAYS[range] - 1));
  start.setHours(0, 0, 0, 0);
  return start;
}

function filterSessionsForRange(range: AnalyticsRangePreset, sessions: DebateSession[]) {
  const start = getRangeStart(range).getTime();
  return sessions.filter((session) => new Date(session.date).getTime() >= start);
}

function buildScoreSeriesFromSessions(sessions: DebateSession[]) {
  return [...sessions]
    .filter((session) => session.feedback?.totalScore != null)
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
    .slice(-6)
    .map((session, index) => ({
      label: `${index + 1}`,
      value: session.feedback?.totalScore ?? 0,
    }));
}

function getAnalyticsScoreMeta(score: number | null) {
  if (score == null) {
    return {
      stroke: "#8A96A8",
      status: "Completed",
      note: "Reviewed",
      badgeClassName: "bg-surface-container-low text-on-surface-variant",
    };
  }

  if (score >= 80) {
    return {
      stroke: "#00a66f",
      status: "Proficient",
      note: score >= 90 ? "Excellent" : "Very Good",
      badgeClassName: "bg-[#eaf8f4] text-[#00a66f]",
    };
  }

  if (score >= 70) {
    return {
      stroke: "#1478ff",
      status: "Competent",
      note: score >= 74 ? "Good" : "Solid",
      badgeClassName: "bg-[#edf5ff] text-[#1478ff]",
    };
  }

  return {
    stroke: "#F59E0B",
    status: "Developing",
    note: "Keep going",
    badgeClassName: "bg-[#fff4e2] text-[#F59E0B]",
  };
}

function getSessionVisual(session: AnalyticsRecentSession, index: number) {
  const category = (session.topicCategory ?? "").toLowerCase();

  if (session.kind === "duel") {
    return {
      Icon: Swords,
      iconClassName: "text-[#ff9b00]",
      iconWrapClassName: "bg-[#fff4e2]",
    };
  }

  if (session.practiceTrack === "speaking") {
    const isPublicSpeaking = category.includes("public");
    return {
      Icon: isPublicSpeaking ? UsersRound : Mic,
      iconClassName: isPublicSpeaking
        ? "text-[#7b45f6]"
        : "text-[#1478ff]",
      iconWrapClassName: isPublicSpeaking
        ? "bg-[#f2ecff]"
        : "bg-[#eaf2ff]",
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
      iconClassName: "text-[#12b8a6]",
      iconWrapClassName: "bg-[#e7fbf8]",
    };
  }

  const visuals = [
    {
      Icon: Building2,
      iconClassName: "text-[#7b45f6]",
      iconWrapClassName: "bg-[#f1e9ff]",
    },
    {
      Icon: Scale,
      iconClassName: "text-primary",
      iconWrapClassName: "bg-[#eaf2ff]",
    },
  ];

  return visuals[index % visuals.length];
}

function getSessionDetail(session: AnalyticsRecentSession, t: ReturnType<typeof useTranslations>) {
  if (session.kind === "duel") return t("recent_duel_badge");
  if (session.practiceTrack === "speaking") {
    return session.topicCategory?.includes("Public")
      ? "Public Speaking"
      : t("recent_speaking_badge");
  }

  if (session.mode === "full") return "1v1 Debate";
  return session.side === "opposition" ? "Rebuttal" : "Constructive";
}

function AnalyticsScoreRing({ score }: { score: number | null }) {
  if (score == null) {
    return (
      <div className="flex h-[3.6rem] w-[3.6rem] items-center justify-center rounded-full bg-surface-container-low text-sm font-semibold text-on-surface-variant">
        —
      </div>
    );
  }

  const meta = getAnalyticsScoreMeta(score);
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, score)) / 100) * circumference;

  return (
    <div className="relative flex h-[3.8rem] w-[3.8rem] items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 64 64">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke="rgba(222,232,248,0.95)"
          strokeWidth="4"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          stroke={meta.stroke}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="text-sm font-semibold text-on-surface">{score}</span>
    </div>
  );
}

function MiniBarChart({
  values,
  labels,
  compact = false,
}: {
  values: number[];
  labels: string[];
  compact?: boolean;
}) {
  const max = Math.max(...values, 1);
  const hasData = values.some((value) => value > 0);
  const highlightIndex = hasData ? values.findIndex((value) => value === max) : -1;
  const chartHeight = compact ? 98 : 112;
  const barWidthClass = compact ? "max-w-[12px]" : "max-w-[18px]";

  return (
    <div className={cn("mt-5", compact && "mt-0")}>
      <div className="flex items-end justify-between gap-2.5" style={{ height: chartHeight }}>
        {values.map((value, index) => (
          <div
            key={`${labels[index]}-${index}`}
            className="flex flex-1 flex-col items-center justify-end"
          >
            <div
              className={cn(
                "w-full rounded-full transition-all",
                barWidthClass,
                index === highlightIndex
                  ? "bg-primary"
                  : value > 0
                    ? "bg-primary/42"
                    : "bg-primary/16"
              )}
              style={{
                height: `${hasData ? Math.max(12, (value / max) * (compact ? 88 : 96)) : 9}px`,
              }}
            />
            {labels[index] ? (
              <div className="mt-2 text-center text-[11px] font-medium text-on-surface-variant/90">
                {labels[index]}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniLineChart({ values }: { values: number[] }) {
  if (values.length === 0) {
    return (
      <div className="mt-4 flex h-[96px] items-center justify-center rounded-2xl bg-surface-container-low text-sm text-on-surface-variant">
        —
      </div>
    );
  }

  const width = 320;
  const height = 116;
  const chartLeft = 36;
  const chartRight = 312;
  const chartTop = 12;
  const chartBottom = 94;
  const stepX =
    values.length === 1 ? 0 : (chartRight - chartLeft) / (values.length - 1);

  const chartPoints = values.map((value, index) => {
      const x = chartLeft + index * stepX;
    const clamped = Math.max(0, Math.min(100, value));
    const y = chartBottom - (clamped / 100) * (chartBottom - chartTop);
    return { x, y, value: Math.round(value) };
  });
  const points = chartPoints.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPoints = `${chartLeft},${chartBottom} ${points} ${chartRight},${chartBottom}`;

  return (
    <div className="mt-3 -mx-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-[112px] w-full overflow-visible"
        role="img"
        aria-label="Recent average score trend"
      >
        <defs>
          <linearGradient id="analytics-score-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#4D86F7" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#4D86F7" stopOpacity="0" />
          </linearGradient>
          <filter id="analytics-score-glow" x="-20%" y="-80%" width="140%" height="260%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0.302 0 0 0 0 0.525 0 0 0 0 0.969 0 0 0 0.35 0"
            />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {[100, 75, 50, 25, 0].map((tick) => {
          const y = chartBottom - (tick / 100) * (chartBottom - chartTop);
          return (
            <g key={tick}>
              <text
                x="3"
                y={y + 3}
                className="fill-[#718096] text-[8.6px] font-medium"
              >
                {tick}
              </text>
              <line
                x1={chartLeft}
                y1={y}
                x2={chartRight}
                y2={y}
                stroke="rgba(65,80,105,0.1)"
                strokeWidth="1"
              />
            </g>
          );
        })}
        <polygon points={areaPoints} fill="url(#analytics-score-area)" />
        <polyline
          fill="none"
          stroke="rgba(77,134,247,0.22)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
        <polyline
          fill="none"
          stroke="#4D86F7"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
          filter="url(#analytics-score-glow)"
        />
        {chartPoints.map((point, index) => {
          const tooltipX = Math.min(Math.max(point.x - 24, chartLeft), chartRight - 48);
          const tooltipY = Math.max(point.y - 30, 1);

          return (
            <g key={`${point.x}-${point.y}-${index}`} className="group cursor-default">
              <circle cx={point.x} cy={point.y} r="11" fill="transparent">
                <title>{`${point.value}/100`}</title>
              </circle>
              <circle
                cx={point.x}
                cy={point.y}
                r={index === chartPoints.length - 1 ? "5" : "3.8"}
                fill="#4D86F7"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              <circle
                cx={point.x}
                cy={point.y}
                r={index === chartPoints.length - 1 ? "9" : "0"}
                fill="rgba(77,134,247,0.18)"
              />
              <g className="pointer-events-none opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                <rect
                  x={tooltipX}
                  y={tooltipY}
                  width="48"
                  height="22"
                  rx="8"
                  fill="#0B1424"
                  opacity="0.92"
                />
                <text
                  x={tooltipX + 24}
                  y={tooltipY + 14.5}
                  textAnchor="middle"
                  className="fill-white text-[9px] font-semibold"
                >
                  {point.value}/100
                </text>
              </g>
            </g>
          );
        })}
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
  const radius = 39;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative flex h-36 w-36 shrink-0 items-center justify-center">
      <svg className="h-36 w-36 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(169,198,251,0.25)"
          strokeWidth="12"
        />
        <circle
          cx="50"
          cy="50"
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
        <div className="text-[1.5rem] font-semibold leading-none text-on-surface">
          {clamped}%
        </div>
        <div className="mt-0.5 text-xs text-on-surface-variant">{label}</div>
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
    <div className="flex min-h-[5rem] w-full items-center justify-center gap-2.5 px-3.5 py-3.5">
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          tone
        )}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="whitespace-nowrap text-[1.35rem] font-semibold leading-none text-on-surface">
          {value}
        </div>
        <div className="mt-1 whitespace-nowrap text-[0.9rem] leading-tight text-on-surface-variant">
          {label}
        </div>
      </div>
    </div>
  );
}

function AnalyticsSkillSnapshotCard({
  metrics,
  overallScore,
  note,
  sourceSessions,
}: AnalyticsPageData["skillSnapshot"]) {
  const t = useTranslations("analyticsPage");
  const values = metrics.map((metric) => metric.value);

  return (
    <section className="rounded-[1.8rem] border border-outline-variant/15 bg-surface p-5 pb-3 shadow-[0_18px_40px_rgba(11,20,36,0.05)] lg:p-6 lg:pb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-on-surface">
            {t("skill_snapshot_title")}
          </h2>
        </div>
      </div>

      {sourceSessions === 0 ? (
        <div className="mt-5 flex h-[250px] flex-col items-center justify-center rounded-[1.5rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-5 text-center">
          <p className="text-sm font-medium text-on-surface">{t("empty_title")}</p>
          <p className="mt-2 max-w-md text-sm leading-6 text-on-surface-variant">
            {t("empty_body")}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(300px,1.08fr)_minmax(270px,0.92fr)]">
          <div className="flex min-h-[294px] items-center justify-center">
            <svg
              viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}
              className="block h-[297px] w-full max-w-[352px]"
              aria-hidden="true"
            >
              {[1, 2, 3, 4].map((step) => {
                const ringValue = 25 * step;
                return (
                  <polygon
                    key={step}
                    points={polygonPoints(Array(5).fill(ringValue))}
                    fill={step % 2 === 0 ? "rgba(169,198,251,0.1)" : "transparent"}
                    stroke="rgba(65,80,105,0.18)"
                    strokeWidth="1"
                  />
                );
              })}

              {metrics.map((_, index) => {
                const edge = pointForValue(index, 100);
                return (
                  <line
                    key={`axis-${index}`}
                    x1={CHART_CENTER}
                    y1={CHART_CENTER}
                    x2={edge.x}
                    y2={edge.y}
                    stroke="rgba(65,80,105,0.16)"
                    strokeWidth="1"
                  />
                );
              })}

              <polygon
                points={polygonPoints(values)}
                fill="rgba(77,134,247,0.16)"
                stroke="rgba(62,120,236,0.95)"
                strokeWidth="2.5"
              />

              {metrics.map((metric, index) => {
                const point = pointForValue(index, metric.value);
                return (
                  <circle
                    key={`point-${metric.key}`}
                    cx={point.x}
                    cy={point.y}
                    r="4"
                    fill="#3E78EC"
                  />
                );
              })}

              {metrics.map((metric, index) => {
                const position = labelPositionForIndex(index);
                return (
                  <text
                    key={`${metric.key}-label`}
                    x={position.x}
                    y={position.y}
                    textAnchor={position.textAnchor}
                    className="fill-[#415069] text-[13.5px] font-medium"
                  >
                    {t(`skills.${metric.key}`)}
                  </text>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-col border-t border-outline-variant/16 pt-5 xl:border-l xl:border-t-0 xl:pt-0 xl:pl-6">
            <div className="divide-y divide-outline-variant/16">
              {metrics.map((metric) => (
                <div
                  key={metric.key}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SKILL_UI_META[metric.key].accentHex }}
                    />
                    <span className="text-[0.97rem] font-medium text-on-surface">
                      {t(`skills.${metric.key}`)}
                    </span>
                  </div>
                  <p className="shrink-0 text-right">
                    <span className="text-[1.06rem] font-semibold text-on-surface">
                      {Math.round(metric.value)}
                    </span>
                    <span className="ml-1 text-sm text-on-surface-variant">/100</span>
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-1">
              <div className="flex items-center justify-between gap-4 border-t border-outline-variant/16 pt-2">
                <span className="min-w-0 text-sm font-medium text-on-surface">
                  {t("overall_score")}
                </span>
                <p className="inline-flex shrink-0 items-center gap-1.5 text-right">
                  <Star className="h-4.5 w-4.5 fill-primary text-primary" />
                  <span className="text-[1.35rem] font-semibold leading-none text-primary">
                    {overallScore != null ? Math.round(overallScore) : "—"}
                  </span>
                  <span className="ml-1 text-sm text-on-surface-variant">/100</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-[1.15rem] bg-surface-container-low px-4 py-3 xl:col-span-2 xl:-mt-4">
            <Star className="h-4.5 w-4.5 shrink-0 fill-primary text-primary" />
            <p className="min-w-0 text-sm leading-5 text-on-surface-variant">{note}</p>
          </div>
        </div>
      )}
    </section>
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
  const scoreMeta = getAnalyticsScoreMeta(score);
  const visual = getSessionVisual(session, index);
  const StatusIcon = scoreMeta.status === "Proficient" ? BadgeCheck : ShieldCheck;
  const tag =
    session.kind === "duel"
      ? t("recent_duel_badge")
      : session.practiceTrack === "speaking"
        ? t("recent_speaking_badge")
        : t("recent_debate_badge");

  return (
    <div className="grid min-h-[104px] items-center gap-4 rounded-[1.35rem] border border-outline-variant/22 bg-surface-container-lowest px-4 py-3.5 shadow-[0_20px_58px_-48px_rgba(22,39,91,0.36)] md:grid-cols-[56px_minmax(0,1fr)_66px_116px_116px_108px]">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-[1.1rem]",
          visual.iconWrapClassName
        )}
      >
        <visual.Icon className={cn("h-7 w-7 stroke-[2.25]", visual.iconClassName)} />
      </div>

      <div className="min-w-0">
        <h3 className="line-clamp-1 text-base font-semibold leading-6 text-on-surface">
          {session.topicTitle}
        </h3>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-lg px-2 text-xs font-semibold",
              session.kind === "duel"
                ? "bg-[#fff4e2] text-[#ff9b00]"
                : session.practiceTrack === "speaking"
                  ? "bg-[#e9f3ff] text-[#1478ff]"
                  : "bg-[#f1e9ff] text-[#8a34ff]"
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
            scoreMeta.badgeClassName
          )}
        >
          <StatusIcon className="h-4 w-4 shrink-0" />
          {session.kind === "duel" && session.resultLabel
            ? session.resultLabel === "Won"
              ? t("recent_won")
              : session.resultLabel === "Lost"
                ? t("recent_lost")
                : t("recent_completed")
            : session.resultLabel ?? scoreMeta.status}
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

export function AnalyticsPage({ data }: { data: AnalyticsPageData }) {
  const t = useTranslations("analyticsPage");
  const { data: clientSessions = [] } = useSWR(
    "analytics-sessions",
    async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        return storage.getSessions();
      }

      return supabaseStorage.getSessions(user.id);
    },
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
    }
  );
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
  const localPracticeSeries = useMemo(
    () => buildPracticeSeriesFromSessions(data.range, clientSessions),
    [data.range, clientSessions]
  );
  const localRangeSessions = useMemo(
    () => filterSessionsForRange(data.range, clientSessions),
    [data.range, clientSessions]
  );
  const practiceMinutesDisplay = useMemo(() => {
    const hasServerData =
      practiceMinutesCard.totalMinutes > 0 ||
      practiceMinutesCard.series.some((entry) => entry.value > 0);
    const hasServerBars = practiceMinutesCard.series.some((entry) => entry.value > 0);
    const hasFallbackBars = localPracticeSeries.some((entry) => entry.value > 0);
    const fallbackTotal = localPracticeSeries.reduce(
      (total, entry) => total + entry.value,
      0
    );

    if ((!hasServerBars && hasFallbackBars) || (!hasServerData && fallbackTotal > 0)) {
      return {
        ...practiceMinutesCard,
        totalMinutes: Math.max(practiceMinutesCard.totalMinutes, fallbackTotal),
        deltaPercent: practiceMinutesCard.deltaPercent,
        series: localPracticeSeries,
      };
    }

    if (hasServerData && !hasServerBars && practiceMinutesCard.totalMinutes > 0) {
      const weekday = new Date().getDay();
      const mondayFirstIndex = weekday === 0 ? 6 : weekday - 1;
      return {
        ...practiceMinutesCard,
        series: practiceMinutesCard.series.map((entry, index) => ({
          ...entry,
          value: index === mondayFirstIndex ? practiceMinutesCard.totalMinutes : 0,
        })),
      };
    }

    if (hasServerData) {
      return practiceMinutesCard;
    }

    return {
      ...practiceMinutesCard,
      totalMinutes: fallbackTotal,
      deltaPercent: null,
      series: localPracticeSeries,
    };
  }, [localPracticeSeries, practiceMinutesCard]);
  const mixDisplay = useMemo(() => {
    const hasServerMix = mixCard.debateCount + mixCard.speakingCount > 0;
    if (hasServerMix) return mixCard;

    const speakingCount = localRangeSessions.filter(
      (session) =>
        session.practiceTrack === "speaking" ||
        session.feedback?.practiceTrack === "speaking"
    ).length;
    const debateCount = localRangeSessions.length - speakingCount;
    const total = debateCount + speakingCount;

    return {
      ...mixCard,
      speakingCount,
      debateCount,
      speakingPercent: total > 0 ? Math.round((speakingCount / total) * 100) : 0,
      debatePercent: total > 0 ? Math.round((debateCount / total) * 100) : 0,
    };
  }, [localRangeSessions, mixCard]);
  const averageScoreDisplay = useMemo(() => {
    const hasServerAverage =
      averageCard.averageScore != null || averageCard.series.some((entry) => entry.value > 0);
    if (hasServerAverage) return averageCard;

    const series = buildScoreSeriesFromSessions(localRangeSessions);
    const averageScore =
      series.length > 0
        ? series.reduce((total, entry) => total + entry.value, 0) / series.length
        : null;

    return {
      ...averageCard,
      averageScore,
      deltaPoints: null,
      sessionsAnalyzed: series.length,
      series,
    };
  }, [averageCard, localRangeSessions]);
  const recentSessionsDisplay = useMemo(() => {
    const merged = [...data.recentSessions];
    const seen = new Set(merged.map((session) => `${session.kind}-${session.id}`));

    clientSessions.map(mapLocalRecentSession).forEach((session) => {
      const key = `${session.kind}-${session.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(session);
      }
    });

    return merged.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }, [clientSessions, data.recentSessions]);

  return (
    <div className="h-[calc(100dvh-3.5rem)] overflow-hidden bg-background px-4 py-4 sm:px-6 md:h-screen lg:px-8 lg:py-6">
      <div className="mx-auto flex h-full max-w-[1400px] min-h-0 flex-col">
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

        <div className="mt-6 grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <section className="rounded-[1.8rem] border border-outline-variant/15 bg-surface p-6 pb-3 shadow-[0_18px_40px_rgba(11,20,36,0.05)]">
              <div className="grid h-full grid-cols-1 gap-x-7 md:grid-cols-[10rem_minmax(0,1fr)] md:grid-rows-[auto_auto]">
                <Avatar className="h-36 w-36 shrink-0 ring-2 ring-[#EEF4FF] shadow-[0_18px_38px_rgba(11,20,36,0.08)]">
                  {data.hero.avatarUrl ? (
                    <AvatarImage src={data.hero.avatarUrl} alt={data.hero.displayName} />
                  ) : null}
                  <AvatarFallback className="bg-[linear-gradient(180deg,#EEF4FF_0%,#DCEAFF_100%)] text-[2.2rem] font-semibold text-primary">
                    {getInitials(data.hero.displayName)}
                  </AvatarFallback>
                </Avatar>

                <div className="mt-7 min-w-0 md:mt-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-[2.15rem] font-semibold leading-tight tracking-tight text-on-surface">
                      {data.hero.displayName}
                    </h2>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-[0.95rem] font-medium text-primary">
                      {data.hero.title ?? t("default_title")}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-on-surface-variant">
                    <span>{t("level", { level: data.hero.level })}</span>
                    <span>•</span>
                    <span>{t("xp_total", { count: data.hero.xp })}</span>
                  </div>

                  <p className="mt-4 max-w-[42rem] text-[1.05rem] leading-8 text-on-surface-variant">
                    {data.hero.statusLine}
                  </p>

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
                    <Progress value={data.hero.xpProgressPercent} className="w-full gap-0" />
                  </div>
                </div>

                <div className="col-span-full mt-16 grid w-full grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
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
              </div>
            </section>

            <AnalyticsSkillSnapshotCard {...data.skillSnapshot} />
          </div>

          <div className="grid gap-4 xl:grid-cols-4">
            <section className="flex min-h-[210px] flex-col rounded-[1.65rem] border border-outline-variant/15 bg-surface p-5 shadow-[0_16px_32px_rgba(11,20,36,0.04)]">
              <div className="flex items-center justify-between">
                <h3 className="text-[0.98rem] font-semibold text-on-surface">
                  {t("cards.practice_minutes.title")}
                </h3>
              </div>
              <div className="mt-5 flex flex-1 items-end justify-between gap-5">
                <div className="min-w-0 flex-1 self-start">
                  <div className="flex items-end gap-2">
                    <div className="text-4xl font-semibold text-on-surface">
                      {practiceMinutesDisplay.totalMinutes}
                    </div>
                    <div className="pb-1 text-sm text-on-surface-variant">
                      {t("cards.practice_minutes.unit")}
                    </div>
                  </div>
                  <p
                    className={cn(
                      "mt-2 max-w-[9.5rem] text-sm font-medium leading-5",
                      practiceMinutesDisplay.deltaPercent != null &&
                      practiceMinutesDisplay.deltaPercent >= 0
                        ? "text-emerald-600"
                        : "text-on-surface-variant"
                    )}
                  >
                    {practiceMinutesDisplay.deltaPercent != null
                      ? t("cards.practice_minutes.delta", {
                          count: Math.abs(practiceMinutesDisplay.deltaPercent),
                          sign: practiceMinutesDisplay.deltaPercent >= 0 ? "+" : "-",
                        })
                      : t("cards.practice_minutes.no_delta")}
                  </p>
                </div>

                <div className="w-[148px] shrink-0 self-end">
                  <MiniBarChart
                    compact
                    values={practiceMinutesDisplay.series.map((entry) => entry.value)}
                    labels={practiceMinutesDisplay.series.map((entry) => entry.label)}
                  />
                </div>
              </div>
            </section>

            <section className="flex min-h-[210px] flex-col rounded-[1.65rem] border border-outline-variant/15 bg-surface p-5 shadow-[0_16px_32px_rgba(11,20,36,0.04)]">
              <div className="flex items-center justify-between">
                <h3 className="text-[0.98rem] font-semibold text-on-surface">
                  {t("cards.mix.title")}
                </h3>
              </div>
              <div className="mt-4 flex flex-1 items-center gap-6">
                <DonutRing value={mixDisplay.debatePercent} label={t("cards.mix.debate")} />
                <div className="min-w-0 flex-1 space-y-3.5 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-on-surface">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                      {t("cards.mix.debate")}
                    </div>
                    <span className="font-semibold text-on-surface">
                      {mixDisplay.debatePercent}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-on-surface">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary/25" />
                      {t("cards.mix.speaking")}
                    </div>
                    <span className="font-semibold text-on-surface">
                      {mixDisplay.speakingPercent}%
                    </span>
                  </div>
                </div>
              </div>
              <Link
                href="/history"
                className="mt-3 inline-flex items-center gap-2 self-end text-sm font-medium text-primary hover:underline"
              >
                {t("cards.mix.view_breakdown")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </section>

            <section className="flex min-h-[210px] flex-col rounded-[1.65rem] border border-outline-variant/15 bg-surface p-5 shadow-[0_16px_32px_rgba(11,20,36,0.04)]">
              <div className="flex items-center justify-between">
                <h3 className="text-[0.98rem] font-semibold text-on-surface">
                  {t("cards.average_score.title")}
                </h3>
              </div>
              <div className="mt-4 flex items-end gap-2">
                <div className="text-4xl font-semibold text-on-surface">
                  {averageScoreDisplay.averageScore != null
                    ? Math.round(averageScoreDisplay.averageScore)
                    : "—"}
                </div>
                <div className="pb-1 text-sm text-on-surface-variant">/100</div>
              </div>
              <p
                className={cn(
                  "mt-2 text-sm font-medium",
                  averageScoreDisplay.deltaPoints != null &&
                    averageScoreDisplay.deltaPoints >= 0
                    ? "text-emerald-600"
                    : "text-on-surface-variant"
                )}
              >
                {averageScoreDisplay.deltaPoints != null
                  ? t("cards.average_score.delta", {
                      count: Math.abs(Math.round(averageScoreDisplay.deltaPoints)),
                      sign: averageScoreDisplay.deltaPoints >= 0 ? "+" : "-",
                    })
                  : t("cards.average_score.no_delta")}
              </p>
              <div className="mt-auto">
                <MiniLineChart values={averageScoreDisplay.series.map((entry) => entry.value)} />
              </div>
            </section>

            <section className="flex min-h-[210px] flex-col rounded-[1.65rem] border border-outline-variant/15 bg-surface p-5 shadow-[0_16px_32px_rgba(11,20,36,0.04)]">
              <div className="flex items-center justify-between">
                <h3 className="text-[0.98rem] font-semibold text-on-surface">
                  {t("cards.strongest_focus.title")}
                </h3>
              </div>
              <div className="mt-4 flex flex-1 flex-col justify-center gap-3">
                <div className="rounded-[1.2rem] border border-outline-variant/12 bg-surface px-4 py-4 shadow-[0_8px_20px_rgba(11,20,36,0.025)]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#34C759]/16 text-[#34C759]">
                        <Trophy className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-on-surface-variant">
                          {t("cards.strongest_focus.strongest")}
                        </div>
                        <div className="mt-0.5 truncate text-[1.05rem] font-semibold text-on-surface">
                          {strongestFocusCard.strongestSkill
                            ? t(`skills.${strongestFocusCard.strongestSkill}`)
                            : t("empty_title")}
                        </div>
                      </div>
                    </div>
                    <div className="flex w-[5.5rem] shrink-0 items-end justify-end text-right text-on-surface">
                      <span className="text-2xl font-semibold leading-none">
                        {strongestFocusCard.strongestScore ?? "—"}
                      </span>
                      {strongestFocusCard.strongestScore != null ? (
                        <span className="ml-1 pb-[1px] text-sm leading-none text-on-surface-variant">
                          /100
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="rounded-[1.2rem] border border-outline-variant/12 bg-surface px-4 py-4 shadow-[0_8px_20px_rgba(11,20,36,0.025)]">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F5B942]/18 text-[#F59E0B]">
                        <Target className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm text-on-surface-variant">
                          {t("cards.strongest_focus.focus_next")}
                        </div>
                        <div className="mt-0.5 truncate text-[1.05rem] font-semibold text-on-surface">
                          {strongestFocusCard.focusSkill
                            ? t(`skills.${strongestFocusCard.focusSkill}`)
                            : t("empty_title")}
                        </div>
                      </div>
                    </div>
                    <div className="flex w-[5.5rem] shrink-0 items-end justify-end text-right text-on-surface">
                      <span className="text-2xl font-semibold leading-none">
                        {strongestFocusCard.focusScore ?? "—"}
                      </span>
                      {strongestFocusCard.focusScore != null ? (
                        <span className="ml-1 pb-[1px] text-sm leading-none text-on-surface-variant">
                          /100
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <section className="flex min-h-0 flex-col rounded-[1.8rem] border border-outline-variant/15 bg-surface p-5 shadow-[0_18px_40px_rgba(11,20,36,0.05)] lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-on-surface">
                  {t("recent_sessions_title")}
                </h3>
              </div>
              <Link href="/history" className="text-sm font-medium text-primary hover:underline">
                {t("view_all")}
              </Link>
            </div>

            {recentSessionsDisplay.length > 0 ? (
              <div className="mt-4 min-h-0 flex-1 overflow-y-auto rounded-[1.35rem] bg-surface px-1">
                {recentSessionsDisplay.slice(0, 4).map((session, index) => (
                  <RecentSessionCard
                    key={`${session.kind}-${session.id}`}
                    session={session}
                    index={index}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-5 flex min-h-[220px] flex-1 items-center rounded-[1.6rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-10 text-center">
                <div className="mx-auto">
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
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
