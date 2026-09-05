import assert from "node:assert/strict";
import {
  activeTeacherNavigationKey,
  teacherClassShortcuts,
  teacherNavigationGroups,
  teacherNavigationHref,
} from "./navigation";
import {
  getWorkspaceMode,
  safeTeacherReturnPath,
  shouldAutoEnterTeacherWorkspace,
} from "../workspace-navigation";
import type { TeacherWorkspaceNavigationItem } from "./presentation";

const keys = [
  "calendar",
  "classes",
  "attendance",
  "announcements",
  "review_queue",
  "assignments",
  "gradebook",
  "materials",
] as const;
const items: TeacherWorkspaceNavigationItem[] = keys.map((key) => ({
  key,
  label: key,
  href: `/dashboard/teacher/${key.replace("_", "-")}`,
  badge: null,
}));
assert.deepEqual(
  teacherNavigationGroups(items).map((group) => group.key),
  ["teaching", "assessment", "preparation"],
);
assert.deepEqual(teacherNavigationGroups([]), []);
assert.equal(
  activeTeacherNavigationKey("/dashboard/teacher", items),
  "calendar",
);
assert.equal(
  activeTeacherNavigationKey(
    "/dashboard/teacher/classes/a/reports/student",
    items,
  ),
  "classes",
);
assert.equal(
  activeTeacherNavigationKey("/dashboard/teacher/classes-elsewhere", items),
  undefined,
);
assert.equal(
  activeTeacherNavigationKey("/dashboard/teacher/organization", items),
  undefined,
);
assert.equal(getWorkspaceMode("/vi/dashboard/teacher/organization"), "teacher");
assert.equal(getWorkspaceMode("/en/dashboard/admin/users"), "admin");
assert.equal(getWorkspaceMode("/dashboard"), "learner");
assert.equal(getWorkspaceMode("/dashboard/teacher-elsewhere"), "learner");
assert.equal(
  safeTeacherReturnPath(
    "/vi/dashboard/teacher/calendar?classId=a&date=2026-09-05#lesson",
  ),
  "/dashboard/teacher/calendar?classId=a&date=2026-09-05#lesson",
);
for (const bad of [
  null,
  "//example.com",
  "https://example.com",
  "/dashboard/teacher-elsewhere",
  "/dashboard/teacher\\evil",
  "/profile",
  "/dashboard/teacher/../../admin",
  "/dashboard/teacher/%2e%2e/%2e%2e/admin",
])
  assert.equal(safeTeacherReturnPath(bad), "/dashboard/teacher");
assert.equal(shouldAutoEnterTeacherWorkspace(true), true);
assert.equal(shouldAutoEnterTeacherWorkspace(true, "learner"), false);
assert.equal(shouldAutoEnterTeacherWorkspace(false, "teacher"), false);
assert.equal(
  teacherNavigationHref(
    "/dashboard/teacher/classes",
    new URLSearchParams(
      "organization=own-org&demo=teacher&classId=old&view=week",
    ),
  ),
  "/dashboard/teacher/classes?organization=own-org&demo=teacher",
);
console.log("Teacher navigation and role transition contracts passed");

assert.equal(
  activeTeacherNavigationKey("/vi/dashboard/teacher", items),
  "calendar",
);
assert.deepEqual(
  teacherClassShortcuts(
    [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }],
    ["removed", "c", "a"],
    "d",
  ).map((item) => item.id),
  ["d", "c", "a"],
);
