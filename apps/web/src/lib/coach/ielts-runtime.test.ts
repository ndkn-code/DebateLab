import assert from "node:assert/strict";
import test from "node:test";

import type { IeltsCoachLearnerContext } from "./ielts-context";
import {
  buildDeterministicIeltsCoachRecovery,
  buildIeltsCoachLearnerEvidence,
} from "./ielts-runtime";
import type { IeltsCoachServerAuthorization } from "./ielts-contract";

const CONTEXT: IeltsCoachLearnerContext = {
  version: "ielts-coach-context-v1",
  product: "ielts",
  subject: "ielts",
  learnerId: "learner-1",
  conversationId: "conversation-1",
  locale: "en",
  classId: "class-1",
  goal: {
    targetOverallBand: 7,
    targetSkillBands: { writing: 7 },
    targetTestDate: null,
  },
  recentAttempts: [
    {
      attemptId: "attempt-1",
      responseId: "response-1",
      responseRevision: 3,
      occurredAt: "2026-08-29T12:00:00.000Z",
      skill: "writing",
      questionType: "academic_task_2",
      band: 6,
      authority: "teacher_confirmed",
      confidence: null,
      gradingVersion: null,
      rubricVersion: null,
      teacherReviewId: "review-1",
      teacherResponseRevision: 3,
      criteria: [
        {
          criterion: "taskResponse",
          band: 5.5,
          authority: "teacher_confirmed",
          confidence: null,
          gradingVersion: null,
          rubricVersion: null,
          evidenceId: "teacher-review:review-1:taskResponse",
        },
      ],
    },
  ],
  weaknesses: [
    {
      key: "writing:taskResponse",
      skill: "writing",
      criterion: "taskResponse",
      questionType: null,
      currentBand: 5.5,
      targetBand: 7,
      gapBands: 1.5,
      authority: "teacher_confirmed",
      evidenceId: "teacher-review:review-1:taskResponse",
    },
  ],
  teacherPublishedFeedback: [
    {
      reviewId: "review-1",
      attemptId: "attempt-1",
      skill: "writing",
      responseRevision: 3,
      publishedAt: "2026-08-30T12:00:00.000Z",
      summary: "Keep one clear position throughout.",
      criterionFeedback: [
        {
          criterion: "taskResponse",
          rationale: "Develop each main idea before adding another.",
        },
      ],
    },
  ],
  assignedWork: [],
  limitations: [],
};

test("teacher overall, criterion, and feedback evidence use distinct canonical ids", () => {
  const evidence = buildIeltsCoachLearnerEvidence({
    context: CONTEXT,
    skill: "writing",
  });
  const ids = evidence.map((item) => item.evidenceId);
  assert.equal(new Set(ids).size, ids.length);
  assert(ids.includes("teacher-review:review-1:overall"));
  assert(ids.includes("teacher-review:review-1:taskResponse"));
  assert(ids.includes("teacher-review:review-1:feedback"));
  const overall = evidence.find(
    (item) => item.evidenceId === "teacher-review:review-1:overall",
  );
  assert.equal(overall?.score?.kind, "teacher_confirmed");
  assert.equal(overall?.score?.band, 6);
  assert.equal(
    overall?.score?.kind === "teacher_confirmed"
      ? overall.score.publishedRevision
      : null,
    "3",
  );
});

test("AI provisional evidence keeps its learner-safe grading and rubric versions", () => {
  const context: IeltsCoachLearnerContext = {
    ...CONTEXT,
    recentAttempts: [
      {
        ...CONTEXT.recentAttempts[0]!,
        authority: "ai_provisional",
        confidence: 0.65,
        gradingVersion: "ielts-grading-v3",
        rubricVersion: "ielts-writing-rubric-v1",
        teacherReviewId: null,
        teacherResponseRevision: null,
        criteria: [],
      },
    ],
    weaknesses: [],
    teacherPublishedFeedback: [],
  };
  const evidence = buildIeltsCoachLearnerEvidence({
    context,
    skill: "writing",
  });
  const attempt = evidence.find((item) => item.kind === "recent_attempt");
  assert.equal(attempt?.score?.kind, "ai_provisional");
  if (attempt?.score?.kind !== "ai_provisional") {
    throw new Error("expected AI provisional score");
  }
  assert.equal(attempt.score.gradingVersion, "ielts-grading-v3");
  assert.equal(attempt.score.rubricVersion, "ielts-writing-rubric-v1");
});

test("schema recovery returns an authorized actionable contract", () => {
  const evidence = buildIeltsCoachLearnerEvidence({
    context: CONTEXT,
    skill: "writing",
  });
  const learnerSources = new Map(
    evidence.map((item) => [
      item.evidenceId,
      {
        evidenceId: item.evidenceId,
        sourceType:
          item.evidenceId.startsWith("teacher-review:")
            ? ("teacher_published" as const)
            : ("learner_record" as const),
        sourceLocator: `learner-record/${item.evidenceId}`,
        version: item.observedAt ?? CONTEXT.version,
      },
    ]),
  );
  const action = {
    id: "ielts-practice:writing:task_response",
    kind: "start_practice" as const,
    skill: "writing" as const,
    criterion: "task_response" as const,
    title: "Writing task response practice",
    label: "Start practice",
  };
  const authorization: IeltsCoachServerAuthorization = {
    learnerEvidence: new Map(
      evidence.map((item) => [item.evidenceId, item]),
    ),
    learnerSources,
    approvedKnowledgeSources: new Map(),
    actions: new Map([
      [
        action.id,
        {
          kind: action.kind,
          skill: action.skill,
          criterion: action.criterion,
        },
      ],
    ]),
  };

  const output = buildDeterministicIeltsCoachRecovery({
    locale: "en",
    skill: "writing",
    evidence,
    weakness: CONTEXT.weaknesses[0],
    actions: [action],
    learnerSources,
    approvedKnowledgeSources: new Map(),
    recommendation: null,
    authorization,
  });

  assert.equal(output.outcome, "recommendation");
  assert.equal(output.bandCriterionGap.current?.band, 5.5);
  assert.equal(output.bandCriterionGap.targetBand, 7);
  assert.equal(output.bandCriterionGap.gapBands, 1.5);
  assert.equal(output.action.resourceId, action.id);
  assert.equal(output.recommendedTask.taskId, action.id);
});

test("schema recovery gives a new learner a drill without inventing a band", () => {
  const action = {
    id: "ielts-practice:writing:task_response",
    kind: "start_practice" as const,
    skill: "writing" as const,
    criterion: "task_response" as const,
    title: "Writing task response practice",
    label: "Start practice",
  };
  const authorization: IeltsCoachServerAuthorization = {
    learnerEvidence: new Map(),
    learnerSources: new Map(),
    approvedKnowledgeSources: new Map(),
    actions: new Map([
      [
        action.id,
        {
          kind: action.kind,
          skill: action.skill,
          criterion: action.criterion,
        },
      ],
    ]),
  };

  const output = buildDeterministicIeltsCoachRecovery({
    locale: "en",
    skill: "writing",
    evidence: [],
    weakness: undefined,
    actions: [action],
    learnerSources: new Map(),
    approvedKnowledgeSources: new Map(),
    recommendation: null,
    authorization,
  });

  assert.equal(output.outcome, "needs_evidence");
  assert.equal(output.bandCriterionGap.current, null);
  assert.equal(output.bandCriterionGap.targetBand, null);
  assert.equal(output.scoreAuthority.effective, null);
  assert.equal(output.action.resourceId, action.id);
});
