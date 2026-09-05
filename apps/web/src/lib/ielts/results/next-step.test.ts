import assert from "node:assert/strict";
import { test } from "node:test";
import { resultsNextStep } from "./next-step";

test("resultsNextStep sends an assigned learner back to its card with encoded context", () => {
  const result = resultsNextStep("vi", {
    assignmentId: "assignment/42?x=1",
    title: "Bài kiểm tra tuần 1",
    className: "Lớp 10A",
  });

  assert.equal(result.kind, "assigned");
  assert.equal(
    result.href,
    "/vi/ielts/assigned#assignment-assignment%2F42%3Fx%3D1",
  );
  assert.equal(result.context, "Lớp 10A · Bài kiểm tra tuần 1");
});

test("resultsNextStep preserves an assignment title when its class is unavailable", () => {
  const result = resultsNextStep("en", {
    assignmentId: "a-1",
    title: "Practice mock",
    className: null,
  });

  assert.deepEqual(result, {
    kind: "assigned",
    href: "/en/ielts/assigned#assignment-a-1",
    context: "Practice mock",
  });
});

test("resultsNextStep falls back to the localized study plan without assignment context", () => {
  assert.deepEqual(resultsNextStep("vi"), {
    kind: "studyPlan",
    href: "/vi/ielts/study-plan",
    context: null,
  });
  assert.deepEqual(resultsNextStep("en", null), {
    kind: "studyPlan",
    href: "/en/ielts/study-plan",
    context: null,
  });
});
