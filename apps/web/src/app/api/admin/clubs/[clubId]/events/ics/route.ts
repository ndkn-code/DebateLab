import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_CLASS_TIMEZONE,
  expandScheduleOccurrences,
  normalizeRecurrenceRule,
  summarizeRecurrence,
} from "@/lib/api/admin-class-schedules-model";
import { createClient } from "@/lib/supabase/server";

function escapeIcs(value: string | null | undefined) {
  return (value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function compactDateTime(dateTime: string) {
  return dateTime.replace(/[-:]/g, "");
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const [{ data: club }, { data: events, error }] = await Promise.all([
    supabase.from("clubs").select("id, name").eq("id", clubId).single(),
    supabase
      .from("club_events")
      .select("*")
      .eq("club_id", clubId)
      .eq("status", "active")
      .order("start_date", { ascending: true }),
  ]);

  if (!club) return new NextResponse("Not found", { status: 404 });
  if (error) return new NextResponse(error.message, { status: 500 });

  const rangeStart = toIsoDate(new Date());
  const rangeEnd = toIsoDate(addDays(new Date(), 180));
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Thinkfy//Club OS//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeIcs(`${club.name} schedule`)}`,
  ];

  for (const event of events ?? []) {
    const startDate = String(event.start_date);
    const startTime = String(event.start_time).length === 5 ? `${event.start_time}:00` : String(event.start_time);
    const endTime = String(event.end_time).length === 5 ? `${event.end_time}:00` : String(event.end_time);
    const recurrenceRule = normalizeRecurrenceRule(event.recurrence_rule, startDate);
    const summary = event.recurrence_summary ?? summarizeRecurrence(recurrenceRule, startDate);
    const timezone = String(event.timezone ?? DEFAULT_CLASS_TIMEZONE);
    const occurrences = expandScheduleOccurrences({
      id: event.id as string,
      startDate,
      endDate: (event.end_date as string | null | undefined) ?? null,
      startTime,
      endTime,
      recurrenceRule,
    }, rangeStart, rangeEnd, 200);

    for (const occurrence of occurrences) {
      lines.push(
        "BEGIN:VEVENT",
        `UID:${event.id}-${occurrence.date}@thinkfy.net`,
        `DTSTAMP:${compactDateTime(new Date().toISOString().replace(/\.\d{3}Z$/, "Z"))}`,
        `DTSTART;TZID=${timezone}:${compactDateTime(occurrence.startsAt)}`,
        `DTEND;TZID=${timezone}:${compactDateTime(occurrence.endsAt)}`,
        `SUMMARY:${escapeIcs(event.title as string)}`,
        `DESCRIPTION:${escapeIcs(summary)}`,
        event.location || event.room ? `LOCATION:${escapeIcs([event.room, event.location].filter(Boolean).join(", "))}` : "",
        "END:VEVENT"
      );
    }
  }

  lines.push("END:VCALENDAR");

  return new NextResponse(lines.filter(Boolean).join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${clubId}-club-events.ics"`,
    },
  });
}
