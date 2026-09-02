import {
  expandScheduleOccurrences,
  type AdminClassProgram,
  type ScheduleExpansionSource,
} from "../admin-class-schedules-model";

export type TeacherCalendarView = "day" | "week" | "month" | "agenda";
export type TeacherCalendarStatus =
  | "scheduled"
  | "completed"
  | "cancelled"
  | "archived";
export type TeacherCalendarScheduleStatus = "active" | "cancelled" | "archived";

export const TEACHER_CALENDAR_VIEWS: readonly TeacherCalendarView[] = [
  "day",
  "week",
  "month",
  "agenda",
];
export const TEACHER_CALENDAR_MAX_DAYS = 62;
export const TEACHER_CALENDAR_DEFAULT_TIMEZONE = "Asia/Ho_Chi_Minh";

/** These are semantic tokens, rather than arbitrary CSS colors, so every class remains accessible. */
export const TEACHER_CLASS_COLOR_TOKENS = [
  "blue",
  "teal",
  "amber",
  "coral",
  "violet",
  "pink",
  "slate",
] as const;
export type TeacherClassColorToken =
  (typeof TEACHER_CLASS_COLOR_TOKENS)[number];

export interface TeacherCalendarRangeInput {
  startDate?: string;
  endDate?: string;
  anchorDate?: string;
  view?: TeacherCalendarView;
  timezone?: string;
  weekStart?: 0 | 1;
  classId?: string;
  programType?: AdminClassProgram;
  statuses?: TeacherCalendarStatus[];
}

export interface TeacherCalendarRange {
  startDate: string;
  endDate: string;
  view: TeacherCalendarView;
  timezone: string;
}

export interface TeacherCalendarActionPermissions {
  viewClass: boolean;
  takeAttendance: boolean;
  reviewHomework: boolean;
  viewGradebook: boolean;
  planLesson: boolean;
  manageMaterials: boolean;
  postAnnouncement: boolean;
  reschedule: boolean;
  cancel: boolean;
  complete: boolean;
}

export interface TeacherCalendarCounts {
  assignmentCount: number;
  submissionCount: number;
  reviewCount: number;
}

export interface TeacherCalendarEvent {
  id: string;
  scheduleId: string;
  /** Version of the recurring schedule used by schedule mutations. */
  scheduleUpdatedAt: string | null;
  /** Version of the materialized occurrence, when one exists. */
  occurrenceUpdatedAt: string | null;
  /** The token required by the permitted mutation for this event. */
  expectedUpdatedAt: string;
  occurrenceId: string | null;
  classId: string;
  classTitle: string;
  programType: AdminClassProgram;
  courseId: string | null;
  courseTitle: string | null;
  lessonId: string | null;
  lessonTitle: string | null;
  title: string;
  date: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  status: TeacherCalendarStatus;
  scheduleStatus: TeacherCalendarScheduleStatus;
  location: string | null;
  room: string | null;
  meetingUrl: string | null;
  attendanceState: "pending" | "taken" | null;
  counts: TeacherCalendarCounts;
  colorToken: TeacherClassColorToken;
  actions: TeacherCalendarActionPermissions;
}

export interface TeacherCalendarRangeResult {
  range: TeacherCalendarRange;
  events: TeacherCalendarEvent[];
  classes: Array<{
    id: string;
    title: string;
    programType: AdminClassProgram;
    colorToken: TeacherClassColorToken;
  }>;
}

export interface TeacherCalendarEventDetail extends TeacherCalendarEvent {
  rosterCount: number;
  roster: Array<{
    id: string;
    name: string;
    enrollmentStatus: "enrolled" | "removed_after_occurrence";
    status: "present" | "late" | "absent" | "unmarked";
  }>;
  lessonNotes: string | null;
  materials: Array<{
    id: string;
    title: string;
    kind: string;
    required: boolean;
  }>;
  assignments: Array<{
    id: string;
    title: string;
    dueAt: string | null;
    relationType: string;
    submissionCount: number;
    reviewCount: number;
  }>;
  attendance: {
    sessionId: string | null;
    present: number;
    late: number;
    absent: number;
    recorded: number;
  };
  announcements: Array<{
    id: string;
    title: string;
    body: string;
    status: string;
    publishAt: string | null;
  }>;
  actionUrls: Partial<Record<keyof TeacherCalendarActionPermissions, string>>;
}

