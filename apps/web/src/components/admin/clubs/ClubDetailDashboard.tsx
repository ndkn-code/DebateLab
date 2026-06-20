"use client";

import type { ReactNode } from "react";
import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Import,
  Loader2,
  Mail,
  MoreVertical,
  Plus,
  ShieldCheck,
  Search,
  Star,
  UserPlus,
  Users,
  XCircle,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import {
  addClubMember,
  createClubJoinCode,
  revokeClubJoinCode,
  searchProfilesForClub,
} from "@/app/actions/admin-clubs";
import { resolveLeaderboardXpEventFlag } from "@/app/actions/leaderboards";
import { ClubSchedulePanel } from "@/components/admin/clubs/ClubSchedulePanel";
import { Stat } from "@/components/ui/typography";
import { showToast } from "@/components/shared/toast";
import { buildPracticeHref } from "@/lib/practice-prefill";
import { cn } from "@/lib/utils";
import type {
  AdminClubAssignmentRow,
  AdminClubDetailData,
  AdminClubPerformanceAttempt,
  AdminClubReviewQueueItem,
  ClubQaState,
} from "@/lib/types/admin-clubs";

const TABS = ["Overview", "Members", "Schedule", "Cohorts", "Assignments", "Performance", "Attendance", "Safety"] as const;
const QA_STATES: Array<{ key: ClubQaState; label: string }> = [
  { key: "empty", label: "Empty" },
  { key: "active", label: "Active" },
  { key: "high", label: "High" },
  { key: "low", label: "Low" },
  { key: "mixed", label: "Mixed" },
];

type ClubProfileSearchResult = Awaited<ReturnType<typeof searchProfilesForClub>>[number];

function formatPercent(value: number | null) {
  return value == null ? "-" : `${value}%`;
}

function formatScore(value: number | null) {
  return value == null ? "-" : value.toFixed(value % 1 === 0 ? 0 : 1);
}

function formatShortDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat("en", { day: "2-digit" }).format(new Date(`${value}T00:00:00`));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(`${value}T00:00:00`)).toUpperCase();
}

function formatTimeRange(start: string, end: string) {
  return `${formatClock(start)}-${formatClock(end)}`;
}

function formatClock(value: string) {
  const time = value.includes("T") ? value.split("T")[1] : value;
  return time.slice(0, 5);
}

function clubInitials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words.slice(0, 3).map((word) => word[0]).join("").toUpperCase();
  return words.map((word) => word[0]).join("").slice(0, 3).toUpperCase() || "CLB";
}

function KpiCard({
  icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  helper: string;
  tone: string;
}) {
  return (
    <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-lg", tone)}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="type-caption font-medium text-on-surface-variant">{label}</p>
            <span className="type-caption flex h-4 w-4 items-center justify-center rounded-full border border-outline-variant font-bold text-on-surface-variant">i</span>
          </div>
          <Stat size="heading-xl" as="p" className="mt-1 text-on-surface">{value}</Stat>
          <p className="mt-2 text-xs font-medium text-on-surface-variant">
            <span className="mr-1 text-success">▲</span>
            {helper}
          </p>
        </div>
      </div>
    </section>
  );
}

