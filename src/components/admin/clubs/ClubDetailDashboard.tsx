"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  FileText,
  Import,
  Mail,
  MoreVertical,
  Plus,
  Star,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ClubSchedulePanel } from "@/components/admin/clubs/ClubSchedulePanel";
import { buildPracticeHref } from "@/lib/practice-prefill";
import { cn } from "@/lib/utils";
import type {
  AdminClubAssignmentRow,
  AdminClubDetailData,
  AdminClubPerformanceAttempt,
  AdminClubReviewQueueItem,
  ClubQaState,
} from "@/lib/types/admin-clubs";

const TABS = ["Overview", "Members", "Schedule", "Cohorts", "Assignments", "Performance", "Attendance"] as const;
const QA_STATES: Array<{ key: ClubQaState; label: string }> = [
  { key: "empty", label: "Empty" },
  { key: "active", label: "Active" },
  { key: "high", label: "High" },
  { key: "low", label: "Low" },
  { key: "mixed", label: "Mixed" },
];

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
    <section className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-lg", tone)}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-medium leading-tight text-[#667795]">{label}</p>
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#AFC0DD] text-[10px] font-bold text-[#7585A0]">i</span>
          </div>
          <p className="mt-1 text-[32px] font-bold leading-none tracking-normal text-[#152238]">{value}</p>
          <p className="mt-2 text-xs font-medium text-[#667795]">
            <span className="mr-1 text-[#159947]">▲</span>
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
    <section className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#152238]">Cohort Performance Trend</h2>
          <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[#AFC0DD] text-[10px] font-bold text-[#7585A0]">i</span>
        </div>
        <div className="flex gap-2">
          <button className="h-9 rounded-lg border border-[#DEE8F8] bg-white px-3 text-xs font-semibold text-[#667795]">All Cohorts</button>
          <button className="h-9 rounded-lg border border-[#DEE8F8] bg-white px-3 text-xs font-semibold text-[#667795]">Last 30 Days</button>
        </div>
      </div>
      <div className="mt-4 flex gap-6 text-xs font-medium text-[#667795]">
        <span className="inline-flex items-center gap-2"><span className="h-1 w-5 rounded-full bg-[#4D86F7]" />Average Score</span>
        <span className="inline-flex items-center gap-2"><span className="h-1 w-5 rounded-full border-t-2 border-dashed border-[#9FCAFF]" />Completion Rate (%)</span>
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
          <polyline fill="none" stroke="#4D86F7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={polyline(scorePoints, 216)} />
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
    <section className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-bold text-[#152238]">Weakest Skills</h2>
        <p className="text-sm text-[#667795]">(by Avg. Score)</p>
        <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full border border-[#AFC0DD] text-[10px] font-bold text-[#7585A0]">i</span>
      </div>
      <div className="mt-6 space-y-5">
        {rows.map((skill, index) => {
          const color = index === 0 ? "#FF6B6B" : index < 4 ? "#F5B942" : "#34C759";
          return (
            <div key={skill.key} className="grid grid-cols-[136px_1fr_34px] items-center gap-3 text-[13px]">
              <span className="font-medium leading-tight text-[#263654]">{skill.label}</span>
              <div className="h-2 rounded-full bg-[#EDF2F8]">
                <div className="h-full rounded-full" style={{ width: `${skill.value}%`, backgroundColor: color }} />
              </div>
              <span className="text-right font-bold text-[#152238]">{skill.value}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-between pl-[136px] pr-[34px] text-xs text-[#667795]">
        <span>0</span>
        <span>50</span>
        <span>100</span>
      </div>
    </section>
  );
}

function AssignmentTable({ assignments, clubId }: { assignments: AdminClubAssignmentRow[]; clubId: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#DEE8F8] bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-[#DEE8F8] px-4 py-3">
        <h2 className="text-base font-bold text-[#152238]">Recent Assignments</h2>
        <Link href={`/dashboard/admin/clubs/${clubId}?tab=Assignments`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#1E63E9]">
          View all assignments
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="hidden grid-cols-[1.4fr_0.7fr_0.7fr_0.85fr_0.9fr_0.7fr_0.7fr_42px] border-b border-[#DEE8F8] bg-[#F7FAFE] px-4 py-3 text-xs font-semibold text-[#667795] lg:grid">
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
          <div className="px-4 py-14 text-center text-sm text-[#667795]">No assignments yet.</div>
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
    <div className="grid gap-3 border-b border-[#EEF3FA] px-4 py-3 text-sm last:border-b-0 lg:grid-cols-[1.4fr_0.7fr_0.7fr_0.85fr_0.9fr_0.7fr_0.7fr_42px] lg:items-center">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", complete ? "bg-[#EAFBF0] text-[#159947]" : "bg-[#EAF2FF] text-[#1E63E9]")}>
          {complete ? <CheckCircle2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </span>
        <Link href={href} className="font-semibold leading-snug text-[#152238] hover:text-[#1E63E9]">
          {assignment.title}
        </Link>
      </div>
      <div className="text-[#40516F]">{assignment.classTitle ?? "All"}</div>
      <div className="capitalize text-[#40516F]">{assignment.assignmentType}</div>
      <div className={cn("font-semibold", assignment.dueAt && new Date(assignment.dueAt) < new Date() ? "text-[#FF6B6B]" : "text-[#40516F]")}>{formatShortDate(assignment.dueAt)}</div>
      <div className="text-[#40516F]">{assignment.submissionCount} submitted</div>
      <div className="font-medium text-[#40516F]">{formatScore(assignment.averageScore)}</div>
      <div>
        <span className={cn("inline-flex rounded-lg border px-2 py-1 text-xs font-semibold", assignment.status === "active" ? "border-[#CFE0FF] bg-[#EAF2FF] text-[#1E63E9]" : "border-[#C8F0D5] bg-[#EAFBF0] text-[#159947]")}>
          {assignment.status === "active" ? "In Progress" : "Completed"}
        </span>
      </div>
      <div className="hidden justify-end lg:flex">
        <MoreVertical className="h-4 w-4 text-[#667795]" />
      </div>
    </div>
  );
}

function ReviewRail({ data }: { data: AdminClubDetailData }) {
  return (
    <aside className="space-y-4">
      <section className="overflow-hidden rounded-lg border border-[#DEE8F8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#DEE8F8] px-4 py-3">
          <h2 className="text-base font-bold text-[#152238]">Review Queue</h2>
          <span className="rounded-full bg-[#FFF1F1] px-2 py-1 text-xs font-bold text-[#FF4A4A]">{data.reviewQueue.length}</span>
          <button className="text-sm font-semibold text-[#1E63E9]">View all</button>
        </div>
        <div>
          {data.reviewQueue.slice(0, 5).map((item) => <ReviewItem key={item.id} item={item} />)}
          {!data.reviewQueue.length && <p className="px-4 py-10 text-center text-sm text-[#667795]">Queue is clear.</p>}
        </div>
        <button className="flex w-full items-center justify-between border-t border-[#DEE8F8] px-4 py-3 text-sm font-semibold text-[#1E63E9]">
          View all review queue
          <ChevronRight className="h-4 w-4" />
        </button>
      </section>

      <section className="overflow-hidden rounded-lg border border-[#DEE8F8] bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-[#DEE8F8] px-4 py-3">
          <h2 className="text-base font-bold text-[#152238]">At-Risk Students</h2>
          <span className="rounded-full bg-[#FFF1F1] px-2 py-1 text-xs font-bold text-[#FF4A4A]">{data.atRiskStudents.length}</span>
          <button className="text-sm font-semibold text-[#1E63E9]">View all</button>
        </div>
        <div className="divide-y divide-[#EEF3FA] px-4">
          {data.atRiskStudents.slice(0, 4).map((student) => (
            <div key={student.userId} className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#EAF2FF] text-[#1E63E9]">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#152238]">{student.displayName}</p>
                <p className="truncate text-xs text-[#667795]">{student.cohort ?? "No cohort"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-medium text-[#667795]">Risk Score</p>
                <p className={cn("text-sm font-bold", student.riskScore > 70 ? "text-[#FF4A4A]" : "text-[#F5A400]")}>{student.riskScore}</p>
              </div>
            </div>
          ))}
          {!data.atRiskStudents.length && <p className="py-10 text-center text-sm text-[#667795]">No risk signals yet.</p>}
        </div>
        <button className="flex w-full items-center justify-between border-t border-[#DEE8F8] px-4 py-3 text-sm font-semibold text-[#1E63E9]">
          View all at-risk students
          <ChevronRight className="h-4 w-4" />
        </button>
      </section>
    </aside>
  );
}

function ReviewItem({ item }: { item: AdminClubReviewQueueItem }) {
  const tone = item.priority === "high" ? "bg-[#FFF1F1] text-[#FF4A4A]" : item.priority === "medium" ? "bg-[#FFF7E6] text-[#D88700]" : "bg-[#EAFBF0] text-[#159947]";
  return (
    <div className="flex gap-3 border-b border-[#EEF3FA] px-4 py-3 last:border-b-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EAF2FF] text-[#1E63E9]">
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#152238]">{item.title}</p>
        <p className="truncate text-xs text-[#667795]">{item.cohort ?? "Club"} · {item.studentName}</p>
        <p className="mt-1 text-xs text-[#667795]">{formatShortDate(item.submittedAt)}</p>
      </div>
      <span className={cn("h-fit rounded-lg px-2 py-1 text-xs font-semibold capitalize", tone)}>{item.priority}</span>
    </div>
  );
}

function AttemptsList({ attempts }: { attempts: AdminClubPerformanceAttempt[] }) {
  return (
    <section className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
      <h2 className="text-base font-bold text-[#152238]">Recent Attempts</h2>
      <div className="mt-3 divide-y divide-[#EEF3FA]">
        {attempts.slice(0, 10).map((attempt) => (
          <div key={attempt.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_0.8fr_0.7fr_0.6fr] md:items-center">
            <div className="min-w-0">
              <p className="truncate font-bold text-[#152238]">{attempt.studentName}</p>
              <p className="truncate text-xs text-[#667795]">{attempt.topicTitle ?? attempt.assignmentTitle ?? "Practice"}</p>
            </div>
            <p className="truncate text-[#40516F]">{attempt.classTitle ?? "No cohort"}</p>
            <p className="text-[#40516F]">{formatShortDate(attempt.occurredAt)}</p>
            <p className="font-bold text-[#152238]">{formatScore(attempt.overallScore)}</p>
          </div>
        ))}
        {!attempts.length && <p className="py-10 text-center text-sm text-[#667795]">No attempts recorded yet.</p>}
      </div>
    </section>
  );
}

function eventTone(type: string) {
  if (type === "workshop") return "border-[#D7C8FF] bg-[#F4EFFF] text-[#7B4CE2]";
  if (type === "tournament") return "border-[#FFD0A8] bg-[#FFF4E9] text-[#D56B00]";
  if (type === "social") return "border-[#FFD5E6] bg-[#FFF1F7] text-[#C43D75]";
  return "border-[#CFE0FF] bg-[#EAF2FF] text-[#1E63E9]";
}

function MembersSchedulePreview({ data }: { data: AdminClubDetailData }) {
  const upcoming = data.eventOccurrences.slice(0, 4);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,0.86fr)_minmax(0,1fr)]">
      <section className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#152238]">Upcoming events</h2>
          <span className="rounded-lg border border-[#DEE8F8] bg-white px-3 py-2 text-xs font-bold text-[#40516F]">Next 7 days</span>
        </div>
        <div className="mt-4 space-y-4">
          {upcoming.map((event) => (
            <div key={event.id} className="grid grid-cols-[48px_1fr] gap-3">
              <div className="text-center">
                <p className="text-[10px] font-bold text-[#667795]">{formatMonth(event.date)}</p>
                <p className="text-2xl font-bold leading-none text-[#152238]">{formatDay(event.date)}</p>
              </div>
              <div className="border-l-2 border-[#4D86F7] pl-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-[#152238]">{event.title}</p>
                  <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold capitalize", eventTone(event.eventType))}>
                    {event.eventType}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#667795]">{formatTimeRange(event.startsAt, event.endsAt)}</p>
                <p className="mt-1 truncate text-xs text-[#667795]">{event.location ?? event.room ?? data.club.city ?? "Vietnam"}</p>
              </div>
            </div>
          ))}
          {!upcoming.length && <p className="py-8 text-center text-sm text-[#667795]">No upcoming events yet.</p>}
        </div>
        <button className="mt-4 text-sm font-bold text-[#1E63E9]">View full calendar</button>
      </section>

      <section className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#152238]">New event</h2>
          <Link href={`/dashboard/admin/clubs/${data.club.id}?tab=Schedule`} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#2E78F6] px-3 text-xs font-bold text-white">
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
        <div className="mt-4 rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] p-3">
          <p className="text-xs font-bold uppercase text-[#667795]">Recurrence preview</p>
          <p className="mt-1 text-sm font-bold text-[#152238]">{data.events[0]?.recurrenceSummary ?? "Every week on Friday for 8 occurrences"}</p>
          <div className="mt-2 space-y-1 text-xs text-[#667795]">
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
      <span className="text-xs font-bold text-[#667795]">{label}</span>
      <span className="mt-1 flex h-10 items-center rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] px-3 text-sm font-semibold text-[#40516F]">
        {value}
      </span>
    </label>
  );
}

export function ClubDetailDashboard({ data }: { data: AdminClubDetailData }) {
  const searchParams = useSearchParams();
  const initialTab = TABS.find((tab) => tab === searchParams.get("tab")) ?? "Overview";
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>(initialTab);
  const completionHelper = useMemo(() => data.kpis.completionRate == null ? "No assignment baseline yet" : "6% vs last 30 days", [data.kpis.completionRate]);

  return (
    <main className="min-h-full bg-[#F7FAFE] px-4 py-5 text-[#152238] sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 border-b border-[#DEE8F8] pb-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#CFE0FF] bg-[#2E78F6] text-2xl font-bold text-white shadow-sm shadow-[#4D86F7]/20">
              {data.club.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.club.logoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                clubInitials(data.club.name)
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-normal text-[#152238] sm:text-3xl">{data.club.name}</h1>
                <span className="inline-flex h-6 items-center rounded-full border border-[#BFE8CA] bg-[#EAFBF0] px-2 text-xs font-bold text-[#159947]">
                  {data.club.status}
                </span>
                <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-[#CFE0FF] bg-white px-3 text-sm font-semibold text-[#40516F]">
                  <Clock3 className="h-4 w-4 text-[#667795]" />
                  GMT+7 Vietnam
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#667795]">
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
                          ? "border-[#4D86F7] bg-[#EAF2FF] text-[#1E63E9]"
                          : "border-[#DEE8F8] bg-white text-[#667795]"
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
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#DEE8F8] bg-white px-4 text-sm font-bold text-[#152238] shadow-sm">
              <Import className="h-4 w-4" />
              Import Students
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#DEE8F8] bg-white px-4 text-sm font-bold text-[#152238] shadow-sm">
              <Mail className="h-4 w-4" />
              Message Club
            </button>
            <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#2E78F6] px-4 text-sm font-bold text-white shadow-sm shadow-[#4D86F7]/25">
              <Plus className="h-4 w-4" />
              Create Assignment
            </button>
          </div>
        </header>

        {data.loadError && (
          <div className="mt-4 rounded-lg border border-[#FF6B6B]/30 bg-[#FFF1F1] px-4 py-3 text-sm text-[#C43D3D]">
            {data.loadError}
          </div>
        )}

        <div className="flex flex-wrap gap-x-6 gap-y-0 border-b border-[#DEE8F8] sm:flex-nowrap sm:gap-8 sm:overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "relative h-14 shrink-0 text-sm font-bold",
                activeTab === tab ? "text-[#1E63E9]" : "text-[#40516F]"
              )}
            >
              {tab}
              {activeTab === tab && <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-[#1E63E9]" />}
            </button>
          ))}
        </div>

        {activeTab === "Overview" && (
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 space-y-4">
              <div className="grid gap-4 lg:grid-cols-3">
                <KpiCard icon={<CheckCircle2 className="h-7 w-7" />} label="Completion Rate" value={formatPercent(data.kpis.completionRate)} helper={completionHelper} tone="bg-[#EAF2FF] text-[#1E63E9]" />
                <KpiCard icon={<CalendarDays className="h-7 w-7" />} label="Attendance (30d)" value={formatPercent(data.kpis.attendanceRate)} helper="4% vs last 30 days" tone="bg-[#EAFBF0] text-[#159947]" />
                <KpiCard icon={<Star className="h-7 w-7" />} label="Average Score" value={`${formatScore(data.kpis.averageScore)} /100`} helper="5.8 pts vs last 30 days" tone="bg-[#FFF7E6] text-[#F5A400]" />
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
              <section className="overflow-hidden rounded-lg border border-[#DEE8F8] bg-white shadow-sm">
                <div className="border-b border-[#DEE8F8] px-4 py-3">
                  <h2 className="text-base font-bold text-[#152238]">Members</h2>
                  <p className="mt-1 text-sm text-[#667795]">Manage club admins, coaches, and members.</p>
                </div>
                <div className="hidden grid-cols-[1.1fr_1fr_120px_90px_116px_32px] border-b border-[#DEE8F8] bg-[#F7FAFE] px-4 py-3 text-xs font-bold text-[#667795] lg:grid">
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
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-xs font-bold text-[#667795]">
                          {clubInitials(member.displayName).slice(0, 2)}
                        </span>
                        <p className="truncate font-bold text-[#152238]">{member.displayName}</p>
                      </div>
                      <p className="truncate text-[#40516F]">{member.email ?? "-"}</p>
                      <span className="w-fit rounded-lg border border-[#CFE0FF] bg-[#EAF2FF] px-2 py-1 text-xs font-bold capitalize text-[#1E63E9]">
                        {member.role === "owner" ? "Club admin" : member.role}
                      </span>
                      <span className="w-fit rounded-lg border border-[#BFE8CA] bg-[#EAFBF0] px-2 py-1 text-xs font-bold capitalize text-[#159947]">
                        {member.status}
                      </span>
                      <p className="text-[#40516F]">{formatShortDate(member.joinedAt)}</p>
                      <MoreVertical className="hidden h-4 w-4 text-[#667795] lg:block" />
                    </div>
                  ))}
                  {!data.members.length && <div className="px-4 py-14 text-center text-sm text-[#667795]">No active members yet.</div>}
                </div>
                {data.members.length > 5 && (
                  <button className="border-t border-[#DEE8F8] px-4 py-3 text-sm font-bold text-[#1E63E9]">
                    View all members
                  </button>
                )}
              </section>

              <aside className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
                <h2 className="text-base font-bold text-[#152238]">Pending invitations</h2>
                <div className="mt-3 space-y-3">
                  {data.invitations.map((invitation) => (
                    <div key={invitation.id} className="rounded-lg border border-[#DEE8F8] bg-[#F7FAFE] p-3">
                      <p className="truncate text-sm font-bold text-[#152238]">{invitation.email}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        <span className="rounded-md border border-[#CFE0FF] bg-white px-2 py-1 font-bold capitalize text-[#1E63E9]">
                          {invitation.role === "owner" ? "Club admin" : invitation.role}
                        </span>
                        <span className={cn(
                          "rounded-md border px-2 py-1 font-bold capitalize",
                          invitation.status === "pending"
                            ? "border-[#FFE2A8] bg-[#FFF7E6] text-[#A96800]"
                            : "border-[#C8F0D5] bg-[#EAFBF0] text-[#159947]"
                        )}>
                          {invitation.status}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-[#667795]">Expires {formatShortDate(invitation.expiresAt)}</p>
                    </div>
                  ))}
                  {!data.invitations.length && <p className="py-8 text-center text-sm text-[#667795]">No pending invitations.</p>}
                </div>
              </aside>
            </div>

            <MembersSchedulePreview data={data} />
          </div>
        )}

        {activeTab === "Schedule" && <ClubSchedulePanel data={data} />}

        {activeTab === "Cohorts" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {data.cohorts.map((cohort) => (
              <section key={cohort.id} className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-[#152238]">{cohort.title}</h2>
                    <p className="mt-1 text-sm text-[#667795]">{cohort.gradeLevel ?? "All levels"} · {cohort.meetingSchedule ?? "Schedule pending"}</p>
                  </div>
                  <Users className="h-5 w-5 text-[#4D86F7]" />
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
        {activeTab === "Assignments" && <div className="mt-5"><AssignmentTable assignments={data.assignments} clubId={data.club.id} /></div>}
        {activeTab === "Performance" && <div className="mt-5"><AttemptsList attempts={data.attempts} /></div>}
        {activeTab === "Attendance" && (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            {data.cohorts.map((cohort) => (
              <section key={cohort.id} className="rounded-lg border border-[#DEE8F8] bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-[#152238]">{cohort.title}</p>
                <div className="mt-3 h-2 rounded-full bg-[#EDF2F8]">
                  <div className="h-full rounded-full bg-[#34C759]" style={{ width: `${cohort.attendanceRate30d ?? 0}%` }} />
                </div>
                <p className="mt-2 text-sm text-[#667795]">{formatPercent(cohort.attendanceRate30d)} attendance over the last 30 days</p>
              </section>
            ))}
            {!data.cohorts.length && <EmptyPanel label="Attendance appears once cohorts exist." />}
          </div>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase text-[#7B8AA7]">{label}</p>
      <p className="mt-1 font-bold text-[#152238]">{value}</p>
    </div>
  );
}

function EmptyPanel({ label }: { label: string }) {
  return (
    <section className="rounded-lg border border-dashed border-[#C8D7EF] bg-white px-6 py-14 text-center text-sm text-[#667795]">
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
      className="inline-flex items-center gap-1 rounded-md border border-[#DEE8F8] bg-white px-2 py-1 text-xs font-bold text-[#40516F] hover:border-[#4D86F7]/50"
    >
      <ExternalLink className="h-3 w-3 text-[#4D86F7]" />
      {label}
    </a>
  );
}
