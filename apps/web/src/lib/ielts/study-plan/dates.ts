const DAY_MS = 86_400_000;
const ISO_DATE_LENGTH = 10;

export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function formatIsoDate(value: Date): string {
  return value.toISOString().slice(0, ISO_DATE_LENGTH);
}

export function addCalendarDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  return formatIsoDate(new Date(date.getTime() + days * DAY_MS));
}

export function diffCalendarDays(from: string, to: string): number {
  return Math.ceil((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / DAY_MS);
}

export function isoWeekday(value: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = parseIsoDate(value).getUTCDay();
  return day === 0 ? 7 : (day as 1 | 2 | 3 | 4 | 5 | 6);
}

export function listHorizonDates(startDate: string, horizonDays: number): string[] {
  return Array.from({ length: horizonDays }, (_, index) =>
    addCalendarDays(startDate, index),
  );
}

export function isSameOrBeforeIsoDate(left: string, right: string): boolean {
  return parseIsoDate(left).getTime() <= parseIsoDate(right).getTime();
}