function TrendChart({ data }: { data: AdminClubDetailData["trend"] }) {
  const points = data.length ? data : [];
  const scorePoints = carryForward(points.map((point) => point.averageScore), 68);
  const completionPoints = carryForward(points.map((point) => point.completionRate), 72);
  const polyline = (values: number[], height: number) =>
    values
      .map((value, index) => {
        const x = 24 + index * (360 / Math.max(1, values.length - 1));
        const y = height - (Math.max(0, Math.min(100, value)) / 100) * (height - 28) - 14;
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-on-surface">Cohort Performance Trend</h2>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-outline-variant type-caption font-bold text-on-surface-variant">i</span>
        </div>
        <div className="flex gap-2">
          <button className="h-9 rounded-lg border border-outline-variant bg-white px-3 text-xs font-semibold text-on-surface-variant">All Cohorts</button>
          <button className="h-9 rounded-lg border border-outline-variant bg-white px-3 text-xs font-semibold text-on-surface-variant">Last 30 Days</button>
        </div>
      </div>
      <div className="mt-4 flex gap-6 text-xs font-medium text-on-surface-variant">
        <span className="inline-flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-primary" />Average Score</span>
        <span className="inline-flex items-center gap-2"><span className="h-1 w-5 rounded-full border-t-2 border-dashed border-primary-fixed" />Completion Rate (%)</span>
      </div>
      <div className="mt-3 h-[244px] overflow-hidden">
        <svg viewBox="0 0 420 230" className="h-full w-full" role="img" aria-label="Cohort performance trend">
          {[0, 25, 50, 75, 100].map((tick) => {
            const y = 205 - (tick / 100) * 178;
            return (
              <g key={tick}>
                <line x1="24" x2="396" y1={y} y2={y} stroke="#E8EEF8" strokeDasharray="2 3" />
                <text x="0" y={y + 4} fill="#667795" fontSize="10">{tick}</text>
              </g>
            );
          })}
          <polyline fill="none" stroke="#9FCAFF" strokeWidth="2" strokeDasharray="6 6" points={polyline(completionPoints, 216)} />
          <polyline fill="none" stroke="#00B8D9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={polyline(scorePoints, 216)} />
          {points.map((point, index) => (
            <text key={point.label} x={24 + index * (360 / Math.max(1, points.length - 1)) - 14} y="226" fill="#667795" fontSize="10">
              {point.label}
            </text>
          ))}
        </svg>
      </div>
    </section>
  );
}

function carryForward(values: Array<number | null>, fallback: number) {
  return values.reduce(
    (state, value) => {
      const next = value ?? state.last;
      return {
        last: next,
        points: [...state.points, next],
      };
    },
    {
      last: values.find((value): value is number => value != null) ?? fallback,
      points: [] as number[],
    }
  ).points;
}

function WeakestSkills({ data }: { data: AdminClubDetailData["weakestSkills"] }) {
  const rows = data.length ? data : [
    { key: "rebuttal", label: "Rebuttal", value: 0 },
    { key: "logic", label: "Logical Reasoning", value: 0 },
    { key: "evidence", label: "Evidence Quality", value: 0 },
  ];

  return (
    <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-on-surface">Weakest Skills</h2>
        <p className="text-sm text-on-surface-variant">(by Avg. Score)</p>
        <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full border border-outline-variant type-caption font-bold text-on-surface-variant">i</span>
      </div>
      <div className="mt-6 space-y-5">
        {rows.map((skill, index) => {
          const color = index === 0 ? "#FF6B6B" : index < 4 ? "#FFD166" : "#00B8D9";
          return (
            <div key={skill.key} className="grid grid-cols-[136px_1fr_34px] items-center gap-3 type-caption">
              <span className="font-medium leading-tight text-on-surface">{skill.label}</span>
              <div className="h-2 rounded-full bg-surface-container">
                <div className="h-full rounded-full" style={{ width: `${skill.value}%`, backgroundColor: color }} />
              </div>
              <span className="text-right font-bold text-on-surface">{skill.value}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-between pl-[136px] pr-[34px] text-xs text-on-surface-variant">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </section>
  );
}

function AssignmentTable({ assignments, clubId }: { assignments: AdminClubAssignmentRow[]; clubId: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-outline-variant bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
        <h2 className="text-base font-bold text-on-surface">Recent Assignments</h2>
        <Link href={`/dashboard/admin/clubs/${clubId}?tab=Assignments`} className="inline-flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
          View all assignments
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.85fr_0.9fr_0.7fr_0.7fr_42px] border-b border-outline-variant bg-background px-4 py-3 text-xs font-semibold text-on-surface-variant lg:grid">
        <div>Assignment</div>
        <div>Cohort</div>
        <div>Type</div>
        <div>Due Date</div>
        <div>Submissions</div>
        <div>Avg. Score</div>
        <div>Status</div>
        <div />
      </div>
      <div>
        {assignments.length ? assignments.slice(0, 5).map((assignment) => (
          <AssignmentRow key={assignment.id} assignment={assignment} />
        )) : (
          <div className="px-4 py-14 text-center text-sm text-on-surface-variant">No assignments yet.</div>
        )}
      </div>
    </section>
  );
}

function AssignmentRow({ assignment }: { assignment: AdminClubAssignmentRow }) {
  const href = buildPracticeHref({
    topicTitle: assignment.topicTitle ?? assignment.title,
    topicCategory: assignment.topicCategory ?? "Education",
    practiceTrack: assignment.assignedTrack === "speaking" ? "speaking" : "debate",
    mode: assignment.assignedTrack === "speaking" ? "quick" : "full",
    side: "proposition",
    clubContext: {
      clubId: assignment.clubId,
      classId: assignment.classId ?? undefined,
      assignmentId: assignment.id,
      assignmentTitle: assignment.title,
    },
  });
  const complete = assignment.status === "archived";
  return (
    <div className="grid gap-3 border-b border-outline-variant px-4 py-3 text-sm last:border-b-0 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.85fr_0.9fr_0.7fr_0.7fr_42px] lg:items-center">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", complete ? "bg-surface-container text-success" : "bg-surface-container text-on-surface-variant")}>
          {complete ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </span>
        <Link href={href} className="font-semibold leading-snug text-on-surface hover:text-on-surface-variant">
          {assignment.title}
        </Link>
      </div>
      <div className="text-on-surface-variant">{assignment.classTitle ?? "All"}</div>
      <div className="capitalize text-on-surface-variant">{assignment.assignmentType}</div>
      <div className={cn("font-semibold", assignment.dueAt && new Date(assignment.dueAt) < new Date() ? "text-on-surface-variant" : "text-on-surface-variant")}>{formatShortDate(assignment.dueAt)}</div>
      <div className="text-on-surface-variant">{assignment.submissionCount} submitted</div>
      <div className="font-medium text-on-surface-variant">{formatScore(assignment.averageScore)}</div>
      <div>
        <span className={cn("inline-flex rounded-lg border px-2 py-1 text-xs font-semibold", assignment.status === "active" ? "border-outline-variant bg-surface-container text-on-surface-variant" : "border-outline-variant bg-surface-container text-success")}>
          {assignment.status === "active" ? "In Progress" : "Completed"}
        </span>
      </div>
      <div className="hidden justify-end lg:flex">
        <MoreVertical className="h-4 w-4 text-on-surface-variant" />
      </div>
    </div>
  );
}

function ReviewRail({ data }: { data: AdminClubDetailData }) {
  return (
    <aside className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-outline-variant bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <h2 className="text-base font-bold text-on-surface">Review Queue</h2>
          <span className="rounded-full bg-surface-container px-2 py-1 text-xs font-bold text-on-surface-variant">{data.reviewQueue.length}</span>
          <button className="text-sm font-semibold text-on-surface-variant">View all</button>
        </div>
        <div>
          {data.reviewQueue.slice(0, 5).map((item) => <ReviewItem key={item.id} item={item} />)}
          {!data.reviewQueue.length && <p className="px-4 py-10 text-center text-sm text-on-surface-variant">Queue is clear.</p>}
        </div>
        <button className="flex w-full items-center justify-between border-t border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface-variant">
          View all review queue
          <ChevronRight className="h-4 w-4" />
        </button>
      </section>

      <section className="overflow-hidden rounded-lg border border-outline-variant bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
          <h2 className="text-base font-bold text-on-surface">At-Risk Students</h2>
          <span className="rounded-full bg-surface-container px-2 py-1 text-xs font-bold text-on-surface-variant">{data.atRiskStudents.length}</span>
          <button className="text-sm font-semibold text-on-surface-variant">View all</button>
        </div>
        <div className="divide-y divide-[#EEF3FA] px-4">
          {data.atRiskStudents.slice(0, 4).map((student) => (
            <div key={student.userId} className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-on-surface">{student.displayName}</p>
                <p className="truncate text-xs text-on-surface-variant">{student.cohort ?? "No cohort"}</p>
              </div>
              <div className="text-right">
                <p className="type-caption text-on-surface-variant">Risk Score</p>
                <p className={cn("text-sm font-bold", student.riskScore > 70 ? "text-on-surface-variant" : "text-on-surface-variant")}>{student.riskScore}</p>
              </div>
            </div>
          ))}
          {!data.atRiskStudents.length && <p className="py-10 text-center text-sm text-on-surface-variant">No risk signals yet.</p>}
        </div>
        <button className="flex w-full items-center justify-between border-t border-outline-variant px-4 py-3 text-sm font-semibold text-on-surface-variant">
          View all at-risk students
          <ChevronRight className="h-4 w-4" />
        </button>
      </section>
    </aside>
  );
}

function ReviewItem({ item }: { item: AdminClubReviewQueueItem }) {
  const tone = item.priority === "high" ? "bg-surface-container text-on-surface-variant" : item.priority === "medium" ? "bg-surface-container text-on-surface-variant" : "bg-surface-container text-success";
  return (
    <div className="flex gap-3 border-b border-outline-variant px-4 py-3 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-container text-on-surface-variant">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-on-surface">{item.title}</p>
        <p className="truncate text-xs text-on-surface-variant">{item.cohort ?? "Club"} · {item.studentName}</p>
        <p className="mt-1 text-xs text-on-surface-variant">{formatShortDate(item.submittedAt)}</p>
      </div>
      <span className={cn("h-fit rounded-lg px-2 py-1 text-xs font-semibold capitalize", tone)}>{item.priority}</span>
    </div>
  );
}

function AttemptsList({ attempts }: { attempts: AdminClubPerformanceAttempt[] }) {
  return (
    <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-on-surface">Recent Attempts</h2>
      <div className="mt-3 divide-y divide-[#EEF3FA]">
        {attempts.slice(0, 10).map((attempt) => (
          <div key={attempt.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_0.8fr_0.7fr_0.6fr] md:items-center">
            <div className="min-w-0">
              <p className="truncate font-bold text-on-surface">{attempt.studentName}</p>
              <p className="truncate text-xs text-on-surface-variant">{attempt.topicTitle ?? attempt.assignmentTitle ?? "Practice"}</p>
            </div>
            <p className="truncate text-on-surface-variant">{attempt.classTitle ?? "No cohort"}</p>
            <p className="text-on-surface-variant">{formatShortDate(attempt.occurredAt)}</p>
            <p className="font-bold text-on-surface">{formatScore(attempt.overallScore)}</p>
          </div>
        ))}
        {!attempts.length && <p className="py-10 text-center text-sm text-on-surface-variant">No attempts recorded yet.</p>}
      </div>
    </section>
  );
}

function SafetyPanel({ data }: { data: AdminClubDetailData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { leaderboardSafety } = data;

  function handleResolve(flagId: string, status: "resolved_allowed" | "suppressed_from_leaderboards") {
    startTransition(async () => {
      try {
        await resolveLeaderboardXpEventFlag({ flagId, status });
        showToast("Leaderboard flag updated.", "success");
        router.refresh();
      } catch (error) {
        showToast(
          error instanceof Error ? error.message : "Unable to update leaderboard flag.",
          "error"
        );
      }
    });
  }

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="overflow-hidden rounded-lg border border-outline-variant bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-outline-variant px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-on-surface">Leaderboard safety</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              Review XP event flags before they affect season outcomes.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs font-bold text-on-surface-variant">
            <ShieldCheck className="h-4 w-4" />
            {leaderboardSafety.flags.length} flags
          </span>
        </div>
        {leaderboardSafety.loadError ? (
          <div className="border-b border-outline-variant bg-surface-container px-4 py-3 text-sm font-semibold text-on-surface-variant">
            {leaderboardSafety.loadError}
          </div>
        ) : null}
        <div className="hidden grid-cols-[1fr_150px_150px_140px_180px] border-b border-outline-variant bg-background px-4 py-3 text-xs font-bold text-on-surface-variant lg:grid">
          <div>Event</div>
          <div>Signal</div>
          <div>Severity</div>
          <div>Status</div>
          <div />
        </div>
        <div className="divide-y divide-[#EEF3FA]">
          {leaderboardSafety.flags.map((flag) => (
            <div key={flag.id} className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1fr_150px_150px_140px_180px] lg:items-center">
              <div className="min-w-0">
                <p className="truncate font-bold text-on-surface">
                  {flag.displayName ?? "Thinkfy member"}
                </p>
                <p className="mt-1 truncate text-xs text-on-surface-variant">
                  {flag.reason ?? "Needs leaderboard review."}
                </p>
              </div>
              <p className="truncate font-semibold capitalize text-on-surface-variant">
                {flag.flagType.replaceAll("_", " ")}
              </p>
              <span className={cn(
                "w-fit rounded-lg border px-2 py-1 text-xs font-bold capitalize",
                flag.severity === "high"
                  ? "border-outline-variant bg-surface-container text-on-surface-variant"
                  : flag.severity === "medium"
                    ? "border-outline-variant bg-surface-container text-on-surface-variant"
                    : "border-outline-variant bg-surface-container text-on-surface-variant"
              )}>
                {flag.severity}
              </span>
              <span className={cn(
                "w-fit rounded-lg border px-2 py-1 text-xs font-bold capitalize",
                flag.status === "suppressed_from_leaderboards"
                  ? "border-outline-variant bg-surface-container text-on-surface-variant"
                  : flag.status === "resolved_allowed" || flag.status === "allowed"
                    ? "border-outline-variant bg-surface-container text-success"
                    : "border-outline-variant bg-surface-container text-on-surface-variant"
              )}>
                {flag.status.replaceAll("_", " ")}
              </span>
              <div className="flex gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => handleResolve(flag.id, "resolved_allowed")}
                  disabled={isPending}
                  className="inline-flex h-9 items-center rounded-lg border border-outline-variant bg-white px-3 text-xs font-bold text-success disabled:opacity-60"
                >
                  Allow
                </button>
                <button
                  type="button"
                  onClick={() => handleResolve(flag.id, "suppressed_from_leaderboards")}
                  disabled={isPending}
                  className="inline-flex h-9 items-center rounded-lg border border-outline-variant bg-white px-3 text-xs font-bold text-on-surface-variant disabled:opacity-60"
                >
                  Suppress
                </button>
              </div>
            </div>
          ))}
          {!leaderboardSafety.flags.length && (
            <div className="px-4 py-14 text-center text-sm text-on-surface-variant">
              No leaderboard safety flags yet.
            </div>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-on-surface">Rollout guardrails</h2>
          <div className="mt-4 space-y-3">
            {leaderboardSafety.guardrails.map((metric) => (
              <div key={metric.key} className="rounded-lg border border-outline-variant bg-background p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-on-surface">{metric.label}</p>
                  <span className={cn(
                    "rounded-md px-2 py-1 text-xs font-bold uppercase",
                    metric.status === "ok"
                      ? "bg-surface-container text-success"
                      : metric.status === "watch"
                        ? "bg-surface-container text-on-surface-variant"
                        : "bg-surface-container text-on-surface-variant"
                  )}>
                    {metric.status}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-on-surface">
                  {(metric.value * 100).toFixed(1)}%
                </p>
                {metric.threshold != null ? (
                  <p className="mt-1 text-xs text-on-surface-variant">
                    Watch threshold {(metric.threshold * 100).toFixed(1)}%
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
          <h2 className="text-base font-bold text-on-surface">Recent audit</h2>
          <div className="mt-3 space-y-3">
            {leaderboardSafety.audit.slice(0, 6).map((event) => (
              <div key={event.id} className="rounded-lg border border-outline-variant bg-background p-3">
                <p className="text-sm font-bold text-on-surface">
                  {event.eventType.replaceAll("_", " ")}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {formatShortDate(event.createdAt)}
                </p>
              </div>
            ))}
            {!leaderboardSafety.audit.length && (
              <p className="py-8 text-center text-sm text-on-surface-variant">
                No audit events yet.
              </p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function eventTone(type: string) {
  if (type === "workshop") return "border-outline-variant bg-surface-container text-on-surface-variant";
  if (type === "tournament") return "border-outline-variant bg-surface-container text-on-surface-variant";
  if (type === "social") return "border-outline-variant bg-surface-container text-on-surface-variant";
  return "border-outline-variant bg-surface-container text-on-surface-variant";
}

function MembersSchedulePreview({ data }: { data: AdminClubDetailData }) {
  const upcoming = data.eventOccurrences.slice(0, 4);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1fr)]">
      <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-on-surface">Upcoming events</h2>
          <span className="rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs font-bold text-on-surface-variant">Next 7 days</span>
        </div>
        <div className="mt-4 space-y-4">
          {upcoming.map((event) => (
            <div key={event.id} className="grid grid-cols-[48px_1fr] gap-3">
              <div className="text-center">
                <p className="type-caption font-bold text-on-surface-variant">{formatMonth(event.date)}</p>
                <p className="text-2xl font-bold leading-none text-on-surface">{formatDay(event.date)}</p>
              </div>
              <div className="border-l-2 border-primary pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-on-surface">{event.title}</p>
                  <span className={cn("rounded-md border px-2 py-0.5 type-caption font-bold capitalize", eventTone(event.eventType))}>
                    {event.eventType}
                  </span>
                </div>
                <p className="mt-1 text-xs text-on-surface-variant">{formatTimeRange(event.startsAt, event.endsAt)}</p>
                <p className="mt-1 truncate text-xs text-on-surface-variant">{event.location ?? event.room ?? data.club.city ?? "Vietnam"}</p>
              </div>
            </div>
          ))}
          {!upcoming.length && <p className="py-8 text-center text-sm text-on-surface-variant">No upcoming events yet.</p>}
        </div>
        <button className="mt-4 text-sm font-bold text-on-surface-variant">View full calendar</button>
      </section>

      <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-on-surface">New event</h2>
          <Link href={`/dashboard/admin/clubs/${data.club.id}?tab=Schedule`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface-container-high px-3 text-xs font-bold text-white">
            <Plus className="h-4 w-4" />
            Schedule tab
          </Link>
        </div>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <PreviewField label="Title" value={data.events[0]?.title ?? "Weekly Debate Practice"} />
          <PreviewField label="Type" value="Meeting" />
          <PreviewField label="Cohort" value={data.events[0]?.classTitle ?? "Whole club"} />
          <PreviewField label="Date" value={formatShortDate(data.events[0]?.startDate ?? new Date().toISOString())} />
          <PreviewField label="Start" value={data.events[0]?.startTime.slice(0, 5) ?? "17:00"} />
          <PreviewField label="End" value={data.events[0]?.endTime.slice(0, 5) ?? "19:30"} />
          <PreviewField label="Location" value={data.events[0]?.location ?? data.events[0]?.room ?? "Room 204"} />
          <PreviewField label="Timezone" value="GMT+7 Asia/Ho_Chi_Minh" />
        </div>
        <div className="mt-4 rounded-lg border border-outline-variant bg-background p-3">
          <p className="text-xs font-bold uppercase text-on-surface-variant">Recurrence preview</p>
          <p className="mt-1 text-sm font-bold text-on-surface">{data.events[0]?.recurrenceSummary ?? "Every week on Friday for 8 occurrences"}</p>
          <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
            {upcoming.slice(0, 4).map((event) => (
              <p key={`preview-${event.id}`}>✓ {formatShortDate(event.date)}</p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return (
    <label>
      <span className="text-xs font-bold text-on-surface-variant">{label}</span>
      <span className="mt-1 flex h-10 items-center rounded-lg border border-outline-variant bg-background px-3 text-sm font-semibold text-on-surface-variant">
        {value}
      </span>
    </label>
  );
}

export function ClubDetailDashboard({ data }: { data: AdminClubDetailData }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialTab = TABS.find((tab) => tab === searchParams.get("tab")) ?? "Overview";
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(initialTab);
  const [memberQuery, setMemberQuery] = useState("");
  const [memberResults, setMemberResults] = useState<ClubProfileSearchResult[]>([]);
  const [createdJoinCode, setCreatedJoinCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [isMemberPending, startMemberTransition] = useTransition();
  const [isJoinCodePending, startJoinCodeTransition] = useTransition();
  const completionHelper = useMemo(() => data.kpis.completionRate == null ? "No assignment baseline yet" : "6% vs last 30 days", [data.kpis.completionRate]);

  function handleSearchMembers() {
    const query = memberQuery.trim();
    if (query.length < 2) {
      setMemberResults([]);
      return;
    }

    startMemberTransition(async () => {
      try {
        setMemberResults(await searchProfilesForClub(query, data.club.id));
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to search members.", "error");
      }
    });
  }

  function handleAddMember(userId: string) {
    startMemberTransition(async () => {
      try {
        await addClubMember({ clubId: data.club.id, userId, role: "student" });
        showToast("Member added.", "success");
        setMemberResults((current) => current.filter((item) => item.id !== userId));
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to add member.", "error");
      }
    });
  }

  function handleCreateJoinCode() {
    startJoinCodeTransition(async () => {
      try {
        const result = await createClubJoinCode(data.club.id);
        setCreatedJoinCode(result);
        if (navigator.clipboard) {
          await navigator.clipboard.writeText(result.code).catch(() => undefined);
        }
        showToast("Join code created.", "success");
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to create join code.", "error");
      }
    });
  }

  function handleCopyJoinCode() {
    if (!createdJoinCode) return;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(createdJoinCode.code);
    }
    showToast("Join code copied.", "success");
  }

  function handleRevokeJoinCode(codeId: string) {
    startJoinCodeTransition(async () => {
      try {
        await revokeClubJoinCode(data.club.id, codeId);
        showToast("Join code revoked.", "success");
        router.refresh();
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Unable to revoke join code.", "error");
      }
    });
  }

  return (
    <main className="min-h-full bg-background px-4 py-5 text-on-surface sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-outline-variant pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-variant bg-surface-container-high text-2xl font-bold text-white shadow-sm shadow-token-card/20">
              {data.club.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.club.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                clubInitials(data.club.name)
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-normal text-on-surface sm:text-3xl">{data.club.name}</h1>
                <span className="inline-flex h-6 items-center rounded-full border border-outline-variant bg-surface-container px-2 text-xs font-bold text-success">
                  {data.club.status}
                </span>
                <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 text-sm font-semibold text-on-surface-variant">
                  <Clock3 className="h-4 w-4 text-on-surface-variant" />
                  GMT+7 Vietnam
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-on-surface-variant">
                <span>{data.club.code}</span>
                <span>·</span>
                <span>{data.club.city ?? "Vietnam"}, Vietnam</span>
                {data.club.facebookUrl && <SocialLink href={data.club.facebookUrl} label="Facebook" />}
                {data.club.instagramUrl && <SocialLink href={data.club.instagramUrl} label="Instagram" />}
                {data.club.threadsUrl && <SocialLink href={data.club.threadsUrl} label="Threads" />}
              </div>
              {data.qaEnabled && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {QA_STATES.map((state) => (
                    <Link
                      key={state.key}
                      href={`/dashboard/admin/clubs/${data.club.id}?qa=${state.key}`}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-xs font-bold",
                        data.qaState === state.key
                          ? "border-primary bg-surface-container text-on-surface-variant"
                          : "border-outline-variant bg-white text-on-surface-variant"
                      )}
                    >
                      {state.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-bold text-on-surface shadow-sm">
              <Import className="h-4 w-4" />
              Import Students
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-bold text-on-surface shadow-sm">
              <Mail className="h-4 w-4" />
              Message Club
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-surface-container-high px-4 text-sm font-bold text-white shadow-sm shadow-token-card/25">
              <Plus className="h-4 w-4" />
              Create Assignment
            </button>
          </div>
        </header>

        {data.loadError && (
          <div className="mt-4 rounded-lg border border-outline-variant/30 bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
            {data.loadError}
          </div>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-0 border-b border-outline-variant sm:flex-nowrap sm:gap-8 sm:overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative h-14 shrink-0 text-sm font-bold",
                activeTab === tab ? "text-on-surface-variant" : "text-on-surface-variant"
              )}
            >
              {tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-surface-container-high" />}
            </button>
          ))}
        </div>

        {activeTab === "Overview" && (
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <KpiCard icon={<CheckCircle2 className="h-7 w-7" />} label="Completion Rate" value={formatPercent(data.kpis.completionRate)} helper={completionHelper} tone="bg-surface-container text-on-surface-variant" />
                <KpiCard icon={<CalendarDays className="h-7 w-7" />} label="Attendance (30d)" value={formatPercent(data.kpis.attendanceRate)} helper="4% vs last 30 days" tone="bg-surface-container text-success" />
                <KpiCard icon={<Star className="h-7 w-7" />} label="Average Score" value={`${formatScore(data.kpis.averageScore)} /100`} helper="5.8 pts vs last 30 days" tone="bg-surface-container text-on-surface-variant" />
              </div>
              <div className="grid gap-4 lg:grid-cols-[1.6fr_0.9fr]">
                <TrendChart data={data.trend} />
                <WeakestSkills data={data.weakestSkills} />
              </div>
              <AssignmentTable assignments={data.assignments} clubId={data.club.id} />
            </section>
            <ReviewRail data={data} />
          </div>
        )}

        {activeTab === "Members" && (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="overflow-hidden rounded-lg border border-outline-variant bg-white shadow-sm">
                <div className="border-b border-outline-variant px-4 py-3">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h2 className="text-base font-bold text-on-surface">Members</h2>
                      <p className="mt-1 text-sm text-on-surface-variant">Manage club admins, coaches, and members.</p>
                    </div>
                    <div className="flex w-full gap-2 xl:max-w-md">
                      <input
                        value={memberQuery}
                        onChange={(event) => setMemberQuery(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleSearchMembers();
                        }}
                        placeholder="Search by name or email"
                        className="h-10 min-w-0 flex-1 rounded-lg border border-outline-variant bg-white px-3 text-sm font-medium text-on-surface outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={handleSearchMembers}
                        disabled={isMemberPending || memberQuery.trim().length < 2}
                        className="inline-flex h-10 items-center gap-2 rounded-lg bg-surface-container-high px-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {isMemberPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                        Search
                      </button>
                    </div>
                  </div>
                </div>
                {memberResults.length > 0 && (
                  <div className="border-b border-outline-variant bg-surface-container px-4 py-3">
                    <div className="grid gap-2">
                      {memberResults.map((profile) => (
                        <div key={profile.id} className="flex flex-col gap-2 rounded-lg border border-outline-variant bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-on-surface">{profile.displayName}</p>
                            <p className="truncate text-xs text-on-surface-variant">{profile.email ?? "No email"} · {profile.role}</p>
                            {profile.blockedReason && (
                              <p className="mt-1 text-xs font-semibold text-on-surface-variant">{profile.blockedReason}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddMember(profile.id)}
                            disabled={isMemberPending || Boolean(profile.blockedReason)}
                            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-surface-container px-3 text-xs font-bold text-on-surface-variant disabled:opacity-50"
                          >
                            <UserPlus className="h-4 w-4" />
                            Add student
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="hidden grid-cols-[1.1fr_1fr_120px_90px_116px_32px] border-b border-outline-variant bg-background px-4 py-3 text-xs font-bold text-on-surface-variant lg:grid">
                  <div>Person</div>
                  <div>Email</div>
                  <div>Role</div>
                  <div>Status</div>
                  <div>Joined</div>
                  <div />
                </div>
                <div className="divide-y divide-[#EEF3FA]">
                  {data.members.slice(0, 5).map((member) => (
                    <div key={member.id} className="grid gap-2 px-4 py-3 text-sm lg:grid-cols-[1.1fr_1fr_120px_90px_116px_32px] lg:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-xs font-bold text-on-surface-variant">
                          {clubInitials(member.displayName).slice(0, 2)}
                        </span>
                        <p className="truncate font-bold text-on-surface">{member.displayName}</p>
                      </div>
                      <p className="truncate text-on-surface-variant">{member.email ?? "-"}</p>
                      <span className="w-fit rounded-lg border border-outline-variant bg-surface-container px-2 py-1 text-xs font-bold capitalize text-on-surface-variant">
                        {member.role === "owner" ? "Club admin" : member.role}
                      </span>
                      <span className="w-fit rounded-lg border border-outline-variant bg-surface-container px-2 py-1 text-xs font-bold capitalize text-success">
                        {member.status}
                      </span>
                      <p className="text-on-surface-variant">{formatShortDate(member.joinedAt)}</p>
                      <MoreVertical className="hidden h-4 w-4 text-on-surface-variant lg:block" />
                    </div>
                  ))}
                  {!data.members.length && <div className="px-4 py-14 text-center text-sm text-on-surface-variant">No active members yet.</div>}
                </div>
                {data.members.length > 5 && (
                  <button className="border-t border-outline-variant px-4 py-3 text-sm font-bold text-on-surface-variant">
                    View all members
                  </button>
                )}
              </section>

              <aside className="space-y-4">
                {data.organizationJoinCodesEnabled && (
                  <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <h2 className="text-base font-bold text-on-surface">Join codes</h2>
                      <button
                        type="button"
                        onClick={handleCreateJoinCode}
                        disabled={isJoinCodePending}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-surface-container-high px-3 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {isJoinCodePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Create
                      </button>
                    </div>
                    {createdJoinCode && (
                      <div className="mt-3 rounded-lg border border-outline-variant bg-surface-container p-3">
                        <p className="text-xs font-bold uppercase text-on-surface-variant">Created code</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="font-mono text-lg font-black text-on-surface">{createdJoinCode.code}</p>
                          <button
                            type="button"
                            onClick={handleCopyJoinCode}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-on-surface-variant"
                            aria-label="Copy join code"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        <p className="mt-1 text-xs text-on-surface-variant">Expires {formatShortDate(createdJoinCode.expiresAt)}</p>
                      </div>
                    )}
                    <div className="mt-3 space-y-3">
                      {data.joinCodes.map((code) => (
                        <div key={code.id} className="rounded-lg border border-outline-variant bg-background p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-bold capitalize",
                              code.status === "pending"
                                ? "border-outline-variant bg-surface-container text-on-surface-variant"
                                : code.status === "redeemed"
                                  ? "border-outline-variant bg-surface-container text-success"
                                  : "border-outline-variant bg-surface-container text-on-surface-variant"
                            )}>
                              {code.status === "redeemed" ? <BadgeCheck className="h-3.5 w-3.5" /> : null}
                              {code.status}
                            </span>
                            {code.status === "pending" && (
                              <button
                                type="button"
                                onClick={() => handleRevokeJoinCode(code.id)}
                                disabled={isJoinCodePending}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-outline-variant bg-white px-2 text-xs font-bold text-on-surface-variant disabled:opacity-60"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Revoke
                              </button>
                            )}
                          </div>
                          <p className="mt-2 text-xs text-on-surface-variant">Expires {formatShortDate(code.expiresAt)}</p>
                          {code.redeemedAt && <p className="mt-1 text-xs text-on-surface-variant">Redeemed {formatShortDate(code.redeemedAt)}</p>}
                        </div>
                      ))}
                      {!data.joinCodes.length && <p className="py-8 text-center text-sm text-on-surface-variant">No join codes yet.</p>}
                    </div>
                  </section>
                )}

                <section className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
                  <h2 className="text-base font-bold text-on-surface">Pending invitations</h2>
                  <div className="mt-3 space-y-3">
                    {data.invitations.map((invitation) => (
                      <div key={invitation.id} className="rounded-lg border border-outline-variant bg-background p-3">
                        <p className="truncate text-sm font-bold text-on-surface">{invitation.email}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-md border border-outline-variant bg-white px-2 py-1 font-bold capitalize text-on-surface-variant">
                            {invitation.role === "owner" ? "Club admin" : invitation.role}
                          </span>
                          <span className={cn(
                            "rounded-md border px-2 py-1 font-bold capitalize",
                            invitation.status === "pending"
                              ? "border-outline-variant bg-surface-container text-on-surface-variant"
                              : "border-outline-variant bg-surface-container text-success"
                          )}>
                            {invitation.status}
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-on-surface-variant">Expires {formatShortDate(invitation.expiresAt)}</p>
                      </div>
                    ))}
                    {!data.invitations.length && <p className="py-8 text-center text-sm text-on-surface-variant">No pending invitations.</p>}
                  </div>
                </section>
              </aside>
            </div>

            <MembersSchedulePreview data={data} />
          </div>
        )}

        {activeTab === "Schedule" && <ClubSchedulePanel data={data} />}

        {activeTab === "Cohorts" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {data.cohorts.map((cohort) => (
              <section key={cohort.id} className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-on-surface">{cohort.title}</h2>
                    <p className="mt-1 text-sm text-on-surface-variant">{cohort.gradeLevel ?? "All levels"} · {cohort.meetingSchedule ?? "Schedule pending"}</p>
                  </div>
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <Metric label="Students" value={cohort.studentCount} />
                  <Metric label="Attendance" value={formatPercent(cohort.attendanceRate30d)} />
                  <Metric label="Schedules" value={cohort.scheduleCount} />
                </div>
              </section>
            ))}
            {!data.cohorts.length && <EmptyPanel label="No cohorts yet." />}
          </div>
        )}
        {activeTab === "Assignments" && (
          <div className="mt-5 flex flex-col gap-4">
            <div className="flex justify-end">
              <Link
                href={`/dashboard/clubs/${data.club.id}/ielts`}
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
              >
                IELTS mock assignments
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
            <AssignmentTable assignments={data.assignments} clubId={data.club.id} />
          </div>
        )}
        {activeTab === "Performance" && <div className="mt-5"><AttemptsList attempts={data.attempts} /></div>}
        {activeTab === "Attendance" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {data.cohorts.map((cohort) => (
              <section key={cohort.id} className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-on-surface">{cohort.title}</p>
                <div className="mt-3 h-2 rounded-full bg-surface-container">
                  <div className="h-full rounded-full bg-success" style={{ width: `${cohort.attendanceRate30d ?? 0}%` }} />
                </div>
                <p className="mt-2 text-sm text-on-surface-variant">{formatPercent(cohort.attendanceRate30d)} attendance over the last 30 days</p>
              </section>
            ))}
            {!data.cohorts.length && <EmptyPanel label="Attendance appears once cohorts exist." />}
          </div>
        )}
        {activeTab === "Safety" && <SafetyPanel data={data} />}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="type-caption font-semibold uppercase text-on-surface-variant">{label}</p>
      <p className="mt-1 font-bold text-on-surface">{value}</p>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <section className="rounded-lg border border-dashed border-outline-variant bg-white px-6 py-14 text-center text-sm text-on-surface-variant">
      {label}
    </section>
  );
}

function SocialLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 rounded-md border border-outline-variant bg-white px-2 py-1 text-xs font-bold text-on-surface-variant hover:border-primary/50"
    >
      <ExternalLink className="h-3 w-3 text-primary" />
      {label}
    </a>
  );
}
