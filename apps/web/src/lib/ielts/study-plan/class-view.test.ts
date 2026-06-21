import assert from "node:assert/strict";
import {
  buildIeltsClassStudyPlanView,
  type BuildIeltsClassStudyPlanViewInput,
  type IeltsClassStudyPlanItemInput,
  type IeltsClassStudyPlanPlanInput,
  type IeltsClassStudyPlanWeakSubskillInput,
} from "./class-view";

const TODAY = "2026-08-17";

function plan(overrides: Partial<IeltsClassStudyPlanPlanInput> = {}): IeltsClassStudyPlanPlanInput {
  return {
    id: "plan-a",
    userId: "learner-a",
    status: "active",
    module: "academic",
    predictedOverallBand: 6,
    targetOverallBand: 7,
    generatedAt: "2026-08-15T00:00:00.000Z",
    nextReassessmentAt: "2026-08-24T00:00:00.000Z",
    ...overrides,
  };
}

function item(overrides: Partial<IeltsClassStudyPlanItemInput> = {}): IeltsClassStudyPlanItemInput {
  return {
    id: "item-a",
    planId: "plan-a",
    status: "scheduled",
    scheduledDate: TODAY,
    ...overrides,
  };
}

function weakness(
  overrides: Partial<IeltsClassStudyPlanWeakSubskillInput> = {},
): IeltsClassStudyPlanWeakSubskillInput {
  return {
    userId: "learner-a",
    key: "reading:matching_headings",
    skill: "reading",
    labelEn: "Matching headings",
    labelVi: "Ghép tiêu đề",
    bandEstimate: 5.5,
    confidence: 0.8,
    weaknessWeight: 0.82,
    evidenceCount: 6,
    lastEvidenceAt: "2026-08-16T00:00:00.000Z",
    ...overrides,
  };
}

function baseInput(overrides: Partial<BuildIeltsClassStudyPlanViewInput> = {}) {
  return {
    classes: [
      { id: "class-1", title: "IELTS B2B A" },
      { id: "class-empty", title: "No roster" },
    ],
    memberships: [
      { classId: "class-1", userId: "learner-a" },
      { classId: "class-1", userId: "learner-b" },
      { classId: "class-1", userId: "learner-c" },
      { classId: "class-1", userId: "learner-a" },
    ],
    profiles: [
      { userId: "learner-a", displayName: "An", email: "an@example.com" },
      { userId: "learner-b", displayName: "Binh", email: "binh@example.com" },
      { userId: "learner-c", displayName: "", email: "chi@example.com" },
    ],
    plans: [
      plan({ id: "plan-a", userId: "learner-a", predictedOverallBand: 6 }),
      plan({ id: "plan-b", userId: "learner-b", predictedOverallBand: 7 }),
      plan({
        id: "plan-b-old",
        userId: "learner-b",
        predictedOverallBand: 5,
        generatedAt: "2026-08-01T00:00:00.000Z",
      }),
      plan({ id: "plan-c-paused", userId: "learner-c", status: "paused" }),
    ],
    items: [
      item({ id: "a-done", planId: "plan-a", status: "completed", scheduledDate: "2026-08-16" }),
      item({ id: "a-today", planId: "plan-a", status: "available", scheduledDate: TODAY }),
      item({ id: "a-past", planId: "plan-a", status: "scheduled", scheduledDate: "2026-08-10" }),
      item({ id: "a-skipped", planId: "plan-a", status: "skipped", scheduledDate: TODAY }),
      item({ id: "b-future", planId: "plan-b", status: "started", scheduledDate: "2026-08-18" }),
      item({ id: "b-missed", planId: "plan-b", status: "missed", scheduledDate: TODAY }),
      item({ id: "old-plan-item", planId: "plan-b-old", status: "completed", scheduledDate: TODAY }),
    ],
    weakSubskills: [
      weakness({ userId: "learner-a" }),
      weakness({
        userId: "learner-a",
        key: "writing:grammar",
        skill: "writing",
        labelEn: "Grammar",
        labelVi: "Ngữ pháp",
        weaknessWeight: 0.45,
        confidence: 0.7,
        evidenceCount: 3,
      }),
      weakness({
        userId: "learner-b",
        key: "reading:matching_headings",
        weaknessWeight: 0.62,
        confidence: 0.6,
        evidenceCount: 4,
      }),
      weakness({
        userId: "learner-b",
        key: "listening:map_labelling",
        skill: "listening",
        labelEn: "Map labelling",
        labelVi: "Điền nhãn bản đồ",
        weaknessWeight: 0,
      }),
    ],
    todayIso: TODAY,
    ...overrides,
  } satisfies BuildIeltsClassStudyPlanViewInput;
}

// Active plans only, latest active plan wins, and old/paused plan items do not count.
{
  const view = buildIeltsClassStudyPlanView(baseInput());
  const classView = view.classes[0];
  assert.equal(classView.activePlanCount, 2);
  assert.equal(classView.averagePredictedBand, 6.5);
  assert.deepEqual(classView.progress, {
    done: 1,
    scheduled: 2,
    missed: 2,
    total: 5,
    completionPercent: 20,
  });

  const learnerB = classView.learners.find((learner) => learner.userId === "learner-b");
  assert.ok(learnerB);
  assert.equal(learnerB.predictedBand, 7);
  assert.equal(learnerB.progress.done, 0);

  const learnerC = classView.learners.find((learner) => learner.userId === "learner-c");
  assert.ok(learnerC);
  assert.equal(learnerC.hasActivePlan, false);
  assert.equal(learnerC.displayName, "chi");
}

// Learners needing attention rise first: missed work / no plan / critical weakness.
{
  const classView = buildIeltsClassStudyPlanView(baseInput()).classes[0];
  assert.deepEqual(
    classView.learners.map((learner) => learner.userId),
    ["learner-a", "learner-b", "learner-c"],
  );
  assert.equal(classView.needsAttentionCount, 3);
  assert.equal(classView.learners[0].weakSubskills[0].severity, "critical");
}

// Weak subskills are ranked per learner and rolled up for class-level targeting.
{
  const view = buildIeltsClassStudyPlanView(baseInput({ maxWeakSubskillsPerLearner: 1 }));
  const classView = view.classes[0];
  assert.deepEqual(
    classView.learners.find((learner) => learner.userId === "learner-a")?.weakSubskills.map((row) => row.key),
    ["reading:matching_headings"],
  );
  assert.deepEqual(
    classView.weakSubskills.map((row) => [row.key, row.affectedLearnerCount]),
    [["reading:matching_headings", 2]],
  );
  assert.equal(classView.weakSubskills[0].severity, "critical");
}

// Empty classes remain present so the teacher can see there is no roster yet.
{
  const empty = buildIeltsClassStudyPlanView(baseInput()).classes[1];
  assert.equal(empty.learnerCount, 0);
  assert.equal(empty.averagePredictedBand, null);
  assert.deepEqual(empty.progress, {
    done: 0,
    scheduled: 0,
    missed: 0,
    total: 0,
    completionPercent: 0,
  });
}

console.log("ielts/study-plan/class-view tests passed");
