import type { TeacherCalendarEvent } from "@/lib/api/class-lms/teacher-calendar-model";

export interface PositionedTeacherEvent {
  event: TeacherCalendarEvent;
  startMinute: number;
  endMinute: number;
  lane: number;
  laneCount: number;
}

export function minutesInTimezone(value: string | Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: timezone,
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return part("hour") * 60 + part("minute");
}

export function dateInTimezone(value: string | Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: timezone,
  }).formatToParts(typeof value === "string" ? new Date(value) : value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/**
 * Stable interval partitioning. Every transitive overlap cluster shares the
 * same lane count, so equal inputs always render at equal widths.
 */
export function layoutTeacherEventLanes(
  events: TeacherCalendarEvent[],
  timezone: string,
): PositionedTeacherEvent[] {
  const ordered = events
    .map((event) => {
      const startMinute = minutesInTimezone(event.startsAt, timezone);
      let endMinute = minutesInTimezone(event.endsAt, timezone);
      if (endMinute <= startMinute) endMinute += 24 * 60;
      return { event, startMinute, endMinute, lane: 0, laneCount: 1 };
    })
    .sort(
      (left, right) =>
        left.startMinute - right.startMinute ||
        left.endMinute - right.endMinute ||
        left.event.id.localeCompare(right.event.id),
    );

  const output: PositionedTeacherEvent[] = [];
  let cluster: typeof ordered = [];
  let clusterEnd = -1;

  const flush = () => {
    if (!cluster.length) return;
    const laneEnds: number[] = [];
    for (const item of cluster) {
      let lane = laneEnds.findIndex((end) => end <= item.startMinute);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.endMinute;
      item.lane = lane;
    }
    const laneCount = Math.max(1, laneEnds.length);
    for (const item of cluster) output.push({ ...item, laneCount });
    cluster = [];
    clusterEnd = -1;
  };

  for (const item of ordered) {
    if (cluster.length && item.startMinute >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMinute);
  }
  flush();
  return output;
}

export function calendarEventGeometry(input: {
  startMinute: number;
  endMinute: number;
  gridStartMinute: number;
  gridEndMinute: number;
  hourHeight: number;
}) {
  const visibleStart = Math.max(input.gridStartMinute, input.startMinute);
  const visibleEnd = Math.min(input.gridEndMinute, input.endMinute);
  return {
    top: ((visibleStart - input.gridStartMinute) / 60) * input.hourHeight,
    height: Math.max(26, ((visibleEnd - visibleStart) / 60) * input.hourHeight),
  };
}
