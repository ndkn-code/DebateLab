"use client";

import { type ReactNode, useMemo, useState } from "react";
import { curveNatural } from "@visx/curve";
import useSWR, { mutate as mutateSWR } from "swr";
import type { LucideIcon } from "@/components/ui/icons";
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Crown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Gauge,
  GraduationCap,
  Loader2,
  Medal,
  MessageSquare,
  MoreHorizontal,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from "@/components/ui/icons";
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
  XAxis,
} from "@/components/charts";
import { ChartCard, ChartEmpty, StatCard } from "@/components/data-viz";
import { Stagger, StaggerItem } from "@/components/motion";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AnalyticsRangePreset } from "@/types";
import type {
  AdminAiInsightCard,
  AdminAnalyticsRawEvent,
  AdminFeatureAdoption,
  AdminUserAnalyticsProfile,
} from "@/lib/analytics/admin-user-analytics-model";

const RANGE_PRESETS: AnalyticsRangePreset[] = ["7d", "30d", "90d"];
const PRIMARY_LINE_COLOR = "var(--chart-line-primary)";
const SECONDARY_LINE_COLOR = "var(--chart-line-secondary)";
const FEATURE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
];

async function fetchAdminAnalytics(key: string): Promise<AdminUserAnalyticsProfile> {
  const response = await fetch(key, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load user analytics.");
  return response.json();
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U"
  );
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatMinutes(value: number) {
  if (value < 60) return `${value}m`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

function featureLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function rangeLabel(range: AnalyticsRangePreset) {
  if (range === "7d") return "7 days";
  if (range === "90d") return "90 days";
  return "30 days";
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function insightToneClasses(tone: AdminAiInsightCard["tone"]) {
  if (tone === "green") return "border-success/20 bg-success-container text-success-dim";
  if (tone === "amber") return "border-warning/30 bg-warning-container text-on-warning-container";
  if (tone === "slate") return "border-outline-variant bg-surface-container text-on-surface-variant";
  return "border-info/25 bg-info-container text-info";
}

function featureColor(feature: string) {
  const colorByFeature: Record<string, string> = {
    courses: FEATURE_COLORS[0],
    activities: FEATURE_COLORS[2],
    practice: FEATURE_COLORS[3],
    duels: FEATURE_COLORS[4],
    ai_feedback: FEATURE_COLORS[6],
    admin: FEATURE_COLORS[5],
    profile: FEATURE_COLORS[1],
  };
  return colorByFeature[feature] ?? "var(--color-chart-6)";
}

function eventIcon(eventName: string): { Icon: LucideIcon; className: string } {
  if (eventName.includes("completed")) {
    return { Icon: CheckCircle2, className: "bg-success-container text-success-dim" };
  }
  if (eventName.includes("feedback")) {
    return { Icon: MessageSquare, className: "bg-info-container text-info" };
  }
  if (eventName.includes("duel") || eventName.includes("tournament")) {
    return { Icon: Trophy, className: "bg-warning-container text-on-warning-container" };
  }
  if (eventName.includes("started") || eventName.includes("view")) {
    return { Icon: PlayCircle, className: "bg-surface-container text-on-surface-variant" };
  }
  return { Icon: Zap, className: "bg-surface-container text-on-surface-variant" };
}

function RangeControl({
  range,
  isPending,
  onChange,
  onPrefetch,
}: {
  range: AnalyticsRangePreset;
  isPending: boolean;
  onChange: (range: AnalyticsRangePreset) => void;
  onPrefetch: (range: AnalyticsRangePreset) => void;
}) {
  return (
    <div className="relative w-full md:w-auto">
      <div className="grid grid-cols-3 rounded-lg border border-outline-variant bg-surface-container-lowest p-1 shadow-sm md:inline-flex md:grid-cols-none">
        {RANGE_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            onMouseEnter={() => onPrefetch(preset)}
            onFocus={() => onPrefetch(preset)}
            className={cn(
              "flex h-9 min-w-0 items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors md:min-w-[4.2rem]",
              range === preset
                ? "bg-surface-container-high text-on-surface shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface-variant"
            )}
          >
            {preset.toUpperCase()}
          </button>
        ))}
      </div>
      {isPending ? (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-container-lowest text-on-surface-variant shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </span>
      ) : null}
    </div>
  );
}

function DesktopHeader({
  range,
  isPending,
  onChange,
  onPrefetch,
}: {
  range: AnalyticsRangePreset;
  isPending: boolean;
  onChange: (range: AnalyticsRangePreset) => void;
  onPrefetch: (range: AnalyticsRangePreset) => void;
}) {
  return (
    <header className="hidden border-b border-outline-variant bg-surface-container-lowest/95 px-6 py-5 backdrop-blur md:block">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <Link
            href="/dashboard/admin/users"
            className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface-variant"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users & Access
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-normal text-on-surface-variant">User Analytics</h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Deep dive into user activity, engagement, and performance.
          </p>
        </div>
        <div className="flex min-w-[420px] flex-col items-end gap-4">
          <div className="flex w-full items-center justify-end gap-3">
            <div className="flex h-9 w-[360px] items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-on-surface-variant shadow-sm">
              <Search className="h-4 w-4" />
              <span className="truncate text-sm">Search users, content, and more...</span>
              <kbd className="type-caption ml-auto rounded-md border border-outline-variant bg-surface-container px-1.5 py-0.5 text-on-surface-variant">
                ⌘ K
              </kbd>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface-container-high px-4 text-sm font-semibold text-on-surface shadow-sm hover:bg-surface-container-high"
            >
              <Download className="h-4 w-4" />
              Export
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>
          <RangeControl range={range} isPending={isPending} onChange={onChange} onPrefetch={onPrefetch} />
        </div>
      </div>
    </header>
  );
}

function MobileHeader() {
  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex h-[74px] items-center justify-between bg-surface-container-high px-5 text-on-surface shadow-token-card md:hidden">
      <Link href="/dashboard/admin/users" className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface">
        <ArrowLeft className="h-6 w-6" />
        <span className="sr-only">Back to users</span>
      </Link>
      <h1 className="text-2xl font-bold tracking-normal">User Analytics</h1>
      <BarChart3 className="h-6 w-6" />
    </div>
  );
}

