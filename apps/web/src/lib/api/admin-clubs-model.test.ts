import assert from "node:assert/strict";
import {
  buildClubDashboardKpis,
  buildWeakestSkills,
  normalizeClubRecipients,
  normalizeSocialUrl,
  normalizeVietnamCity,
  normalizeClubAssignmentStatus,
  validateClubCreationInput,
  validateClubAssignmentInput,
  validateClubEventInput,
} from "./admin-clubs-model";
import type {
  AdminClubAssignmentRow,
  AdminClubPerformanceAttempt,
  AdminClubReviewQueueItem,
} from "@/lib/types/admin-clubs";

const clubId = "00000000-0000-4c00-8000-000000000002";
const assignment: AdminClubAssignmentRow = {
  id: "00000000-0000-4c20-8000-000000000001",
  clubId,
  classId: "00000000-0000-4500-8000-000000000001",
  classTitle: "Cohort A",
  title: "Policy Case",
  description: null,
  assignmentType: "practice",
  assignedTrack: "debate",
  topicTitle: "Policy Case",
  topicCategory: "Debate",
  dueAt: "2026-05-22T00:00:00.000Z",
  requiredAttempts: 1,
  rubricKey: "debate_v1",
  rubricVersion: 1,
  status: "active",
  submissionCount: 8,
  uniqueSubmitters: 8,
  averageScore: 72,
  isHomework: false,
  submissionTextEnabled: true,
  submissionFilesEnabled: false,
  submissionMaxFiles: 3,
  submissionMaxFileMb: 10,
  submissionAllowedExt: null,
  submissionInstructions: null,
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

const attempts: AdminClubPerformanceAttempt[] = [
  {
    id: "00000000-0000-4c30-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000101",
    studentName: "Student A",
    clubId,
    classId: assignment.classId,
    classTitle: "Cohort A",
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    practiceTrack: "debate",
    format: "full",
    topicTitle: assignment.title,
    durationSeconds: 420,
    wordCount: 600,
    overallScore: 70,
    overallBand: "Competent",
    skillScores: { rebuttal: 54, logic: 68, evidence: 64 },
    occurredAt: "2026-05-14T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4c30-8000-000000000002",
    userId: "00000000-0000-4000-8000-000000000102",
    studentName: "Student B",
    clubId,
    classId: assignment.classId,
    classTitle: "Cohort A",
    assignmentId: assignment.id,
    assignmentTitle: assignment.title,
    practiceTrack: "debate",
    format: "full",
    topicTitle: assignment.title,
    durationSeconds: 480,
    wordCount: 640,
    overallScore: 80,
    overallBand: "Proficient",
    skillScores: { rebuttal: 58, logic: 75, evidence: 70 },
    occurredAt: "2026-05-15T00:00:00.000Z",
  },
];

const reviews: AdminClubReviewQueueItem[] = [
  {
    id: "review-1",
    attemptId: attempts[0].id,
    studentName: "Student A",
    title: "Policy Case",
    cohort: "Cohort A",
    priority: "medium",
    submittedAt: attempts[0].occurredAt,
    status: "open",
  },
];

assert.equal(normalizeClubAssignmentStatus("active"), "active");
assert.equal(normalizeClubAssignmentStatus("bad"), "draft");
assert.equal(normalizeVietnamCity("ha noi"), "Ha Noi");
assert.equal(normalizeVietnamCity("New York"), null);
assert.equal(normalizeSocialUrl("https://facebook.com/debatelab", { required: true, hostIncludes: "facebook.com" }), "https://facebook.com/debatelab");
assert.equal(
  normalizeClubRecipients([
    { email: "Coach@Example.com", role: "owner" },
    { email: "Coach@Example.com", role: "owner" },
    { email: "bad", role: "coach" },
  ]).length,
  1
);

assert.deepEqual(
  validateClubAssignmentInput({
    clubId,
    title: "Policy Case",
    requiredAttempts: 1,
    rubricVersion: 1,
  }),
  { ok: true }
);

assert.equal(
  validateClubAssignmentInput({
    clubId,
    title: "Policy Case",
    submissionTextEnabled: false,
    submissionFilesEnabled: false,
  }).reason,
  "assignment_requires_submission_mode",
);

assert.equal(
  validateClubAssignmentInput({
    clubId: "bad-id",
    title: "Policy Case",
  }).reason,
  "invalid_club_id"
);

assert.equal(
  validateClubCreationInput({
    name: "Hanoi Debate Club",
    city: "Ha Noi",
    facebookUrl: "https://facebook.com/hanoidebate",
    recipients: [{ email: "owner@example.com", role: "owner" }],
  }).ok,
  true
);

assert.equal(
  validateClubCreationInput({
    name: "Hanoi Debate Club",
    city: "Ha Noi",
    facebookUrl: "https://facebook.com/hanoidebate",
    recipients: [{ email: "student@example.com", role: "student" }],
  }).reason,
  "missing_owner_recipient"
);

assert.equal(
  validateClubEventInput({
    clubId,
    title: "Weekly sparring",
    startDate: "2026-05-18",
    startTime: "17:00",
    endTime: "18:30",
    recurrenceRule: { frequency: "weekly", weekdays: ["MO"], endMode: "after_occurrences", count: 6 },
  }).ok,
  true
);

assert.deepEqual(
  buildClubDashboardKpis({
    studentCount: 10,
    cohortCount: 1,
    attendanceRate: 86,
    assignments: [assignment],
    attempts,
    reviewQueue: reviews,
  }),
  {
    completionRate: 80,
    attendanceRate: 86,
    averageScore: 75,
    reviewQueueCount: 1,
    studentCount: 10,
    cohortCount: 1,
  }
);

const weakest = buildWeakestSkills(attempts);
assert.equal(weakest[0].key, "rebuttal");
assert.equal(weakest[0].value, 56);

console.log("Admin club model tests passed");
