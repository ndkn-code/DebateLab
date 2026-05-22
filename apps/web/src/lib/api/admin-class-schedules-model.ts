import { RRule } from "rrule";

export type AdminClassProgram = "debate" | "ielts" | "public_speaking";
export type ClassScheduleStatus = "active" | "cancelled" | "archived";
export type RecurrenceFrequency = "none" | "daily" | "weekly" | "monthly";
export type RecurrenceEndMode = "never" | "on_date" | "after_occurrences";
export type RecurrenceWeekday = "SU" | "MO" | "TU" | "WE" | "TH" | "FR" | "SA";

export interface ClassRecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  weekdays: RecurrenceWeekday[];
  endMode: RecurrenceEndMode;
  until: string | null;
  count: number | null;
}

export interface ScheduleExpansionSource {
  id: string;
  startDate: string;
  endDate: string | null;
  startTime: string;
  endTime: string;
  recurrenceRule: ClassRecurrenceRule;
}

export interface ScheduleOccurrence {
  scheduleId: string;
  date: string;
  startsAt: string;
  endsAt: string;
}

export const DEFAULT_CLASS_TIMEZONE = "Asia/Ho_Chi_Minh";

export const PROGRAM_OPTIONS: Array<{
  value: AdminClassProgram;
  label: string;
  codePrefix: string;
  levels: string[];
}> = [
  { value: "debate", label: "Debate", codePrefix: "DEB", levels: ["Beginner", "Intermediate", "Advanced"] },
  { value: "ielts", label: "IELTS", codePrefix: "IELTS", levels: ["Foundation", "Band 5-6", "Band 6.5-7.5", "Band 8+"] },
  { value: "public_speaking", label: "Public Speaking", codePrefix: "PS", levels: ["Beginner", "Intermediate", "Advanced"] },
];

const WEEKDAY_BY_CODE: Record<RecurrenceWeekday, typeof RRule.MO> = {
  SU: RRule.SU,
  MO: RRule.MO,
  TU: RRule.TU,
  WE: RRule.WE,
  TH: RRule.TH,
  FR: RRule.FR,
  SA: RRule.SA,
};

const WEEKDAY_LABEL: Record<RecurrenceWeekday, string> = {
  SU: "Sun",
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
};

const WEEKDAY_FROM_JS_DAY: RecurrenceWeekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

export function normalizeClassProgram(value: unknown): AdminClassProgram {
  if (value === "ielts" || value === "public_speaking" || value === "debate") return value;
  return "debate";
}

export function getProgramLabel(program: AdminClassProgram) {
  return PROGRAM_OPTIONS.find((option) => option.value === program)?.label ?? "Debate";
}

export function getProgramLevels(program: AdminClassProgram) {
  return PROGRAM_OPTIONS.find((option) => option.value === program)?.levels ?? PROGRAM_OPTIONS[0].levels;
}

export function normalizeClassLevel(program: AdminClassProgram, value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  const levels = getProgramLevels(program);
  const match = levels.find((level) => level.toLowerCase() === text.toLowerCase());
  return match ?? levels[0];
}

export function isValidProgramLevel(program: AdminClassProgram, level: unknown) {
  return getProgramLevels(program).includes(typeof level === "string" ? level : "");
}

export function buildClassCodeCandidate(
  program: AdminClassProgram,
  attempt: number,
  date = new Date(),
  seed = randomCodeSeed()
) {
  const prefix = PROGRAM_OPTIONS.find((option) => option.value === program)?.codePrefix ?? "CLS";
  const year = date.getFullYear();
  const suffix = attempt <= 0 ? seed : `${seed}-${attempt + 1}`;
  return `${prefix}-${year}-${suffix}`.toUpperCase();
}

