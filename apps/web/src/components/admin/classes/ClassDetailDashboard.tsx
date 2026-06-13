"use client";

import type { ReactNode } from "react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GraduationCap,
  MapPin,
  MoreVertical,
  Plus,
  Repeat2,
  Save,
  Search,
  Trash2,
  Users,
} from "@/components/ui/icons";
import { Link, useRouter } from "@/i18n/navigation";
import {
  addStudentToClass,
  archiveClass,
  assignCourseToClass,
  deleteClassSchedule,
  removeStudentFromClass,
  saveAttendanceSession,
  searchCoursesForClass,
  searchStudentsForClass,
  unassignCourseFromClass,
  updateClass,
} from "@/app/actions/admin-classes";
import { FadeInItem, PageTransition, StaggeredContainer } from "@/components/shared/page-motion";
import {
  ClassProgramFields,
  ScheduleEditor,
  ScheduleTimeline,
} from "@/components/admin/classes/ScheduleTools";
import { getProgramLabel } from "@/lib/api/admin-class-schedules-model";
import { cn } from "@/lib/utils";
import type {
  AdminClassAssignedCourse,
  AdminClassDetailData,
  AdminClassSchedule,
  AdminClassSchedulesData,
  AdminClassProfileSummary,
  AdminClassRosterRow,
  AttendanceStatus,
} from "@/lib/types/admin-classes";

interface Props {
  data: AdminClassDetailData;
}

