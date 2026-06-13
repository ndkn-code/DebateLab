"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, Clock3, Download, MapPin, Plus, Repeat2, Save, Trash2, X } from "@/components/ui/icons";
import { deleteClubEvent, saveClubEvent } from "@/app/actions/admin-clubs";
import {
  DEFAULT_CLASS_TIMEZONE,
  normalizeRecurrenceRule,
  summarizeRecurrence,
} from "@/lib/api/admin-class-schedules-model";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type {
  AdminClubDetailData,
  AdminClubEvent,
  ClubEventType,
} from "@/lib/types/admin-clubs";
import type { RecurrenceEndMode, RecurrenceFrequency, RecurrenceWeekday } from "@/lib/types/admin-classes";

const WEEKDAYS: Array<{ value: RecurrenceWeekday; label: string }> = [
  { value: "SU", label: "Sun" },
  { value: "MO", label: "Mon" },
  { value: "TU", label: "Tue" },
  { value: "WE", label: "Wed" },
  { value: "TH", label: "Thu" },
  { value: "FR", label: "Fri" },
  { value: "SA", label: "Sat" },
];

const EVENT_TYPES: Array<{ value: ClubEventType; label: string }> = [
  { value: "meeting", label: "Meeting" },
  { value: "workshop", label: "Workshop" },
  { value: "tournament", label: "Tournament" },
  { value: "social", label: "Social" },
  { value: "deadline", label: "Deadline" },
  { value: "other", label: "Other" },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

export function ClubSchedulePanel({ data }: { data: AdminClubDetailData }) {
  const [editingEvent, setEditingEvent] = useState<AdminClubEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const upcoming = data.eventOccurrences.slice(0, 10);

  function openEditor(event?: AdminClubEvent | null) {
    setEditingEvent(event ?? null);
    setEditorOpen(true);
  }

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-outline-variant bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant px-4 py-3">
          <div>
            <h2 className="text-base font-bold text-on-surface">Club schedule</h2>
            <p className="mt-0.5 text-xs text-on-surface-variant">Club-wide meetings, cohort-linked events, and exportable calendar entries</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/admin/clubs/${data.club.id}/events/ics`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-outline-variant bg-white px-3 text-xs font-bold text-on-surface"
            >
              <Download className="h-4 w-4 text-primary" />
              ICS
            </a>
            <button
              type="button"
              onClick={() => openEditor()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white"
            >
              <Plus className="h-4 w-4" />
              New event
            </button>
          </div>
        </div>

        <div className="divide-y divide-[#EEF3FA]">
          {data.events.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => openEditor(event)}
              className="grid w-full gap-3 px-4 py-3 text-left transition hover:bg-background sm:grid-cols-[1fr_140px_96px]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-bold text-on-surface">{event.title}</p>
                  <span className="rounded-md border border-outline-variant bg-surface-container px-2 py-0.5 type-caption font-bold capitalize text-on-surface-variant">
                    {event.eventType}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-on-surface-variant">
                  {event.classTitle ?? "Whole club"} · {event.recurrenceSummary}
                </p>
              </div>
              <div className="text-sm font-semibold text-on-surface-variant">
                {formatDate(event.startDate)}
              </div>
              <div className="text-sm font-semibold text-on-surface-variant">
                {formatTime(event.startTime)}-{formatTime(event.endTime)}
              </div>
            </button>
          ))}
          {!data.events.length && (
            <div className="px-4 py-16 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-primary" />
              <p className="mt-3 text-sm font-bold text-on-surface">No club events yet</p>
              <p className="mt-1 text-sm text-on-surface-variant">Create the first meeting or event for this club.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="rounded-lg border border-outline-variant bg-white p-4 shadow-sm">
        <h2 className="text-base font-bold text-on-surface">Next on calendar</h2>
        <div className="mt-3 space-y-3">
          {upcoming.map((occurrence) => (
            <div key={occurrence.id} className="rounded-lg border border-outline-variant bg-background p-3">
              <p className="text-sm font-bold text-on-surface">{occurrence.title}</p>
              <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                <span className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {formatDate(occurrence.date)} · {formatTime(occurrence.startsAt.split("T")[1] ?? "")}
                </span>
                {(occurrence.room || occurrence.location) && (
                  <span className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    {[occurrence.room, occurrence.location].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </div>
          ))}
          {!upcoming.length && <p className="py-8 text-center text-sm text-on-surface-variant">No upcoming occurrences in range.</p>}
        </div>
      </aside>

      {editorOpen && (
        <ClubEventEditor
          clubId={data.club.id}
          cohorts={data.cohorts}
          event={editingEvent}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </div>
  );
}

function ClubEventEditor({
  clubId,
  cohorts,
  event,
  onClose,
}: {
  clubId: string;
  cohorts: AdminClubDetailData["cohorts"];
  event: AdminClubEvent | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [classId, setClassId] = useState(event?.classId ?? "");
  const [title, setTitle] = useState(event?.title ?? "");
  const [eventType, setEventType] = useState<ClubEventType>(event?.eventType ?? "meeting");
  const [room, setRoom] = useState(event?.room ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startDate, setStartDate] = useState(event?.startDate ?? today);
  const [startTime, setStartTime] = useState((event?.startTime ?? "17:00:00").slice(0, 5));
  const [endTime, setEndTime] = useState((event?.endTime ?? "18:30:00").slice(0, 5));
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(event?.recurrenceRule.frequency ?? "weekly");
  const [interval, setInterval] = useState(String(event?.recurrenceRule.interval ?? 1));
  const [weekdays, setWeekdays] = useState<RecurrenceWeekday[]>(event?.recurrenceRule.weekdays ?? ["MO"]);
  const [endMode, setEndMode] = useState<RecurrenceEndMode>(event?.recurrenceRule.endMode ?? "on_date");
  const [until, setUntil] = useState(event?.recurrenceRule.until ?? event?.endDate ?? today);
  const [count, setCount] = useState(String(event?.recurrenceRule.count ?? 12));

  const recurrenceRule = useMemo(() => normalizeRecurrenceRule({
    frequency,
    interval: Number(interval),
    weekdays,
    endMode,
    until,
    count: Number(count),
  }, startDate), [count, endMode, frequency, interval, startDate, until, weekdays]);

  const recurrenceSummary = useMemo(
    () => summarizeRecurrence(recurrenceRule, startDate),
    [recurrenceRule, startDate]
  );

  function toggleWeekday(day: RecurrenceWeekday) {
    setWeekdays((current) => current.includes(day)
      ? current.filter((item) => item !== day)
      : [...current, day]
    );
  }

  function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await saveClubEvent({
          id: event?.id,
          clubId,
          classId: classId || null,
          title,
          eventType,
          room,
          location,
          startDate,
          endDate: recurrenceRule.until,
          startTime,
          endTime,
          timezone: DEFAULT_CLASS_TIMEZONE,
          recurrenceRule,
        });
        onClose();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Event could not be saved.");
      }
    });
  }

  function archive() {
    if (!event) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteClubEvent(clubId, event.id);
        onClose();
        router.refresh();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Event could not be archived.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-surface-container-high/30 backdrop-blur-sm sm:items-stretch">
      <form onSubmit={submit} className="flex max-h-[92dvh] w-full flex-col rounded-t-lg border border-outline-variant bg-white shadow-2xl sm:h-full sm:max-h-none sm:max-w-md sm:rounded-none sm:border-y-0 sm:border-r-0">
        <div className="flex h-16 items-center justify-between border-b border-outline-variant px-5">
          <div>
            <h2 className="text-lg font-bold text-on-surface">{event ? "Edit event" : "New event"}</h2>
            <p className="text-xs text-on-surface-variant">Club schedule entry</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container" aria-label="Close event editor">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {error && <div className="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-sm text-on-surface-variant">{error}</div>}
          <label className="block">
            <span className="text-xs font-semibold text-on-surface-variant">Cohort</span>
            <select value={classId} onChange={(changeEvent) => setClassId(changeEvent.target.value)} className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary">
              <option value="">Whole club</option>
              {cohorts.map((cohort) => (
                <option key={cohort.id} value={cohort.id}>{cohort.title}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-on-surface-variant">Title</span>
            <input value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} required placeholder="Weekly sparring round" className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">Type</span>
              <select value={eventType} onChange={(changeEvent) => setEventType(changeEvent.target.value as ClubEventType)} className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary">
                {EVENT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">Room</span>
              <input value={room} onChange={(changeEvent) => setRoom(changeEvent.target.value)} placeholder="Room 204" className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-on-surface-variant">Location</span>
            <input value={location} onChange={(changeEvent) => setLocation(changeEvent.target.value)} placeholder="Ha Noi campus" className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary" />
          </label>
          <div className="grid grid-cols-3 gap-3">
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">Date</span>
              <input type="date" value={startDate} onChange={(changeEvent) => setStartDate(changeEvent.target.value)} required className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary" />
            </label>
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">Start</span>
              <input type="time" value={startTime} onChange={(changeEvent) => setStartTime(changeEvent.target.value)} required className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary" />
            </label>
            <label>
              <span className="text-xs font-semibold text-on-surface-variant">End</span>
              <input type="time" value={endTime} onChange={(changeEvent) => setEndTime(changeEvent.target.value)} required className="mt-1 h-11 w-full rounded-lg border border-outline-variant bg-background px-3 text-sm outline-none focus:border-primary" />
            </label>
          </div>

          <section className="rounded-lg border border-outline-variant bg-background p-3">
            <div className="flex items-center gap-2 text-sm font-bold text-on-surface">
              <Repeat2 className="h-4 w-4 text-primary" />
              Repeat
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <select value={frequency} onChange={(changeEvent) => setFrequency(changeEvent.target.value as RecurrenceFrequency)} className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <input type="number" min={1} max={99} value={interval} onChange={(changeEvent) => setInterval(changeEvent.target.value)} className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" />
            </div>
            {frequency === "weekly" && (
              <div className="mt-3 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWeekday(day.value)}
                    className={cn(
                      "h-9 rounded-lg border text-xs font-bold",
                      weekdays.includes(day.value)
                        ? "border-primary bg-surface-container text-on-surface-variant"
                        : "border-outline-variant bg-white text-on-surface-variant"
                    )}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
            {frequency !== "none" && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <select value={endMode} onChange={(changeEvent) => setEndMode(changeEvent.target.value as RecurrenceEndMode)} className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary">
                  <option value="never">Never ends</option>
                  <option value="on_date">Ends on date</option>
                  <option value="after_occurrences">After count</option>
                </select>
                {endMode === "on_date" ? (
                  <input type="date" value={until} onChange={(changeEvent) => setUntil(changeEvent.target.value)} className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" />
                ) : (
                  <input type="number" min={1} max={999} value={count} onChange={(changeEvent) => setCount(changeEvent.target.value)} className="h-10 rounded-lg border border-outline-variant bg-white px-3 text-sm outline-none focus:border-primary" />
                )}
              </div>
            )}
            <p className="mt-3 rounded-lg border border-outline-variant bg-white px-3 py-2 text-xs font-semibold text-on-surface-variant">
              {recurrenceSummary}
            </p>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-outline-variant p-4 sm:flex-row sm:items-center sm:justify-between">
          {event ? (
            <button type="button" onClick={archive} disabled={isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-outline-variant bg-white px-4 text-sm font-bold text-on-surface-variant">
              <Trash2 className="h-4 w-4" />
              Archive
            </button>
          ) : <span />}
          <button type="submit" disabled={isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:bg-surface-container-high">
            {isPending ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isPending ? "Saving..." : "Save event"}
          </button>
        </div>
      </form>
    </div>
  );
}
