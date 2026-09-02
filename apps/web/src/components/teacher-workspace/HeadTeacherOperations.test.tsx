import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { buildTeacherWorkspaceDemoPresentation } from "@/lib/teacher-workspace/presentation";
import { HeadTeacherOperations } from "./HeadTeacherOperations";

const organizationData = buildTeacherWorkspaceDemoPresentation({
  locale: "en",
  surface: "organization",
});
const organizationMarkup = renderToStaticMarkup(
  <HeadTeacherOperations data={organizationData} surface="organization" />,
);
assert.match(organizationMarkup, /Head Teacher/i);
assert.match(organizationMarkup, /Academic operations across active classes/);
assert.match(organizationMarkup, /IELTS Academic 7B/);
assert.match(organizationMarkup, /Public Speaking Studio/);
assert.match(organizationMarkup, /<table/);
assert.doesNotMatch(organizationMarkup, /Duel|AI Coach/);

const peopleData = buildTeacherWorkspaceDemoPresentation({
  locale: "vi",
  surface: "people",
});
const peopleMarkup = renderToStaticMarkup(
  <HeadTeacherOperations data={peopleData} surface="people" />,
);
assert.match(peopleMarkup, /TRƯỞNG BỘ MÔN/);
assert.match(peopleMarkup, /Nhân sự/);
assert.match(peopleMarkup, /Minh Anh/);
assert.match(peopleMarkup, /Tìm thành viên/);

const reportsData = buildTeacherWorkspaceDemoPresentation({
  locale: "en",
  surface: "reports",
});
const reportsMarkup = renderToStaticMarkup(
  <HeadTeacherOperations data={reportsData} surface="reports" />,
);
assert.match(reportsMarkup, /Avg\. attendance/);
assert.match(reportsMarkup, /Follow up/);
assert.match(reportsMarkup, /role="progressbar"/);

console.log("head teacher operations component tests passed");
