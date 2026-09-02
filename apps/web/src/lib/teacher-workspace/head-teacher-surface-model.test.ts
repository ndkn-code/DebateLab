import assert from "node:assert/strict";
import { buildHeadTeacherSurfaceModel } from "./head-teacher-surface-model";
import { buildTeacherWorkspaceDemoPresentation } from "./presentation";

const data = buildTeacherWorkspaceDemoPresentation({
  locale: "en",
  surface: "reports",
});
const model = buildHeadTeacherSurfaceModel(data, "reports");

assert.equal(model.classes.length, 3);
assert.equal(model.people.length, 5);
assert.equal(model.totals.classes, 3);
assert.equal(model.totals.assignments, 4);
assert.equal(model.totals.materials, 4);
assert.equal(model.totals.announcements, 3);
assert.equal(model.totals.pendingReviews, 3);
assert.equal(model.totals.averageAttendance, 91);
assert.equal(model.totals.averageCompletion, 67);
assert.equal(
  model.classes.find((item) => item.id === "class-ielts-7b")?.assignmentCount,
  2,
);
assert.equal(model.people[0]?.scoredAssessments, 3);
assert.equal(model.people[0]?.pendingAssessments, 1);

console.log("head teacher surface model tests passed");
