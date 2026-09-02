"use server";

import {
  rescheduleTeacherCalendar,
  rescheduleTeacherCalendarOccurrence,
  setTeacherOccurrenceState,
} from "@/lib/api/class-lms/teacher-operation-repository";

export async function rescheduleTeacherWorkspaceEvent(input: {
  scheduleId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
  expectedUpdatedAt: string;
  idempotencyKey: string;
}) {
  return rescheduleTeacherCalendar(input);
}

export async function setTeacherWorkspaceEventState(input: {
  occurrenceId: string;
  state: "scheduled" | "completed" | "cancelled";
  expectedUpdatedAt: string;
  idempotencyKey: string;
}) {
  return setTeacherOccurrenceState(input);
}

export async function rescheduleTeacherWorkspaceOccurrence(input: {
  occurrenceId: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  expectedUpdatedAt: string;
  idempotencyKey: string;
}) {
  return rescheduleTeacherCalendarOccurrence(input);
}
