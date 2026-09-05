import { z } from "zod";

const uuid = z.string().uuid();
const month = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM")
  .refine((value) => {
    const year = Number(value.slice(0, 4));
    return year >= 2000 && year <= 2100;
  }, "month year must be 2000-2100");
export const ParentReportInputSchema = z
  .object({ classId: uuid, studentId: uuid, month })
  .strict();
export type ParentReportInput = z.infer<typeof ParentReportInputSchema>;
const pad = (value: number) => String(value).padStart(2, "0");
function localMonth(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const monthValue = parts.find((part) => part.type === "month")?.value ?? "";
  return `${year}-${monthValue}`;
}
function shift(monthValue: string, delta: number): string {
  const date = new Date(
    Date.UTC(
      Number(monthValue.slice(0, 4)),
      Number(monthValue.slice(5)) - 1 + delta,
      1,
    ),
  );
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}
export function defaultReportMonth(
  now = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
): string {
  return shift(localMonth(now, timeZone), -1);
}
export function reportMonthOptions(
  now = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
): string[] {
  const current = localMonth(now, timeZone);
  return Array.from({ length: 24 }, (_, index) => shift(current, -index));
}
export function reportPeriod(
  monthValue: string,
  now = new Date(),
  timeZone = "Asia/Ho_Chi_Minh",
) {
  const parsed = month.parse(monthValue);
  const current = localMonth(now, timeZone);
  if (parsed > current) throw new Error("Report month cannot be in the future");
  const startDate = `${parsed}-01`;
  const next = shift(parsed, 1);
  const endDate = `${next}-01`;
  const start = localMidnight(startDate, timeZone);
  const end = localMidnight(endDate, timeZone);
  const endCapped = end > now ? now : end;
  return {
    month: parsed,
    timeZone,
    start: start.toISOString(),
    end: end.toISOString(),
    endCapped: endCapped.toISOString(),
    startDate,
    endDate,
    historyStart: shift(parsed, -5) + "-01",
    isCurrentMonth: parsed === current,
  };
}

/** Resolve calendar midnight in the centre's IANA zone, including DST changes. */
export function localMidnight(day: string, timeZone: string): Date {
  const target = Date.parse(`${day}T00:00:00Z`);
  let instant = target;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let iteration = 0; iteration < 4; iteration++) {
    const values = Object.fromEntries(
      formatter.formatToParts(instant).map((part) => [part.type, part.value]),
    );
    const wall = Date.parse(
      `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}Z`,
    );
    const correction = target - wall;
    if (correction === 0) return new Date(instant);
    instant += correction;
  }
  throw new Error(
    "Report month boundary could not be resolved in this time zone",
  );
}
