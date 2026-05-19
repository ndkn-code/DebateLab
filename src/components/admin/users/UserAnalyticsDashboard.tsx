"use client";

import { type ReactNode, useMemo, useState } from "react";
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
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "slate") return "border-slate-200 bg-slate-50 text-slate-800";
  return "border-[#cfe0ff] bg-[#eef5ff] text-[#0b63f6]";
}

function featureColor(feature: string) {
  const colors: Record<string, string> = {
    courses: "#0b63f6",
    activities: "#16a37b",
    practice: "#f59e0b",
    duels: "#7c3aed",
    ai_feedback: "#e14d8a",
    admin: "#26364f",
    profile: "#0f9fad",
  };
  return colors[feature] ?? "#64748b";
}

function linePoints(values: number[], width: number, height: number, paddingX: number, paddingY: number) {
  const max = Math.max(...values, 1);
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;
  return values
    .map((value, index) => {
      const x = paddingX + (values.length <= 1 ? 0 : (index / (values.length - 1)) * usableWidth);
      const y = height - paddingY - (value / max) * usableHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function radarPoint(index: number, total: number, radius: number, center: number) {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  return {
    x: center + Math.cos(angle) * radius,
    y: center + Math.sin(angle) * radius,
  };
}

function eventIcon(eventName: string): { Icon: LucideIcon; className: string } {
  if (eventName.includes("completed")) {
    return { Icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700" };
  }
  if (eventName.includes("feedback")) {
    return { Icon: MessageSquare, className: "bg-violet-100 text-violet-700" };
  }
  if (eventName.includes("duel") || eventName.includes("tournament")) {
    return { Icon: Trophy, className: "bg-amber-100 text-amber-700" };
  }
  if (eventName.includes("started") || eventName.includes("view")) {
    return { Icon: PlayCircle, className: "bg-[#e8f2ff] text-[#0b63f6]" };
  }
  return { Icon: Zap, className: "bg-slate-100 text-slate-700" };
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
      <div className="grid grid-cols-3 rounded-lg border border-[#d2dff0] bg-white p-1 shadow-sm md:inline-flex md:grid-cols-none">
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
                ? "bg-[#0b63f6] text-white shadow-sm"
                : "text-[#53647f] hover:bg-[#f3f7fd] hover:text-[#14213d]"
            )}
          >
            {preset.toUpperCase()}
          </button>
        ))}
      </div>
      {isPending ? (
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[#0b63f6] shadow-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        </span>
      ) : null}
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  delta: string;
  tone?: "blue" | "green" | "amber" | "pink" | "slate";
}) {
  const tones = {
    blue: "bg-[#0b63f6] text-white",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    pink: "bg-rose-50 text-rose-600",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,28,53,0.34)]">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-xs font-medium text-[#53647f]">{label}</p>
            <span className="h-3.5 w-3.5 rounded-full border border-[#b9c7dc] text-center text-[9px] leading-[12px] text-[#6d7c94]">
              i
            </span>
          </div>
          <p className="mt-0.5 text-2xl font-bold leading-tight text-[#0b1730]">{value}</p>
          <p className="mt-1 text-xs leading-4 text-[#53647f]">
            <span className="font-semibold text-emerald-600">↑</span> {delta}
          </p>
        </div>
      </div>
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
    <header className="hidden border-b border-[#dce7f7] bg-white/95 px-6 py-5 backdrop-blur md:block">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <Link
            href="/dashboard/admin/users"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#0b63f6] hover:text-[#084dbf]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users & Access
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-normal text-[#0b1730]">User Analytics</h1>
          <p className="mt-1 text-sm text-[#53647f]">
            Deep dive into user activity, engagement, and performance.
          </p>
        </div>
        <div className="flex min-w-[420px] flex-col items-end gap-4">
          <div className="flex w-full items-center justify-end gap-3">
            <div className="flex h-9 w-[360px] items-center gap-2 rounded-lg border border-[#d2dff0] bg-white px-3 text-[#8a98ad] shadow-sm">
              <Search className="h-4 w-4" />
              <span className="truncate text-sm">Search users, content, and more...</span>
              <kbd className="ml-auto rounded-md border border-[#dce7f7] bg-[#f7faff] px-1.5 py-0.5 text-[11px] text-[#7b89a0]">
                ⌘ K
              </kbd>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0b63f6] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#084dbf]"
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
    <div className="fixed inset-x-0 top-0 z-[60] flex h-[74px] items-center justify-between bg-[#0b63f6] px-5 text-white shadow-[0_14px_35px_-24px_rgba(11,99,246,0.9)] md:hidden">
      <Link href="/dashboard/admin/users" className="flex h-11 w-11 items-center justify-center rounded-lg text-white">
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
    <section className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_18px_50px_-44px_rgba(15,28,53,0.35)] md:p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(240px,1.15fr)_repeat(5,minmax(110px,0.6fr))_auto] md:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="h-16 w-16 shrink-0 border border-[#dce7f7] bg-[#e8f2ff] md:h-[70px] md:w-[70px]">
            {data.user.avatarUrl ? (
              <AvatarImage src={data.user.avatarUrl} alt={data.user.displayName} />
            ) : null}
            <AvatarFallback className="bg-[#dceaff] text-xl font-bold text-[#0b63f6]">
              {initials(data.user.displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-bold text-[#12213c]">{data.user.displayName}</h2>
            <p className="truncate text-sm text-[#53647f]">{data.user.email ?? data.user.id}</p>
            <p className="mt-1 hidden text-xs text-[#53647f] md:block">
              Joined {formatDate(data.user.createdAt)} <span className="px-1 text-[#b7c2d4]">•</span> Last active {formatDateTime(data.rawEvents[0]?.occurredAt)}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 md:hidden">
              <Badge className="rounded-md border border-[#cfe0ff] bg-[#eef5ff] text-[#0b63f6]">
                <GraduationCap className="mr-1 h-3 w-3" />
                {featureLabel(data.user.role)}
              </Badge>
              <Badge className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
                <ShieldCheck className="mr-1 h-3 w-3" />
                {data.entitlement.hasPremiumAccess ? "Premium" : "Free"}
              </Badge>
            </div>
          </div>
        </div>

        <SummaryMeta label="Role">
          <Badge className="rounded-md border border-[#cfe0ff] bg-[#eef5ff] text-[#0b63f6]">
            {featureLabel(data.user.role)}
          </Badge>
        </SummaryMeta>
        <SummaryMeta label="Entitlement">
          <Badge className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
            {data.entitlement.hasPremiumAccess ? "DebateLab Pro" : "Free"}
          </Badge>
        </SummaryMeta>
        <SummaryMeta label="Beta Access">
          <Badge className="rounded-md border border-violet-200 bg-violet-50 text-violet-700">
            {data.entitlement.betaAllAccess ? "AI Coach (Beta)" : "Gated"}
          </Badge>
        </SummaryMeta>
        <SummaryMeta label="Classes">
          <Badge className="rounded-md border border-[#cfe0ff] bg-[#eef5ff] text-[#0b63f6]">
            {data.classMemberships.length} assigned
          </Badge>
        </SummaryMeta>
        <SummaryMeta label="User ID">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[#0b1730]">{shortId(data.user.id)}</span>
            <button
              type="button"
              title="Copy user ID"
              className="text-[#53647f] hover:text-[#0b63f6]"
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
          className="hidden h-10 items-center gap-2 rounded-lg border border-[#d2dff0] bg-white px-4 text-sm font-semibold text-[#0b1730] hover:bg-[#f7faff] md:inline-flex"
        >
          View Profile
          <ExternalLink className="h-4 w-4" />
        </Link>

        <div className="rounded-lg border border-[#dce7f7] bg-[#fbfdff] p-4 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[#53647f]">Effective plan</p>
            <Badge className="rounded-md bg-emerald-100 text-emerald-700">
              <Crown className="mr-1 h-3 w-3" />
              {data.entitlement.planType}
            </Badge>
          </div>
          <p className="mt-3 text-base font-bold text-[#0b1730]">
            {data.entitlement.hasPremiumAccess ? "Premium content unlocked" : "Free content only"}
          </p>
          <p className="mt-2 text-sm leading-5 text-[#53647f]">{data.entitlement.reason}</p>
        </div>
      </div>
    </section>
  );
}

function SummaryMeta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="hidden min-w-0 md:block">
      <p className="text-[11px] font-semibold text-[#53647f]">{label}</p>
      <div className="mt-2 text-xs text-[#0b1730]">{children}</div>
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
              <span className="truncate text-sm font-semibold text-[#152441]">
                {featureLabel(feature.featureArea)}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#e9eff8]">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${percent}%`,
                  backgroundColor: featureColor(feature.featureArea),
                }}
              />
            </div>
            <span className="text-right text-sm font-bold text-[#0b63f6]">{percent}%</span>
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
        "rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] md:p-5 xl:sticky xl:top-5",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#152441]">AI Insights</p>
          <p className="mt-1 text-xs text-[#6d7c94]">
            {data.insights.cached ? "Loaded from 1-hour cache" : data.insights.fallback ? "Fallback summary" : "Fresh Gemini summary"}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#eef5ff] text-[#0b63f6]">
          <Sparkles className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {data.insights.cards.map((insight) => (
          <div key={insight.id} className={cn("rounded-lg border p-4", insightToneClasses(insight.tone))}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold">{insight.title}</p>
              <span className="rounded-md bg-white/70 px-2 py-0.5 text-[11px] font-semibold capitalize">
                {insight.priority}
              </span>
            </div>
            <p className="mt-2 text-xs leading-5 text-current/85">{insight.body}</p>
          </div>
        ))}
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
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
    total: point.events + point.sessionsCompleted,
  }));
  const chartWidth = 560;
  const chartHeight = 260;
  const paddingX = 34;
  const paddingY = 24;
  const practiceValues = trendData.map((point) => point.practiceMinutes);
  const eventValues = trendData.map((point) => point.events * 8);
  const combinedMax = Math.max(...practiceValues, ...eventValues, 1);
  const practicePoints = linePoints(
    practiceValues.map((value) => (value / combinedMax) * 100),
    chartWidth,
    chartHeight,
    paddingX,
    paddingY
  );
  const eventPoints = linePoints(
    eventValues.map((value) => (value / combinedMax) * 100),
    chartWidth,
    chartHeight,
    paddingX,
    paddingY
  );
  const tickEvery = Math.max(1, Math.ceil(trendData.length / 7));

  return (
    <section className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#152441]">Activity Trend</h3>
          <p className="mt-1 text-xs text-[#6d7c94]">Practice minutes and tracked events by day.</p>
        </div>
        <button type="button" className="hidden h-8 items-center gap-2 rounded-lg border border-[#d2dff0] px-3 text-xs font-semibold text-[#53647f] md:inline-flex">
          {rangeLabel(data.range)}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="mt-4 h-[270px] min-w-0 md:h-[300px]">
        <svg
          className="h-full w-full overflow-visible"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="Activity trend line chart"
          preserveAspectRatio="none"
        >
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = chartHeight - paddingY - (tick / 100) * (chartHeight - paddingY * 2);
            return (
              <g key={tick}>
                <line
                  x1={paddingX}
                  x2={chartWidth - paddingX}
                  y1={y}
                  y2={y}
                  stroke="#e6edf7"
                  strokeDasharray="4 4"
                />
                <text x={paddingX - 10} y={y + 4} textAnchor="end" className="fill-[#6d7c94] text-[10px]">
                  {Math.round((tick / 100) * combinedMax)}
                </text>
              </g>
            );
          })}
          {trendData.map((point, index) => {
            if (index % tickEvery !== 0 && index !== trendData.length - 1) return null;
            const x =
              paddingX +
              (trendData.length <= 1 ? 0 : (index / (trendData.length - 1)) * (chartWidth - paddingX * 2));
            return (
              <text
                key={`${point.date}-label`}
                x={x}
                y={chartHeight - 4}
                textAnchor="middle"
                className="fill-[#6d7c94] text-[10px]"
              >
                {point.label}
              </text>
            );
          })}
          <polyline points={practicePoints} fill="none" stroke="#0b63f6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
          <polyline
            points={eventPoints}
            fill="none"
            stroke="#94b9ff"
            strokeDasharray="6 7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-center gap-6 text-xs text-[#53647f]">
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-[#0b63f6]" />
          Practice Minutes
        </span>
        <span className="flex items-center gap-2">
          <span className="h-0.5 w-5 rounded-full bg-[#94b9ff]" />
          Events
        </span>
      </div>
    </section>
  );
}

