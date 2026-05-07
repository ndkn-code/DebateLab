"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate as mutateSWR } from "swr";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CalendarDays,
  Clock3,
  Crown,
  Eye,
  Gauge,
  LineChart as LineChartIcon,
  Loader2,
  Medal,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { AnalyticsRangePreset } from "@/types";
import type {
  AdminAiInsightCard,
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

function insightToneClasses(tone: AdminAiInsightCard["tone"]) {
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "slate") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-[#cfe0ff] bg-[#eef5ff] text-[#0b63f6]";
}

function featureColor(feature: string) {
  const colors: Record<string, string> = {
    courses: "#0b63f6",
    activities: "#12a87a",
    practice: "#f59e0b",
    duels: "#7c3aed",
    ai_feedback: "#e14d8a",
    admin: "#26364f",
    profile: "#0f9fad",
  };
  return colors[feature] ?? "#64748b";
}

function AnalyticsStat({
  icon: Icon,
  label,
  value,
  detail,
  tone = "blue",
}: {
  icon: typeof BarChart3;
  label: string;
  value: string | number;
  detail: string;
  tone?: "blue" | "green" | "amber" | "pink" | "slate";
}) {
  const tones = {
    blue: "bg-[#e8f2ff] text-[#0b63f6]",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    pink: "bg-rose-50 text-rose-600",
    slate: "bg-slate-100 text-slate-700",
  };

  return (
    <div className="rounded-lg border border-[#dce7f7] bg-white p-4 shadow-[0_18px_50px_-42px_rgba(15,28,53,0.34)]">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-tight text-[#0b1730]">{value}</p>
          <p className="mt-1 text-sm font-semibold text-[#1d2b46]">{label}</p>
          <p className="mt-1 text-xs leading-5 text-[#6d7c94]">{detail}</p>
        </div>
      </div>
    </div>
  );
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
    <div className="inline-flex rounded-lg border border-[#d2dff0] bg-white p-1 shadow-sm">
      {RANGE_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange(preset)}
          onMouseEnter={() => onPrefetch(preset)}
          onFocus={() => onPrefetch(preset)}
          className={cn(
            "flex h-9 min-w-[4.4rem] items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors",
            range === preset
              ? "bg-[#0b63f6] text-white shadow-sm"
              : "text-[#53647f] hover:bg-[#f3f7fd] hover:text-[#14213d]"
          )}
        >
          {preset}
        </button>
      ))}
      {isPending ? (
        <span className="flex h-9 w-9 items-center justify-center text-[#0b63f6]">
          <Loader2 className="h-4 w-4 animate-spin" />
        </span>
      ) : null}
    </div>
  );
}

