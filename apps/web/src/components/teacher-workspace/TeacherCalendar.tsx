"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDashed,
  ClipboardList,
  Clock3,
  Highlighter,
  MapPin,
  Megaphone,
  RefreshCw,
  Sun,
  Users,
  X,
  type LucideIcon,
} from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  TeacherCalendarEvent,
  TeacherCalendarStatus,
  TeacherCalendarView,
  TeacherClassColorToken,
} from "@/lib/api/class-lms/teacher-calendar-model";
import {
  canMutateTeacherCalendarEvent,
  isTeacherCalendarView,
  zonedWallClockToUtc,
} from "@/lib/api/class-lms/teacher-calendar-model";
import {
  calendarEventGeometry,
  dateInTimezone,
  layoutTeacherEventLanes,
  minutesInTimezone,
} from "@/lib/teacher-workspace/calendar-layout";
import type {
  TeacherEventDetailPresentation,
  TeacherWorkspacePresentation,
} from "@/lib/teacher-workspace/presentation";
import { cn } from "@/lib/utils";
import {
  rescheduleTeacherWorkspaceEvent,
  rescheduleTeacherWorkspaceOccurrence,
  setTeacherWorkspaceEventState,
} from "@/app/actions/teacher-workspace-calendar";
import styles from "./teacher-calendar.module.css";

const GRID_START_MINUTE = 8 * 60;
const GRID_END_MINUTE = 20 * 60;
const HOUR_HEIGHT = 64;
const DAY_MS = 86_400_000;
const COMPACT_CALENDAR_QUERY = "(max-width: 900px)";