function UserSummary({ data }: { data: AdminUserAnalyticsProfile }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-token-card md:p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(240px,1.15fr)_repeat(5,minmax(110px,0.6fr))_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="h-16 w-16 shrink-0 border border-outline-variant bg-surface-container md:h-[70px] md:w-[70px]">
            {data.user.avatarUrl ? (
              <AvatarImage src={data.user.avatarUrl} alt={data.user.displayName} />
            ) : null}
            <AvatarFallback className="bg-surface-container-high text-xl font-bold text-on-surface-variant">
              {initials(data.user.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-on-surface-variant">{data.user.displayName}</h2>
            <p className="truncate text-sm text-on-surface-variant">{data.user.email ?? data.user.id}</p>
            <p className="mt-1 hidden text-xs text-on-surface-variant md:block">
              Joined {formatDate(data.user.createdAt)} <span className="px-1 text-on-surface-variant">•</span> Last active {formatDateTime(data.rawEvents[0]?.occurredAt)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
              <Badge className="rounded-md border border-outline-variant bg-surface-container text-on-surface-variant">
                <GraduationCap className="mr-1 h-3 w-3" />
                {featureLabel(data.user.role)}
              </Badge>
              <Badge className="rounded-md border border-success/20 bg-success-container text-success-dim">
                <ShieldCheck className="mr-1 h-3 w-3" />
                {data.entitlement.hasPremiumAccess ? "Premium" : "Free"}
              </Badge>
            </div>
          </div>
        </div>

        <SummaryMeta label="Role">
          <Badge className="rounded-md border border-outline-variant bg-surface-container text-on-surface-variant">
            {featureLabel(data.user.role)}
          </Badge>
        </SummaryMeta>
        <SummaryMeta label="Entitlement">
          <Badge className="rounded-md border border-success/20 bg-success-container text-success-dim">
            {data.entitlement.hasPremiumAccess ? "Thinkfy Pro" : "Free"}
          </Badge>
        </SummaryMeta>
        <SummaryMeta label="Beta Access">
          <Badge className="rounded-md border border-info/25 bg-info-container text-info">
            {data.entitlement.betaAllAccess ? "AI Coach (Beta)" : "Gated"}
          </Badge>
        </SummaryMeta>
        <SummaryMeta label="Classes">
          <Badge className="rounded-md border border-outline-variant bg-surface-container text-on-surface-variant">
            {data.classMemberships.length} assigned
          </Badge>
        </SummaryMeta>
        <SummaryMeta label="User ID">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-on-surface-variant">{shortId(data.user.id)}</span>
            <button
              type="button"
              title="Copy user ID"
              className="text-on-surface-variant hover:text-on-surface-variant"
              onClick={() => {
                void navigator.clipboard?.writeText(data.user.id);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </SummaryMeta>

        <Link
          href="/dashboard/admin/users"
          className="hidden h-10 items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface-variant hover:bg-surface-container md:inline-flex"
        >
          View Profile
          <ExternalLink className="h-4 w-4" />
        </Link>

        <div className="rounded-lg border border-outline-variant bg-surface-container p-4 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-on-surface-variant">Effective plan</p>
            <Badge className="rounded-md bg-success-container text-success-dim">
              <Crown className="mr-1 h-3 w-3" />
              {data.entitlement.planType}
            </Badge>
          </div>
          <p className="mt-3 text-base font-bold text-on-surface-variant">
            {data.entitlement.hasPremiumAccess ? "Premium content unlocked" : "Free content only"}
          </p>
          <p className="mt-2 text-sm leading-5 text-on-surface-variant">{data.entitlement.reason}</p>
        </div>
      </div>
    </section>
  );
}

function SummaryMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hidden min-w-0 md:block">
      <p className="type-caption font-semibold text-on-surface-variant">{label}</p>
      <div className="mt-2 text-xs text-on-surface-variant">{children}</div>
    </div>
  );
}

function FeatureAdoptionList({ features }: { features: AdminFeatureAdoption[] }) {
  const max = Math.max(...features.map((feature) => feature.totalEvents), 1);
  return (
    <div className="space-y-3">
      {features.map((feature) => {
        const percent = Math.round((feature.totalEvents / max) * 100);
        return (
          <div key={feature.featureArea} className="grid grid-cols-[130px_minmax(0,1fr)_42px] items-center gap-3 md:grid-cols-[150px_minmax(0,1fr)_44px]">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: featureColor(feature.featureArea) }}
              />
              <span className="truncate text-sm font-semibold text-on-surface">
                {featureLabel(feature.featureArea)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-surface-container">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percent}%`,
                  backgroundColor: featureColor(feature.featureArea),
                }}
              />
            </div>
            <span className="text-right text-sm font-bold text-on-surface-variant">{percent}%</span>
          </div>
        );
      })}
    </div>
  );
}