function FeatureAdoptionList({ features }: { features: AdminFeatureAdoption[] }) {
  const max = Math.max(...features.map((feature) => feature.totalEvents), 1);
  return (
    <div className="space-y-3">
      {features.map((feature) => (
        <div key={feature.featureArea} className="rounded-lg border border-[#e6edf7] bg-white px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: featureColor(feature.featureArea) }}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#152441]">
                  {featureLabel(feature.featureArea)}
                </p>
                <p className="text-xs text-[#6d7c94]">
                  {feature.activeDays} active day(s) - last {formatDate(feature.lastSeenAt)}
                </p>
              </div>
            </div>
            <span className="text-sm font-bold text-[#0b1730]">{feature.totalEvents}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf3fb]">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round((feature.totalEvents / max) * 100)}%`,
                backgroundColor: featureColor(feature.featureArea),
              }}
            />
          </div>
        </div>
      ))}
    </div>
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

  const trendData = useMemo(
    () =>
      data.trend.map((point) => ({
        ...point,
        total: point.events + point.sessionsCompleted,
      })),
    [data.trend]
  );
  const scoreMetrics = data.base.skillSnapshot.metrics;

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
    <div className="min-h-full bg-[#f7faff] text-[#0f1c35]">
      <header className="border-b border-[#dce7f7] bg-white/92 px-5 py-5 backdrop-blur md:px-7">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Link
              href="/dashboard/admin/users"
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#d2dff0] bg-white text-[#53647f] hover:bg-[#f3f7fd]"
              aria-label="Back to users"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="rounded-md border border-[#cfe0ff] bg-[#eef5ff] text-[#0b63f6]">
                  Users & Access
                </Badge>
                <Badge className="rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700">
                  {data.entitlement.betaAllAccess ? "Beta all-access on" : "Subscription gates on"}
                </Badge>
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-normal text-[#0b1730] md:text-3xl">
                User Analytics Profile
              </h1>
              <p className="mt-1 text-sm text-[#53647f]">
                Product progress, tracked events, entitlement state, and AI-generated admin notes.
              </p>
            </div>
          </div>
          <RangeControl
            range={selectedRange}
            isPending={isPending}
            onChange={handleRangeChange}
            onPrefetch={prefetchRange}
          />
        </div>
      </header>

      <main className="space-y-5 px-5 py-5 md:px-7">
        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_370px]">
          <div className="space-y-5">
            <div className="rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)]">
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar className="h-20 w-20 shrink-0 border border-[#dce7f7] bg-[#e8f2ff]">
                    {data.user.avatarUrl ? (
                      <AvatarImage src={data.user.avatarUrl} alt={data.user.displayName} />
                    ) : null}
                    <AvatarFallback className="bg-[#dceaff] text-xl font-bold text-[#0b63f6]">
                      {initials(data.user.displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="truncate text-2xl font-bold text-[#12213c]">
                      {data.user.displayName}
                    </h2>
                    <p className="truncate text-sm text-[#53647f]">
                      {data.user.email ?? data.user.id}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="rounded-md capitalize">
                        {data.user.role}
                      </Badge>
                      <Badge className="rounded-md bg-[#eef5ff] text-[#0b63f6]">
                        Level {data.user.level}
                      </Badge>
                      <Badge className="rounded-md bg-amber-50 text-amber-700">
                        {data.user.orbBalance} orbs
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border border-[#e6edf7] bg-[#fbfdff] p-4 md:min-w-[270px]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-[#53647f]">Effective plan</span>
                    <Badge className="rounded-md bg-emerald-100 text-emerald-700">
                      <Crown className="mr-1 h-3 w-3" />
                      {data.entitlement.planType}
                    </Badge>
                  </div>
                  <p className="text-sm font-semibold text-[#152441]">
                    {data.entitlement.hasPremiumAccess ? "Premium content unlocked" : "Free content only"}
                  </p>
                  <p className="text-xs leading-5 text-[#6d7c94]">{data.entitlement.reason}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <AnalyticsStat
                icon={CalendarDays}
                label="Active days"
                value={data.kpis.activeDays}
                detail={`In the last ${rangeLabel(data.range)}`}
                tone="blue"
              />
              <AnalyticsStat
                icon={Activity}
                label="Tracked events"
                value={data.kpis.trackedEvents}
                detail="Supabase admin event source"
                tone="green"
              />
              <AnalyticsStat
                icon={Clock3}
                label="Practice time"
                value={formatMinutes(data.kpis.practiceMinutes)}
                detail={`${data.kpis.sessionsCompleted} completed session(s)`}
                tone="amber"
              />
              <AnalyticsStat
                icon={Gauge}
                label="Avg score"
                value={data.kpis.averageScore == null ? "-" : `${data.kpis.averageScore}`}
                detail="From daily practice stats"
                tone="slate"
              />
              <AnalyticsStat
                icon={BrainCircuit}
                label="AI feedback"
                value={data.kpis.aiFeedbackCalls}
                detail="Events plus Gemini usage"
                tone="pink"
              />
              <AnalyticsStat
                icon={BookOpenCheck}
                label="Course completion"
                value={`${data.kpis.completionRate}%`}
                detail={`${data.courseProgress.length} enrolled course(s)`}
                tone="blue"
              />
            </div>
          </div>

          <aside className="rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#152441]">AI Admin Insights</p>
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
                <div
                  key={insight.id}
                  className={cn("rounded-lg border p-3", insightToneClasses(insight.tone))}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold">{insight.title}</p>
                    <span className="rounded-md bg-white/70 px-2 py-0.5 text-[11px] font-semibold capitalize">
                      {insight.priority}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-current/85">{insight.body}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#152441]">Engagement Trend</h3>
                <p className="mt-1 text-xs text-[#6d7c94]">Tracked events, active time, and product progress by day.</p>
              </div>
              <LineChartIcon className="h-5 w-5 text-[#0b63f6]" />
            </div>
            <div className="mt-4 h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="admin-events" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#0b63f6" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#0b63f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="admin-practice" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#12a87a" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="#12a87a" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#e6edf7" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6d7c94" }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#6d7c94" }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #dce7f7", fontSize: 12 }} />
                  <Area type="monotone" dataKey="events" stroke="#0b63f6" strokeWidth={2} fill="url(#admin-events)" />
                  <Area type="monotone" dataKey="practiceMinutes" stroke="#12a87a" strokeWidth={2} fill="url(#admin-practice)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#152441]">Feature Adoption</h3>
                <p className="mt-1 text-xs text-[#6d7c94]">Admin-owned feature area tracking.</p>
              </div>
              <BarChart3 className="h-5 w-5 text-[#0b63f6]" />
            </div>
            <div className="mt-4">
              <FeatureAdoptionList features={data.featureAdoption} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#152441]">Course Progress</h3>
                <p className="mt-1 text-xs text-[#6d7c94]">Enrollment remains progress tracking; entitlement gates are separate.</p>
              </div>
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="mt-4 space-y-3">
              {data.courseProgress.length > 0 ? (
                data.courseProgress.map((course) => (
                  <div key={course.courseId} className="rounded-lg border border-[#e6edf7] bg-[#fbfdff] p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-[#152441]">{course.title}</p>
                          <Badge variant="outline" className="rounded-md capitalize">
                            {course.visibility ?? "course"}
                          </Badge>
                          <Badge className="rounded-md bg-[#eef5ff] text-[#0b63f6]">
                            {course.status}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-[#6d7c94]">
                          Enrolled {formatDate(course.enrolledAt)} - last activity {formatDate(course.lastActivityAt)}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[#0b1730]">{course.progressPercent}%</span>
                    </div>
                    <Progress value={course.progressPercent} className="mt-3 h-2 w-full" />
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-[#d2dff0] bg-[#fbfdff] px-4 py-8 text-center text-sm text-[#6d7c94]">
                  No course enrollments found for this user.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#152441]">Skill Snapshot</h3>
                <p className="mt-1 text-xs text-[#6d7c94]">{data.base.skillSnapshot.note}</p>
              </div>
              <Medal className="h-5 w-5 text-amber-600" />
            </div>
            {scoreMetrics.length > 0 ? (
              <div className="mt-4 h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={scoreMetrics.map((metric) => ({ name: featureLabel(metric.key), value: metric.value }))}>
                    <CartesianGrid stroke="#e6edf7" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#6d7c94" }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#6d7c94" }} tickLine={false} axisLine={false} width={32} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #dce7f7", fontSize: 12 }} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[8, 8, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-[#d2dff0] bg-[#fbfdff] px-4 py-8 text-center text-sm text-[#6d7c94]">
                Skill metrics appear after scored practice sessions.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
          <div className="rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#152441]">Module Progress</h3>
                <p className="mt-1 text-xs text-[#6d7c94]">Completion by module and access level.</p>
              </div>
              <BookOpenCheck className="h-5 w-5 text-[#0b63f6]" />
            </div>
            <div className="mt-4 space-y-3">
              {data.moduleProgress.slice(0, 8).map((module) => {
                const value =
                  module.totalActivities > 0
                    ? Math.round((module.completedActivities / module.totalActivities) * 100)
                    : 0;
                return (
                  <div key={module.moduleId} className="rounded-lg border border-[#e6edf7] bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#152441]">{module.title}</p>
                        <p className="mt-1 text-xs text-[#6d7c94]">
                          {module.completedActivities}/{module.totalActivities} activities - {module.accessLevel ?? "free"}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-[#0b1730]">{value}%</span>
                    </div>
                    <Progress value={value} className="mt-3 h-2 w-full" />
                  </div>
                );
              })}
              {data.moduleProgress.length === 0 ? (
                <div className="rounded-lg border border-dashed border-[#d2dff0] bg-[#fbfdff] px-4 py-8 text-center text-sm text-[#6d7c94]">
                  No module progress rows yet.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-lg border border-[#dce7f7] bg-white p-5 shadow-[0_22px_70px_-58px_rgba(15,28,53,0.35)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#152441]">Recent Events</h3>
                <p className="mt-1 text-xs text-[#6d7c94]">Raw Supabase analytics events for this selected range.</p>
              </div>
              <Eye className="h-5 w-5 text-[#0b63f6]" />
            </div>
            <div className="mt-4 overflow-hidden rounded-lg border border-[#e6edf7]">
              <div className="overflow-x-auto">
                <div className="min-w-[680px] divide-y divide-[#e6edf7]">
                  <div className="grid grid-cols-[150px_120px_minmax(180px,1fr)_150px] bg-[#fbfdff] px-4 py-3 text-xs font-semibold text-[#53647f]">
                    <span>Event</span>
                    <span>Feature</span>
                    <span>Route</span>
                    <span>Time</span>
                  </div>
                  {data.rawEvents.slice(0, 18).map((event) => (
                    <div
                      key={event.id}
                      className="grid grid-cols-[150px_120px_minmax(180px,1fr)_150px] items-center px-4 py-3 text-sm"
                    >
                      <span className="truncate font-semibold text-[#152441]">
                        {featureLabel(event.eventName)}
                      </span>
                      <span>
                        <Badge
                          className="rounded-md text-white"
                          style={{ backgroundColor: featureColor(event.featureArea) }}
                        >
                          {featureLabel(event.featureArea)}
                        </Badge>
                      </span>
                      <span className="truncate text-xs text-[#53647f]">{event.route ?? "-"}</span>
                      <span className="text-xs text-[#53647f]">{formatDateTime(event.occurredAt)}</span>
                    </div>
                  ))}
                  {data.rawEvents.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-[#6d7c94]">
                      No raw events yet. Page views will begin filling this table after the migration is applied.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
