import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  HEAD_TEACHER_WORKSPACE_SURFACES,
  isHeadTeacherWorkspaceSurface,
} from "@/lib/teacher-workspace/presentation";

const routeSource = readFileSync(
  resolve(
    process.cwd(),
    "src/app/[locale]/(protected)/dashboard/teacher/[surface]/page.tsx",
  ),
  "utf8",
);

for (const surface of HEAD_TEACHER_WORKSPACE_SURFACES) {
  assert.equal(isHeadTeacherWorkspaceSurface(surface), true);
  assert.match(
    routeSource,
    new RegExp(`"${surface}"`),
    `${surface} must resolve through the teacher surface route`,
  );
}
assert.equal(isHeadTeacherWorkspaceSurface("calendar"), false);

console.log("teacher workspace surface routing tests passed");
