import assert from "node:assert/strict";
import test from "node:test";

import { buildTeacherWorkspaceDemoPresentation } from "./presentation";
import { loadTeacherWorkspacePresentation } from "./server-presentation";

type Loaders = NonNullable<
  Parameters<typeof loadTeacherWorkspacePresentation>[1]
>;
type Capability = Awaited<ReturnType<Loaders["capability"]>>;
type Calendar = Awaited<ReturnType<Loaders["calendar"]>>;
type CalendarInput = NonNullable<Parameters<Loaders["calendar"]>[0]>;
type ReviewInput = NonNullable<Parameters<Loaders["reviews"]>[0]>;
type Details = Awaited<ReturnType<Loaders["details"]>>;
type Gradebook = Awaited<ReturnType<Loaders["gradebook"]>>;

const demo = buildTeacherWorkspaceDemoPresentation({
  locale: "en",
  surface: "calendar",
  range: {
    startDate: "2026-08-31",
    endDate: "2026-09-06",
    view: "week",
    timezone: "America/New_York",
  },
});

const capability: Capability = {
  userId: "teacher-1",
  profileRole: "teacher",
  isPlatformAdmin: false,
  canAccess: true,
  shouldAutoEnter: true,
  isHeadTeacher: false,
  hasIeltsEntitlement: true,
  organizations: [
    {
      id: "thinkfy-academy",
      role: "teacher",
      featureEnabled: true,
      hasIeltsEntitlement: true,
    },
  ],
  classes: demo.classes.map(
    ({
      id,
      organizationId,
      title,
      programType,
      isAssigned,
      isLeadTeacher,
    }) => ({
      id,
      organizationId,
      title,
      programType,
      isAssigned,
      isLeadTeacher,
      featureEnabled: true,
    }),
  ),
};

const emptyReviews: Awaited<ReturnType<Loaders["reviews"]>> = {
  items: [],
  total: 0,
  counts: { needs_review: 0, returned: 0, draft: 0 },
  classes: [],
};

function calendarFor(input: CalendarInput): Calendar {
  const classId = input.classId;
  return {
    ...demo.calendar,
    events: classId
      ? demo.calendar.events.filter((event) => event.classId === classId)
      : demo.calendar.events,
    classes: classId
      ? demo.calendar.classes.filter((item) => item.id === classId)
      : demo.calendar.classes,
  };
}

function makeLoaders(overrides: Partial<Loaders> = {}): Loaders {
  return {
    capability: async () => capability,
    calendar: async (input) => calendarFor(input ?? {}),
    details: async (events) =>
      Object.fromEntries(
        events.map((event) => {
          const detail = demo.eventDetails[event.id];
          return [
            event.id,
            detail && {
              ...detail,
              roster: detail.roster.map((student) => ({
                ...student,
                enrollmentStatus: "enrolled" as const,
              })),
            },
          ];
        }),
      ) as Details,
    reviews: async () => emptyReviews,
    assignments: async () => [],
    resources: async () => [],
    announcements: async () => [],
    gradebook: async () => ({ rows: [] }) as unknown as Gradebook,
    ...overrides,
  };
}

const input = {
  locale: "en",
  surface: "calendar" as const,
  view: "week" as const,
  anchorDate: "2026-08-31",
};

const selectedEventId = demo.calendar.events[0].id;

test("calendar does not start unrelated review and content loaders", async () => {
  const calls: string[] = [];
  const result = await loadTeacherWorkspacePresentation(
    input,
    makeLoaders({
      reviews: async () => {
        calls.push("reviews");
        return emptyReviews;
      },
      assignments: async () => {
        calls.push("assignments");
        return [];
      },
      resources: async () => {
        calls.push("materials");
        return [];
      },
      announcements: async () => {
        calls.push("announcements");
        return [];
      },
      gradebook: async () => {
        calls.push("gradebook");
        return { rows: [] } as unknown as Gradebook;
      },
    }),
  );
  assert.equal(result.state, "ready");
  assert.deepEqual(calls, []);
  assert.ok(result.calendar.events.length > 0);
  assert.equal(result.dataStatus?.reviews, "not_requested");
});

test("review rejection leaves classes and calendar valid with unavailable status", async () => {
  const result = await loadTeacherWorkspacePresentation(
    { ...input, surface: "review-queue" },
    makeLoaders({
      reviews: async () => {
        throw new Error("upstream request timeout");
      },
    }),
  );
  assert.equal(result.state, "partial");
  assert.ok(result.classes.length > 0);
  assert.equal(result.classes[0].pendingReviews, 0);
  assert.equal(result.classes[0].reviewsStatus, "unavailable");
  assert.equal(result.dataStatus?.reviews, "unavailable");
});