export function randomCodeSeed() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function normalizeRecurrenceRule(
  input: Partial<ClassRecurrenceRule> | null | undefined,
  startDate: string
): ClassRecurrenceRule {
  const frequency = input?.frequency === "daily" || input?.frequency === "weekly" || input?.frequency === "monthly"
    ? input.frequency
    : "none";
  const interval = Math.max(1, Math.min(99, Math.floor(Number(input?.interval ?? 1) || 1)));
  const endMode = input?.endMode === "on_date" || input?.endMode === "after_occurrences"
    ? input.endMode
    : "never";
  const weekdayFromStart = weekdayForDate(startDate);
  const weekdays = Array.from(new Set((input?.weekdays ?? []).filter(isWeekdayCode)));
  const count = endMode === "after_occurrences"
    ? Math.max(1, Math.min(999, Math.floor(Number(input?.count ?? 1) || 1)))
    : null;
  const until = endMode === "on_date" && isIsoDate(input?.until) ? input.until ?? null : null;

  return {
    frequency,
    interval,
    weekdays: frequency === "weekly" ? (weekdays.length > 0 ? weekdays : [weekdayFromStart]) : [],
    endMode: frequency === "none" ? "never" : endMode,
    until: frequency === "none" ? null : until,
    count: frequency === "none" ? null : count,
  };
}

export function summarizeRecurrence(rule: ClassRecurrenceRule, startDate: string) {
  if (rule.frequency === "none") return "Does not repeat";
  const cadence = rule.interval > 1
    ? `Every ${rule.interval} ${rule.frequency === "daily" ? "days" : rule.frequency === "weekly" ? "weeks" : "months"}`
    : rule.frequency === "daily"
      ? "Daily"
      : rule.frequency === "weekly"
        ? "Weekly"
        : "Monthly";
  const weekdayText = rule.frequency === "weekly" && rule.weekdays.length
    ? ` on ${rule.weekdays.map((day) => WEEKDAY_LABEL[day]).join(", ")}`
    : "";
  const endText = rule.endMode === "on_date" && rule.until
    ? ` until ${formatSummaryDate(rule.until)}`
    : rule.endMode === "after_occurrences" && rule.count
      ? ` for ${rule.count} occurrence${rule.count === 1 ? "" : "s"}`
      : "";
  return `${cadence}${weekdayText} from ${formatSummaryDate(startDate)}${endText}`;
}

export function expandScheduleOccurrences(
  schedule: ScheduleExpansionSource,
  rangeStart: string,
  rangeEnd: string,
  maxOccurrences = 500
): ScheduleOccurrence[] {
  const rule = normalizeRecurrenceRule(schedule.recurrenceRule, schedule.startDate);
  const normalizedRangeStart = toUtcDate(rangeStart);
  const normalizedRangeEnd = toUtcDate(rangeEnd, true);

  if (rule.frequency === "none") {
    if (schedule.startDate < rangeStart || schedule.startDate > rangeEnd) return [];
    return [occurrenceForDate(schedule, schedule.startDate)];
  }

  const options = {
    freq: rule.frequency === "daily" ? RRule.DAILY : rule.frequency === "weekly" ? RRule.WEEKLY : RRule.MONTHLY,
    interval: rule.interval,
    dtstart: toUtcDate(schedule.startDate),
    until: rule.endMode === "on_date" && rule.until ? toUtcDate(rule.until, true) : undefined,
    count: rule.endMode === "after_occurrences" && rule.count ? rule.count : undefined,
    byweekday: rule.frequency === "weekly" ? rule.weekdays.map((day) => WEEKDAY_BY_CODE[day]) : undefined,
  };

  return new RRule(options)
    .between(normalizedRangeStart, normalizedRangeEnd, true)
    .slice(0, maxOccurrences)
    .map((date) => occurrenceForDate(schedule, dateToIso(date)));
}

export function isScheduleCourseAllowed(courseId: string | null | undefined, assignedCourseIds: string[]) {
  if (!courseId) return true;
  return assignedCourseIds.includes(courseId);
}

function occurrenceForDate(schedule: ScheduleExpansionSource, date: string): ScheduleOccurrence {
  return {
    scheduleId: schedule.id,
    date,
    startsAt: `${date}T${schedule.startTime}`,
    endsAt: `${date}T${schedule.endTime}`,
  };
}

function isWeekdayCode(value: unknown): value is RecurrenceWeekday {
  return value === "SU" || value === "MO" || value === "TU" || value === "WE" || value === "TH" || value === "FR" || value === "SA";
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function weekdayForDate(date: string): RecurrenceWeekday {
  return WEEKDAY_FROM_JS_DAY[toUtcDate(date).getUTCDay()] ?? "MO";
}

function toUtcDate(value: string, endOfDay = false) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0));
}

function dateToIso(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatSummaryDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })
    .format(toUtcDate(date));
}
