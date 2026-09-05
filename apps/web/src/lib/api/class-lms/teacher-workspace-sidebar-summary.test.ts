import assert from "node:assert/strict";
import test from "node:test";
import {
  loadTeacherShellNavigation,
  type ShellTeacherNavigation,
} from "./teacher-workspace-sidebar";
import type { TeacherWorkspaceCapability } from "./teacher-workspace-capability";

const capability: TeacherWorkspaceCapability = {
  userId: "teacher-1",
  profileRole: "admin",
  isPlatformAdmin: true,
  canAccess: true,
  shouldAutoEnter: true,
  isHeadTeacher: true,
  hasIeltsEntitlement: true,
  organizations: [],
  classes: [
    {
      id: "class-1",
      organizationId: "org-1",
      title: "IELTS Foundation",
      programType: "ielts",
      isAssigned: true,
      isLeadTeacher: true,
      featureEnabled: true,
    },
  ],
};

test("shell navigation uses capability only and leaves optional counts unknown", async () => {
  let capabilityLoads = 0;
  const navigation = await loadTeacherShellNavigation(async () => {
    capabilityLoads += 1;
    return capability;
  });

  assert.equal(capabilityLoads, 1);
  assert.deepEqual(navigation, {
    canAccess: true,
    isAdminPreview: true,
    isHeadTeacher: true,
    hasIeltsEntitlement: true,
    classCount: 1,
    pendingReviewCount: null,
    items: navigation.items,
  } satisfies ShellTeacherNavigation);
  assert.equal(navigation.items.find((item) => item.key === "review_queue")?.badge, null);
});

test("shell navigation propagates capability failures", async () => {
  const failure = new Error("temporary auth failure");
  await assert.rejects(
    () => loadTeacherShellNavigation(async () => { throw failure; }),
    failure,
  );
});
