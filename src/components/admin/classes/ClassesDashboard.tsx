"use client";

import type { ReactNode } from "react";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  GraduationCap,
  MoreVertical,
  Plus,
  Repeat2,
  Search,
  Users,
} from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { createClass } from "@/app/actions/admin-classes";
import {
  ClassProgramFields,
  ScheduleEditor,
  ScheduleRangeControls,
  ScheduleTimeline,
} from "@/components/admin/classes/ScheduleTools";
import { getProgramLabel } from "@/lib/api/admin-class-schedules-model";
import { cn } from "@/lib/utils";
import type {
  AdminClassesPageData,
  AdminClassListRow,
  AdminClassSchedule,
  AdminClassSchedulesData,
} from "@/lib/types/admin-classes";

interface Props {
  data: AdminClassesPageData;
  schedulesData: AdminClassSchedulesData;
}

function formatDateRange(startDate: string | null, endDate: string | null) {
  const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });
  if (!startDate && !endDate) return "-";
  if (startDate && !endDate) return fmt.format(new Date(`${startDate}T00:00:00`));
  if (!startDate && endDate) return fmt.format(new Date(`${endDate}T00:00:00`));
  return `${fmt.format(new Date(`${startDate}T00:00:00`))} - ${fmt.format(new Date(`${endDate}T00:00:00`))}`;
}

function statusTone(status: AdminClassListRow["status"]) {
  if (status === "active") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (status === "draft") return "bg-slate-50 text-slate-600 border-slate-200";
  return "bg-red-50 text-red-700 border-red-100";
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
  value: string | number;
  helper: string;
  tone: string;
}) {
  return (
    <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-full", tone)}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-on-surface-variant">{label}</p>
          <p className="text-2xl font-bold leading-tight text-on-surface">{value}</p>
          <p className="text-xs text-on-surface-variant">{helper}</p>
        </div>
      </div>
    </div>
  );
}

