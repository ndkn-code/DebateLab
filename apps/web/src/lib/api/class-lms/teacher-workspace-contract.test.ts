import assert from "node:assert/strict";
import {
  resolveTeacherWorkspaceClassFeature,
  TEACHER_WORKSPACE_FEATURE_KEY,
  loadTeacherWorkspaceCapability,
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

console.log("teacher workspace capability/sidebar contracts passed");