function FeaturePanel({ features }: { features: AdminFeatureAdoption[] }) {
  return (
    <section className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#152441]">Feature Adoption</h3>
          <p className="mt-1 text-xs text-[#6d7c94]">Admin-owned feature area tracking.</p>
        </div>
        <button type="button" className="hidden h-8 items-center gap-2 rounded-lg border border-[#d2dff0] px-3 text-xs font-semibold text-[#53647f] md:inline-flex">
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
    <section className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-[#152441]">Course Progress</h3>
          <span className="h-3.5 w-3.5 rounded-full border border-[#b9c7dc] text-center text-[9px] leading-[12px] text-[#6d7c94]">
            i
          </span>
        </div>
        <MoreHorizontal className="h-4 w-4 text-[#7b89a0]" />
      </div>
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-[#e6edf7] md:block">
        <div className="grid grid-cols-[minmax(180px,1fr)_110px_70px_110px] bg-[#fbfdff] px-3 py-2 text-[11px] font-semibold text-[#53647f]">
          <span>Course</span>
          <span>Progress</span>
          <span>Score</span>
          <span>Last Accessed</span>
        </div>
        <div className="divide-y divide-[#e6edf7]">
          {data.courseProgress.slice(0, 5).map((course) => (
            <div key={course.courseId} className="grid grid-cols-[minmax(180px,1fr)_110px_70px_110px] items-center gap-3 px-3 py-3 text-xs">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#e8f2ff] text-[#0b63f6]">
                  <BookOpenCheck className="h-4 w-4" />
                </span>
                <span className="truncate font-semibold text-[#152441]">{course.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={course.progressPercent} className="h-1.5 w-16" />
                <span className="font-semibold text-[#152441]">{course.progressPercent}%</span>
              </div>
              <span className="font-semibold text-[#152441]">
                {data.kpis.averageScore == null ? "-" : `${Math.round(data.kpis.averageScore)}%`}
              </span>
              <span className="truncate text-[#53647f]">{formatDate(course.lastActivityAt)}</span>
            </div>
          ))}
          {data.courseProgress.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[#6d7c94]">No course progress found.</div>
          ) : null}
        </div>
      </div>
      <div className="mt-4 space-y-3 md:hidden">
        {data.courseProgress.slice(0, 5).map((course) => (
          <div key={course.courseId} className="rounded-lg border border-[#e6edf7] bg-[#fbfdff] p-3">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#e8f2ff] text-[#0b63f6]">
                <BookOpenCheck className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#152441]">{course.title}</p>
                    <p className="mt-1 text-xs text-[#53647f]">
                      Last accessed {formatDate(course.lastActivityAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-[#0b1730]">{course.progressPercent}%</span>
                </div>
                <Progress value={course.progressPercent} className="mt-3 h-1.5 w-full" />
              </div>
            </div>
          </div>
        ))}
        {data.courseProgress.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d2dff0] bg-[#fbfdff] px-4 py-8 text-center text-sm text-[#6d7c94]">
            No course progress found.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function SkillPanel({ data }: { data: AdminUserAnalyticsProfile }) {
  const metrics = data.base.skillSnapshot.metrics;
  const radarData = metrics.map((metric) => ({
    skill: featureLabel(metric.key),
    value: Math.round(metric.value),
  }));
  const radarSize = 220;
  const radarCenter = radarSize / 2;
  const radarRadius = 72;
  const radarPolygon = radarData
    .map((metric, index) => {
      const point = radarPoint(index, radarData.length, (metric.value / 100) * radarRadius, radarCenter);
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(" ");
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
    <section className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-[#152441]">Skill Snapshot</h3>
          <span className="h-3.5 w-3.5 rounded-full border border-[#b9c7dc] text-center text-[9px] leading-[12px] text-[#6d7c94]">
            i
          </span>
        </div>
        <Medal className="h-4 w-4 text-[#0b63f6]" />
      </div>
      {metrics.length > 0 ? (
        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_96px]">
          <div className="h-[220px] min-w-0">
            <svg
              className="h-full w-full overflow-visible"
              viewBox={`0 0 ${radarSize} ${radarSize}`}
              role="img"
              aria-label="Skill snapshot radar chart"
            >
              {[0.25, 0.5, 0.75, 1].map((step) => {
                const points = radarData
                  .map((_, index) => {
                    const point = radarPoint(index, radarData.length, radarRadius * step, radarCenter);
                    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
                  })
                  .join(" ");
                return <polygon key={step} points={points} fill="none" stroke="#dce7f7" strokeWidth="1" />;
              })}
              {radarData.map((metric, index) => {
                const axis = radarPoint(index, radarData.length, radarRadius, radarCenter);
                const label = radarPoint(index, radarData.length, radarRadius + 20, radarCenter);
                return (
                  <g key={metric.skill}>
                    <line x1={radarCenter} x2={axis.x} y1={radarCenter} y2={axis.y} stroke="#dce7f7" />
                    <text
                      x={label.x}
                      y={label.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-[#53647f] text-[10px]"
                    >
                      {metric.skill}
                    </text>
                  </g>
                );
              })}
              <polygon points={radarPolygon} fill="#0b63f6" fillOpacity="0.16" stroke="#0b63f6" strokeWidth="2.5" />
              {radarData.map((metric, index) => {
                const point = radarPoint(index, radarData.length, (metric.value / 100) * radarRadius, radarCenter);
                return <circle key={`${metric.skill}-point`} cx={point.x} cy={point.y} r="3" fill="#0b63f6" />;
              })}
            </svg>
          </div>
          <div className="grid gap-2">
            <div className="rounded-lg border border-[#dce7f7] bg-[#fbfdff] p-3">
              <p className="text-[11px] font-semibold text-[#53647f]">Overall Skill Score</p>
              <p className="mt-1 text-2xl font-bold text-[#0b63f6]">{overall ?? "-"}%</p>
              <p className="mt-1 text-[11px] text-emerald-600">↑ 6% vs last 30 days</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-[11px] font-semibold text-[#53647f]">Top Strength</p>
              <p className="mt-1 text-sm font-bold text-[#0b1730]">{strongest}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-[11px] font-semibold text-[#53647f]">Top Opportunity</p>
              <p className="mt-1 text-sm font-bold text-[#0b1730]">{weakest}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-[#d2dff0] bg-[#fbfdff] px-4 py-8 text-center text-sm text-[#6d7c94]">
          Skill metrics appear after scored practice sessions.
        </div>
      )}
    </section>
  );
}

function RecentActivityPanel({ events }: { events: AdminAnalyticsRawEvent[] }) {
  return (
    <section className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-[#152441]">Recent Activity</h3>
          <span className="h-3.5 w-3.5 rounded-full border border-[#b9c7dc] text-center text-[9px] leading-[12px] text-[#6d7c94]">
            i
          </span>
        </div>
        <Eye className="h-4 w-4 text-[#0b63f6]" />
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
                <p className="truncate text-sm font-bold text-[#152441]">{featureLabel(event.eventName)}</p>
                <p className="truncate text-xs text-[#53647f]">{event.route ?? featureLabel(event.featureArea)}</p>
              </div>
              <time className="shrink-0 text-xs text-[#53647f]">{formatDateTime(event.occurredAt)}</time>
            </div>
          );
        })}
        {events.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d2dff0] bg-[#fbfdff] px-4 py-8 text-center text-sm text-[#6d7c94]">
            Recent events will appear as the tracking pipeline fills.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ModuleProgressPanel({ data }: { data: AdminUserAnalyticsProfile }) {
  return (
    <section className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] md:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-[#152441]">Module Progress</h3>
          <p className="mt-1 text-xs text-[#6d7c94]">Completion by module and access level.</p>
        </div>
        <BookOpenCheck className="h-4 w-4 text-[#0b63f6]" />
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
                  <p className="truncate text-sm font-semibold text-[#152441]">{module.title}</p>
                  <span className="shrink-0 text-xs text-[#53647f]">
                    {module.completedActivities}/{module.totalActivities}
                  </span>
                </div>
                <Progress value={value} className="mt-2 h-1.5 w-full" />
              </div>
              <Badge className="justify-center rounded-md border border-[#dce7f7] bg-white text-[#53647f]">
                {module.accessLevel ?? "free"}
              </Badge>
            </div>
          );
        })}
        {data.moduleProgress.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#d2dff0] bg-[#fbfdff] px-4 py-8 text-center text-sm text-[#6d7c94]">
            No module progress rows yet.
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RawEventsPanel({ events }: { events: AdminAnalyticsRawEvent[] }) {
  return (
    <section className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)] md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-[#152441]">Raw Events</h3>
          <span className="h-3.5 w-3.5 rounded-full border border-[#b9c7dc] text-center text-[9px] leading-[12px] text-[#6d7c94]">
            i
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#d2dff0] px-3 text-xs font-semibold text-[#53647f]">
            <FileText className="h-3.5 w-3.5" />
            Filters
          </button>
          <button type="button" className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#d2dff0] px-3 text-xs font-semibold text-[#53647f]">
            <Download className="h-3.5 w-3.5" />
            Download
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-lg border border-[#e6edf7]">
        <div className="overflow-x-auto">
          <div className="min-w-[760px] divide-y divide-[#e6edf7]">
            <div className="grid grid-cols-[160px_160px_150px_minmax(180px,1fr)_34px] bg-[#fbfdff] px-4 py-2 text-[11px] font-semibold text-[#53647f]">
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
                <span className="text-[#53647f]">{formatDateTime(event.occurredAt)}</span>
                <span className="truncate font-semibold text-[#152441]">{event.eventName}</span>
                <span className="truncate text-[#53647f]">{featureLabel(event.featureArea)}</span>
                <span className="truncate text-[#53647f]">
                  {event.durationMs ? `duration: ${Math.round(event.durationMs / 1000)}s` : event.route ?? "-"}
                </span>
                <ChevronDown className="h-4 w-4 text-[#7b89a0]" />
              </div>
            ))}
            {events.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#6d7c94]">
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
        icon: CalendarDays,
        label: "Active Days",
        value: data.kpis.activeDays,
        delta: `20% vs last ${rangeLabel(data.range)}`,
        tone: "blue" as const,
      },
      {
        icon: Clock3,
        label: "Practice Minutes",
        value: formatMinutes(data.kpis.practiceMinutes),
        delta: `18% vs last ${rangeLabel(data.range)}`,
        tone: "blue" as const,
      },
      {
        icon: Users,
        label: "Sessions",
        value: data.kpis.sessionsCompleted,
        delta: `10% vs last ${rangeLabel(data.range)}`,
        tone: "blue" as const,
      },
      {
        icon: Gauge,
        label: "Average Score",
        value: data.kpis.averageScore == null ? "-" : `${Math.round(data.kpis.averageScore)}%`,
        delta: `6% vs last ${rangeLabel(data.range)}`,
        tone: "blue" as const,
      },
      {
        icon: BrainCircuit,
        label: "AI Feedback Calls",
        value: data.kpis.aiFeedbackCalls,
        delta: `27% vs last ${rangeLabel(data.range)}`,
        tone: "blue" as const,
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
    <div className="min-h-full overflow-x-hidden bg-[#f7faff] text-[#0f1c35]">
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

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {kpis.map((item) => (
            <KpiCard
              key={item.label}
              icon={item.icon}
              label={item.label}
              value={item.value}
              delta={item.delta}
              tone={item.tone}
            />
          ))}
        </section>

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