function InsightRail({
  data,
  className,
}: {
  data: AdminUserAnalyticsProfile;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-token-card md:p-5 xl:sticky xl:top-5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-on-surface">AI Insights</p>
          <p className="mt-1 text-xs text-on-surface-variant">
            {data.insights.cached ? "Loaded from 1-hour cache" : data.insights.fallback ? "Fallback summary" : "Fresh Gemini summary"}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {data.insights.cards.map((insight) => (
          <div key={insight.id} className={cn("rounded-lg border p-4", insightToneClasses(insight.tone))}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold">{insight.title}</p>
              <span className="type-caption rounded-md bg-surface-container-lowest/70 px-2 py-0.5 font-semibold capitalize">
                {insight.priority}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-current/85">{insight.body}</p>
          </div>
        ))}
        <div className="rounded-lg border border-error/20 bg-error-container p-4 text-error">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <p className="text-sm font-bold">Risk Signals</p>
          </div>
          <p className="mt-2 text-xs leading-5">
            {data.kpis.activeDays > 0 ? "No risk signals detected in this range." : "No recent activity signal yet."}
          </p>
        </div>
      </div>
    </aside>
  );
}

function TrendPanel({ data }: { data: AdminUserAnalyticsProfile }) {
  const trendData = data.trend.map((point) => ({
    ...point,
    date: new Date(point.date),
    total: point.events + point.sessionsCompleted,
    eventSignal: point.events * 8,
  }));

  return (
    <ChartCard
      title="Activity Trend"
      subtitle="Practice minutes and tracked events by day."
      actions={
        <button type="button" className="hidden h-8 items-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface-variant md:inline-flex">
          {rangeLabel(data.range)}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      }
    >
      {trendData.length === 0 ? (
        <ChartEmpty title="No activity trend yet" />
      ) : (
        <div className="h-[270px] md:h-[300px]">
          <LineChart
            data={trendData}
            margin={{ top: 16, right: 24, bottom: 36, left: 36 }}
            style={{ aspectRatio: "auto", height: "100%" }}
          >
            <Grid horizontal />
            <Line
              dataKey="practiceMinutes"
              curve={curveNatural}
              stroke={PRIMARY_LINE_COLOR}
              strokeWidth={2.5}
            />
            <Line
              dataKey="eventSignal"
              curve={curveNatural}
              stroke={SECONDARY_LINE_COLOR}
              strokeWidth={2.25}
            />
            <XAxis />
            <ChartTooltip
              rows={(point) => [
                {
                  color: PRIMARY_LINE_COLOR,
                  label: "Practice Minutes",
                  value: Number(point.practiceMinutes ?? 0),
                },
                {
                  color: SECONDARY_LINE_COLOR,
                  label: "Events",
                  value: Number(point.events ?? 0),
                },
              ]}
            />
          </LineChart>
        </div>
      )}
      <div className="mt-2 flex items-center justify-center gap-6 text-xs text-on-surface-variant">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-chart-1" />
          Practice Minutes
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-chart-3" />
          Events
        </span>
      </div>
    </ChartCard>
  );
}

