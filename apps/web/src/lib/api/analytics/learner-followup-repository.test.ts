import assert from "node:assert/strict";
import test from "node:test";
import { fixtureClient } from "./rest-fixture";
import { AnalyticsForbidden } from "./access";
import { loadLearnerFollowup } from "./learner-followup-repository";
import type { ClassAnalyticsData } from "./class-repository";
import { TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS } from "@/lib/api/class-lms/teacher-workspace-capability";

const managerTables = (membership: Record<string, unknown>[]) => ({
  profiles: [{ id: "actor", role: "owner" }],
  classes: [{ id: "class", club_id: "centre", program_type: "ielts", title: "Class" }],
  club_memberships: [{ id: "club", club_id: "centre", user_id: "actor", role: "owner", status: "active" }],
  class_memberships: membership,
  lms_pilot_flags: TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS.map((feature_key, index) => ({
    id: `flag-${index}`,
    club_id: "centre",
    class_id: "class",
    feature_key,
    enabled: true,
  })),
});

const emptyData = (studentId: string): ClassAnalyticsData => ({
  report: {
    classId: "class", clubId: "centre", classTitle: "Class",
    period: { days: 7, timezone: "UTC", start: "2026-01-01", end: "2026-01-08" },
    assessments: [], skillSummaries: [], criterionSummaries: [], reteachPriorities: [],
    attention: [], insufficientEvidence: [], groups: [],
    groupsMissingEvidence: { listening: [], reading: [], writing: [], speaking: [] },
    sources: { gradebook: "available" }, coverage: { learnerCount: 1, totalLearners: 1 },
  },
  snapshot: {
    gradebook: {
      classId: "class", clubId: "centre", classTitle: "Class", rubric: [] as never,
      rows: [{ userId: studentId, displayName: "Learner", email: "", membershipStatus: "active", historical: false, attendance: { present: 0, late: 0, absent: 0, rate: null }, courses: [], assignments: [] }],
      nextCursor: null,
      summary: { totalStudents: 1, started: 0, submitted: 0, completed: 0, needsReview: 0, averageOverallBand: null, skillAverages: { listening: null, reading: null, writing: null, speaking: null } },
    }, speakingRows: [],
  },
  weakSubskills: [], attendance: [], sourceErrors: {},
});
const manager = { classId: "class", clubId: "centre", userId: "actor", role: "owner" as const };
const authorized = { requireClass: async () => manager };

test("unauthorized manager is rejected before learner membership or trusted reads", async () => {
  const fixture = fixtureClient(managerTables([]));
  await assert.rejects(loadLearnerFollowup("class", "student", 7, {
    client: fixture.client,
    requireClass: async () => { throw new AnalyticsForbidden("Forbidden"); },
    trustedFactory: () => { throw new Error("trusted client must not be created"); },
  }), AnalyticsForbidden);
  assert.ok(!fixture.requests.some((url) => url.pathname.endsWith("/class_memberships")));
});

test("wrong or removed learner is rejected before trusted client creation", async () => {
  const fixture = fixtureClient(managerTables([{ id: "teacher", class_id: "class", user_id: "actor", member_role: "teacher", status: "active" }]));
  await assert.rejects(loadLearnerFollowup("class", "student", 7, {
    client: fixture.client,
    ...authorized,
    trustedFactory: () => { throw new Error("trusted client must not be created"); },
  }), AnalyticsForbidden);
});

test("membership query failure is unavailable and does not become forbidden", async () => {
  const fixture = fixtureClient(managerTables([{ id: "student", class_id: "class", user_id: "student", member_role: "student", status: "active" }]));
  await assert.rejects(loadLearnerFollowup("class", "student", 7, {
    client: fixture.client,
    ...authorized,
    checkMembership: async () => ({ data: null, error: { message: "membership timeout" } }),
  }), /Learner membership unavailable: membership timeout/);
});

test("valid active learner creates trusted access and loads one authorized snapshot", async () => {
  const fixture = fixtureClient(managerTables([{ id: "student", class_id: "class", user_id: "student", member_role: "student", status: "active" }]));
  let trustedReads = 0;
  let analyticsReads = 0;
  const result = await loadLearnerFollowup("class", "student", 7, {
    client: fixture.client,
    ...authorized,
    trustedFactory: () => { trustedReads += 1; return fixture.client as never; },
    loadAnalytics: async () => { analyticsReads += 1; return emptyData("student"); },
  });
  assert.equal(result.studentId, "student");
  assert.equal(trustedReads, 1);
  assert.equal(analyticsReads, 1);
});
