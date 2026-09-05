import assert from "node:assert/strict";
import {
  resolveTeacherWorkspaceClassFeature,
  TEACHER_WORKSPACE_FEATURE_KEY,
  loadTeacherWorkspaceCapability,
  resolveTeacherWorkspaceOrganizationRole,
  type TeacherWorkspaceCapability,
} from "./teacher-workspace-capability";
import { buildTeacherSidebarSummary } from "./teacher-workspace-sidebar";

assert.equal(TEACHER_WORKSPACE_FEATURE_KEY, "teacher_workspace_v2");

const legacyIeltsFlag = { club_id: "org-a", class_id: "class-1", feature_key: "ielts_lms_pilot_v1", enabled: true };
assert.equal(resolveTeacherWorkspaceClassFeature({ flags: [legacyIeltsFlag], organizationId: "org-a", classId: "class-1", programType: "ielts" }), true);
assert.equal(resolveTeacherWorkspaceClassFeature({ flags: [legacyIeltsFlag], organizationId: "org-a", classId: "class-1", programType: "debate" }), false);
assert.equal(resolveTeacherWorkspaceClassFeature({ flags: [legacyIeltsFlag, { ...legacyIeltsFlag, feature_key: "teacher_workspace_v2", enabled: false }], organizationId: "org-a", classId: "class-1", programType: "ielts" }), false);

const capability: TeacherWorkspaceCapability = {
  userId: "teacher-1",
  profileRole: "teacher",
  isPlatformAdmin: false,
  canAccess: true,
  shouldAutoEnter: true,
  isHeadTeacher: false,
  hasIeltsEntitlement: true,
  organizations: [{ id: "org-a", role: "teacher", featureEnabled: true, hasIeltsEntitlement: true }],
  classes: [
    { id: "class-1", organizationId: "org-a", title: "IELTS Foundation", programType: "ielts", isAssigned: true, isLeadTeacher: true, featureEnabled: true },
    { id: "class-2", organizationId: "org-a", title: "Debate Beginners", programType: "debate", isAssigned: true, isLeadTeacher: false, featureEnabled: true },
  ],
};

const summary = buildTeacherSidebarSummary({ capability, pendingReviewCount: 2, pendingHomeworkCount: 3, unreadNotificationCount: 1 });
assert.equal(summary.classCount, 2);
assert.equal(summary.items.length, 8);
assert.equal(summary.items.find((item) => item.key === "review_queue")?.badge, 5);
assert.equal(summary.items.find((item) => item.key === "calendar")?.href, "/dashboard/teacher/calendar");
assert.equal(summary.items.map((item) => String(item.key)).includes("duel"), false);
assert.equal(typeof loadTeacherWorkspaceCapability, "function");
assert.equal(
  resolveTeacherWorkspaceOrganizationRole(
    new Map([["org-a", "head_teacher"]]),
    "org-a",
  ),
  "head_teacher",
);
assert.deepEqual(summary.classes, [
  { id: "class-1", organizationId: "org-a", title: "IELTS Foundation" },
  { id: "class-2", organizationId: "org-a", title: "Debate Beginners" },
]);
assert.deepEqual(summary.organizations, []);

const denied = buildTeacherSidebarSummary({
  capability: { ...capability, canAccess: false, classes: [] },
});
assert.deepEqual(denied.items, []);

const adminWithoutMembership = buildTeacherSidebarSummary({
  capability: { ...capability, isPlatformAdmin: true, profileRole: "admin", organizations: [] },
});
assert.equal(adminWithoutMembership.organizations.length, 0);
assert.equal(adminWithoutMembership.items.some((item) => item.key === "organization"), false);

const assignedTeacher = buildTeacherSidebarSummary({
  capability: { ...capability, isPlatformAdmin: false, isHeadTeacher: false },
  organizations: [{ id: "org-a", name: "Thinkfy Academy", role: "teacher" }],
});
assert.deepEqual(assignedTeacher.organizations, [{ id: "org-a", name: "Thinkfy Academy", role: "teacher" }]);
assert.equal(assignedTeacher.items.some((item) => item.key === "organization"), false);

const realHeadTeacher = buildTeacherSidebarSummary({
  capability: { ...capability, isHeadTeacher: true },
  organizations: [{ id: "org-a", name: "Thinkfy Academy", role: "head_teacher" }],
});
assert.equal(realHeadTeacher.items.some((item) => item.key === "organization"), true);

console.log("teacher workspace capability/sidebar contracts passed");
