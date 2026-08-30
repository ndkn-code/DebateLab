"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  GraduationCap,
  Plus,
  Repeat2,
  Save,
  Trash2,
  Users,
} from "@/components/ui/icons";
import {
  getAssignedCoursesForClass,
  saveClassSchedule,
} from "@/app/actions/admin-classes";
import {
  DEFAULT_CLASS_TIMEZONE,
  PROGRAM_OPTIONS,
  getProgramLevels,
  normalizeClassProgram,
  normalizeRecurrenceRule,
} from "@/lib/api/admin-class-schedules-model";
import { cn } from "@/lib/utils";
import { useAdminDialogFocus } from "@/components/admin/use-admin-dialog-focus";
import type {
  AdminClassAssignedCourse,
  AdminClassListRow,
  AdminClassProgram,
  AdminClassSchedule,
  AdminClassSchedulesData,
  RecurrenceEndMode,
  RecurrenceFrequency,
  RecurrenceWeekday,
} from "@/lib/types/admin-classes";

const WEEKDAYS: Array<{ value: RecurrenceWeekday }> = [
  { value: "SU" }, { value: "MO" }, { value: "TU" }, { value: "WE" },
  { value: "TH" }, { value: "FR" }, { value: "SA" },
];

const PROGRAM_TONE: Record<AdminClassProgram, string> = {
  debate: "border-primary/25 bg-primary-container text-primary-dim",
  ielts: "border-info/25 bg-info-container text-info",
  public_speaking:
    "border-warning/25 bg-warning-container text-on-warning-container",
};

const PROGRAM_BAR: Record<AdminClassProgram, string> = {
  debate: "border-primary/35 bg-primary-container text-primary-dim",
  ielts: "border-info/35 bg-info-container text-info",
  public_speaking:
    "border-warning/35 bg-warning-container text-on-warning-container",
};