test("review surface preserves class and locale filters on retry", async () => {
  const seen: Array<{ classId?: string; locale: string }> = [];
  let attempt = 0;
  const loaders = makeLoaders({
    reviews: async (params: ReviewInput = {}) => {
      seen.push({ classId: params.classId, locale: "vi" });
      attempt += 1;
      if (attempt === 1) throw new Error("timeout");
      return emptyReviews;
    },
  });
  const reviewInput = {
    locale: "vi",
    surface: "review-queue" as const,
    classId: capability.classes[0].id,
  };
  const failed = await loadTeacherWorkspacePresentation(
    reviewInput,
    loaders,
    20,
  );
  const retried = await loadTeacherWorkspacePresentation(
    reviewInput,
    loaders,
    100,
  );
  assert.equal(failed.state, "partial");
  assert.equal(failed.dataStatus?.reviews, "unavailable");
  assert.equal(retried.dataStatus?.reviews, "ready");
  assert.deepEqual(seen, [
    { classId: reviewInput.classId, locale: "vi" },
    { classId: reviewInput.classId, locale: "vi" },
  ]);
});

test("calendar failure stays truthful while authorized classes remain visible", async () => {
  const result = await loadTeacherWorkspacePresentation(
    input,
    makeLoaders({
      calendar: async () => {
        throw new Error("calendar backend unavailable");
      },
    }),
  );
  assert.equal(result.state, "partial");
  assert.ok(result.classes.length > 0);
  assert.equal(result.dataStatus?.calendar, "unavailable");
  assert.equal(result.classes[0].calendarStatus, "unavailable");
  assert.equal(result.calendar.events.length, 0);
});

test("capability and selected class authorization failures deny without reads", async () => {
  let reads = 0;
  const denied = await loadTeacherWorkspacePresentation(
    input,
    makeLoaders({
      capability: async () => ({ ...capability, canAccess: false }),
      calendar: async () => {
        reads += 1;
        return demo.calendar;
      },
    }),
  );
  assert.equal(denied.state, "denied");
  assert.equal(reads, 0);

  const unknownClass = await loadTeacherWorkspacePresentation(
    { ...input, classId: "other-class" },
    makeLoaders({
      calendar: async () => {
        reads += 1;
        return demo.calendar;
      },
    }),
  );
  assert.equal(unknownClass.state, "denied");
  assert.equal(reads, 0);
});

test("authorization boundary errors from calendar and event details deny truthfully", async () => {
  let detailReads = 0;
  const calendarDenied = await loadTeacherWorkspacePresentation(
    input,
    makeLoaders({
      calendar: async () => {
        throw new Error("Forbidden: calendar scope");
      },
    }),
  );
  assert.equal(calendarDenied.state, "denied");

  const event = demo.calendar.events[0];
  const detailDenied = await loadTeacherWorkspacePresentation(
    { ...input, eventId: event.id },
    makeLoaders({
      details: async () => {
        detailReads += 1;
        throw new Error("Unauthorized");
      },
    }),
  );
  assert.equal(detailDenied.state, "denied");
  assert.equal(detailReads, 1);
});

test("capability timeout is an error and never starts downstream reads", async () => {
  let downstreamReads = 0;
  const result = await loadTeacherWorkspacePresentation(
    input,
    makeLoaders({
      capability: () => new Promise<Capability>(() => undefined),
      calendar: async () => {
        downstreamReads += 1;
        return demo.calendar;
      },
      reviews: async () => {
        downstreamReads += 1;
        return emptyReviews;
      },
    }),
    10,
  );
  assert.equal(result.state, "error");
  assert.equal(downstreamReads, 0);
});

test("capability Forbidden is denied without downstream reads", async () => {
  let downstreamReads = 0;
  const result = await loadTeacherWorkspacePresentation(
    input,
    makeLoaders({
      capability: async () => {
        throw new Error("Forbidden");
      },
      calendar: async () => {
        downstreamReads += 1;
        return demo.calendar;
      },
    }),
  );
  assert.equal(result.state, "denied");
  assert.equal(downstreamReads, 0);
});

test("retry rechecks capability and discards unavailable review data after revocation", async () => {
  let capabilityReads = 0;
  let reviewReads = 0;
  const loaders = makeLoaders({
    capability: async () => {
      capabilityReads += 1;
      return capabilityReads === 1
        ? capability
        : { ...capability, canAccess: false };
    },
    reviews: async () => {
      reviewReads += 1;
      throw new Error("timeout");
    },
  });
  const reviewInput = { ...input, surface: "review-queue" as const };
  const failed = await loadTeacherWorkspacePresentation(
    reviewInput,
    loaders,
    20,
  );
  const denied = await loadTeacherWorkspacePresentation(
    reviewInput,
    loaders,
    100,
  );
  assert.equal(failed.state, "partial");
  assert.equal(denied.state, "denied");
  assert.deepEqual(denied.reviews, []);
  assert.equal(reviewReads, 1);
});

