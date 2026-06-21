import assert from "node:assert/strict";
import {
  emptyHistoryIeltsPredictionSnapshot,
  fixtureIeltsGoal,
  fixtureIeltsLearnAtoms,
  fixtureIeltsPredictionSnapshot,
} from "@/lib/ielts/adaptive/contracts";
import { generateIeltsStudyPlan } from "./generator";
import type { GenerateIeltsStudyPlanInput } from "./types";

const START_DATE = "2026-06-22";
const REVIEW_ID = "00000000-0000-4000-8000-000000000701";
const ASSIGNMENT_ID = "00000000-0000-4000-8000-000000000801";

function baseInput(): GenerateIeltsStudyPlanInput {
  return {
    goal: fixtureIeltsGoal,
    prediction: fixtureIeltsPredictionSnapshot,
    learnAtoms: fixtureIeltsLearnAtoms,
    startDate: START_DATE,
  };
}

{
  const plan = generateIeltsStudyPlan({
    ...baseInput(),
    goal: {
      ...fixtureIeltsGoal,
      focusSkills: undefined,
      targetSkillBands: {},
    },
  });

  assert.equal(plan.horizon.days, 14);
  assert.equal(plan.horizon.startDate, START_DATE);
  assert.equal(plan.horizon.endDate, "2026-07-05");
  assert.equal(plan.today.length, 3);
  assert.equal(plan.skillPriorities[0].skill, "reading");
  assert(plan.today.some((item) => item.skill === "reading"));
  assert(plan.items.every((item) => item.rationaleEn.length > 0));
  assert(plan.items.every((item) => item.rationaleVi.length > 0));
}

{
  const plan = generateIeltsStudyPlan(baseInput());
  const focus = new Set(fixtureIeltsGoal.focusSkills);
  const todaySkills = new Set(plan.today.map((item) => item.skill));
  const maintenanceItems = plan.items.filter((item) => item.metadata.maintenance === true);

  assert.equal(plan.mode, "standard");
  assert([...todaySkills].every((skill) => focus.has(skill)));
  assert(maintenanceItems.length > 0);
  assert(
    maintenanceItems.length < plan.items.length / 2,
    "de-focused skills should stay light maintenance, not dominate the plan",
  );
}

{
  const plan = generateIeltsStudyPlan({
    ...baseInput(),
    dueReviews: [
      {
        reviewItemId: REVIEW_ID,
        skill: "writing",
        focusArea: "cohesion markers",
        dueAt: "2026-06-21T10:00:00.000Z",
        estimatedMinutes: 5,
      },
    ],
    teacherAssignments: [
      {
        assignmentId: ASSIGNMENT_ID,
        skill: "reading",
        focusArea: "teacher fixed mini mock",
        scheduledDate: START_DATE,
        estimatedMinutes: 12,
      },
    ],
  });

  assert.equal(plan.today[0].kind, "teacher_assignment");
  assert.equal(plan.today[0].reference.type, "teacher_assignment");
  assert.equal(plan.today[1].kind, "review");
  assert.equal(plan.today[1].reference.type, "review_item");
}

{
  const plan = generateIeltsStudyPlan({
    ...baseInput(),
    prediction: emptyHistoryIeltsPredictionSnapshot,
    weaknesses: [],
  });

  assert.equal(plan.skillPriorities.length, 0);
  assert.equal(plan.today.length, 1);
  assert.equal(plan.today[0].metadata.diagnostic, true);
  assert.equal(plan.today[0].sourceWeaknessKeys.length, 0);
}

console.log("ielts/study-plan/generator.test.ts passed");