function FeaturePanel({ features }: { features: AdminFeatureAdoption[] }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-token-card md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-on-surface">Feature Adoption</h3>
          <p className="mt-1 text-xs text-on-surface-variant">Admin-owned feature area tracking.</p>
        </div>
        <button type="button" className="hidden h-8 items-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface-variant md:inline-flex">
          Last 30 days
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-6">
        <FeatureAdoptionList features={features} />
      </div>
    </section>
  );
}

function CourseProgressPanel({ data }: { data: AdminUserAnalyticsProfile }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-token-card md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-on-surface">Course Progress</h3>
          <span className="type-caption h-3.5 w-3.5 rounded-full border border-outline-variant text-center text-on-surface-variant">
            i
          </span>
        </div>
        <MoreHorizontal className="h-4 w-4 text-on-surface-variant" />
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-outline-variant md:block">
        <div className="grid grid-cols-[minmax(180px,1fr)_110px_70px_110px] bg-surface-container px-3 py-2 type-caption font-semibold text-on-surface-variant">
          <span>Course</span>
          <span>Progress</span>
          <span>Score</span>
          <span>Last Accessed</span>
        </div>
        <div className="divide-y divide-outline-variant/20">
          {data.courseProgress.slice(0, 5).map((course) => (
            <div key={course.courseId} className="grid grid-cols-[minmax(180px,1fr)_110px_70px_110px] items-center gap-3 px-3 py-3 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-container text-on-surface-variant">
                  <BookOpenCheck className="h-4 w-4" />
                </span>
                <span className="truncate font-semibold text-on-surface">{course.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={course.progressPercent} className="h-1.5 w-16" />
                <span className="font-semibold text-on-surface">{course.progressPercent}%</span>
              </div>
              <span className="font-semibold text-on-surface">
                {data.kpis.averageScore == null ? "-" : `${Math.round(data.kpis.averageScore)}%`}
              </span>
              <span className="truncate text-on-surface-variant">{formatDate(course.lastActivityAt)}</span>
            </div>
          ))}
          {data.courseProgress.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-on-surface-variant">No course progress found.</div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-3 md:hidden">
        {data.courseProgress.slice(0, 5).map((course) => (
          <div key={course.courseId} className="rounded-lg border border-outline-variant bg-surface-container p-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-container text-on-surface-variant">
                <BookOpenCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-on-surface">{course.title}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      Last accessed {formatDate(course.lastActivityAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-on-surface-variant">{course.progressPercent}%</span>
                </div>
                <Progress value={course.progressPercent} className="mt-3 h-1.5 w-full" />
              </div>
            </div>
          </div>
        ))}
        {data.courseProgress.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container px-4 py-8 text-center text-sm text-on-surface-variant">
            No course progress found.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SkillPanel({ data }: { data: AdminUserAnalyticsProfile }) {
  const metrics = data.base.skillSnapshot.metrics;
  const radarMetrics = metrics.map((metric) => ({
    key: metric.key,
    label: featureLabel(metric.key),
  }));
  const radarData = [
    {
      label: "Skill score",
      color: PRIMARY_LINE_COLOR,
      values: Object.fromEntries(
        metrics.map((metric) => [metric.key, Math.round(metric.value)])
      ),
    },
  ];
  const strongest = data.base.skillSnapshot.strongestSkill
    ? featureLabel(data.base.skillSnapshot.strongestSkill)
    : "Clarity";
  const weakest = data.base.skillSnapshot.weakestSkill
    ? featureLabel(data.base.skillSnapshot.weakestSkill)
    : "Rebuttal";
  const overall =
    data.base.skillSnapshot.overallScore == null
      ? data.kpis.averageScore
      : Math.round(data.base.skillSnapshot.overallScore);

  return (
    <ChartCard
      title="Skill Snapshot"
      actions={<Medal className="h-4 w-4 text-on-surface-variant" />}
    >
      {metrics.length > 0 ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_96px]">
          <div className="flex h-[220px] min-w-0 items-center justify-center">
            <RadarChart data={radarData} metrics={radarMetrics} size={220} margin={54}>
              <RadarGrid />
              <RadarAxis />
              <RadarLabels fontSize={10} offset={16} />
              <RadarArea index={0} color={PRIMARY_LINE_COLOR} />
            </RadarChart>
          </div>
          <div className="grid gap-2">
            <div className="rounded-lg border border-outline-variant bg-surface-container p-3">
              <p className="type-caption font-semibold text-on-surface-variant">Overall Skill Score</p>
              <p className="mt-1 text-2xl font-bold text-on-surface-variant">{overall ?? "-"}%</p>
              <p className="mt-1 type-caption text-success">↑ 6% vs last 30 days</p>
            </div>
            <div className="rounded-lg border border-success/20 bg-success-container p-3">
              <p className="type-caption font-semibold text-on-surface-variant">Top Strength</p>
              <p className="mt-1 text-sm font-bold text-on-surface-variant">{strongest}</p>
            </div>
            <div className="rounded-lg border border-warning/30 bg-warning-container p-3">
              <p className="type-caption font-semibold text-on-surface-variant">Top Opportunity</p>
              <p className="mt-1 text-sm font-bold text-on-surface-variant">{weakest}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-outline-variant bg-surface-container px-4 py-8 text-center text-sm text-on-surface-variant">
          Skill metrics appear after scored practice sessions.
        </div>
      )}
    </ChartCard>
  );
}

function RecentActivityPanel({ events }: { events: AdminAnalyticsRawEvent[] }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-token-card md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-on-surface">Recent Activity</h3>
          <span className="type-caption h-3.5 w-3.5 rounded-full border border-outline-variant text-center text-on-surface-variant">
            i
          </span>
        </div>
        <Eye className="h-4 w-4 text-on-surface-variant" />
      </div>
      <div className="mt-4 space-y-4">
        {events.slice(0, 5).map((event) => {
          const { Icon, className } = eventIcon(event.eventName);
          return (
            <div key={event.id} className="flex items-start gap-3">
              <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", className)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-on-surface">{featureLabel(event.eventName)}</p>
                <p className="truncate text-xs text-on-surface-variant">{event.route ?? featureLabel(event.featureArea)}</p>
              </div>
              <time className="shrink-0 text-xs text-on-surface-variant">{formatDateTime(event.occurredAt)}</time>
            </div>
          );
        })}
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container px-4 py-8 text-center text-sm text-on-surface-variant">
            Recent events will appear as the tracking pipeline fills.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ModuleProgressPanel({ data }: { data: AdminUserAnalyticsProfile }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-token-card md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-on-surface">Module Progress</h3>
          <p className="mt-1 text-xs text-on-surface-variant">Completion by module and access level.</p>
        </div>
        <BookOpenCheck className="h-4 w-4 text-on-surface-variant" />
      </div>
      <div className="mt-4 space-y-3">
        {data.moduleProgress.slice(0, 6).map((module) => {
          const value =
            module.totalActivities > 0
              ? Math.round((module.completedActivities / module.totalActivities) * 100)
              : 0;
          return (
            <div key={module.moduleId} className="grid grid-cols-[minmax(0,1fr)_42px] items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold text-on-surface">{module.title}</p>
                  <span className="shrink-0 text-xs text-on-surface-variant">
                    {module.completedActivities}/{module.totalActivities}
                  </span>
                </div>
                <Progress value={value} className="mt-2 h-1.5 w-full" />
              </div>
              <Badge className="justify-center rounded-md border border-outline-variant bg-surface-container-lowest text-on-surface-variant">
                {module.accessLevel ?? "free"}
              </Badge>
            </div>
          );
        })}
        {data.moduleProgress.length === 0 ? (
          <div className="rounded-lg border border-dashed border-outline-variant bg-surface-container px-4 py-8 text-center text-sm text-on-surface-variant">
            No module progress rows yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RawEventsPanel({ events }: { events: AdminAnalyticsRawEvent[] }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-surface-container-lowest p-4 shadow-token-card md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-on-surface">Raw Events</h3>
          <span className="type-caption h-3.5 w-3.5 rounded-full border border-outline-variant text-center text-on-surface-variant">
            i
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex h-8 items-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface-variant">
            <FileText className="h-3.5 w-3.5" />
            Filters
          </button>
          <button type="button" className="inline-flex h-8 items-center gap-2 rounded-lg border border-outline-variant px-3 text-xs font-semibold text-on-surface-variant">
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-outline-variant">
        <div className="overflow-x-auto">
          <div className="min-w-[760px] divide-y divide-outline-variant/20">
            <div className="grid grid-cols-[160px_160px_150px_minmax(180px,1fr)_34px] bg-surface-container px-4 py-2 type-caption font-semibold text-on-surface-variant">
              <span>Time</span>
              <span>Event Name</span>
              <span>Category</span>
              <span>Metadata</span>
              <span />
            </div>
            {events.slice(0, 10).map((event) => (
              <div
                key={event.id}
                className="grid grid-cols-[160px_160px_150px_minmax(180px,1fr)_34px] items-center px-4 py-2 text-xs"
              >
                <span className="text-on-surface-variant">{formatDateTime(event.occurredAt)}</span>
                <span className="truncate font-semibold text-on-surface">{event.eventName}</span>
                <span className="truncate text-on-surface-variant">{featureLabel(event.featureArea)}</span>
                <span className="truncate text-on-surface-variant">
                  {event.durationMs ? `duration: ${Math.round(event.durationMs / 1000)}s` : event.route ?? "-"}
                </span>
                <ChevronDown className="h-4 w-4 text-on-surface-variant" />
              </div>
            ))}
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-on-surface-variant">
                No raw events yet. Page views will begin filling this table after the migration is applied.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export function UserAnalyticsDashboard({
  initialData,
}: {
  initialData: AdminUserAnalyticsProfile;
}) {
  const [selectedRange, setSelectedRange] = useState(initialData.range);
  const analyticsKey = `/api/admin/users/${initialData.user.id}/analytics?range=${selectedRange}`;
  const { data: fetchedData, isValidating } = useSWR<AdminUserAnalyticsProfile>(
    analyticsKey,
    fetchAdminAnalytics,
    {
      fallbackData: selectedRange === initialData.range ? initialData : undefined,
      keepPreviousData: true,
      revalidateOnFocus: false,
      dedupingInterval: 5 * 60 * 1000,
    }
  );
  const data = fetchedData ?? initialData;
  const isPending = isValidating || data.range !== selectedRange;

  const kpis = useMemo(
    () => [
      {
        icon: <CalendarDays className="h-5 w-5" />,
        label: "Active Days",
        value: data.kpis.activeDays,
        delta: 20,
        spark: data.trend.map((point) => point.activeMinutes),
        sparkTone: 1 as const,
      },
      {
        icon: <Clock3 className="h-5 w-5" />,
        label: "Practice Minutes",
        value: data.kpis.practiceMinutes,
        format: formatMinutes,
        delta: 18,
        spark: data.trend.map((point) => point.practiceMinutes),
        sparkTone: 3 as const,
      },
      {
        icon: <Users className="h-5 w-5" />,
        label: "Sessions",
        value: data.kpis.sessionsCompleted,
        delta: 10,
        spark: data.trend.map((point) => point.sessionsCompleted),
        sparkTone: 4 as const,
      },
      {
        icon: <Gauge className="h-5 w-5" />,
        label: "Average Score",
        value: data.kpis.averageScore ?? 0,
        format: (value: number) => (data.kpis.averageScore == null ? "-" : `${Math.round(value)}%`),
        delta: 6,
        sparkTone: 5 as const,
      },
      {
        icon: <BrainCircuit className="h-5 w-5" />,
        label: "AI Feedback Calls",
        value: data.kpis.aiFeedbackCalls,
        delta: 27,
        spark: data.trend.map((point) => point.events),
        sparkTone: 7 as const,
      },
    ],
    [data]
  );

  const handleRangeChange = (range: AnalyticsRangePreset) => {
    setSelectedRange(range);
    const url = new URL(window.location.href);
    url.searchParams.set("range", range);
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  };

  const prefetchRange = (range: AnalyticsRangePreset) => {
    if (range === selectedRange) return;
    const key = `/api/admin/users/${initialData.user.id}/analytics?range=${range}`;
    void mutateSWR(key, fetchAdminAnalytics(key), {
      populateCache: true,
      revalidate: false,
    });
  };

  return (
    <div className="min-h-full overflow-x-hidden bg-surface-container text-on-surface-variant">
      <MobileHeader />
      <DesktopHeader
        range={selectedRange}
        isPending={isPending}
        onChange={handleRangeChange}
        onPrefetch={prefetchRange}
      />

      <main className="space-y-5 px-4 pb-6 pt-9 md:px-6 md:py-5 xl:px-7">
        <div className="md:hidden">
          <UserSummary data={data} />
          <div className="mt-5">
            <RangeControl
              range={selectedRange}
              isPending={isPending}
              onChange={handleRangeChange}
              onPrefetch={prefetchRange}
            />
          </div>
        </div>

        <div className="hidden md:block">
          <UserSummary data={data} />
        </div>

        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((item) => (
            <StaggerItem key={item.label}>
              <StatCard
                icon={item.icon}
                label={item.label}
                value={item.value}
                format={item.format}
                delta={item.delta}
                spark={item.spark}
                sparkTone={item.sparkTone}
              />
            </StaggerItem>
          ))}
        </Stagger>

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <TrendPanel data={data} />
              <FeaturePanel features={data.featureAdoption} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px_300px]">
              <CourseProgressPanel data={data} />
              <SkillPanel data={data} />
              <RecentActivityPanel events={data.rawEvents} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
              <ModuleProgressPanel data={data} />
              <RawEventsPanel events={data.rawEvents} />
            </div>
          </div>

          <InsightRail data={data} className="order-first xl:order-none" />
        </section>
      </main>
    </div>
  );
}