function subscribeToCompactCalendar(callback: () => void) {
  const query = window.matchMedia(COMPACT_CALENDAR_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function compactCalendarSnapshot() {
  return window.matchMedia(COMPACT_CALENDAR_QUERY).matches;
}

const WEEKEND_STORAGE_KEY = "thinkfy.teacher.calendar.weekend.v1";
const weekendListeners = new Set<() => void>();

function subscribeToWeekendPreference(callback: () => void) {
  weekendListeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    weekendListeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}

function weekendPreferenceSnapshot() {
  try {
    return window.localStorage.getItem(WEEKEND_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeWeekendPreference(next: boolean) {
  try {
    window.localStorage.setItem(WEEKEND_STORAGE_KEY, String(next));
  } catch {
    // Weekdays-only stays the default when storage is unavailable.
  }
  for (const listener of weekendListeners) listener();
}

const CLASS_COLORS: Record<
  TeacherClassColorToken,
  { background: string; foreground: string; border: string }
> = {
  blue: {
    background: "var(--teacher-class-blue-bg)",
    foreground: "var(--teacher-class-blue-fg)",
    border: "var(--teacher-class-blue-border)",
  },
  teal: {
    background: "var(--teacher-class-teal-bg)",
    foreground: "var(--teacher-class-teal-fg)",
    border: "var(--teacher-class-teal-border)",
  },
  amber: {
    background: "var(--teacher-class-amber-bg)",
    foreground: "var(--teacher-class-amber-fg)",
    border: "var(--teacher-class-amber-border)",
  },
  coral: {
    background: "var(--teacher-class-coral-bg)",
    foreground: "var(--teacher-class-coral-fg)",
    border: "var(--teacher-class-coral-border)",
  },
  violet: {
    background: "var(--teacher-class-violet-bg)",
    foreground: "var(--teacher-class-violet-fg)",
    border: "var(--teacher-class-violet-border)",
  },
  pink: {
    background: "var(--teacher-class-pink-bg)",
    foreground: "var(--teacher-class-pink-fg)",
    border: "var(--teacher-class-pink-border)",
  },
  slate: {
    background: "var(--teacher-class-slate-bg)",
    foreground: "var(--teacher-class-slate-fg)",
    border: "var(--teacher-class-slate-border)",
  },
};

function addDays(value: string, days: number) {
  return new Date(new Date(`${value}T12:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

function dateParts(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

function startOfMonth(value: string) {
  const { year, month } = dateParts(value);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function shiftMonth(value: string, amount: number) {
  const { year, month } = dateParts(value);
  return new Date(Date.UTC(year, month - 1 + amount, 1))
    .toISOString()
    .slice(0, 10);
}

function shiftMonthKeepingDay(value: string, amount: number) {
  const { year, month, day } = dateParts(value);
  const lastDay = new Date(Date.UTC(year, month + amount, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + amount, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

function startOfWeek(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return addDays(value, -mondayOffset);
}

function formatDate(
  value: string,
  locale: string,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(locale, options).format(
    new Date(`${value}T12:00:00Z`),
  );
}

function formatTime(value: string, locale: string, timezone: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function localDateTimeValue(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function teacherHref(path: string, demo: boolean) {
  if (!demo) return path;
  return `${path}${path.includes("?") ? "&" : "?"}demo=teacher`;
}

function eventActionHref(
  detail: TeacherEventDetailPresentation | undefined,
  action: keyof TeacherEventDetailPresentation["actionUrls"],
  fallback: string,
  demo: boolean,
) {
  return teacherHref(detail?.actionUrls[action] ?? fallback, demo);
}

function statusLabel(status: TeacherCalendarStatus, vi: boolean) {
  const labels = vi
    ? {
        scheduled: "Đã lên lịch",
        completed: "Hoàn tất",
        cancelled: "Đã hủy",
        archived: "Lưu trữ",
      }
    : {
        scheduled: "Scheduled",
        completed: "Completed",
        cancelled: "Cancelled",
        archived: "Archived",
      };
  return labels[status];
}

function plannedLabel(event: TeacherCalendarEvent, vi: boolean) {
  return event.occurrenceId
    ? vi
      ? "Đã soạn bài"
      : "Planned"
    : vi
      ? "Chưa soạn bài"
      : "Unplanned";
}

function attendanceLabel(
  value: "present" | "late" | "absent" | "unmarked" | "recorded",
  vi: boolean,
) {
  if (!vi) return value;
  return {
    present: "có mặt",
    late: "đi muộn",
    absent: "vắng mặt",
    unmarked: "chưa ghi nhận",
    recorded: "đã ghi nhận",
  }[value];
}

function materialKindLabel(value: string, vi: boolean) {
  if (!vi) return value;
  return (
    {
      document: "tài liệu",
      video: "video",
      link: "liên kết",
      worksheet: "phiếu bài tập",
    }[value] ?? value
  );
}

function lessonCountLabel(count: number, vi: boolean) {
  if (vi) return `${count} buổi học`;
  return `${count} ${count === 1 ? "lesson" : "lessons"}`;
}

function viewLabel(view: TeacherCalendarView, vi: boolean) {
  if (!vi)
    return { day: "Day", week: "Week", month: "Month", agenda: "Agenda" }[view];
  return {
    day: "Ngày",
    week: "Tuần",
    month: "Tháng",
    agenda: "Danh sách",
  }[view];
}

function rangeTitle(
  view: TeacherCalendarView,
  anchor: string,
  locale: string,
  weekLength = 7,
) {
  if (view === "day") {
    return formatDate(anchor, locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
  if (view === "month")
    return formatDate(anchor, locale, { month: "long", year: "numeric" });
  const start = startOfWeek(anchor);
  const end = addDays(start, weekLength - 1);
  return `${formatDate(start, locale, { month: "short", day: "numeric" })} – ${formatDate(end, locale, { month: "short", day: "numeric", year: "numeric" })}`;
}

function eventStyle(colorToken: TeacherClassColorToken): CSSProperties {
  const color = CLASS_COLORS[colorToken];
  return {
    "--event-bg": color.background,
    "--event-fg": color.foreground,
    "--event-border": color.border,
  } as CSSProperties;
}

const CLASS_COLOR_LABELS: Record<
  TeacherClassColorToken,
  { en: string; vi: string }
> = {
  blue: { en: "Blue", vi: "Xanh dương" },
  teal: { en: "Teal", vi: "Xanh ngọc" },
  amber: { en: "Amber", vi: "Hổ phách" },
  coral: { en: "Coral", vi: "San hô" },
  violet: { en: "Violet", vi: "Tím" },
  pink: { en: "Pink", vi: "Hồng" },
  slate: { en: "Slate", vi: "Xám" },
};

const PILL_CLASS =
  "inline-flex h-8 max-w-56 items-center gap-1.5 rounded-full border border-outline-variant bg-surface pl-2.5 pr-2 type-label font-medium text-on-surface transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary data-[popup-open]:bg-surface-container";

type CalendarSelectOption = {
  value: string;
  label: string;
  dot?: string;
};

/** Pill filter control: leading icon, current label, trailing chevron. */
function CalendarSelect({
  icon: Icon,
  label,
  value,
  options,
  onChange,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  options: CalendarSelectOption[];
  onChange: (value: string) => void;
}) {
  const current =
    options.find((option) => option.value === value) ?? options[0];
  if (!current) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={PILL_CLASS}
        aria-label={`${label}: ${current.label}`}
      >
        {current.dot ? (
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: current.dot }}
            aria-hidden="true"
          />
        ) : (
          <Icon
            className="size-4 shrink-0 text-on-surface-variant"
            aria-hidden="true"
          />
        )}
        <span className="truncate">{current.label}</span>
        <ChevronDown
          className="size-3.5 shrink-0 text-on-surface-variant"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-auto min-w-52 max-w-72">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(next) => onChange(String(next))}
        >
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              closeOnClick
              className="type-label py-1.5"
            >
              {option.dot ? (
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: option.dot }}
                  aria-hidden="true"
                />
              ) : null}
              <span className="truncate">{option.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Month grid inside a popover, replacing the browser-drawn date input. */
function CalendarDatePicker({
  value,
  locale,
  timezone,
  onChange,
}: {
  value: string;
  locale: string;
  timezone: string;
  onChange: (value: string) => void;
}) {
  const vi = locale === "vi";
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => startOfMonth(value));
  const [focusDate, setFocusDate] = useState(value);
  const [focusRequest, setFocusRequest] = useState<{
    date: string;
    tick: number;
  } | null>(null);
  const handledTickRef = useRef(0);
  const today = dateInTimezone(new Date(), timezone);
  const monthLabelId = `teacher-calendar-datepicker-${value}`;

  const gridStart = addDays(
    month,
    -((new Date(`${month}T12:00:00Z`).getUTCDay() + 6) % 7),
  );
  const weeks = Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => addDays(gridStart, week * 7 + day)),
  );
  const weekdayHeads = Array.from({ length: 7 }, (_, index) =>
    addDays("2026-08-31", index),
  );

  function moveFocus(next: string) {
    setFocusDate(next);
    setMonth(startOfMonth(next));
    setFocusRequest((current) => ({
      date: next,
      tick: (current?.tick ?? 0) + 1,
    }));
  }

  /** Header arrows: keep the roving tab target inside the visible month. */
  function changeMonth(amount: number) {
    setMonth(shiftMonth(month, amount));
    setFocusDate(shiftMonthKeepingDay(focusDate, amount));
  }

  function handleKeyDown(keyEvent: ReactKeyboardEvent<HTMLDivElement>) {
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const step = steps[keyEvent.key];
    if (step !== undefined) {
      keyEvent.preventDefault();
      moveFocus(addDays(focusDate, step));
      return;
    }
    if (keyEvent.key === "Home") {
      keyEvent.preventDefault();
      moveFocus(startOfWeek(focusDate));
      return;
    }
    if (keyEvent.key === "End") {
      keyEvent.preventDefault();
      moveFocus(addDays(startOfWeek(focusDate), 6));
      return;
    }
    if (keyEvent.key === "PageUp" || keyEvent.key === "PageDown") {
      keyEvent.preventDefault();
      moveFocus(
        shiftMonthKeepingDay(focusDate, keyEvent.key === "PageUp" ? -1 : 1),
      );
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setMonth(startOfMonth(value));
          setFocusDate(value);
          setFocusRequest((current) => ({
            date: value,
            tick: (current?.tick ?? 0) + 1,
          }));
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger
        className={PILL_CLASS}
        aria-label={`${vi ? "Chuyển đến ngày" : "Jump to date"}: ${formatDate(
          value,
          locale,
          { day: "numeric", month: "long", year: "numeric" },
        )}`}
      >
        <CalendarDays
          className="size-4 shrink-0 text-on-surface-variant"
          aria-hidden="true"
        />
        <span className="truncate tabular-nums">
          {formatDate(value, locale, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
        <ChevronDown
          className="size-3.5 shrink-0 text-on-surface-variant"
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent align="start" showArrow={false} className="w-auto p-3">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => changeMonth(-1)}
            aria-label={vi ? "Tháng trước" : "Previous month"}
          >
            <ChevronLeft />
          </Button>
          <span
            id={monthLabelId}
            aria-live="polite"
            className="type-label font-semibold text-on-surface"
          >
            {formatDate(month, locale, { month: "long", year: "numeric" })}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => changeMonth(1)}
            aria-label={vi ? "Tháng sau" : "Next month"}
          >
            <ChevronRight />
          </Button>
        </div>
        <div
          role="grid"
          aria-labelledby={monthLabelId}
          onKeyDown={handleKeyDown}
          className="mt-2"
        >
          <div role="row" className="grid grid-cols-7">
            {weekdayHeads.map((day) => (
              <span
                key={day}
                role="columnheader"
                aria-label={formatDate(day, locale, { weekday: "long" })}
                className="grid h-7 place-items-center type-caption font-semibold uppercase text-on-surface-variant"
              >
                {formatDate(day, locale, { weekday: "narrow" })}
              </span>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week[0]} role="row" className="grid grid-cols-7">
              {week.map((day) => {
                const selected = day === value;
                const outside = dateParts(day).month !== dateParts(month).month;
                return (
                  <button
                    key={day}
                    // The popup mounts asynchronously and a month change
                    // remounts every cell, so focus is placed at attach time
                    // rather than from an effect. Month arrows leave the
                    // request untouched and so keep their own focus.
                    ref={(node) => {
                      if (
                        node &&
                        focusRequest?.date === day &&
                        focusRequest.tick !== handledTickRef.current
                      ) {
                        handledTickRef.current = focusRequest.tick;
                        node.focus();
                      }
                    }}
                    type="button"
                    role="gridcell"
                    data-day={day}
                    aria-selected={selected}
                    aria-current={day === today ? "date" : undefined}
                    aria-label={formatDate(day, locale, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    tabIndex={day === focusDate ? 0 : -1}
                    onClick={() => {
                      onChange(day);
                      setOpen(false);
                    }}
                    className={cn(
                      "m-0.5 grid size-8 place-items-center rounded-full type-label tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      outside
                        ? "text-on-surface-variant opacity-60"
                        : "text-on-surface",
                      !selected && "hover:bg-surface-container-high",
                      day === today &&
                        !selected &&
                        "font-semibold text-primary",
                      selected && "bg-primary font-semibold text-on-primary",
                    )}
                  >
                    {formatDate(day, locale, { day: "numeric" })}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** One grouped control with a single filled selection. */
function CalendarViewSwitcher({
  value,
  options,
  label,
  vi,
  onChange,
  className,
}: {
  value: TeacherCalendarView;
  options: readonly TeacherCalendarView[];
  label: string;
  vi: boolean;
  onChange: (value: TeacherCalendarView) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "items-center gap-0.5 rounded-control border border-outline-variant bg-surface-container p-0.5",
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            className={cn(
              "h-7 rounded-md px-2.5 type-label transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              active
                ? "bg-primary font-semibold text-on-primary"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {viewLabel(option, vi)}
          </button>
        );
      })}
    </div>
  );
}

function EmptyCalendar({ vi }: { vi: boolean }) {
  return (
    <div
      className="grid min-h-72 place-items-center px-6 py-12 text-center"
      role="status"
    >
      <div>
        <CalendarDays
          className="mx-auto size-9 text-on-surface-variant"
          aria-hidden="true"
        />
        <h3 className="mt-3 type-body font-semibold text-on-surface">
          {vi ? "Không có buổi học phù hợp" : "No matching lessons"}
        </h3>
        <p className="mt-1 max-w-md type-body-sm text-on-surface-variant">
          {vi
            ? "Hãy xóa bộ lọc hoặc chuyển sang ngày khác."
            : "Clear a filter or move to another date to see scheduled classes."}
        </p>
      </div>
    </div>
  );
}

function AgendaView({
  events,
  locale,
  timezone,
  idPrefix,
  onSelect,
}: {
  events: TeacherCalendarEvent[];
  locale: string;
  timezone: string;
  idPrefix: string;
  onSelect: (event: TeacherCalendarEvent, trigger: HTMLButtonElement) => void;
}) {
  const vi = locale === "vi";
  const dates = [...new Set(events.map((event) => event.date))].sort();
  if (!events.length) return <EmptyCalendar vi={vi} />;
  return (
    <div className={cn(styles.agendaList, "p-3 sm:p-4")}>
      {dates.map((date) => (
        <section
          key={date}
          className={styles.agendaDay}
          aria-labelledby={`${idPrefix}-agenda-${date}`}
        >
          <div className={styles.agendaDate}>
            <p
              id={`${idPrefix}-agenda-${date}`}
              className="type-label font-semibold uppercase text-on-surface-variant"
            >
              {formatDate(date, locale, { weekday: "long" })}
            </p>
            <p className="type-body font-semibold text-on-surface">
              {formatDate(date, locale, { month: "short", day: "numeric" })}
            </p>
          </div>
          <div className="grid gap-2">
            {events
              .filter((event) => event.date === date)
              .sort(
                (a, b) =>
                  a.startsAt.localeCompare(b.startsAt) ||
                  a.id.localeCompare(b.id),
              )
              .map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={(clickEvent) =>
                    onSelect(event, clickEvent.currentTarget)
                  }
                  className="flex min-h-16 w-full items-start gap-3 rounded-control border border-outline-variant bg-surface-container-low p-3 text-left transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="w-20 shrink-0 type-caption font-semibold tabular-nums text-on-surface">
                    {formatTime(event.startsAt, locale, timezone)}
                    <span className="mt-0.5 block font-normal text-on-surface-variant">
                      {formatTime(event.endsAt, locale, timezone)}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block type-label font-semibold text-on-surface">
                      {event.title}
                    </span>
                    <span className="mt-0.5 block type-caption text-on-surface-variant">
                      {event.classTitle} · {statusLabel(event.status, vi)} ·{" "}
                      {plannedLabel(event, vi)}
                    </span>
                  </span>
                  <span
                    className="mt-1 size-3 shrink-0 rounded-full border-2 border-surface"
                    style={{
                      backgroundColor: CLASS_COLORS[event.colorToken].border,
                    }}
                    aria-hidden="true"
                  />
                </button>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TimeGrid({
  days,
  events,
  locale,
  timezone,
  onSelect,
}: {
  days: string[];
  events: TeacherCalendarEvent[];
  locale: string;
  timezone: string;
  onSelect: (event: TeacherCalendarEvent, trigger: HTMLButtonElement) => void;
}) {
  const vi = locale === "vi";
  const today = dateInTimezone(new Date(), timezone);
  const nowMinutes = minutesInTimezone(new Date(), timezone);
  const hourOffsets = Array.from(
    { length: 13 },
    (_, index) => index * HOUR_HEIGHT,
  );
  const halfHourOffsets = Array.from(
    { length: 12 },
    (_, index) => index * HOUR_HEIGHT + HOUR_HEIGHT / 2,
  );
  const showNow =
    days.includes(today) &&
    nowMinutes >= GRID_START_MINUTE &&
    nowMinutes <= GRID_END_MINUTE;
  const canvasStyle = {
    "--calendar-days": days.length,
  } as CSSProperties;
  return (
    <div className={styles.scrollRegion} data-calendar-scroll-region>
      <div
        className={days.length === 1 ? styles.dayCanvas : styles.calendarCanvas}
        style={canvasStyle}
      >
        <div
          className={cn(styles.sharedGrid, styles.headerGrid)}
          data-calendar-header-grid
        >
          <div className={styles.timezoneCell}>
            {timezone.split("/").at(-1)?.replaceAll("_", " ")}
          </div>
          {days.map((day) => {
            const dayEvents = events.filter((event) => event.date === day);
            return (
              <div
                key={day}
                className={styles.dayHeader}
                data-today={day === today}
                data-calendar-day-header={day}
              >
                <span className={styles.dayNumeral}>
                  {formatDate(day, locale, { day: "numeric" })}
                </span>
                <span className={styles.dayWeekday}>
                  {formatDate(day, locale, { weekday: "short" })}
                </span>
                <span className={styles.dayCount}>
                  <span aria-hidden="true">{dayEvents.length}</span>
                  <span className="sr-only">
                    {lessonCountLabel(dayEvents.length, vi)}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
        <div
          className={cn(styles.sharedGrid, styles.bodyGrid)}
          data-calendar-body-grid
        >
          <div className={styles.timeGutter} data-calendar-time-gutter>
            {hourOffsets.map((top, index) => (
              <span
                key={top}
                className={styles.timeLabel}
                style={{ top }}
                data-calendar-time-label={GRID_START_MINUTE + index * 60}
              >
                {new Intl.DateTimeFormat(locale, {
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: "UTC",
                }).format(new Date(Date.UTC(2026, 0, 1, 8 + index)))}
              </span>
            ))}
          </div>
          {days.map((day) => {
            const positioned = layoutTeacherEventLanes(
              events.filter((event) => event.date === day),
              timezone,
            );
            return (
              <div
                key={day}
                className={styles.dayColumn}
                data-today={day === today}
                data-calendar-day-column={day}
              >
                {hourOffsets.map((top, index) => (
                  <span
                    key={`h-${top}`}
                    className={styles.hourLine}
                    style={{ top }}
                    data-calendar-grid-line={GRID_START_MINUTE + index * 60}
                  />
                ))}
                {halfHourOffsets.map((top) => (
                  <span
                    key={`hh-${top}`}
                    className={styles.halfHourLine}
                    style={{ top }}
                  />
                ))}
                {positioned.map((entry) => {
                  const geometry = calendarEventGeometry({
                    startMinute: entry.startMinute,
                    endMinute: entry.endMinute,
                    gridStartMinute: GRID_START_MINUTE,
                    gridEndMinute: GRID_END_MINUTE,
                    hourHeight: HOUR_HEIGHT,
                  });
                  const laneGap = 3;
                  const laneWidth = 100 / entry.laneCount;
                  return (
                    <button
                      key={entry.event.id}
                      type="button"
                      className={styles.eventButton}
                      data-calendar-event={entry.event.id}
                      data-status={entry.event.status}
                      data-start-minute={entry.startMinute}
                      data-end-minute={entry.endMinute}
                      onClick={(clickEvent) =>
                        onSelect(entry.event, clickEvent.currentTarget)
                      }
                      style={{
                        ...eventStyle(entry.event.colorToken),
                        top: geometry.top,
                        height: geometry.height,
                        left: `calc(${entry.lane * laneWidth}% + ${laneGap}px)`,
                        width: `calc(${laneWidth}% - ${laneGap + 2}px)`,
                      }}
                      aria-label={`${entry.event.classTitle}, ${entry.event.title}, ${formatTime(entry.event.startsAt, locale, timezone)} to ${formatTime(entry.event.endsAt, locale, timezone)}, ${statusLabel(entry.event.status, vi)}`}
                    >
                      <span className={styles.eventHeadline}>
                        <span className={styles.eventTime}>
                          {formatTime(entry.event.startsAt, locale, timezone)}
                        </span>
                        <span className={styles.eventTitle}>
                          {entry.event.title}
                        </span>
                      </span>
                      <span className={styles.eventMeta}>
                        {entry.event.classTitle} ·{" "}
                        {plannedLabel(entry.event, vi)}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          {showNow ? (
            <div
              className={styles.currentTime}
              style={{
                top: ((nowMinutes - GRID_START_MINUTE) / 60) * HOUR_HEIGHT,
              }}
              role="img"
              aria-label={vi ? "Thời gian hiện tại" : "Current time"}
              data-calendar-current-time
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MonthView({
  anchor,
  events,
  locale,
  timezone,
  onSelect,
}: {
  anchor: string;
  events: TeacherCalendarEvent[];
  locale: string;
  timezone: string;
  onSelect: (event: TeacherCalendarEvent, trigger: HTMLButtonElement) => void;
}) {
  const first = startOfMonth(anchor);
  const leading = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const gridStart = addDays(first, -leading);
  const dates = Array.from({ length: 42 }, (_, index) =>
    addDays(gridStart, index),
  );
  const month = dateParts(first).month;
  return (
    <div className={styles.scrollRegion}>
      <div className="min-w-[52rem]">
        <div className="grid grid-cols-7 border-b border-outline-variant bg-surface-container-low">
          {Array.from({ length: 7 }, (_, index) =>
            addDays("2026-08-31", index),
          ).map((day) => (
            <div
              key={day}
              className="px-2 py-2 text-center type-caption font-semibold uppercase text-on-surface-variant"
            >
              {formatDate(day, locale, { weekday: "short" })}
            </div>
          ))}
        </div>
        <div className={styles.monthGrid}>
          {dates.map((date) => {
            const dayEvents = events
              .filter((event) => event.date === date)
              .slice(0, 3);
            return (
              <div
                key={date}
                className={styles.monthCell}
                data-outside={dateParts(date).month !== month}
              >
                <span className="type-caption font-semibold tabular-nums">
                  {formatDate(date, locale, { day: "numeric" })}
                </span>
                <div className="mt-1.5 grid gap-1">
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={(clickEvent) =>
                        onSelect(event, clickEvent.currentTarget)
                      }
                      className="truncate rounded-md border-l-[3px] px-1.5 py-1 text-left type-caption font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      style={{
                        ...eventStyle(event.colorToken),
                        background: CLASS_COLORS[event.colorToken].background,
                        color: CLASS_COLORS[event.colorToken].foreground,
                        borderLeftColor: CLASS_COLORS[event.colorToken].border,
                      }}
                    >
                      {formatTime(event.startsAt, locale, timezone)} ·{" "}
                      {event.title}
                    </button>
                  ))}
                  {events.filter((event) => event.date === date).length > 3 ? (
                    <span className="type-caption text-on-surface-variant">
                      +
                      {events.filter((event) => event.date === date).length - 3}{" "}
                      more
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventDrawer({
  event,
  detail,
  locale,
  source,
  onClose,
  onDemoChange,
  onLiveAction,
}: {
  event: TeacherCalendarEvent | null;
  detail: TeacherEventDetailPresentation | undefined;
  locale: string;
  source: TeacherWorkspacePresentation["source"];
  onClose: () => void;
  onDemoChange: (
    eventId: string,
    change: Partial<
      Pick<
        TeacherCalendarEvent,
        "date" | "status" | "startsAt" | "endsAt" | "occurrenceId"
      >
    >,
  ) => void;
  onLiveAction: (input: {
    event: TeacherCalendarEvent;
    action: "reschedule" | "cancel" | "complete";
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
  }) => Promise<void>;
}) {
  const vi = locale === "vi";
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const drawerTitleRef = useRef<HTMLHeadingElement>(null);
  const isDemo = source === "explicit_demo";

  function closeDrawer() {
    setRescheduleOpen(false);
    setActionMessage(null);
    onClose();
  }

  function submitReschedule(eventForm: FormEvent<HTMLFormElement>) {
    eventForm.preventDefault();
    if (!event) return;
    let start: Date;
    let end: Date;
    let startDate = "";
    let endDate = "";
    try {
      let startTime: string;
      let endTime: string;
      [startDate, startTime] = startValue.split("T");
      [endDate, endTime] = endValue.split("T");
      start = new Date(
        zonedWallClockToUtc(startDate, `${startTime}:00`, event.timezone),
      );
      end = new Date(
        zonedWallClockToUtc(endDate, `${endTime}:00`, event.timezone),
      );
    } catch {
      setActionMessage(
        vi
          ? "Giờ này không tồn tại trong múi giờ đã chọn do chuyển đổi giờ mùa hè."
          : "That wall-clock time does not exist in the selected timezone because of a daylight-saving transition.",
      );
      return;
    }
    if (startDate !== endDate) {
      setActionMessage(
        vi
          ? "Thời gian bắt đầu và kết thúc phải trong cùng một ngày."
          : "Start and end must be on the same calendar day.",
      );
      return;
    }
    if (end <= start) {
      setActionMessage(
        vi
          ? "Giờ kết thúc phải sau giờ bắt đầu."
          : "End time must be after start time.",
      );
      return;
    }
    const duration = (end.getTime() - start.getTime()) / 60_000;
    if (duration < 15 || duration > 8 * 60) {
      setActionMessage(
        vi
          ? "Buổi học phải dài từ 15 phút đến 8 giờ."
          : "Lessons must be between 15 minutes and 8 hours.",
      );
      return;
    }
    if (isDemo) {
      onDemoChange(event.id, {
        date: startDate,
        startsAt: start.toISOString(),
        endsAt: end.toISOString(),
      });
      setActionMessage(
        vi
          ? "Đã kiểm tra và cập nhật bản xem trước."
          : "Validated and updated in this preview.",
      );
      setRescheduleOpen(false);
      return;
    }
    setActionPending(true);
    void onLiveAction({
      event,
      action: "reschedule",
      startDate,
      startTime: startValue.split("T")[1],
      endDate,
      endTime: endValue.split("T")[1],
    })
      .then(() => {
        setActionMessage(
          vi ? "Đã cập nhật lịch học." : "Lesson schedule updated.",
        );
        setRescheduleOpen(false);
      })
      .catch((error: unknown) =>
        setActionMessage(
          error instanceof Error
            ? error.message
            : vi
              ? "Không thể cập nhật lịch học."
              : "Unable to update the schedule.",
        ),
      )
      .finally(() => setActionPending(false));
  }

  return (
    <Sheet
      open={Boolean(event)}
      onOpenChange={(open) => {
        if (!open) closeDrawer();
      }}
    >
      <SheetContent
        side="right"
        className="data-[side=right]:w-full data-[side=right]:max-w-none data-[side=right]:sm:max-w-[27rem] gap-0 border-outline-variant bg-surface p-0"
        aria-describedby="teacher-event-description"
        data-teacher-event-drawer
        initialFocus={drawerTitleRef}
        showCloseButton={false}
      >
        {event ? (
          <>
            <button
              type="button"
              onClick={closeDrawer}
              aria-label={
                vi ? "Đóng chi tiết buổi học" : "Close lesson details"
              }
              className="absolute right-3 top-3 z-30 flex size-8 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
            <SheetHeader className="sticky top-0 z-10 border-b border-outline-variant bg-surface px-5 py-4 pr-14">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-5 items-center rounded-md bg-surface-container-high px-1.5 type-caption font-semibold text-on-surface-variant">
                  {statusLabel(event.status, vi)}
                </span>
                <span className="inline-flex h-5 items-center rounded-md border border-outline-variant px-1.5 type-caption font-semibold text-on-surface-variant">
                  {plannedLabel(event, vi)}
                </span>
              </div>
              <SheetTitle
                ref={drawerTitleRef}
                tabIndex={-1}
                className="mt-2 type-title font-semibold text-on-surface focus:outline-none"
              >
                {event.title}
              </SheetTitle>
              <SheetDescription
                id="teacher-event-description"
                className="mt-1 text-on-surface-variant"
              >
                {event.classTitle} ·{" "}
                {event.courseTitle ??
                  (vi ? "Chưa có khóa học" : "No course assigned")}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <dl className="grid gap-3 rounded-control border border-outline-variant bg-surface-container-low p-3">
                <div className="flex items-start gap-3">
                  <Clock3
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <dt className="sr-only">{vi ? "Thời gian" : "Time"}</dt>
                    <dd className="type-label font-semibold text-on-surface">
                      {formatDate(event.date, locale, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}
                    </dd>
                    <dd className="type-caption text-on-surface-variant">
                      {formatTime(event.startsAt, locale, event.timezone)}–
                      {formatTime(event.endsAt, locale, event.timezone)} ·{" "}
                      {event.timezone}
                    </dd>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <dt className="sr-only">{vi ? "Địa điểm" : "Location"}</dt>
                    <dd className="type-label font-semibold text-on-surface">
                      {event.room ??
                        event.location ??
                        (vi ? "Chưa có địa điểm" : "Location not set")}
                    </dd>
                    {event.meetingUrl ? (
                      <a
                        href={event.meetingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="type-caption font-semibold text-primary"
                      >
                        {vi ? "Mở phòng trực tuyến" : "Open meeting room"}
                      </a>
                    ) : null}
                  </div>
                </div>
              </dl>

              {rescheduleOpen ? (
                <form
                  onSubmit={submitReschedule}
                  className="mt-4 grid gap-3 rounded-control border border-primary/30 bg-primary-container/25 p-3"
                  aria-label={vi ? "Đổi lịch" : "Reschedule lesson"}
                >
                  <p className="type-label font-semibold text-on-surface">
                    {vi ? "Đổi lịch bản xem trước" : "Reschedule preview"}
                  </p>
                  <label className="grid gap-1 type-caption font-semibold text-on-surface-variant">
                    {vi ? "Bắt đầu" : "Starts"}
                    <input
                      type="datetime-local"
                      value={startValue}
                      onChange={(e) => setStartValue(e.target.value)}
                      required
                      className="h-9 rounded-control border border-outline-variant bg-surface px-2 text-on-surface"
                    />
                  </label>
                  <label className="grid gap-1 type-caption font-semibold text-on-surface-variant">
                    {vi ? "Kết thúc" : "Ends"}
                    <input
                      type="datetime-local"
                      value={endValue}
                      onChange={(e) => setEndValue(e.target.value)}
                      required
                      className="h-9 rounded-control border border-outline-variant bg-surface px-2 text-on-surface"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setRescheduleOpen(false)}
                    >
                      {vi ? "Đóng" : "Close"}
                    </Button>
                    <Button type="submit">
                      {vi ? "Kiểm tra" : "Validate"}
                    </Button>
                  </div>
                </form>
              ) : null}

              <section
                className="mt-5 border-t border-outline-variant pt-4"
                aria-labelledby="drawer-roster"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3
                    id="drawer-roster"
                    className="flex items-center gap-2 type-body font-semibold text-on-surface"
                  >
                    <Users className="size-4 text-primary" aria-hidden="true" />
                    {vi ? "Danh sách lớp" : "Roster"}
                  </h3>
                  <span className="type-caption font-semibold text-on-surface-variant">
                    {detail?.rosterCount ?? 0} {vi ? "học viên" : "learners"}
                  </span>
                </div>
                {detail?.roster.length ? (
                  <ul className="mt-2 divide-y divide-outline-variant">
                    {detail.roster.map((student) => (
                      <li
                        key={student.id}
                        className="flex items-center justify-between gap-3 py-2 type-body-sm"
                      >
                        <span className="font-medium text-on-surface">
                          {student.name}
                        </span>
                        <span className="type-caption font-semibold text-on-surface-variant">
                          {attendanceLabel(student.status, vi)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 type-body-sm text-on-surface-variant">
                    {vi
                      ? "Chi tiết tên học viên không có trong hợp đồng hiện tại."
                      : "The current contract exposes roster count only."}
                  </p>
                )}
              </section>

              <section
                className="mt-5 border-t border-outline-variant pt-4"
                aria-labelledby="drawer-attendance"
              >
                <h3
                  id="drawer-attendance"
                  className="type-body font-semibold text-on-surface"
                >
                  {vi ? "Tóm tắt điểm danh" : "Attendance summary"}
                </h3>
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {(["present", "late", "absent", "recorded"] as const).map(
                    (key) => (
                      <div
                        key={key}
                        className="rounded-lg bg-surface-container-low p-2 text-center"
                      >
                        <p className="type-body font-semibold tabular-nums text-on-surface">
                          {detail?.attendance[key] ?? 0}
                        </p>
                        <p className="type-caption capitalize text-on-surface-variant">
                          {attendanceLabel(key, vi)}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </section>

              <section
                className="mt-5 border-t border-outline-variant pt-4"
                aria-labelledby="drawer-materials"
              >
                <h3
                  id="drawer-materials"
                  className="type-body font-semibold text-on-surface"
                >
                  {vi ? "Tài liệu" : "Materials"}
                </h3>
                {detail?.materials.length ? (
                  <ul className="mt-2 grid gap-2">
                    {detail.materials.map((material) => (
                      <li
                        key={material.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low px-3 py-2"
                      >
                        <span className="type-body-sm font-medium text-on-surface">
                          {material.title}
                        </span>
                        <span className="type-caption text-on-surface-variant">
                          {material.required
                            ? vi
                              ? "Bắt buộc"
                              : "Required"
                            : materialKindLabel(material.kind, vi)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 type-body-sm text-on-surface-variant">
                    {vi ? "Chưa có tài liệu." : "No materials attached."}
                  </p>
                )}
              </section>

              <section
                className="mt-5 border-t border-outline-variant pt-4"
                aria-labelledby="drawer-homework"
              >
                <div className="flex items-center gap-2">
                  <ClipboardList
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  <h3
                    id="drawer-homework"
                    className="type-body font-semibold text-on-surface"
                  >
                    {vi ? "Bài tập và chấm bài" : "Homework and review"}
                  </h3>
                </div>
                {detail?.homework.length ? (
                  <ul className="mt-2 grid gap-2">
                    {detail.homework.map((homework) => (
                      <li
                        key={homework.id}
                        className="rounded-lg bg-surface-container-low px-3 py-2"
                      >
                        <p className="type-label font-semibold text-on-surface">
                          {homework.title}
                        </p>
                        <p className="mt-0.5 type-caption text-on-surface-variant">
                          {homework.submissions} {vi ? "bài nộp" : "submitted"}{" "}
                          · {homework.reviews} {vi ? "cần chấm" : "to review"}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 type-body-sm text-on-surface-variant">
                    {vi ? "Chưa có bài tập." : "No homework attached."}
                  </p>
                )}
              </section>

              <section
                className="mt-5 border-t border-outline-variant pt-4"
                aria-labelledby="drawer-announcements"
              >
                <div className="flex items-center gap-2">
                  <Megaphone
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  <h3
                    id="drawer-announcements"
                    className="type-body font-semibold text-on-surface"
                  >
                    {vi ? "Thông báo" : "Announcements"}
                  </h3>
                </div>
                {detail?.announcements.length ? (
                  <ul className="mt-2 grid gap-2">
                    {detail.announcements.map((announcement) => (
                      <li
                        key={announcement.id}
                        className="rounded-lg bg-surface-container-low px-3 py-2"
                      >
                        <p className="type-label font-semibold text-on-surface">
                          {announcement.title}
                        </p>
                        <p className="mt-1 type-body-sm text-on-surface-variant">
                          {announcement.body}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 type-body-sm text-on-surface-variant">
                    {vi
                      ? "Chưa có thông báo."
                      : "No announcements for this lesson."}
                  </p>
                )}
              </section>
              {actionMessage ? (
                <p
                  className="mt-4 rounded-lg bg-surface-container-high px-3 py-2 type-caption text-on-surface"
                  role="status"
                >
                  {actionMessage}
                </p>
              ) : null}
            </div>
            <SheetFooter className="sticky bottom-0 border-t border-outline-variant bg-surface p-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={eventActionHref(
                        detail,
                        "takeAttendance",
                        `/dashboard/teacher/classes/${event.classId}?tab=attendance`,
                        isDemo,
                      )}
                    />
                  }
                  variant="outline"
                >
                  {vi ? "Điểm danh" : "Attendance"}
                </Button>
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={eventActionHref(
                        detail,
                        "viewClass",
                        `/dashboard/teacher/classes/${event.classId}`,
                        isDemo,
                      )}
                    />
                  }
                  variant="outline"
                >
                  {vi ? "Mở lớp" : "Open class"}
                </Button>
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={eventActionHref(
                        detail,
                        "reviewHomework",
                        `/dashboard/teacher/review-queue?classId=${event.classId}`,
                        isDemo,
                      )}
                    />
                  }
                  variant="outline"
                >
                  {vi ? "Chấm bài" : "Review"}
                </Button>
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={eventActionHref(
                        detail,
                        "viewGradebook",
                        `/dashboard/teacher/gradebook?classId=${event.classId}`,
                        isDemo,
                      )}
                    />
                  }
                  variant="outline"
                >
                  {vi ? "Sổ điểm" : "Gradebook"}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {!isDemo &&
                event.actions.planLesson &&
                detail?.actionUrls.planLesson ? (
                  <Button
                    nativeButton={false}
                    render={
                      <Link
                        href={eventActionHref(
                          detail,
                          "planLesson",
                          `/dashboard/teacher/classes/${event.classId}?tab=lessons&plan=${encodeURIComponent(event.id)}`,
                          false,
                        )}
                      />
                    }
                    variant="outline"
                  >
                    {vi ? "Soạn bài" : "Plan lesson"}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!event.actions.planLesson || !isDemo}
                    onClick={() => {
                      onDemoChange(event.id, {
                        occurrenceId:
                          event.occurrenceId ?? `preview-${event.id}`,
                      });
                      setActionMessage(
                        vi
                          ? "Đã đánh dấu buổi học là đã soạn trong bản xem trước."
                          : "Lesson marked planned in this preview.",
                      );
                    }}
                  >
                    {vi ? "Soạn bài" : "Plan lesson"}
                  </Button>
                )}
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={eventActionHref(
                        detail,
                        "manageMaterials",
                        `/dashboard/teacher/classes/${event.classId}?tab=materials`,
                        isDemo,
                      )}
                    />
                  }
                  variant="outline"
                >
                  {vi ? "Tài liệu" : "Materials"}
                </Button>
                <Button
                  nativeButton={false}
                  render={
                    <Link
                      href={eventActionHref(
                        detail,
                        "postAnnouncement",
                        `/dashboard/teacher/classes/${event.classId}?tab=announcements`,
                        isDemo,
                      )}
                    />
                  }
                  variant="outline"
                >
                  {vi ? "Thông báo" : "Announcements"}
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={
                    actionPending ||
                    (!isDemo &&
                      !canMutateTeacherCalendarEvent(event, "reschedule"))
                  }
                  onClick={() => {
                    setStartValue(
                      localDateTimeValue(event.startsAt, event.timezone),
                    );
                    setEndValue(
                      localDateTimeValue(event.endsAt, event.timezone),
                    );
                    setRescheduleOpen(true);
                  }}
                >
                  {vi ? "Đổi lịch" : "Reschedule"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={
                    !event.actions.cancel ||
                    actionPending ||
                    (!isDemo &&
                      (!event.occurrenceId || !event.occurrenceUpdatedAt))
                  }
                  onClick={() => {
                    if (isDemo) {
                      onDemoChange(event.id, { status: "cancelled" });
                      setActionMessage(
                        vi
                          ? "Đã hủy trong bản xem trước."
                          : "Cancelled in this preview.",
                      );
                      return;
                    }
                    setActionPending(true);
                    void onLiveAction({ event, action: "cancel" })
                      .then(() => {
                        setActionMessage(
                          vi ? "Đã hủy buổi học." : "Lesson cancelled.",
                        );
                      })
                      .catch((error: unknown) =>
                        setActionMessage(
                          error instanceof Error
                            ? error.message
                            : vi
                              ? "Không thể hủy buổi học."
                              : "Unable to cancel the lesson.",
                        ),
                      )
                      .finally(() => setActionPending(false));
                  }}
                >
                  {vi ? "Hủy" : "Cancel"}
                </Button>
                <Button
                  type="button"
                  disabled={
                    !event.actions.complete ||
                    actionPending ||
                    (!isDemo &&
                      (!event.occurrenceId || !event.occurrenceUpdatedAt))
                  }
                  onClick={() => {
                    if (isDemo) {
                      onDemoChange(event.id, { status: "completed" });
                      setActionMessage(
                        vi
                          ? "Đã hoàn tất trong bản xem trước."
                          : "Completed in this preview.",
                      );
                      return;
                    }
                    setActionPending(true);
                    void onLiveAction({ event, action: "complete" })
                      .then(() => {
                        setActionMessage(
                          vi ? "Đã hoàn tất buổi học." : "Lesson completed.",
                        );
                      })
                      .catch((error: unknown) =>
                        setActionMessage(
                          error instanceof Error
                            ? error.message
                            : vi
                              ? "Không thể hoàn tất buổi học."
                              : "Unable to complete the lesson.",
                        ),
                      )
                      .finally(() => setActionPending(false));
                  }}
                >
                  {vi ? "Hoàn tất" : "Complete"}
                </Button>
              </div>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function TeacherCalendar({
  data,
}: {
  data: TeacherWorkspacePresentation;
}) {
  const vi = data.locale === "vi";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialView = data.calendar.range.view;
  const initialAnchor =
    searchParams.get("date") ?? data.calendar.range.startDate;
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const lastEventTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [overrides, setOverrides] = useState<
    Record<string, Partial<TeacherCalendarEvent>>
  >({});
  const [classColors, setClassColors] = useState<
    Record<string, TeacherClassColorToken>
  >(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem(
        "thinkfy.teacher.calendar.colors.v1",
      );
      return stored
        ? (JSON.parse(stored) as Record<string, TeacherClassColorToken>)
        : {};
    } catch {
      return {};
    }
  });
  const showWeekend = useSyncExternalStore(
    subscribeToWeekendPreference,
    weekendPreferenceSnapshot,
    () => false,
  );
  const isCompactCalendar = useSyncExternalStore(
    subscribeToCompactCalendar,
    compactCalendarSnapshot,
    () => false,
  );
  const view =
    isCompactCalendar && initialView !== "day" && initialView !== "agenda"
      ? "agenda"
      : initialView;
  const anchor = initialAnchor;
  const selectedClass = searchParams.get("classId") ?? "";
  const selectedProgram = searchParams.get("program") ?? "";
  const selectedStatus = searchParams.get("status") ?? "";

  useEffect(() => {
    if (searchParams.has("view")) return;
    try {
      const stored = window.localStorage.getItem(
        "thinkfy.teacher.calendar.view.v1",
      );
      const preferred =
        isCompactCalendar && stored !== "day" && stored !== "agenda"
          ? "agenda"
          : stored;
      if (isTeacherCalendarView(preferred) && preferred !== initialView) {
        const params = new URLSearchParams(searchParams.toString());
        params.set("view", preferred);
        router.replace(`${pathname}?${params.toString()}`);
      }
    } catch {
      // The server-provided Week default remains authoritative when storage is unavailable.
    }
  }, [initialView, isCompactCalendar, pathname, router, searchParams]);

  useEffect(() => {
    if (!isCompactCalendar || initialView === "day" || initialView === "agenda")
      return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", "agenda");
    router.replace(`${pathname}?${params.toString()}`);
  }, [initialView, isCompactCalendar, pathname, router, searchParams]);

  const events = useMemo(
    () =>
      data.calendar.events
        .map((event) => ({
          ...event,
          ...(overrides[event.id] ?? {}),
          colorToken: classColors[event.classId] ?? event.colorToken,
        }))
        .filter((event) => !selectedClass || event.classId === selectedClass)
        .filter(
          (event) => !selectedProgram || event.programType === selectedProgram,
        )
        .filter((event) => !selectedStatus || event.status === selectedStatus),
    [
      classColors,
      data.calendar.events,
      overrides,
      selectedClass,
      selectedProgram,
      selectedStatus,
    ],
  );
  const selectedEvent = selectedEventId
    ? (events.find((event) => event.id === selectedEventId) ?? null)
    : null;

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function setView(nextView: TeacherCalendarView) {
    if (!isCompactCalendar) {
      try {
        window.localStorage.setItem(
          "thinkfy.teacher.calendar.view.v1",
          nextView,
        );
      } catch {}
    }
    navigate({ view: nextView });
  }

  function move(amount: number) {
    const next =
      view === "month"
        ? shiftMonth(anchor, amount)
        : addDays(
            anchor,
            amount * (view === "week" || view === "agenda" ? 7 : 1),
          );
    navigate({ date: next });
  }

  function setColor(classId: string, color: TeacherClassColorToken) {
    const next = { ...classColors, [classId]: color };
    setClassColors(next);
    try {
      window.localStorage.setItem(
        "thinkfy.teacher.calendar.colors.v1",
        JSON.stringify(next),
      );
    } catch {}
  }

  const weekDays = Array.from({ length: showWeekend ? 7 : 5 }, (_, index) =>
    addDays(startOfWeek(anchor), index),
  );
  const weekendDays = [
    addDays(startOfWeek(anchor), 5),
    addDays(startOfWeek(anchor), 6),
  ];
  const weekendEventCount = events.filter((event) =>
    weekendDays.includes(event.date),
  ).length;
  const dayEvents = events.filter((event) => event.date === anchor);
  const displayEvents = view === "day" ? dayEvents : events;
  const mobileView: TeacherCalendarView = view === "day" ? "day" : "agenda";

  function selectEvent(
    event: TeacherCalendarEvent,
    trigger: HTMLButtonElement,
  ) {
    lastEventTriggerRef.current = trigger;
    setSelectedEventId(event.id);
  }

  function closeEvent() {
    setSelectedEventId(null);
    window.setTimeout(() => lastEventTriggerRef.current?.focus(), 500);
  }

  async function runLiveAction(input: {
    event: TeacherCalendarEvent;
    action: "reschedule" | "cancel" | "complete";
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
  }) {
    const key = globalThis.crypto.randomUUID();
    if (input.action === "reschedule") {
      if (
        !input.startDate ||
        !input.startTime ||
        !input.endDate ||
        !input.endTime
      )
        throw new Error("A complete schedule is required.");
      if (input.event.occurrenceId && input.event.occurrenceUpdatedAt) {
        await rescheduleTeacherWorkspaceOccurrence({
          occurrenceId: input.event.occurrenceId,
          startsAt: zonedWallClockToUtc(
            input.startDate,
            `${input.startTime}:00`,
            input.event.timezone,
          ),
          endsAt: zonedWallClockToUtc(
            input.endDate,
            `${input.endTime}:00`,
            input.event.timezone,
          ),
          timezone: input.event.timezone,
          expectedUpdatedAt: input.event.occurrenceUpdatedAt,
          idempotencyKey: key,
        });
      } else {
        if (!input.event.scheduleUpdatedAt)
          throw new Error("This event has no mutable recurring schedule.");
        await rescheduleTeacherWorkspaceEvent({
          scheduleId: input.event.scheduleId,
          startDate: input.startDate,
          endDate: input.endDate,
          startTime: input.startTime,
          endTime: input.endTime,
          timezone: input.event.timezone,
          expectedUpdatedAt: input.event.scheduleUpdatedAt,
          idempotencyKey: key,
        });
      }
    } else {
      if (!input.event.occurrenceId || !input.event.occurrenceUpdatedAt)
        throw new Error("This event has no mutable occurrence.");
      await setTeacherWorkspaceEventState({
        occurrenceId: input.event.occurrenceId,
        state: input.action === "cancel" ? "cancelled" : "completed",
        expectedUpdatedAt: input.event.occurrenceUpdatedAt,
        idempotencyKey: key,
      });
    }
    router.refresh();
  }

  return (
    <section aria-labelledby="teacher-calendar-heading" data-teacher-calendar>
      <div className="flex flex-col gap-3 border-b border-outline-variant pb-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="type-label font-semibold uppercase tracking-wide text-primary">
            {vi ? "Không gian giáo viên" : "Teacher workspace"}
          </p>
          <h1
            id="teacher-calendar-heading"
            className="mt-1 type-heading-md font-semibold text-on-surface"
          >
            {vi ? "Lịch giảng dạy" : "Teaching Calendar"}
          </h1>
          <p className="mt-0.5 type-body-sm text-on-surface-variant">
            {rangeTitle(view, anchor, data.locale, weekDays.length)}
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label={vi ? "Điều khiển lịch" : "Calendar controls"}
        >
          <Button
            variant="outline"
            onClick={() =>
              navigate({
                date: dateInTimezone(new Date(), data.calendar.range.timezone),
              })
            }
          >
            {vi ? "Hôm nay" : "Today"}
          </Button>
          <div className="flex items-center rounded-control border border-outline-variant bg-surface">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => move(-1)}
              aria-label={vi ? "Trước" : "Previous"}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => move(1)}
              aria-label={vi ? "Sau" : "Next"}
            >
              <ChevronRight />
            </Button>
          </div>
          <CalendarDatePicker
            value={anchor}
            locale={data.locale}
            timezone={data.calendar.range.timezone}
            onChange={(next) => navigate({ date: next })}
          />
          <CalendarViewSwitcher
            className={styles.desktopOnly}
            label={vi ? "Chế độ xem" : "Calendar view"}
            options={["day", "week", "month", "agenda"]}
            value={view}
            vi={vi}
            onChange={setView}
          />
          <CalendarViewSwitcher
            className={styles.compactOnly}
            label={vi ? "Chế độ xem di động" : "Mobile calendar view"}
            options={["day", "agenda"]}
            value={mobileView}
            vi={vi}
            onChange={setView}
          />
          {view === "week" ? (
            <button
              type="button"
              onClick={() => writeWeekendPreference(!showWeekend)}
              aria-pressed={showWeekend}
              aria-label={`${vi ? "Cuối tuần" : "Weekend"}: ${lessonCountLabel(
                weekendEventCount,
                vi,
              )}`}
              className={cn(
                styles.desktopOnly,
                "h-8 items-center gap-1.5 rounded-full border px-2.5 type-label font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                showWeekend
                  ? "border-primary bg-primary-container text-on-primary-container"
                  : "border-outline-variant bg-surface text-on-surface hover:bg-surface-container",
              )}
            >
              <Sun className="size-4 shrink-0" aria-hidden="true" />
              {vi ? "Cuối tuần" : "Weekend"}
              {!showWeekend && weekendEventCount > 0 ? (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-container-high px-1 type-caption font-semibold tabular-nums text-on-surface-variant">
                  {weekendEventCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-2"
        data-calendar-filters
      >
        <CalendarSelect
          icon={Users}
          label={vi ? "Lọc theo lớp" : "Filter by class"}
          value={selectedClass}
          onChange={(next) => navigate({ classId: next || null })}
          options={[
            { value: "", label: vi ? "Tất cả lớp" : "All classes" },
            ...data.classes.map((item) => ({
              value: item.id,
              label: item.title,
            })),
          ]}
        />
        <CalendarSelect
          icon={BookOpen}
          label={vi ? "Lọc theo môn" : "Filter by subject"}
          value={selectedProgram}
          onChange={(next) => navigate({ program: next || null })}
          options={[
            { value: "", label: vi ? "Tất cả môn" : "All subjects" },
            { value: "ielts", label: "IELTS" },
            { value: "debate", label: vi ? "Tranh biện" : "Debate" },
            {
              value: "public_speaking",
              label: vi ? "Thuyết trình" : "Public speaking",
            },
          ]}
        />
        <CalendarSelect
          icon={CircleDashed}
          label={vi ? "Lọc theo trạng thái" : "Filter by status"}
          value={selectedStatus}
          onChange={(next) => navigate({ status: next || null })}
          options={[
            { value: "", label: vi ? "Tất cả trạng thái" : "All statuses" },
            { value: "scheduled", label: statusLabel("scheduled", vi) },
            { value: "completed", label: statusLabel("completed", vi) },
            { value: "cancelled", label: statusLabel("cancelled", vi) },
          ]}
        />
        {selectedClass ? (
          <CalendarSelect
            icon={Highlighter}
            label={vi ? "Chọn màu lớp" : "Choose class color"}
            value={
              classColors[selectedClass] ??
              data.classes.find((item) => item.id === selectedClass)
                ?.colorToken ??
              "blue"
            }
            onChange={(next) =>
              setColor(selectedClass, next as TeacherClassColorToken)
            }
            options={(
              Object.keys(CLASS_COLORS) as TeacherClassColorToken[]
            ).map((color) => ({
              value: color,
              label: vi
                ? CLASS_COLOR_LABELS[color].vi
                : CLASS_COLOR_LABELS[color].en,
              dot: CLASS_COLORS[color].border,
            }))}
          />
        ) : null}
        {selectedClass || selectedProgram || selectedStatus ? (
          <Button
            variant="ghost"
            className="rounded-full"
            onClick={() =>
              navigate({ classId: null, program: null, status: null })
            }
          >
            <RefreshCw />
            {vi ? "Xóa bộ lọc" : "Clear filters"}
          </Button>
        ) : null}
      </div>

      <div className={cn(styles.calendarShell, "mt-3")}>
        <div className={styles.desktopCalendar}>
          {view === "week" ? (
            <TimeGrid
              days={weekDays}
              events={events}
              locale={data.locale}
              timezone={data.calendar.range.timezone}
              onSelect={selectEvent}
            />
          ) : null}
          {view === "day" ? (
            <TimeGrid
              days={[anchor]}
              events={dayEvents}
              locale={data.locale}
              timezone={data.calendar.range.timezone}
              onSelect={selectEvent}
            />
          ) : null}
          {view === "month" ? (
            <MonthView
              anchor={anchor}
              events={events}
              locale={data.locale}
              timezone={data.calendar.range.timezone}
              onSelect={selectEvent}
            />
          ) : null}
          {view === "agenda" ? (
            <AgendaView
              events={displayEvents}
              locale={data.locale}
              timezone={data.calendar.range.timezone}
              idPrefix="desktop"
              onSelect={selectEvent}
            />
          ) : null}
        </div>
        <div className={styles.mobileFallback}>
          {mobileView === "day" ? (
            <TimeGrid
              days={[anchor]}
              events={dayEvents}
              locale={data.locale}
              timezone={data.calendar.range.timezone}
              onSelect={selectEvent}
            />
          ) : (
            <AgendaView
              events={events}
              locale={data.locale}
              timezone={data.calendar.range.timezone}
              idPrefix="mobile"
              onSelect={selectEvent}
            />
          )}
        </div>
      </div>

      <div
        className="mt-3 flex flex-wrap items-center gap-3 type-caption text-on-surface-variant"
        aria-label={vi ? "Chú giải lịch" : "Calendar legend"}
      >
        <span className="inline-flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          {vi ? "Đã soạn bài" : "Planned"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-3.5 rounded-full border border-dashed border-on-surface-variant"
            aria-hidden="true"
          />
          {vi ? "Chưa soạn bài" : "Unplanned"}
        </span>
        <span>{data.calendar.range.timezone}</span>
      </div>

      <EventDrawer
        event={selectedEvent}
        detail={selectedEvent ? data.eventDetails[selectedEvent.id] : undefined}
        locale={data.locale}
        source={data.source}
        onClose={closeEvent}
        onLiveAction={runLiveAction}
        onDemoChange={(eventId, change) =>
          setOverrides((current) => ({
            ...current,
            [eventId]: { ...(current[eventId] ?? {}), ...change },
          }))
        }
      />
    </section>
  );
}
