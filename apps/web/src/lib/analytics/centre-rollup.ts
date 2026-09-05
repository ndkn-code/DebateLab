import {
  AI_MARKING_MINUTES_PER_TASK2,
  type CentreAnalyticsInput,
  type CentreAnalytics,
  type CentreEventFact,
} from "./contracts";
const unique = <T>(values: readonly T[]) => [...new Set(values)];
function localDay(value: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function key(event: CentreEventFact): string {
  return event.kind === "ai-grading"
    ? `ai:${event.responseId ?? event.id}`
    : `${event.kind}:${event.id}:${event.kind === "feedback" ? (event.revision ?? "") : ""}`;
}
/** Deduplicate before period filtering: retries cannot move original delivery into another period. */
function dedupe(events: readonly CentreEventFact[]): CentreEventFact[] {
  const selected = new Map<string, CentreEventFact>();
  for (const event of events) {
    if (!Number.isFinite(Date.parse(event.occurredAt))) continue;
    const id = key(event);
    const prior = selected.get(id);
    if (
      !prior ||
      (prior.status === "pending" && event.status === "published") ||
      (prior.status === event.status && event.occurredAt < prior.occurredAt)
    )
      selected.set(id, event);
  }
  return [...selected.values()];
}
function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}
export function estimateMarkingWorkload(
  qualifyingResponses: number,
  minutesPerResponse = AI_MARKING_MINUTES_PER_TASK2,
) {
  const count = Number.isFinite(qualifyingResponses)
    ? Math.max(0, Math.floor(qualifyingResponses))
    : 0;
  const minutes = Number.isFinite(minutesPerResponse)
    ? Math.min(120, Math.max(0, minutesPerResponse))
    : AI_MARKING_MINUTES_PER_TASK2;
  return {
    hours: (count * minutes) / 60,
    qualifyingResponses: count,
    minutesPerResponse: minutes,
  };
}
export function buildCentreAnalytics(
  input: CentreAnalyticsInput,
): CentreAnalytics {
  // Required input failures invalidate the report. Optional gated IELTS metrics are
  // represented by sources.ielts and rendered unavailable rather than as zero.
  if (
    input.events.some((event) => event.sourceAvailable === false) ||
    input.sources?.operations === "unavailable"
  )
    throw new Error("Required analytics source unavailable");
  const events = dedupe(input.events).filter(
    (event) =>
      Date.parse(event.occurredAt) >= Date.parse(input.period.start) &&
      Date.parse(event.occurredAt) <= Date.parse(input.period.end),
  );
  const sessions = events.filter(
    (event) => event.kind === "session" && event.status === "completed",
  );
  const mocks = events.filter(
    (event) => event.kind === "mock" && event.status === "graded",
  );
  const feedback = events.filter(
    (event) => event.kind === "feedback" && event.status === "published",
  );
  const teacherFeedback = events.filter(
    (event) =>
      event.kind === "teacher-review" ||
      (event.kind === "feedback" &&
        !event.responseId &&
        event.status === "published"),
  );
  const durations = feedback.flatMap((event) =>
    typeof event.turnedAroundHours === "number" &&
    Number.isFinite(event.turnedAroundHours) &&
    event.turnedAroundHours >= 0
      ? [event.turnedAroundHours]
      : [],
  );
  const pending = events.filter(
    (event) => event.kind === "feedback" && event.status === "pending",
  );
  const ai = events.filter(
    (event) =>
      event.kind === "ai-grading" &&
      event.status === "scored" &&
      event.responseId,
  );
  const task2 = ai.filter(
    (event) => event.skill === "writing" && event.taskNumber === 2,
  );
  const activity = events.filter((event) => event.kind === "activity");
  const activeCount = (items: readonly CentreEventFact[]) =>
    unique(items.flatMap((event) => (event.learnerId ? [event.learnerId] : [])))
      .length;
  const days: string[] = [];
  const cursor = new Date(
    `${localDay(input.period.start, input.period.timezone)}T00:00:00Z`,
  );
  const endDay = localDay(input.period.end, input.period.timezone);
  while (cursor.toISOString().slice(0, 10) <= endDay && days.length <= 90) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const onDay = (items: readonly CentreEventFact[], day: string) =>
    items.filter(
      (event) => localDay(event.occurredAt, input.period.timezone) === day,
    ).length;
  const dailyTrend = days.map((date) => ({
    date,
    sessions: onDay(sessions, date),
    mocksGraded: onDay(mocks, date),
    aiResponses: onDay(ai, date),
  }));
  const classRows = input.classes.map((klass) => ({
    classId: klass.classId,
    classTitle: klass.title,
    sessions: sessions.filter((event) => event.classId === klass.classId)
      .length,
    mocksGraded: mocks.filter((event) => event.classId === klass.classId)
      .length,
    activeLearners: activeCount(
      activity.filter((event) => event.classId === klass.classId),
    ),
  }));
  const teacherIds = unique([
    ...input.classes.flatMap((klass) => klass.teacherIds),
    ...events.flatMap((event) => (event.teacherId ? [event.teacherId] : [])),
  ]).sort();
  const teacherRows = teacherIds.map((teacherId) => ({
    teacherId,
    currentClassIds: input.classes
      .filter((klass) => klass.teacherIds.includes(teacherId))
      .map((klass) => klass.classId),
    sessions: sessions.filter((event) => event.teacherId === teacherId).length,
    mocksGraded: mocks.filter((event) => event.teacherId === teacherId).length,
    activeLearners: activeCount(
      events.filter(
        (event) => event.teacherId === teacherId && event.status !== "pending",
      ),
    ),
    publishedFeedback: teacherFeedback.filter(
      (event) => event.teacherId === teacherId,
    ).length,
  }));
  const classTeacherRows = input.classes.flatMap((klass) =>
    teacherIds
      .filter(
        (id) =>
          klass.teacherIds.includes(id) ||
          events.some(
            (event) =>
              event.classId === klass.classId && event.teacherId === id,
          ),
      )
      .map((teacherId) => ({
        classId: klass.classId,
        classTitle: klass.title,
        teacherId,
        sessions: sessions.filter(
          (event) =>
            event.classId === klass.classId && event.teacherId === teacherId,
        ).length,
        mocksGraded: mocks.filter(
          (event) =>
            event.classId === klass.classId && event.teacherId === teacherId,
        ).length,
        activeLearners: activeCount(
          events.filter(
            (event) =>
              event.classId === klass.classId &&
              event.teacherId === teacherId &&
              event.status !== "pending",
          ),
        ),
      })),
  );
  return {
    coverage: {
      classesIncluded: input.classes.length,
      publishedFeedback: feedback.length,
      feedbackWithKnownDuration: durations.length,
    },
    clubId: input.clubId,
    viewerId: input.viewerId,
    teacherNames: {},
    period: input.period,
    sessions: sessions.length,
    mocksGraded: {
      total: mocks.length,
      provisional: mocks.filter((event) => event.stage !== "confirmed").length,
      confirmed: mocks.filter((event) => event.stage === "confirmed").length,
    },
    turnedAroundRevisions: {
      count: feedback.length,
      medianHours: median(durations),
      pending: pending.length,
    },
    activeLearners: activeCount(activity),
    uniqueAiResponses: ai.length,
    markingWorkload: estimateMarkingWorkload(task2.length),
    dailyTrend,
    classTeacherRows,
    classRows,
    teacherRows,
    sources: input.sources ?? { operations: "available", ielts: "available" },
  };
}
