const DAY_MS = 86_400_000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function dateKeyInTimezone(value: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function addIsoDateDays(value: string, days: number): string {
  if (!ISO_DATE_PATTERN.test(value)) throw new Error("Invalid calendar date");
  return new Date(new Date(`${value}T12:00:00Z`).getTime() + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function weekStartForTimezone(
  value: string | undefined,
  timezone: string,
  now = new Date(),
): string {
  if (value && !ISO_DATE_PATTERN.test(value)) {
    throw new Error("Invalid week date");
  }
  const anchor = value ?? dateKeyInTimezone(now, timezone);
  const parsed = new Date(`${anchor}T12:00:00Z`);
  const day = parsed.getUTCDay();
  parsed.setUTCDate(parsed.getUTCDate() - ((day + 6) % 7));
  return parsed.toISOString().slice(0, 10);
}
