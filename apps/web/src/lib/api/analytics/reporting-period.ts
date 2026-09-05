import type { ReportingPeriod } from "@/lib/analytics/contracts";
export const DEFAULT_CENTRE_TIMEZONE = "Asia/Ho_Chi_Minh";
export function validTimezone(value: unknown): string {
  if (typeof value === "string") {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value }).format();
      return value;
    } catch {
      /* fall through */
    }
  }
  return DEFAULT_CENTRE_TIMEZONE;
}
export function dateInZone(value: string | Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (name: string) =>
    parts.find((entry) => entry.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** Convert a local calendar-day boundary to UTC, including DST offset changes. */
export function localMidnight(date: string, timezone: string): string {
  const target = Date.parse(`${date}T00:00:00Z`);
  let instant = target;
  for (let i = 0; i < 4; i += 1) {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const v = (key: string) => p.find((entry) => entry.type === key)?.value;
    const represented = Date.parse(
      `${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}:${v("second")}Z`,
    );
    const next = instant + target - represented;
    if (next === instant) break;
    instant = next;
  }
  return new Date(instant).toISOString();
}
export function reportingPeriod(
  days: 7 | 30 | 90,
  timezone: string,
  now = new Date(),
): ReportingPeriod {
  const zone = validTimezone(timezone);
  const firstDay = new Date(`${dateInZone(now, zone)}T00:00:00Z`);
  firstDay.setUTCDate(firstDay.getUTCDate() - days + 1);
  return {
    days,
    timezone: zone,
    start: localMidnight(firstDay.toISOString().slice(0, 10), zone),
    end: now.toISOString(),
  };
}
