import assert from "node:assert/strict";
import {
  collectParentReportRoster,
  createParentReportRepository,
  selectParentAttendanceSessions,
} from "./parent-report-repository";
import type { ParentReportRepositoryDependencies } from "./parent-report-repository";
import type { IeltsGradebookRow } from "./gradebook-repository";

const row = (userId: string): IeltsGradebookRow => ({
  userId,
  displayName: userId,
  email: "private@example.test",
  membershipStatus: "active",
  historical: false,
  attendance: { present: 0, late: 0, absent: 0, rate: null },
  courses: [],
  assignments: [],
});

async function main() {
  const complete = await collectParentReportRoster(async (cursor) => {
    const page =
      cursor === null
        ? Array.from({ length: 500 }, (_, index) => row(`student-${index}`))
        : [row("student-500")];
    return { rows: page, nextCursor: cursor === null ? "page-1" : null };
  });
  assert.equal(complete.length, 501);
  await assert.rejects(
    () =>
      collectParentReportRoster(async () => ({ rows: [], nextCursor: "same" })),
    /cursor did not advance/,
  );

  let trustedReads = 0;
  const deniedDeps = {
    createClient: async () => ({}),
    authorize: async () => {
      throw new Error("Forbidden");
    },
    createTrustedClient: () => {
      trustedReads += 1;
      return {};
    },
    loadGradebook: async () => ({ rows: [], nextCursor: null }),
  } as unknown as ParentReportRepositoryDependencies;
  await assert.rejects(
    () => createParentReportRepository(deniedDeps).loadRoster("class"),
    /Forbidden/,
  );
  assert.equal(
    trustedReads,
    0,
    "trusted client must not be created after authorization denial",
  );

  let invalidClientCalls = 0;
  const invalidDeps = {
    ...deniedDeps,
    createClient: async () => {
      invalidClientCalls += 1;
      return {};
    },
  } as unknown as ParentReportRepositoryDependencies;
  await assert.rejects(
    () =>
      createParentReportRepository(invalidDeps).loadReport({
        classId: "bad",
        studentId: "bad",
        month: "2026-08",
      }),
    /Invalid/,
  );
  assert.equal(
    invalidClientCalls,
    0,
    "strict UUID parsing precedes client creation",
  );

  function fakeClient(rows: Record<string, unknown[]>) {
    return {
      from(table: string) {
        const value = rows[table] ?? [];
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: () => builder,
          order: () => builder,
          range: () => builder,
          then: (
            resolve: (result: { data: unknown[]; error: null }) => unknown,
          ) => Promise.resolve(resolve({ data: value, error: null })),
        };
        return builder;
      },
    };
  }
  let membershipTrustedCalls = 0;
  const membershipDeps = {
    createClient: async () =>
      fakeClient({
        classes: [
          {
            id: "class",
            club_id: "club",
            title: "IELTS",
            program_type: "ielts",
          },
        ],
        clubs: [{ id: "club", name: "Centre", timezone: "Asia/Ho_Chi_Minh" }],
        lms_pilot_flags: [
          {
            club_id: "club",
            class_id: "00000000-0000-4000-8000-000000000001",
            feature_key: "teacher_workspace_v2",
            enabled: true,
          },
        ],
        class_memberships: [],
      }),
    authorize: async () => ({
      userId: "teacher",
      classId: "class",
      clubId: "club",
      role: "admin" as const,
    }),
    createTrustedClient: () => {
      membershipTrustedCalls += 1;
      return fakeClient({});
    },
    loadGradebook: async () => ({ rows: [], nextCursor: null }),
  } as unknown as ParentReportRepositoryDependencies;
  await assert.rejects(
    () =>
      createParentReportRepository(membershipDeps).loadReport(
        {
          classId: "00000000-0000-4000-8000-000000000001",
          studentId: "00000000-0000-4000-8000-000000000002",
          month: "2026-08",
        },
        new Date("2026-09-01T00:00:00Z"),
      ),
    /outside this class/,
  );
  assert.equal(
    membershipTrustedCalls,
    0,
    "trusted client is deferred until membership validation",
  );

  let disabledTrustedCalls = 0;
  const disabledDeps = {
    ...membershipDeps,
    createClient: async () =>
      fakeClient({
        classes: [
          {
            id: "class",
            club_id: "club",
            title: "IELTS",
            program_type: "ielts",
          },
        ],
        clubs: [{ id: "club", name: "Centre", timezone: "Asia/Ho_Chi_Minh" }],
        lms_pilot_flags: [],
      }),
    createTrustedClient: () => {
      disabledTrustedCalls++;
      return fakeClient({});
    },
  } as unknown as ParentReportRepositoryDependencies;
  await assert.rejects(
    () =>
      createParentReportRepository(disabledDeps).loadRoster(
        "00000000-0000-4000-8000-000000000001",
      ),
    /not enabled/,
  );
  assert.equal(
    disabledTrustedCalls,
    0,
    "disabled capability cannot create a trusted client",
  );

  const now = new Date("2026-08-31T17:00:00.000Z");
  const sessions = [
    { id: "future", session_date: "2026-09-02", title: "Future" },
    {
      id: "cancelled",
      session_date: "2026-08-10",
      title: "Cancelled",
      occurrence_id: "occ-cancelled",
    },
    {
      id: "historical",
      session_date: "2026-08-11",
      title: "Historical",
      occurrence_id: "occ-historical",
    },
    {
      id: "snapshot-only",
      session_date: "2026-08-13",
      title: "Snapshot only",
      occurrence_id: "occ-snapshot",
    },
    { id: "unmarked", session_date: "2026-08-12", title: "Unmarked" },
  ];
  const selected = selectParentAttendanceSessions({
    sessions,
    records: [{ session_id: "historical", status: "present" }],
    occurrences: [
      {
        id: "occ-cancelled",
        status: "cancelled",
        occurrence_date: "2026-08-10",
        starts_at: "2026-08-10T10:00:00Z",
      },
      {
        id: "occ-historical",
        status: "completed",
        occurrence_date: "2026-08-11",
        starts_at: "2026-08-11T10:00:00Z",
      },
      {
        id: "occ-snapshot",
        status: "completed",
        occurrence_date: "2026-08-13",
        starts_at: "2026-08-13T10:00:00Z",
      },
    ],
    snapshots: [
      {
        occurrence_id: "occ-historical",
        user_id: "student",
        enrollment_status: "removed_after_occurrence",
      },
      {
        occurrence_id: "occ-snapshot",
        user_id: "student",
        enrollment_status: "removed_after_occurrence",
      },
    ],
    membership: {
      user_id: "student",
      joined_at: "2026-08-01T00:00:00Z",
      removed_at: "2026-08-15T00:00:00Z",
    },
    studentId: "student",
    timeZone: "Asia/Ho_Chi_Minh",
    now,
  });
  assert.deepEqual(
    selected.map((item) => item.sessionId),
    ["historical", "unmarked", "snapshot-only"],
  );
  assert.equal(selected[0].status, "present");
  assert.equal(selected[1].status, "unmarked");
  assert.equal(selected[2].status, "unmarked");

  console.log("parent report repository tests passed");
}
void main();