export type TeacherCalendarMutation = "reschedule" | "cancel" | "complete";

export function canMutateTeacherCalendarEvent(
  event: Pick<
    TeacherCalendarEvent,
    "actions" | "scheduleUpdatedAt" | "occurrenceId" | "occurrenceUpdatedAt"
  >,
  mutation: TeacherCalendarMutation,
): boolean {
  if (!event.actions[mutation]) return false;
  if (mutation === "reschedule") {
    return (
      event.scheduleUpdatedAt !== null ||
      (event.occurrenceId !== null && event.occurrenceUpdatedAt !== null)
    );
  }
  return event.occurrenceId !== null && event.occurrenceUpdatedAt !== null;
}

export interface TeacherCalendarPreferences {
  view: TeacherCalendarView;
  weekStart: 0 | 1;
  workingHours: { start: string; end: string };
  timezoneMode: "class" | "user" | "fixed";
  timezone: string;
}

export interface TeacherCalendarPreferencesInput {
  view?: TeacherCalendarView;
  weekStart?: 0 | 1;
  workingHours?: { start: string; end: string };
  timezoneMode?: "class" | "user" | "fixed";
  timezone?: string;
}

export function isTeacherCalendarView(
  value: unknown,
): value is TeacherCalendarView {
  return (
    typeof value === "string" &&
    (TEACHER_CALENDAR_VIEWS as readonly string[]).includes(value)
  );
}

export function isTeacherCalendarColorToken(
  value: unknown,
): value is TeacherClassColorToken {
  return (
    typeof value === "string" &&
    (TEACHER_CLASS_COLOR_TOKENS as readonly string[]).includes(value)
  );
}

export function normalizeTeacherCalendarView(
  value: unknown,
): TeacherCalendarView {
  return isTeacherCalendarView(value) ? value : "week";
}

export function normalizeTeacherCalendarPreferences(
  input: Partial<TeacherCalendarPreferences> | null | undefined,
  fallbackTimezone = TEACHER_CALENDAR_DEFAULT_TIMEZONE,
): TeacherCalendarPreferences {
  const start = input?.workingHours?.start ?? "08:00";
  const end = input?.workingHours?.end ?? "20:00";
  return {
    view: normalizeTeacherCalendarView(input?.view),
    weekStart: input?.weekStart === 0 ? 0 : 1,
    workingHours: {
      start: normalizeClock(start, "08:00"),
      end: normalizeClock(end, "20:00"),
    },
    timezoneMode:
      input?.timezoneMode === "user" || input?.timezoneMode === "fixed"
        ? input.timezoneMode
        : "class",
    timezone: validTimezone(input?.timezone)
      ? input!.timezone!
      : fallbackTimezone,
  };
}