test("class detail tab loads only its requested source", async () => {
  const calls: string[] = [];
  const result = await loadTeacherWorkspacePresentation(
    {
      ...input,
      surface: "class-detail",
      classId: capability.classes[0].id,
      tab: "assignments",
    },
    makeLoaders({
      calendar: async () => {
        calls.push("calendar");
        return demo.calendar;
      },
      assignments: async () => {
        calls.push("assignments");
        return [];
      },
      reviews: async () => {
        calls.push("reviews");
        return emptyReviews;
      },
      details: async () => {
        calls.push("details");
        return {};
      },
      resources: async () => {
        calls.push("materials");
        return [];
      },
      announcements: async () => {
        calls.push("announcements");
        return [];
      },
      gradebook: async () => {
        calls.push("gradebook");
        return { rows: [] } as unknown as Gradebook;
      },
    }),
  );
  assert.equal(result.state, "ready");
  assert.deepEqual(calls, ["assignments"]);
});

test("selected event detail reads only that event", async () => {
  const seen: string[] = [];
  const result = await loadTeacherWorkspacePresentation(
    { ...input, eventId: selectedEventId },
    makeLoaders({
      details: async (events) => {
        seen.push(...events.map((event) => event.id));
        return {};
      },
    }),
  );
  assert.equal(result.state, "ready");
  assert.deepEqual(seen, [selectedEventId]);
});

test("failed event details leave calendar events visible and mark a partial result", async () => {
  const result = await loadTeacherWorkspacePresentation(
    { ...input, eventId: selectedEventId },
    makeLoaders({
      details: async () => {
        throw new Error("event detail unavailable");
      },
    }),
  );
  assert.equal(result.state, "partial");
  assert.equal(result.dataStatus?.details, "unavailable");
  assert.ok(result.calendar.events.length > 0);
  assert.deepEqual(result.eventDetails, {});
});

test("a delayed calendar reaches a bounded unavailable state", async () => {
  const result = await loadTeacherWorkspacePresentation(
    { ...input, eventId: selectedEventId },
    makeLoaders({
      calendar: () => new Promise<Calendar>(() => undefined),
    }),
    10,
  );
  assert.equal(result.dataStatus?.calendar, "unavailable");
  assert.equal(result.state, "partial");
});

test("late calendar completion cannot write details after the deadline", async () => {
  let detailReads = 0;
  let resolveCalendar!: (value: Calendar) => void;
  const resultPromise = loadTeacherWorkspacePresentation(
    input,
    makeLoaders({
      calendar: () =>
        new Promise<Calendar>((resolve) => {
          resolveCalendar = resolve;
        }),
      details: async () => {
        detailReads += 1;
        return {};
      },
    }),
    10,
  );
  const result = await resultPromise;
  resolveCalendar(demo.calendar);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(result.dataStatus?.calendar, "unavailable");
  assert.equal(detailReads, 0);
});

test("assignments rejection is unavailable instead of empty success", async () => {
  const result = await loadTeacherWorkspacePresentation(
    { ...input, surface: "assignments" },
    makeLoaders({
      assignments: async () => {
        throw new Error("assignments unavailable");
      },
    }),
  );
  assert.equal(result.state, "partial");
  assert.equal(result.dataStatus?.assignments, "unavailable");
  assert.equal(result.assignments.length, 0);
});

test("materials rejection is unavailable instead of empty success", async () => {
  const result = await loadTeacherWorkspacePresentation(
    { ...input, surface: "materials" },
    makeLoaders({
      resources: async () => {
        throw new Error("materials unavailable");
      },
    }),
  );
  assert.equal(result.state, "partial");
  assert.equal(result.dataStatus?.materials, "unavailable");
  assert.equal(result.materials.length, 0);
});

test("announcements rejection is unavailable instead of empty success", async () => {
  const result = await loadTeacherWorkspacePresentation(
    { ...input, surface: "announcements" },
    makeLoaders({
      announcements: async () => {
        throw new Error("announcements unavailable");
      },
    }),
  );
  assert.equal(result.state, "partial");
  assert.equal(result.dataStatus?.announcements, "unavailable");
  assert.equal(result.announcements.length, 0);
});

test("gradebook rejection is unavailable instead of empty success", async () => {
  const result = await loadTeacherWorkspacePresentation(
    { ...input, surface: "gradebook" },
    makeLoaders({
      gradebook: async () => {
        throw new Error("gradebook unavailable");
      },
    }),
  );
  assert.equal(result.state, "partial");
  assert.equal(result.dataStatus?.gradebook, "unavailable");
  assert.deepEqual(result.gradebook.students, []);
});