export function ClassProgramFields({
  defaultProgram = "debate",
  defaultLevel,
}: {
  defaultProgram?: AdminClassProgram | string | null;
  defaultLevel?: string | null;
}) {
  const t = useTranslations("admin.classes.schedule");
  const [program, setProgram] = useState<AdminClassProgram>(
    normalizeClassProgram(defaultProgram),
  );
  const levels = getProgramLevels(program);
  const resolvedLevel =
    defaultLevel && levels.includes(defaultLevel) ? defaultLevel : levels[0];
  const [level, setLevel] = useState(resolvedLevel);

  function selectProgram(nextProgram: AdminClassProgram) {
    setProgram(nextProgram);
    const nextLevels = getProgramLevels(nextProgram);
    setLevel((current) =>
      nextLevels.includes(current) ? current : nextLevels[0],
    );
  }

  return (
    <>
      <input type="hidden" name="programType" value={program} />
      <label className="sm:col-span-2">
        <span className="text-xs font-semibold text-on-surface-variant">
          {t("program")}
        </span>
        <div className="mt-1 grid grid-cols-3 overflow-hidden rounded-lg border border-outline-variant/40 bg-background">
          {PROGRAM_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => selectProgram(option.value)}
              className={cn(
                "flex h-12 items-center justify-center gap-2 border-r border-outline-variant/30 px-2 text-xs font-bold transition-all duration-200 last:border-r-0 hover:-translate-y-0.5 active:scale-[0.98] sm:text-sm",
                program === option.value
                  ? "bg-primary text-on-primary"
                  : "text-on-surface-variant hover:bg-surface-container",
              )}
            >
              {option.value === "debate" ? (
                <GraduationCap className="h-4 w-4" />
              ) : option.value === "ielts" ? (
                <BookOpen className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              <span className="truncate">{t(`programs.${option.value}`)}</span>
            </button>
          ))}
        </div>
      </label>
      <label>
        <span className="text-xs font-semibold text-on-surface-variant">
          {t("level")}
        </span>
        <select
          name="gradeLevel"
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
        >
          {levels.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

export function ScheduleEditor({
  classes,
  schedule,
  initialClassId,
  initialCourses = [],
  onClose,
}: {
  classes: AdminClassListRow[];
  schedule?: AdminClassSchedule | null;
  initialClassId?: string;
  initialCourses?: AdminClassAssignedCourse[];
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("admin.classes.schedule");
  const dialogRef = useAdminDialogFocus<HTMLFormElement>(true, onClose);
  const [isPending, startTransition] = useTransition();
  const today = new Date().toISOString().slice(0, 10);
  const [classId, setClassId] = useState(
    schedule?.classId ?? initialClassId ?? classes[0]?.id ?? "",
  );
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>(
    initialCourses.map((course) => ({
      id: course.courseId,
      title: course.title,
    })),
  );
  const [courseId, setCourseId] = useState(schedule?.courseId ?? "");
  const [title, setTitle] = useState(schedule?.title ?? "");
  const [room, setRoom] = useState(schedule?.room ?? "");
  const [startDate, setStartDate] = useState(schedule?.startDate ?? today);
  const [startTime, setStartTime] = useState(
    (schedule?.startTime ?? "16:00:00").slice(0, 5),
  );
  const [endTime, setEndTime] = useState(
    (schedule?.endTime ?? "17:30:00").slice(0, 5),
  );
  const [timezone, setTimezone] = useState(
    schedule?.timezone ?? DEFAULT_CLASS_TIMEZONE,
  );
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(
    schedule?.recurrenceRule.frequency ?? "weekly",
  );
  const [interval, setInterval] = useState(
    String(schedule?.recurrenceRule.interval ?? 1),
  );
  const [weekdays, setWeekdays] = useState<RecurrenceWeekday[]>(
    schedule?.recurrenceRule.weekdays ?? ["MO"],
  );
  const [endMode, setEndMode] = useState<RecurrenceEndMode>(
    schedule?.recurrenceRule.endMode ?? "on_date",
  );
  const [until, setUntil] = useState(
    schedule?.recurrenceRule.until ?? schedule?.endDate ?? today,
  );
  const [count, setCount] = useState(
    String(schedule?.recurrenceRule.count ?? 12),
  );

  useEffect(() => {
    if (!classId) return;
    let alive = true;
    getAssignedCoursesForClass(classId)
      .then((items) => {
        if (alive)
          setCourses(items.map((item) => ({ id: item.id, title: item.title })));
      })
      .catch(() => {
        if (alive) setCourses([]);
      });
    return () => {
      alive = false;
    };
  }, [classId]);

  const recurrenceRule = useMemo(
    () =>
      normalizeRecurrenceRule(
        {
          frequency,
          interval: Number(interval),
          weekdays,
          endMode,
          until,
          count: Number(count),
        },
        startDate,
      ),
    [count, endMode, frequency, interval, startDate, until, weekdays],
  );

  const locale = useLocale();
  const recurrenceSummary = formatRecurrenceSummary(recurrenceRule, startDate, t, locale);

  function toggleWeekday(day: RecurrenceWeekday) {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-scrim/30 backdrop-blur-sm sm:items-stretch" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            await saveClassSchedule({
              id: schedule?.id,
              classId,
              courseId: courseId || null,
              title,
              room,
              startDate,
              endDate: recurrenceRule.until,
              startTime,
              endTime,
              timezone,
              recurrenceRule,
            });
            onClose();
            router.refresh();
          });
        }}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-editor-title"
        className="flex max-h-[92dvh] w-full flex-col rounded-t-[10px] border border-outline-variant bg-surface shadow-lg sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-y-0 sm:border-r-0"
      >
        <div className="flex h-16 items-center justify-between border-b border-outline-variant/20 px-5">
          <div>
            <h2 id="schedule-editor-title" className="text-lg font-bold text-on-surface">
              {schedule ? t("editTitle") : t("newTitle")}
            </h2>
            <p className="text-xs text-on-surface-variant">
              {t("description")}
            </p>
          </div>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-on-surface-variant transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.98]"
          >
            {t("close")}
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block">
            <span className="text-xs font-semibold text-on-surface-variant">
              {t("class")}
            </span>
            <select
              value={classId}
              onChange={(event) => {
                setClassId(event.target.value);
                setCourseId("");
              }}
              required
              className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
            >
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({t(`programs.${item.programType}`)} -{" "}
                  {item.gradeLevel})
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-on-surface-variant">
              {t("courseOptional")}
            </span>
            <select
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
            >
              <option value="">{t("noCourse")}</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-on-surface-variant">
              {t("title")}
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              placeholder={t("titlePlaceholder")}
              className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-on-surface-variant">
              {t("roomLocation")}
            </span>
            <input
              value={room}
              onChange={(event) => setRoom(event.target.value)}
              placeholder={t("roomPlaceholder")}
              className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">
                {t("startDate")}
              </span>
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                required
                className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">
                {t("timezone")}
              </span>
              <select
                value={timezone}
                onChange={(event) => setTimezone(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="America/New_York">{t("timezones.newYork")}</option>
                <option value="Asia/Ho_Chi_Minh">{t("timezones.hoChiMinh")}</option>
                <option value="UTC">{t("timezones.utc")}</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">
                {t("startTime")}
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
                className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">
                {t("endTime")}
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                required
                className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          <div className="grid grid-cols-[1fr_112px] gap-3">
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">
                {t("repeat")}
              </span>
              <select
                value={frequency}
                onChange={(event) =>
                  setFrequency(event.target.value as RecurrenceFrequency)
                }
                className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
              >
                <option value="none">{t("frequency.none")}</option>
                <option value="daily">{t("frequency.daily")}</option>
                <option value="weekly">{t("frequency.weekly")}</option>
                <option value="monthly">{t("frequency.monthly")}</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">
                {t("every")}
              </span>
              <input
                type="number"
                min={1}
                max={99}
                value={interval}
                onChange={(event) => setInterval(event.target.value)}
                className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </label>
          </div>
          {frequency === "weekly" && (
            <div>
              <span className="text-xs font-semibold text-on-surface-variant">
                {t("repeatOn")}
              </span>
              <div className="mt-2 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={cn(
                      "h-9 rounded-lg border text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.96]",
                      weekdays.includes(day.value)
                        ? "border-primary bg-primary text-on-primary shadow-sm shadow-primary/20"
                        : "border-outline-variant/40 bg-background text-on-surface-variant hover:bg-surface-container",
                    )}
                  >
                    {t(`weekdays.${day.value}`)}
                  </button>
                ))}
              </div>
            </div>
          )}
          {frequency !== "none" && (
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className="text-xs font-semibold text-on-surface-variant">
                  {t("ends")}
                </span>
                <select
                  value={endMode}
                  onChange={(event) =>
                    setEndMode(event.target.value as RecurrenceEndMode)
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="never">{t("endMode.never")}</option>
                  <option value="on_date">{t("endMode.onDate")}</option>
                  <option value="after_occurrences">{t("endMode.afterCount")}</option>
                </select>
              </label>
              {endMode === "on_date" ? (
                <label>
                  <span className="text-xs font-semibold text-on-surface-variant">
                    {t("endDate")}
                  </span>
                  <input
                    type="date"
                    value={until}
                    onChange={(event) => setUntil(event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
              ) : endMode === "after_occurrences" ? (
                <label>
                  <span className="text-xs font-semibold text-on-surface-variant">
                    {t("occurrences")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={count}
                    onChange={(event) => setCount(event.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
                  />
                </label>
              ) : (
                <div className="mt-6 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-2 text-xs text-on-surface-variant">
                  {t("noEndDate")}
                </div>
              )}
            </div>
          )}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-primary">
            <div className="mb-1 flex items-center gap-2 font-bold">
              <Repeat2 className="h-4 w-4" />
              {t("summary")}
            </div>
            {recurrenceSummary}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-outline-variant/20 p-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-outline-variant/40 bg-background px-4 text-sm font-semibold text-on-surface transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.98]"
          >
            {t("cancel")}
          </button>
          <button
            disabled={isPending || !classId || !title}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-on-primary transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {isPending
              ? t("saving")
              : schedule
                ? t("save")
                : t("create")}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ScheduleTimeline({
  data,
  onNewSchedule,
  onEditSchedule,
  onDeleteSchedule,
}: {
  data: AdminClassSchedulesData;
  onNewSchedule?: () => void;
  onEditSchedule?: (schedule: AdminClassSchedule) => void;
  onDeleteSchedule?: (schedule: AdminClassSchedule) => void;
}) {
  const t = useTranslations("admin.classes.schedule");
  const locale = useLocale();
  const months = useMemo(
    () => buildMonthTicks(data.filters.rangeStart, data.filters.rangeEnd, locale),
    [data.filters.rangeEnd, data.filters.rangeStart, locale],
  );
  const schedulesById = new Map(
    data.schedules.map((schedule) => [schedule.id, schedule]),
  );
  const groups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        program: AdminClassProgram;
        level: string;
        classCount: number;
        schedules: AdminClassSchedule[];
      }
    >();
    for (const item of data.classes) {
      const key = `${item.programType}-${item.gradeLevel ?? t("level")}`;
      map.set(key, {
        key,
        program: item.programType,
        level: item.gradeLevel ?? t("level"),
        classCount: (map.get(key)?.classCount ?? 0) + 1,
        schedules: [],
      });
    }
    for (const schedule of data.schedules) {
      const key = `${schedule.classProgramType}-${schedule.classLevel ?? t("level")}`;
      const group = map.get(key) ?? {
        key,
        program: schedule.classProgramType,
        level: schedule.classLevel ?? t("level"),
        classCount: 0,
        schedules: [],
      };
      if (
        scheduleOverlapsRange(
          schedule,
          data.filters.rangeStart,
          data.filters.rangeEnd,
        )
      ) {
        group.schedules.push(schedule);
      }
      map.set(key, group);
    }
    return Array.from(map.values());
  }, [
    data.classes,
    data.filters.rangeEnd,
    data.filters.rangeStart,
    data.schedules,
    t,
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const todayPercent =
    today >= data.filters.rangeStart && today <= data.filters.rangeEnd
      ? timelinePosition(today, data.filters.rangeStart, data.filters.rangeEnd)
          .left
      : null;

  return (
    <section className="rounded-lg border border-outline-variant/30 bg-surface-container-lowest shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md">
      <div className="flex flex-col gap-3 border-b border-outline-variant/20 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold text-on-surface">
            {t("timeline.title")}
          </h2>
          <p className="text-sm text-on-surface-variant">
            {t("timeline.description")}
          </p>
        </div>
        {onNewSchedule && (
          <button
            onClick={onNewSchedule}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary shadow-sm shadow-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            {t("new")}
          </button>
        )}
      </div>
      <div className="hidden overflow-x-auto lg:block">
        <div className="min-w-[980px]">
          <div
            className="grid border-b border-outline-variant/20 bg-surface-container text-xs font-semibold text-on-surface-variant"
            style={{ gridTemplateColumns: "220px 1fr" }}
          >
            <div className="px-4 py-3">{t("programLevel")}</div>
            <div
              className="relative grid"
              style={{
                gridTemplateColumns: `repeat(${months.length}, minmax(120px, 1fr))`,
              }}
            >
              {months.map((month) => (
                <div
                  key={month.key}
                  className="border-l border-outline-variant/15 px-3 py-3"
                >
                  <div className="text-sm font-bold text-on-surface">
                    {month.label}
                  </div>
                  <div>{month.year}</div>
                </div>
              ))}
              {todayPercent != null && (
                <div
                  className="pointer-events-none absolute bottom-0 top-0 w-px bg-primary"
                  style={{ left: `${todayPercent}%` }}
                >
                  <span className="absolute left-1/2 top-1 -translate-x-1/2 rounded-md bg-primary px-2 py-1 type-caption font-bold text-on-primary shadow-sm">
                    {t("today")}
                  </span>
                </div>
              )}
            </div>
          </div>
          {groups.map((group) => {
            const laneHeight = Math.max(96, group.schedules.length * 52 + 36);
            return (
              <div
                key={group.key}
                className="grid border-b border-outline-variant/15 last:border-b-0"
                style={{ gridTemplateColumns: "220px 1fr" }}
              >
                <div className="flex items-center gap-3 border-r border-outline-variant/20 px-4 py-4">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border",
                      PROGRAM_TONE[group.program],
                    )}
                  >
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-bold text-on-surface">
                      {t(`programs.${group.program}`)}
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      {group.level} · {t("timeline.classes", { count: group.classCount })}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {t("timeline.schedules", { count: group.schedules.length })}
                    </p>
                  </div>
                </div>
                <div className="relative" style={{ minHeight: laneHeight }}>
                  <div
                    className="absolute inset-0 grid"
                    style={{
                      gridTemplateColumns: `repeat(${months.length}, minmax(120px, 1fr))`,
                    }}
                  >
                    {months.map((month) => (
                      <div
                        key={month.key}
                        className="border-l border-outline-variant/15"
                      />
                    ))}
                  </div>
                  {todayPercent != null && (
                    <div
                      className="absolute bottom-0 top-0 w-px bg-primary/70"
                      style={{ left: `${todayPercent}%` }}
                    />
                  )}
                  {group.schedules.length === 0 ? (
                    <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg border border-dashed border-outline-variant/30 bg-background/70 px-3 py-3 text-sm text-on-surface-variant">
                      {t("timeline.empty")}
                    </div>
                  ) : (
                    group.schedules.map((schedule, index) => {
                      const position = timelinePosition(
                        schedule.startDate,
                        data.filters.rangeStart,
                        data.filters.rangeEnd,
                        schedule.endDate,
                      );
                      return (
                        <button
                          key={schedule.id}
                          type="button"
                          onClick={() => onEditSchedule?.(schedule)}
                          className={cn(
                            "absolute h-10 rounded-lg border px-3 text-left text-xs shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.995]",
                            PROGRAM_BAR[schedule.classProgramType],
                          )}
                          style={{
                            left: `${position.left}%`,
                            top: `${20 + index * 52}px`,
                            width: `${position.width}%`,
                            minWidth: 170,
                          }}
                        >
                          <span className="flex h-full items-center justify-between gap-3">
                            <span className="min-w-0">
                              <span className="block truncate font-bold">
                                {schedule.title}
                              </span>
                              <span className="block truncate">
                                {formatTime(`2000-01-01T${schedule.startTime}`, locale)}{" "}
                                - {formatTime(`2000-01-01T${schedule.endTime}`, locale)}{" "}
                                · {formatRecurrenceSummary(schedule.recurrenceRule, schedule.startDate, t, locale)}
                              </span>
                            </span>
                            <span className="shrink-0 rounded bg-surface-container-lowest/80 px-2 py-1">
                              {schedule.room ?? schedule.courseTitle ?? t("class")}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid gap-3 p-4 lg:hidden">
        {data.occurrences.length === 0 ? (
          <p className="rounded-lg border border-dashed border-outline-variant/30 px-3 py-10 text-center text-sm text-on-surface-variant">
            {t("timeline.mobileEmpty")}
          </p>
        ) : (
          data.occurrences.map((item) => {
            const schedule = schedulesById.get(item.scheduleId);
            return (
              <div
                key={item.id}
                className={cn(
                  "rounded-lg border p-3",
                  PROGRAM_BAR[item.classProgramType],
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold">{item.title}</p>
                    <p className="text-xs">
                      {formatDate(item.date, locale)} · {formatTime(item.startsAt, locale)} -{" "}
                      {formatTime(item.endsAt, locale)}
                    </p>
                    <p className="mt-1 text-xs">
                      {item.classTitle} ·{" "}
                      {t(`programs.${item.classProgramType}`)} {item.classLevel}
                    </p>
                  </div>
                  {schedule && (
                    <button
                      onClick={() => onEditSchedule?.(schedule)}
                      className="rounded-lg bg-surface-container-lowest/80 px-2 py-1 text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container-lowest active:scale-[0.98]"
                    >
                      {t("edit")}
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  {item.courseTitle && (
                    <span className="rounded bg-surface-container-lowest/80 px-2 py-1">
                      {item.courseTitle}
                    </span>
                  )}
                  {item.room && (
                    <span className="rounded bg-surface-container-lowest/80 px-2 py-1">
                      {item.room}
                    </span>
                  )}
                  <span className="rounded bg-surface-container-lowest/80 px-2 py-1">
                    {schedule ? formatRecurrenceSummary(schedule.recurrenceRule, schedule.startDate, t, locale) : item.recurrenceSummary}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
      {onDeleteSchedule && data.schedules.length > 0 && (
        <div className="border-t border-outline-variant/20 p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            {t("manage")}
          </p>
          <div className="flex flex-wrap gap-2">
            {data.schedules.map((schedule) => (
              <button
                key={schedule.id}
                onClick={() => onDeleteSchedule(schedule)}
                className="inline-flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-background px-3 py-2 text-xs font-semibold text-on-surface-variant transition-all duration-200 hover:-translate-y-0.5 hover:border-error/30 hover:bg-error-container hover:text-error-dim active:scale-[0.98]"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t("archive", { title: schedule.title })}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export function ScheduleRangeControls({
  data,
}: {
  data: AdminClassSchedulesData;
}) {
  const t = useTranslations("admin.classes.schedule");
  const prevStart = shiftDate(data.filters.rangeStart, -28);
  const prevEnd = shiftDate(data.filters.rangeEnd, -28);
  const nextStart = shiftDate(data.filters.rangeStart, 28);
  const nextEnd = shiftDate(data.filters.rangeEnd, 28);
  return (
    <form className="grid gap-3 rounded-lg border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm transition-all duration-200 hover:border-primary/15 hover:shadow-md lg:grid-cols-[1fr_1fr_180px_180px_auto]">
      <label className="flex h-11 items-center gap-2 rounded-lg border border-outline-variant/40 bg-background px-3 text-sm">
        <CalendarDays className="h-4 w-4 text-primary" />
        <input
          type="date"
          name="start"
          defaultValue={data.filters.rangeStart}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      <label className="flex h-11 items-center gap-2 rounded-lg border border-outline-variant/40 bg-background px-3 text-sm">
        <CalendarDays className="h-4 w-4 text-primary" />
        <input
          type="date"
          name="end"
          defaultValue={data.filters.rangeEnd}
          className="min-w-0 flex-1 bg-transparent outline-none"
        />
      </label>
      <select
        name="program"
        defaultValue={data.filters.program}
        className="h-11 rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
      >
        <option value="all">{t("allPrograms")}</option>
        {PROGRAM_OPTIONS.map((program) => (
          <option key={program.value} value={program.value}>
            {t(`programs.${program.value}`)}
          </option>
        ))}
      </select>
      <select
        name="level"
        defaultValue={data.filters.level}
        className="h-11 rounded-lg border border-outline-variant/40 bg-background px-3 text-sm outline-none focus:border-primary"
      >
        <option value="all">{t("allLevels")}</option>
        {Array.from(
          new Set(PROGRAM_OPTIONS.flatMap((program) => program.levels)),
        ).map((level) => (
          <option key={level} value={level}>
            {level}
          </option>
        ))}
      </select>
      <div className="flex gap-2">
        <a
          href={`?view=schedules&start=${prevStart}&end=${prevEnd}`}
          aria-label={t("previousRange")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-outline-variant/40 bg-background transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.98]"
        >
          <ChevronLeft className="h-4 w-4" />
        </a>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant/40 bg-background px-4 text-sm font-semibold text-on-surface transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.98]">
          <Filter className="h-4 w-4" />
          {t("filters")}
        </button>
        <a
          href={`?view=schedules&start=${nextStart}&end=${nextEnd}`}
          aria-label={t("nextRange")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-outline-variant/40 bg-background transition-all duration-200 hover:-translate-y-0.5 hover:bg-surface-container active:scale-[0.98]"
        >
          <ChevronRight className="h-4 w-4" />
        </a>
      </div>
      <input type="hidden" name="view" value="schedules" />
    </form>
  );
}

function buildMonthTicks(start: string, end: string, locale: string) {
  const ticks: Array<{ key: string; label: string; year: string }> = [];
  const current = new Date(`${start}T00:00:00`);
  current.setDate(1);
  const last = new Date(`${end}T00:00:00`);
  while (current <= last && ticks.length < 14) {
    ticks.push({
      key: current.toISOString().slice(0, 7),
      label: current.toLocaleDateString(locale, { month: "short" }),
      year: current.toLocaleDateString(locale, { year: "numeric" }),
    });
    current.setMonth(current.getMonth() + 1);
  }
  return ticks.length
    ? ticks
    : [{ key: start.slice(0, 7), label: formatDate(start, locale), year: "" }];
}

function formatDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

function formatTime(value: string, locale: string) {
  const time = value.slice(11, 16);
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatRecurrenceSummary(
  rule: AdminClassSchedule["recurrenceRule"],
  startDate: string,
  t: (key: string) => string,
  locale: string,
) {
  if (rule.frequency === "none") return t("frequency.none");
  const cadence = rule.interval > 1
    ? `${t("every")} ${rule.interval} ${t(`units.${rule.frequency === "daily" ? "days" : rule.frequency === "weekly" ? "weeks" : "months"}`)}`
    : t(`frequency.${rule.frequency}`);
  const weekdayText = rule.frequency === "weekly" && rule.weekdays.length
    ? ` ${t("on")} ${rule.weekdays.map((day) => t(`weekdays.${day}`)).join(", ")}`
    : "";
  const endText = rule.endMode === "on_date" && rule.until
    ? ` ${t("until")} ${formatDate(rule.until, locale)}`
    : rule.endMode === "after_occurrences" && rule.count
      ? ` ${t("for")} ${rule.count} ${t(rule.count === 1 ? "occurrence" : "occurrences")}`
      : "";
  return `${cadence}${weekdayText} ${t("from")} ${formatDate(startDate, locale)}${endText}`;
}

function shiftDate(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function scheduleOverlapsRange(
  schedule: AdminClassSchedule,
  rangeStart: string,
  rangeEnd: string,
) {
  const scheduleEnd = schedule.endDate ?? schedule.startDate;
  return schedule.startDate <= rangeEnd && scheduleEnd >= rangeStart;
}

function timelinePosition(
  startDate: string,
  rangeStart: string,
  rangeEnd: string,
  endDate?: string | null,
) {
  const rangeDays = Math.max(1, dayDiff(rangeStart, rangeEnd) + 1);
  const visibleStart = startDate < rangeStart ? rangeStart : startDate;
  const rawEnd = endDate ?? startDate;
  const visibleEnd = rawEnd > rangeEnd ? rangeEnd : rawEnd;
  const startOffset = Math.max(0, dayDiff(rangeStart, visibleStart));
  const endOffset = Math.min(rangeDays, dayDiff(rangeStart, visibleEnd) + 1);
  const spanDays = Math.max(1, endOffset - startOffset);
  return {
    left: (startOffset / rangeDays) * 100,
    width: Math.max(6, (spanDays / rangeDays) * 100),
  };
}

function dayDiff(start: string, end: string) {
  const startTime = new Date(`${start}T00:00:00`).getTime();
  const endTime = new Date(`${end}T00:00:00`).getTime();
  return Math.round((endTime - startTime) / 86_400_000);
}