function ClassRow({ item }: { item: AdminClassListRow }) {
  const classMeta = `${getProgramLabel(item.programType)}${item.gradeLevel ? ` · ${item.gradeLevel}` : ""}`;
  return (
    <Link
      href={`/dashboard/admin/classes/${item.id}`}
      className="grid grid-cols-[1.8fr_0.7fr_1.2fr_0.7fr_0.8fr_1fr_52px] items-center border-b border-outline-variant/15 px-4 py-3 text-sm transition-colors hover:bg-surface-container/50"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
          <Users className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-on-surface">{item.title}</p>
          <p className="truncate text-xs text-on-surface-variant">{classMeta}</p>
        </div>
      </div>
      <div>
        <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold", statusTone(item.status))}>
          {item.status === "active" ? "Active" : item.status === "draft" ? "Draft" : "Archived"}
        </span>
      </div>
      <div className="text-on-surface-variant">
        <CalendarDays className="mr-1 inline h-4 w-4 text-primary" />
        {formatDateRange(item.startDate, item.endDate)}
      </div>
      <div className="font-medium text-on-surface">{item.studentCount}</div>
      <div>
        <p className="font-medium text-on-surface">{item.assignedCourseCount}</p>
        <p className="text-xs text-on-surface-variant">{item.scheduleCount} schedules</p>
      </div>
      <div>
        {item.attendanceRate30d == null ? (
          <span className="text-on-surface-variant">-</span>
        ) : (
          <div className="flex items-center gap-2">
            <span className={cn("w-9 font-semibold", item.attendanceRate30d < 80 ? "text-amber-600" : "text-emerald-600")}>
              {item.attendanceRate30d}%
            </span>
            <div className="h-1.5 w-20 rounded-full bg-surface-container-high">
              <div
                className={cn("h-full rounded-full", item.attendanceRate30d < 80 ? "bg-amber-500" : "bg-emerald-500")}
                style={{ width: `${item.attendanceRate30d}%` }}
              />
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end">
        <MoreVertical className="h-4 w-4 text-on-surface-variant" />
      </div>
    </Link>
  );
}

function ClassCard({ item }: { item: AdminClassListRow }) {
  const classMeta = `${getProgramLabel(item.programType)}${item.gradeLevel ? ` · ${item.gradeLevel}` : ""}`;
  return (
    <Link
      href={`/dashboard/admin/classes/${item.id}`}
      className="block rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-on-surface">{item.title}</h2>
            <p className="truncate text-xs text-on-surface-variant">{classMeta}</p>
          </div>
        </div>
        <span className={cn("rounded-full border px-2 py-0.5 text-xs font-semibold", statusTone(item.status))}>
          {item.status === "active" ? "Active" : item.status === "draft" ? "Draft" : "Archived"}
        </span>
      </div>
      <div className="mt-4 space-y-2 text-xs text-on-surface-variant">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span>{formatDateRange(item.startDate, item.endDate)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span>{item.assignedCourseCount} courses</span>
          <span>{item.scheduleCount} schedules</span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-4 w-4" />
            {item.studentCount}
          </span>
        </div>
        {item.attendanceRate30d != null && (
          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-600">{item.attendanceRate30d}%</span>
            <div className="h-1.5 flex-1 rounded-full bg-surface-container-high">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.attendanceRate30d}%` }} />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

export function ClassesDashboard({ data, schedulesData }: Props) {
  const t = useTranslations("admin.classes");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<AdminClassSchedule | null>(null);
  const [isPending, startTransition] = useTransition();
  const isSchedulesView = searchParams.get("view") === "schedules";

  const searchDefaults = useMemo(() => ({
    q: data.filters.search,
    status: data.filters.status,
    sort: data.filters.sort,
  }), [data.filters.search, data.filters.sort, data.filters.status]);

  function applyFilters(form: HTMLFormElement) {
    const formData = new FormData(form);
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", "1");
    for (const key of ["q", "status", "sort"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value && value !== "all" && !(key === "sort" && value === "newest")) next.set(key, value);
      else next.delete(key);
    }
    router.push(`/dashboard/admin/classes?${next.toString()}`);
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyFilters(event.currentTarget);
  }

  function pageHref(page: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(page));
    return `/dashboard/admin/classes?${next.toString()}`;
  }

  function openSchedule(schedule?: AdminClassSchedule | null) {
    setEditingSchedule(schedule ?? null);
    setScheduleOpen(true);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">{t("title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{t("subtitle")}</p>
        </div>
        <button
          onClick={() => (isSchedulesView ? openSchedule() : setCreateOpen(true))}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm shadow-primary/20 transition hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          {isSchedulesView ? "New Schedule" : t("newClass")}
        </button>
      </div>

      <div className="mt-5 flex w-full overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-1 shadow-sm sm:w-fit">
        <Link
          href="/dashboard/admin/classes"
          className={cn(
            "flex h-10 min-w-32 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition sm:flex-none",
            !isSchedulesView ? "bg-primary text-on-primary shadow-sm shadow-primary/20" : "text-on-surface-variant hover:bg-surface-container"
          )}
        >
          <Users className="h-4 w-4" />
          Classes
        </Link>
        <Link
          href="/dashboard/admin/classes?view=schedules"
          className={cn(
            "flex h-10 min-w-32 flex-1 items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition sm:flex-none",
            isSchedulesView ? "bg-primary text-on-primary shadow-sm shadow-primary/20" : "text-on-surface-variant hover:bg-surface-container"
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Schedules
        </Link>
      </div>

      {data.loadError && (
        <div className="mt-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {data.loadError}
        </div>
      )}

      {isSchedulesView ? (
        <div className="mt-6 space-y-5">
          {schedulesData.loadError && (
            <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
              {schedulesData.loadError}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard icon={<CalendarDays className="h-5 w-5" />} label="Upcoming Meetings" value={schedulesData.kpis.upcomingMeetings} helper="In selected range" tone="bg-blue-50 text-primary" />
            <KpiCard icon={<Repeat2 className="h-5 w-5" />} label="Active Schedules" value={schedulesData.kpis.activeSchedules} helper="Recurring patterns" tone="bg-violet-50 text-violet-600" />
            <KpiCard icon={<Users className="h-5 w-5" />} label="Scheduled Classes" value={schedulesData.kpis.scheduledClasses} helper="With at least one meeting" tone="bg-emerald-50 text-emerald-600" />
            <KpiCard icon={<Clock3 className="h-5 w-5" />} label="Weekly Hours" value={schedulesData.kpis.weeklyHours} helper="Estimated class time" tone="bg-amber-50 text-amber-600" />
          </div>
          <ScheduleRangeControls data={schedulesData} />
          <ScheduleTimeline
            data={schedulesData}
            onNewSchedule={() => openSchedule()}
            onEditSchedule={(schedule) => openSchedule(schedule)}
          />
        </div>
      ) : (
        <>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard icon={<Users className="h-5 w-5" />} label={t("kpis.totalClasses")} value={data.kpis.totalClasses} helper={t("kpis.active", { count: data.kpis.activeClasses })} tone="bg-blue-50 text-primary" />
        <KpiCard icon={<Users className="h-5 w-5" />} label={t("kpis.totalStudents")} value={data.kpis.totalStudents} helper={t("kpis.acrossAll")} tone="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={<GraduationCap className="h-5 w-5" />} label={t("kpis.assignedCourses")} value={data.kpis.assignedCourses} helper={t("kpis.acrossAll")} tone="bg-violet-50 text-violet-600" />
        <KpiCard icon={<CheckCircle2 className="h-5 w-5" />} label={t("kpis.attendance")} value={data.kpis.attendanceRate30d == null ? "-" : `${data.kpis.attendanceRate30d}%`} helper={t("kpis.averageRate")} tone="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={<CalendarDays className="h-5 w-5" />} label={t("kpis.sessions")} value={data.kpis.sessions30d} helper={t("kpis.acrossAll")} tone="bg-amber-50 text-amber-600" />
      </div>

      <form onSubmit={handleFilterSubmit} className="mt-6 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
            <input
              name="q"
              defaultValue={searchDefaults.q}
              placeholder={t("searchPlaceholder")}
              className="h-11 w-full rounded-lg border border-outline-variant/40 bg-background pl-10 pr-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </label>
          <select name="status" defaultValue={searchDefaults.status} className="h-11 rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary">
            <option value="all">{t("status.all")}</option>
            <option value="active">{t("status.active")}</option>
            <option value="draft">{t("status.draft")}</option>
            <option value="archived">{t("status.archived")}</option>
          </select>
          <select name="sort" defaultValue={searchDefaults.sort} className="h-11 rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary">
            <option value="newest">{t("sort.newest")}</option>
            <option value="oldest">{t("sort.oldest")}</option>
            <option value="title">{t("sort.title")}</option>
            <option value="attendance">{t("sort.attendance")}</option>
          </select>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-background px-4 text-sm font-semibold text-on-surface transition hover:bg-surface-container">
            <Filter className="h-4 w-4" />
            {t("filters")}
          </button>
        </div>
      </form>

      <div className="mt-4 hidden overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-sm lg:block">
        <div className="grid grid-cols-[1.8fr_0.7fr_1.2fr_0.7fr_0.8fr_1fr_52px] border-b border-outline-variant/20 bg-surface-container px-4 py-3 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          <div>{t("table.class")}</div>
          <div>{t("table.status")}</div>
          <div>{t("table.dates")}</div>
          <div>{t("table.students")}</div>
          <div>{t("table.courses")}</div>
          <div>{t("table.attendance")}</div>
          <div />
        </div>
        {data.classes.length === 0 ? (
          <div className="px-4 py-14 text-center text-sm text-on-surface-variant">{t("empty")}</div>
        ) : (
          data.classes.map((item) => <ClassRow key={item.id} item={item} />)
        )}
      </div>

      <div className="mt-4 grid gap-3 lg:hidden">
        {data.classes.length === 0 ? (
          <div className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-4 py-14 text-center text-sm text-on-surface-variant">
            {t("empty")}
          </div>
        ) : (
          data.classes.map((item) => <ClassCard key={item.id} item={item} />)
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-on-surface-variant">
        <span>{t("showing", { current: data.classes.length, total: data.totalCount })}</span>
        <div className="flex items-center gap-2">
          <Link
            href={pageHref(Math.max(1, data.page - 1))}
            className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest", data.page <= 1 && "pointer-events-none opacity-40")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-on-primary">{data.page}</span>
          <Link
            href={pageHref(Math.min(data.pageCount, data.page + 1))}
            className={cn("inline-flex h-9 w-9 items-center justify-center rounded-lg border border-outline-variant/30 bg-surface-container-lowest", data.page >= data.pageCount && "pointer-events-none opacity-40")}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
        </>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim/30 px-4 backdrop-blur-sm">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                const id = await createClass(formData);
                setCreateOpen(false);
                router.push(`/dashboard/admin/classes/${id}`);
              });
            }}
            className="w-full max-w-xl rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-on-surface">{t("create.title")}</h2>
                <p className="text-sm text-on-surface-variant">{t("create.subtitle")}</p>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg px-2 py-1 text-sm text-on-surface-variant hover:bg-surface-container">Esc</button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold text-on-surface-variant">{t("fields.title")}</span>
                <input name="title" required className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <ClassProgramFields />
              <label>
                <span className="text-xs font-semibold text-on-surface-variant">{t("fields.startDate")}</span>
                <input type="date" name="startDate" className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label>
                <span className="text-xs font-semibold text-on-surface-variant">{t("fields.endDate")}</span>
                <input type="date" name="endDate" className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label>
                <span className="text-xs font-semibold text-on-surface-variant">{t("fields.meeting")}</span>
                <input name="meetingSchedule" placeholder="Tues & Thu 4:00 - 5:30 PM" className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label>
                <span className="text-xs font-semibold text-on-surface-variant">{t("fields.room")}</span>
                <input name="room" placeholder="Room 204" className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary" />
              </label>
              <label className="sm:col-span-2">
                <span className="text-xs font-semibold text-on-surface-variant">{t("fields.description")}</span>
                <textarea name="description" rows={3} className="mt-1 w-full rounded-lg border border-outline-variant/40 bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
              </label>
              <input type="hidden" name="status" value="active" />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCreateOpen(false)} className="h-10 rounded-lg border border-outline-variant/40 bg-background px-4 text-sm font-semibold text-on-surface">
                {t("cancel")}
              </button>
              <button disabled={isPending} className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary disabled:opacity-60">
                {isPending ? t("saving") : t("create.submit")}
              </button>
            </div>
          </form>
        </div>
      )}
      {scheduleOpen && (
        <ScheduleEditor
          classes={schedulesData.classes}
          schedule={editingSchedule}
          onClose={() => {
            setScheduleOpen(false);
            setEditingSchedule(null);
          }}
        />
      )}
    </div>
  );
}