type Tab = "overview" | "students" | "courses" | "schedule" | "attendance";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.slice(0, 5).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function statusTone(value: AttendanceStatus) {
  if (value === "present") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "late") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/20 hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold leading-tight text-on-surface">{value}</p>
          <p className="text-sm font-medium text-on-surface">{label}</p>
          <p className="text-xs text-on-surface-variant">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function StudentRow({
  student,
  onRemove,
}: {
  student: AdminClassRosterRow;
  onRemove?: () => void;
}) {
  return (
    <div className="grid grid-cols-[1.5fr_0.8fr_0.8fr_auto] items-center gap-3 border-b border-outline-variant/15 px-3 py-3 text-sm last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface">
          {initials(student.displayName)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-on-surface">{student.displayName}</p>
          <p className="truncate text-xs text-on-surface-variant">{student.email}</p>
        </div>
      </div>
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-center text-xs font-semibold text-emerald-700">
        Active
      </span>
      <div className="flex items-center gap-2">
        <span className={cn("w-9 font-semibold", (student.attendanceRate30d ?? 0) < 80 ? "text-amber-600" : "text-emerald-600")}>
          {student.attendanceRate30d == null ? "-" : `${student.attendanceRate30d}%`}
        </span>
        <div className="h-1.5 flex-1 rounded-full bg-surface-container-high">
          <div
            className={cn("h-full rounded-full", (student.attendanceRate30d ?? 0) < 80 ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${student.attendanceRate30d ?? 0}%` }}
          />
        </div>
      </div>
      {onRemove ? (
        <button onClick={onRemove} className="rounded-lg p-2 text-on-surface-variant transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-600 active:scale-[0.95]">
          <Trash2 className="h-4 w-4" />
        </button>
      ) : (
        <MoreVertical className="h-4 w-4 text-on-surface-variant" />
      )}
    </div>
  );
}

function CourseAssignmentRow({
  course,
  onRemove,
}: {
  course: AdminClassAssignedCourse;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-outline-variant/25 bg-background px-3 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
        <BookOpen className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-on-surface">{course.title}</p>
        <p className="truncate text-xs text-on-surface-variant">{course.category ?? "Course"} · {course.visibility === "class_restricted" ? "Class restricted" : course.visibility}</p>
      </div>
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        {course.isPublished ? "Active" : "Draft"}
      </span>
      {onRemove && (
        <button onClick={onRemove} className="rounded-lg p-2 text-on-surface-variant transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50 hover:text-red-600 active:scale-[0.95]">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function SearchPanel<T extends AdminClassProfileSummary | {
  id: string;
  title: string;
  category?: string | null;
}>({
  placeholder,
  results,
  onSearch,
  onAdd,
  renderLabel,
}: {
  placeholder: string;
  results: T[];
  onSearch: (query: string) => void;
  onAdd: (item: T) => void;
  renderLabel: (item: T) => { title: string; subtitle: string | null };
}) {
  const [query, setQuery] = useState("");
  return (
    <div className="relative">
      <Search className="absolute left-3 top-3.5 h-4 w-4 text-on-surface-variant" />
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          onSearch(event.target.value);
        }}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-outline-variant/40 bg-background pl-10 pr-3 text-sm outline-none focus:border-primary"
      />
      {results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-lg">
          {results.map((result) => {
            const label = renderLabel(result);
            return (
              <button
                key={result.id}
                type="button"
                onClick={() => {
                  onAdd(result);
                  setQuery("");
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.995]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {initials(label.title)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-on-surface">{label.title}</p>
                  <p className="truncate text-xs text-on-surface-variant">{label.subtitle}</p>
                </div>
                <Plus className="h-4 w-4 text-primary" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AttendanceSheet({
  data,
  onClose,
}: {
  data: AdminClassDetailData;
  onClose: () => void;
}) {
  const t = useTranslations("admin.classes.detail.attendanceSheet");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [courseId, setCourseId] = useState(data.assignedCourses[0]?.courseId ?? "");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessionNotes, setSessionNotes] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(
    Object.fromEntries(data.roster.map((student) => [student.id, "present" as AttendanceStatus]))
  );

  const counts = useMemo(() => {
    const values = Object.values(statuses);
    return {
      present: values.filter((value) => value === "present").length,
      late: values.filter((value) => value === "late").length,
      absent: values.filter((value) => value === "absent").length,
      total: values.length,
    };
  }, [statuses]);

  function setStatus(userId: string, status: AttendanceStatus) {
    setStatuses((prev) => ({ ...prev, [userId]: status }));
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-scrim/30 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-md flex-col border-l border-outline-variant/30 bg-surface-container-lowest shadow-2xl">
        <div className="flex h-16 items-center justify-between border-b border-outline-variant/20 px-4">
          <h2 className="text-lg font-bold text-on-surface">{t("title")}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-on-surface-variant hover:bg-surface-container">Esc</button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-on-surface">{t("course")}</label>
            <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary">
              {data.assignedCourses.map((course) => (
                <option key={course.courseId} value={course.courseId}>{course.title}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-on-surface">{t("date")}</label>
            <input type="date" value={sessionDate} onChange={(event) => setSessionDate(event.target.value)} className="h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="rounded-lg border border-outline-variant/30 bg-background p-3 text-center">
              <p className="text-xl font-bold text-emerald-600">{counts.present}</p>
              <p className="text-xs text-on-surface-variant">{t("present")}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/30 bg-background p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{counts.late}</p>
              <p className="text-xs text-on-surface-variant">{t("late")}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/30 bg-background p-3 text-center">
              <p className="text-xl font-bold text-red-600">{counts.absent}</p>
              <p className="text-xs text-on-surface-variant">{t("absent")}</p>
            </div>
            <div className="rounded-lg border border-outline-variant/30 bg-background p-3 text-center">
              <p className="text-xl font-bold text-on-surface">{counts.total}</p>
              <p className="text-xs text-on-surface-variant">{t("total")}</p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-outline-variant/30">
            <div className="grid grid-cols-[1fr_172px] bg-surface-container px-3 py-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              <span>{t("student")}</span>
              <span>{t("status")}</span>
            </div>
            {data.roster.map((student) => (
              <div key={student.id} className="grid grid-cols-[1fr_172px] items-center gap-2 border-t border-outline-variant/15 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-xs font-bold text-on-surface">
                    {initials(student.displayName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface">{student.displayName}</p>
                    <input
                      value={notes[student.id] ?? ""}
                      onChange={(event) => setNotes((prev) => ({ ...prev, [student.id]: event.target.value }))}
                      placeholder={t("note")}
                      className="mt-1 h-7 w-full rounded-md border border-outline-variant/25 bg-background px-2 text-xs outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(["present", "late", "absent"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setStatus(student.id, status)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs font-bold transition",
                        statuses[student.id] === status
                          ? statusTone(status)
                          : "border-outline-variant/30 bg-background text-on-surface-variant hover:bg-surface-container"
                      )}
                    >
                      {status === "present" ? "P" : status === "late" ? "L" : "A"}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-on-surface">{t("sessionNote")}</span>
            <textarea value={sessionNotes} onChange={(event) => setSessionNotes(event.target.value)} rows={3} className="w-full rounded-lg border border-outline-variant/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
          </label>
        </div>
        <div className="border-t border-outline-variant/20 p-4">
          <button
            disabled={isPending || !courseId || data.roster.length === 0}
            onClick={() => {
              startTransition(async () => {
                await saveAttendanceSession({
                  classId: data.classInfo.id,
                  courseId,
                  sessionDate,
                  notes: sessionNotes,
                  records: data.roster.map((student) => ({
                    userId: student.id,
                    status: statuses[student.id] ?? "present",
                    notes: notes[student.id] ?? null,
                  })),
                });
                onClose();
                router.refresh();
              });
            }}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-on-primary shadow-sm shadow-primary/20 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isPending ? t("saving") : t("save")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ClassDetailDashboard({ data }: Props) {
  const t = useTranslations("admin.classes.detail");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [studentResults, setStudentResults] = useState<AdminClassProfileSummary[]>([]);
  const [courseResults, setCourseResults] = useState<Array<{ id: string; title: string; category: string | null }>>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<AdminClassSchedule | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    startTransition(async () => {
      await archiveClass(data.classInfo.id);
      router.push("/dashboard/admin/classes");
    });
  }

  function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      await updateClass(data.classInfo.id, formData);
      setEditOpen(false);
      router.refresh();
    });
  }

  const tabs: Tab[] = ["overview", "students", "courses", "schedule", "attendance"];
  const scheduleData = useMemo<AdminClassSchedulesData>(() => {
    const rangeStart = toIsoDate(addDays(new Date(), -7));
    const rangeEnd = toIsoDate(addDays(new Date(), 90));
    const scheduledClasses = data.schedules.length > 0 ? 1 : 0;
    const weeklyMinutes = data.schedules.reduce((total, schedule) => {
      const duration = Math.max(0, timeToMinutes(schedule.endTime) - timeToMinutes(schedule.startTime));
      const interval = Math.max(1, schedule.recurrenceRule.interval || 1);
      const weeklyMultiplier =
        schedule.recurrenceRule.frequency === "weekly"
          ? Math.max(1, schedule.recurrenceRule.weekdays.length) / interval
          : schedule.recurrenceRule.frequency === "daily"
            ? 5 / interval
            : schedule.recurrenceRule.frequency === "monthly"
              ? 0.25 / interval
              : 0;
      return total + duration * weeklyMultiplier;
    }, 0);
    return {
      schedules: data.schedules,
      occurrences: data.scheduleOccurrences,
      classes: [data.classInfo],
      filters: {
        rangeStart,
        rangeEnd,
        program: "all",
        level: "all",
      },
      kpis: {
        upcomingMeetings: data.scheduleOccurrences.length,
        activeSchedules: data.schedules.filter((schedule) => schedule.status === "active").length,
        scheduledClasses,
        weeklyHours: Number((weeklyMinutes / 60).toFixed(1)),
      },
      loadError: null,
    };
  }, [data]);

  function openSchedule(schedule?: AdminClassSchedule | null) {
    setEditingSchedule(schedule ?? null);
    setScheduleOpen(true);
  }

  return (
    <PageTransition className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/dashboard/admin/classes" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-on-surface-variant transition-all duration-200 hover:-translate-y-0.5 hover:text-primary active:scale-[0.98]">
            <ArrowLeft className="h-4 w-4" />
            {t("back")}
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-on-surface">{data.classInfo.title}</h1>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{data.classInfo.status === "active" ? "Active" : data.classInfo.status}</span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{data.classInfo.description}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditOpen(true)} className="h-10 rounded-lg border border-outline-variant/40 bg-background px-4 text-sm font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.98]">
            {t("edit")}
          </button>
          <button onClick={() => setAttendanceOpen(true)} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]">
            {t("takeAttendance")}
          </button>
        </div>
      </div>

      {data.loadError && (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {data.loadError}
        </div>
      )}

      <FadeInItem className="mt-6 grid gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 text-sm shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md sm:grid-cols-2 lg:grid-cols-5">
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
          <div><p className="text-xs text-on-surface-variant">Program</p><p className="font-semibold text-on-surface">{getProgramLabel(data.classInfo.programType)}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <GraduationCap className="mt-0.5 h-4 w-4 text-primary" />
          <div><p className="text-xs text-on-surface-variant">Level</p><p className="font-semibold text-on-surface">{data.classInfo.gradeLevel ?? "-"}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-4 w-4 text-primary" />
          <div><p className="text-xs text-on-surface-variant">{t("facts.time")}</p><p className="font-semibold text-on-surface">{data.classInfo.meetingSchedule ?? "-"}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <CalendarDays className="mt-0.5 h-4 w-4 text-primary" />
          <div><p className="text-xs text-on-surface-variant">{t("facts.dateRange")}</p><p className="font-semibold text-on-surface">{formatDate(data.classInfo.startDate)} - {formatDate(data.classInfo.endDate)}</p></div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="mt-0.5 h-4 w-4 text-primary" />
          <div><p className="text-xs text-on-surface-variant">{t("facts.room")}</p><p className="font-semibold text-on-surface">{data.classInfo.room ?? "-"}</p></div>
        </div>
      </FadeInItem>

      <div className="mt-6 border-b border-outline-variant/20">
        <nav className="flex gap-5 overflow-x-auto">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={cn(
                "border-b-2 px-1 py-3 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]",
                tab === item
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface"
              )}
            >
              {t(`tabs.${item}`)}
            </button>
          ))}
        </nav>
      </div>

      {tab === "overview" && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <StaggeredContainer className="grid gap-4 sm:grid-cols-2 lg:col-span-2 xl:grid-cols-4">
            <MetricCard icon={<Users className="h-5 w-5" />} label={t("metrics.students")} value={data.classInfo.studentCount} helper={t("metrics.activeStudents", { count: data.roster.length })} />
            <MetricCard icon={<CheckCircle2 className="h-5 w-5" />} label={t("metrics.attendance")} value={data.classInfo.attendanceRate30d == null ? "-" : `${data.classInfo.attendanceRate30d}%`} helper={t("metrics.thisMonth")} />
            <MetricCard icon={<BookOpen className="h-5 w-5" />} label={t("metrics.courses")} value={data.assignedCourses.length} helper={t("metrics.classRestricted")} />
            <MetricCard icon={<Repeat2 className="h-5 w-5" />} label="Schedules" value={data.schedules.length} helper="Recurring patterns" />
          </StaggeredContainer>
          <FadeInItem className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-on-surface">{t("roster.title", { count: data.roster.length })}</h2>
              <button onClick={() => setTab("students")} className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.98]">{t("viewAll")}</button>
            </div>
            <div className="overflow-hidden rounded-lg border border-outline-variant/20">
              {data.roster.slice(0, 5).map((student) => <StudentRow key={student.id} student={student} />)}
              {data.roster.length === 0 && <p className="px-3 py-8 text-center text-sm text-on-surface-variant">{t("roster.empty")}</p>}
            </div>
          </FadeInItem>
          <FadeInItem className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-on-surface">{t("courses.title", { count: data.assignedCourses.length })}</h2>
              <button onClick={() => setTab("courses")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[0.98]">{t("courses.assign")}</button>
            </div>
            <div className="space-y-2">
              {data.assignedCourses.slice(0, 5).map((course) => <CourseAssignmentRow key={course.assignmentId} course={course} />)}
              {data.assignedCourses.length === 0 && <p className="rounded-lg border border-dashed border-outline-variant/30 px-3 py-8 text-center text-sm text-on-surface-variant">{t("courses.empty")}</p>}
            </div>
          </FadeInItem>
          <FadeInItem className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-on-surface">{t("attendance.recent")}</h2>
              <button onClick={() => setTab("attendance")} className="rounded-lg border border-outline-variant/30 px-3 py-1.5 text-xs font-semibold text-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.98]">{t("viewAll")}</button>
            </div>
            <AttendanceTable data={data} compact />
          </FadeInItem>
        </div>
      )}

      {tab === "students" && (
        <FadeInItem className="mt-5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-bold text-on-surface">{t("roster.title", { count: data.roster.length })}</h2>
            <div className="w-full md:w-80">
              <SearchPanel
                placeholder={t("roster.search")}
                results={studentResults}
                onSearch={(query) => {
                  if (query.trim().length < 2) return setStudentResults([]);
                  startTransition(async () => {
                    const results = await searchStudentsForClass(query, data.classInfo.id);
                    setStudentResults(results.map((student) => ({
                      id: student.id,
                      displayName: student.display_name || student.email?.split("@")[0] || "Unnamed student",
                      email: student.email,
                      avatarUrl: student.avatar_url,
                    })));
                  });
                }}
                onAdd={(student) => {
                  startTransition(async () => {
                    await addStudentToClass(data.classInfo.id, student.id);
                    router.refresh();
                  });
                }}
                renderLabel={(student) => ({ title: student.displayName, subtitle: student.email })}
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-outline-variant/20">
            {data.roster.map((student) => (
              <StudentRow
                key={student.id}
                student={student}
                onRemove={() => {
                  startTransition(async () => {
                    await removeStudentFromClass(data.classInfo.id, student.id);
                    router.refresh();
                  });
                }}
              />
            ))}
            {data.roster.length === 0 && <p className="px-3 py-12 text-center text-sm text-on-surface-variant">{t("roster.empty")}</p>}
          </div>
        </FadeInItem>
      )}

      {tab === "courses" && (
        <FadeInItem className="mt-5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-on-surface">{t("courses.title", { count: data.assignedCourses.length })}</h2>
              <p className="text-sm text-on-surface-variant">{t("courses.visibilityNote")}</p>
            </div>
            <div className="w-full md:w-80">
              <SearchPanel
                placeholder={t("courses.search")}
                results={courseResults}
                onSearch={(query) => {
                  if (query.trim().length < 2) return setCourseResults([]);
                  startTransition(async () => {
                    const results = await searchCoursesForClass(query, data.classInfo.id);
                    setCourseResults(results.map((course) => ({
                      id: course.id,
                      title: course.title,
                      category: course.category,
                    })));
                  });
                }}
                onAdd={(course) => {
                  startTransition(async () => {
                    await assignCourseToClass(data.classInfo.id, course.id);
                    router.refresh();
                  });
                }}
                renderLabel={(course) => ({ title: course.title, subtitle: course.category ?? "Course" })}
              />
            </div>
          </div>
          <div className="grid gap-2">
            {data.assignedCourses.map((course) => (
              <CourseAssignmentRow
                key={course.assignmentId}
                course={course}
                onRemove={() => {
                  startTransition(async () => {
                    await unassignCourseFromClass(data.classInfo.id, course.courseId);
                    router.refresh();
                  });
                }}
              />
            ))}
            {data.assignedCourses.length === 0 && <p className="rounded-lg border border-dashed border-outline-variant/30 px-3 py-12 text-center text-sm text-on-surface-variant">{t("courses.empty")}</p>}
          </div>
        </FadeInItem>
      )}

      {tab === "schedule" && (
        <div className="mt-5 space-y-4">
          <FadeInItem className="flex flex-col gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Class Schedule</h2>
              <p className="text-sm text-on-surface-variant">Display-only meeting patterns for this class. Attendance stays manual.</p>
            </div>
            <button
              onClick={() => openSchedule()}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
            >
              <CalendarDays className="h-4 w-4" />
              New Schedule
            </button>
          </FadeInItem>
          <StaggeredContainer className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard icon={<CalendarDays className="h-5 w-5" />} label="Upcoming" value={scheduleData.kpis.upcomingMeetings} helper="Next 90 days" />
            <MetricCard icon={<Repeat2 className="h-5 w-5" />} label="Active Rules" value={scheduleData.kpis.activeSchedules} helper="Recurring schedules" />
            <MetricCard icon={<Clock3 className="h-5 w-5" />} label="Weekly Hours" value={scheduleData.kpis.weeklyHours} helper="Estimated" />
          </StaggeredContainer>
          <FadeInItem>
            <ScheduleTimeline
              data={scheduleData}
              onNewSchedule={() => openSchedule()}
              onEditSchedule={(schedule) => openSchedule(schedule)}
              onDeleteSchedule={(schedule) => {
                startTransition(async () => {
                  await deleteClassSchedule(data.classInfo.id, schedule.id);
                  router.refresh();
                });
              }}
            />
          </FadeInItem>
        </div>
      )}

      {tab === "attendance" && (
        <FadeInItem className="mt-5 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-on-surface">{t("attendance.title")}</h2>
            <button onClick={() => setAttendanceOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[0.98]">
              <CalendarDays className="h-4 w-4" />
              {t("takeAttendance")}
            </button>
          </div>
          <AttendanceGrid data={data} />
          <div className="mt-5">
            <AttendanceTable data={data} />
          </div>
        </FadeInItem>
      )}

      {attendanceOpen && <AttendanceSheet data={data} onClose={() => setAttendanceOpen(false)} />}
      {scheduleOpen && (
        <ScheduleEditor
          classes={[data.classInfo]}
          schedule={editingSchedule}
          initialClassId={data.classInfo.id}
          initialCourses={data.assignedCourses}
          onClose={() => {
            setScheduleOpen(false);
            setEditingSchedule(null);
          }}
        />
      )}

      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 px-4 backdrop-blur-sm">
          <form onSubmit={handleUpdate} className="w-full max-w-xl rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-xl">
            <h2 className="text-lg font-bold text-on-surface">{t("editClass")}</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="text-xs font-semibold text-on-surface-variant">{t("fields.title")}</span><input name="title" defaultValue={data.classInfo.title} required className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" /></label>
              <ClassProgramFields defaultProgram={data.classInfo.programType} defaultLevel={data.classInfo.gradeLevel} />
              <label><span className="text-xs font-semibold text-on-surface-variant">{t("fields.startDate")}</span><input type="date" name="startDate" defaultValue={data.classInfo.startDate ?? ""} className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" /></label>
              <label><span className="text-xs font-semibold text-on-surface-variant">{t("fields.endDate")}</span><input type="date" name="endDate" defaultValue={data.classInfo.endDate ?? ""} className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" /></label>
              <label><span className="text-xs font-semibold text-on-surface-variant">{t("fields.meeting")}</span><input name="meetingSchedule" defaultValue={data.classInfo.meetingSchedule ?? ""} className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" /></label>
              <label><span className="text-xs font-semibold text-on-surface-variant">{t("fields.room")}</span><input name="room" defaultValue={data.classInfo.room ?? ""} className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" /></label>
              <label className="sm:col-span-2"><span className="text-xs font-semibold text-on-surface-variant">{t("fields.description")}</span><textarea name="description" defaultValue={data.classInfo.description ?? ""} rows={3} className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary" /></label>
              <input type="hidden" name="status" value={data.classInfo.status} />
            </div>
            <div className="mt-5 flex justify-between gap-2">
              <button type="button" onClick={handleArchive} disabled={isPending} className="h-10 rounded-lg border border-red-100 bg-red-50 px-4 text-sm font-semibold text-red-700 transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-100 active:scale-[0.98]">{t("archive")}</button>
              <div className="flex gap-2">
                <button type="button" onClick={() => setEditOpen(false)} className="h-10 rounded-lg border border-outline-variant/40 bg-background px-4 text-sm font-semibold text-on-surface transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.98]">{t("cancel")}</button>
                <button disabled={isPending} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[0.98]">{isPending ? t("saving") : t("save")}</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </PageTransition>
  );
}

function AttendanceTable({ data, compact = false }: { data: AdminClassDetailData; compact?: boolean }) {
  const t = useTranslations("admin.classes.detail.attendance");
  if (data.attendanceSessions.length === 0) {
    return <p className="rounded-lg border border-dashed border-outline-variant/30 px-3 py-10 text-center text-sm text-on-surface-variant">{t("empty")}</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-outline-variant/20">
      <div className="grid grid-cols-[1fr_1fr_0.5fr_0.5fr_0.5fr_0.7fr] bg-surface-container px-3 py-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        <span>{t("date")}</span><span>{t("course")}</span><span>{t("present")}</span><span>{t("late")}</span><span>{t("absent")}</span><span>{t("rate")}</span>
      </div>
      {data.attendanceSessions.slice(0, compact ? 4 : undefined).map((session) => (
        <div key={session.id} className="grid grid-cols-[1fr_1fr_0.5fr_0.5fr_0.5fr_0.7fr] border-t border-outline-variant/15 px-3 py-2 text-sm">
          <span className="text-on-surface">{formatDate(session.sessionDate)}</span>
          <span className="truncate text-on-surface-variant">{session.courseTitle}</span>
          <span className="text-emerald-600">{session.present}</span>
          <span className="text-amber-600">{session.late}</span>
          <span className="text-red-600">{session.absent}</span>
          <span className="font-semibold text-on-surface">{session.attendanceRate == null ? "-" : `${session.attendanceRate}%`}</span>
        </div>
      ))}
    </div>
  );
}

function AttendanceGrid({ data }: { data: AdminClassDetailData }) {
  const t = useTranslations("admin.classes.detail.attendance");
  if (data.attendanceGrid.sessions.length === 0 || data.attendanceGrid.students.length === 0) {
    return <p className="rounded-lg border border-dashed border-outline-variant/30 px-3 py-10 text-center text-sm text-on-surface-variant">{t("empty")}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-outline-variant/20">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead className="bg-surface-container text-xs uppercase tracking-wide text-on-surface-variant">
          <tr>
            <th className="sticky left-0 z-10 bg-surface-container px-3 py-2 text-left">{t("student")}</th>
            {data.attendanceGrid.sessions.map((session) => (
              <th key={session.id} className="px-3 py-2 text-center">
                <div>{new Date(`${session.sessionDate}T00:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" })}</div>
                <div className="max-w-24 truncate type-caption font-normal normal-case">{session.courseTitle}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.attendanceGrid.students.map((student) => (
            <tr key={student.id} className="border-t border-outline-variant/15">
              <td className="sticky left-0 z-10 bg-surface-container-lowest px-3 py-2 font-semibold text-on-surface">{student.displayName}</td>
              {data.attendanceGrid.sessions.map((session) => {
                const status = student.attendance[session.id];
                return (
                  <td key={session.id} className="px-3 py-2 text-center">
                    {status ? (
                      <span className={cn("inline-flex h-7 w-7 items-center justify-center rounded-md border text-xs font-bold", statusTone(status))}>
                        {status === "present" ? "P" : status === "late" ? "L" : "A"}
                      </span>
                    ) : (
                      <span className="text-on-surface-variant/40">-</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