export function normalizeTeacherCalendarRange(
  input: TeacherCalendarRangeInput,
  now = new Date(),
): TeacherCalendarRange {
  const view = normalizeTeacherCalendarView(input.view);
  const timezone = validTimezone(input.timezone)
    ? input.timezone!
    : TEACHER_CALENDAR_DEFAULT_TIMEZONE;
  const anchor =
    input.anchorDate ?? input.startDate ?? dateKeyInTimezone(now, timezone);
  assertIsoDate(anchor);
  let startDate = input.startDate;
  let endDate = input.endDate;
  if (!startDate || !endDate) {
    if (view === "day") startDate = endDate = anchor;
    else if (view === "week" || view === "agenda") {
      startDate = startOfWeek(anchor, input.weekStart === 0 ? 0 : 1);
      endDate = addIsoDateDays(startDate, 6);
    } else {
      const [year, month] = anchor.split("-").map(Number);
      startDate = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-01`;
      endDate = addIsoDateDays(addIsoDateDays(startDate, 31), -1);
      while (endDate.slice(0, 7) !== startDate.slice(0, 7))
        endDate = addIsoDateDays(endDate, -1);
    }
  }
  assertIsoDate(startDate);
  assertIsoDate(endDate);
  if (startDate > endDate)
    throw new Error("Calendar range start must not be after end");
  const days = daysBetween(startDate, endDate) + 1;
  if (days > TEACHER_CALENDAR_MAX_DAYS)
    throw new Error(
      `Calendar range must be at most ${TEACHER_CALENDAR_MAX_DAYS} days`,
    );
  return { startDate, endDate, view, timezone };
}

/** Expand a schedule in local calendar dates, then materialize each wall-clock time in its IANA timezone. */
export function expandTeacherScheduleOccurrences(
  schedule: ScheduleExpansionSource & { timezone?: string },
  rangeStart: string,
  rangeEnd: string,
): Array<{
  scheduleId: string;
  date: string;
  startsAt: string;
  endsAt: string;
}> {
  const dates = expandScheduleOccurrences(
    schedule,
    rangeStart,
    rangeEnd,
    TEACHER_CALENDAR_MAX_DAYS + 1,
  )
    .filter((item) => item.date >= rangeStart && item.date <= rangeEnd)
    .filter((item) => !schedule.endDate || item.date <= schedule.endDate);
  const timezone = validTimezone(schedule.timezone)
    ? schedule.timezone!
    : TEACHER_CALENDAR_DEFAULT_TIMEZONE;
  return dates.map((item) => ({
    ...item,
    startsAt: zonedWallClockToUtc(item.date, schedule.startTime, timezone),
    endsAt: zonedWallClockToUtc(item.date, schedule.endTime, timezone),
  }));
}

export function sortTeacherCalendarEvents(
  events: TeacherCalendarEvent[],
): TeacherCalendarEvent[] {
  return [...events].sort(
    (a, b) =>
      a.startsAt.localeCompare(b.startsAt) ||
      a.endsAt.localeCompare(b.endsAt) ||
      a.classTitle.localeCompare(b.classTitle) ||
      a.id.localeCompare(b.id),
  );
}

export function zonedWallClockToUtc(
  date: string,
  time: string,
  timezone: string,
): string {
  assertIsoDate(date);
  const [hour, minute, second = "0"] = time.split(":").map(Number);
  if (
    !/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(time) ||
    ![hour, minute, Number(second)].every(Number.isFinite) ||
    hour > 23 ||
    minute > 59 ||
    Number(second) > 59
  )
    throw new Error("Invalid schedule time");
  const desiredUtc = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    hour,
    minute,
    Number(second),
  );
  if (!validTimezone(timezone))
    throw new Error(`Invalid timezone: ${timezone}`);
  // Gather every offset in a generous window around the requested wall time.
  // This covers DST gaps/folds (including half-hour transitions) without
  // assuming that a transition occurs at a particular UTC hour.
  const offsets = new Set<number>();
  for (let sampleHours = -168; sampleHours <= 168; sampleHours += 1) {
    const sample = new Date(desiredUtc + sampleHours * 60 * 60 * 1000);
    const local = localWallClockParts(sample, timezone);
    const renderedUtc = Date.UTC(
      Number(local.date.slice(0, 4)),
      Number(local.date.slice(5, 7)) - 1,
      Number(local.date.slice(8, 10)),
      local.hour,
      local.minute,
      local.second,
    );
    offsets.add(renderedUtc - sample.getTime());
  }
  const matches = [...offsets]
    .map((offset) => new Date(desiredUtc - offset))
    .filter((candidate) => {
      const local = localWallClockParts(candidate, timezone);
      return (
        local.date === date &&
        local.hour === hour &&
        local.minute === minute &&
        local.second === Number(second)
      );
    })
    .sort((a, b) => a.getTime() - b.getTime());
  if (!matches[0])
    throw new Error(
      `Schedule time does not exist in ${timezone} because of a timezone transition`,
    );
  return matches[0].toISOString();
}

function localWallClockParts(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(value);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? Number.NaN);
  return {
    date: `${pad(get("year"))}-${pad(get("month"))}-${pad(get("day"))}`,
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

function normalizeClock(value: string, fallback: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : fallback;
}

function validTimezone(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 1 || value.length > 64)
    return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

function dateKeyInTimezone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function assertIsoDate(value: string): asserts value is string {
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error("Invalid calendar date");
}

function addIsoDateDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  return (
    (new Date(`${end}T12:00:00Z`).getTime() -
      new Date(`${start}T12:00:00Z`).getTime()) /
    86_400_000
  );
}

function startOfWeek(value: string, weekStart: 0 | 1) {
  const date = new Date(`${value}T12:00:00Z`);
  const day = date.getUTCDay();
  date.setUTCDate(date.getUTCDate() - ((day - weekStart + 7) % 7));
  return date.toISOString().slice(0, 10);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}
