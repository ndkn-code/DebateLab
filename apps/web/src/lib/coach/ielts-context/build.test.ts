import assert from "node:assert/strict";
import {
  CoachContextBoundaryError,
  loadIeltsCoachContext,
  resolveCoachConversationContext,
  type IeltsCoachContextRequest,
  type IeltsCoachEvidenceRepository,
} from "./index";

const REQUEST: IeltsCoachContextRequest = {
  product: "ielts",
  subject: "ielts",
  learnerId: "learner-1",
  sessionUserId: "learner-1",
  conversationId: "conversation-1",
  locale: "vi",
  classId: "class-ielts",
};

function repository(
  overrides: Partial<IeltsCoachEvidenceRepository> = {},
): IeltsCoachEvidenceRepository {
  return {
    async loadAccessScope() {
      return {
        learnerId: "learner-1",
        activeIeltsClassIds: ["class-ielts"],
      };
    },
    async loadGoal() {
      return {
        userId: "learner-1",
        targetOverallBand: 7,
        targetSkillBands: { writing: 7.5 },
        targetTestDate: "2026-12-01",
      };
    },
    async loadRecentAttempts() {
      return [
        {
          attemptId: "attempt-own",
          userId: "learner-1",
          responseId: "response-own",
          responseRevision: 2,
          occurredAt: "2026-08-29T12:00:00.000Z",
          skill: "writing",
          questionType: "academic_task_2",
          band: 6.5,
          authority: "ai_provisional",
          confidence: 0.72,
          criteria: [
            {
              criterion: "taskResponse",
              band: 6,
              authority: "ai_provisional",
              confidence: 0.7,
            },
            {
              criterion: "lexicalResource",
              band: 7,
              authority: "ai_provisional",
              confidence: 0.8,
            },
          ],
          // An adapter may accidentally return additional DB columns at runtime.
          // The output projection must never spread them into coach context.
          correctAnswer: "secret",
          essay: "raw learner response",
        },
        {
          attemptId: "attempt-other",
          userId: "learner-2",
          occurredAt: "2026-08-30T12:00:00.000Z",
          skill: "reading",
          band: 9,
          authority: "objective",
          criteria: [],
        },
      ];
    },
    async loadPublishedTeacherFeedback() {
      return [
        {
          reviewId: "review-published",
          userId: "learner-1",
          classId: "class-ielts",
          attemptId: "attempt-own",
          responseId: "response-own",
          responseRevision: 2,
          skill: "writing",
          status: "published",
          publishedAt: "2026-08-30T10:00:00.000Z",
          skillBand: 7,
          criteria: [
            {
              criterion: "taskResponse",
              band: 6.5,
              rationale: "State one clear position throughout the response.",
            },
          ],
          summary: "Build a clearer position before adding examples.",
        },
        {
          reviewId: "review-draft",
          userId: "learner-1",
          classId: "class-ielts",
          attemptId: "attempt-own",
          responseId: "response-own",
          responseRevision: 2,
          skill: "writing",
          status: "draft",
          publishedAt: null,
          skillBand: 9,
          criteria: [{ criterion: "taskResponse", band: 9 }],
          summary: "Private draft note",
        },
        {
          reviewId: "review-other-class",
          userId: "learner-1",
          classId: "class-other",
          attemptId: "attempt-own",
          responseId: "response-own",
          responseRevision: 2,
          skill: "writing",
          status: "published",
          publishedAt: "2026-08-30T11:00:00.000Z",
          skillBand: 9,
          criteria: [],
          summary: "Unrelated class content",
        },
      ];
    },
    async loadAssignedWork() {
      return [
        {
          assignmentId: "assignment-own-class",
          classId: "class-ielts",
          subject: "ielts",
          publicationStatus: "published",
          status: "active",
          title: "Task 2 thesis drill",
          skill: "writing",
          criterion: "taskResponse",
          questionType: "academic_task_2",
          dueAt: "2026-09-02T12:00:00.000Z",
          estimatedMinutes: 20,
        },
        {
          assignmentId: "assignment-other-learner",
          classId: "class-ielts",
          subject: "ielts",
          publicationStatus: "published",
          assignedLearnerId: "learner-2",
          status: "active",
          title: "Private assignment",
          skill: "speaking",
          dueAt: null,
        },
        {
          assignmentId: "assignment-other-class",
          classId: "class-other",
          subject: "ielts",
          publicationStatus: "published",
          status: "active",
          title: "Other class assignment",
          skill: "reading",
          dueAt: null,
        },
        {
          assignmentId: "assignment-draft",
          classId: "class-ielts",
          subject: "ielts",
          publicationStatus: "draft",
          status: "active",
          title: "Teacher draft",
          skill: "writing",
          dueAt: null,
        },
        {
          assignmentId: "assignment-debate",
          classId: "class-ielts",
          subject: "debate",
          publicationStatus: "published",
          status: "active",
          title: "Debate assignment",
          skill: "speaking",
          dueAt: null,
        },
      ];
    },
    ...overrides,
  };
}

async function run() {
  // Production repositories use one prepared snapshot; legacy repository
  // methods must not be read when that capability is available.
  {
    let preparedReads = 0;
    let legacyReads = 0;
    const unavailableLegacyRead = async () => {
      legacyReads += 1;
      throw new Error("legacy evidence read must not run");
    };
    const result = await loadIeltsCoachContext({
      request: REQUEST,
      repository: repository({
        async loadPreparedContext() {
          preparedReads += 1;
          return {
            accessScope: {
              learnerId: "learner-1",
              activeIeltsClassIds: ["class-ielts"],
            },
            goal: {
              userId: "learner-1",
              targetOverallBand: 7,
              targetSkillBands: { writing: 7.5 },
              targetTestDate: "2026-12-01",
            },
            recentAttempts: [
              {
                attemptId: "attempt-prepared",
                userId: "learner-1",
                responseId: "response-prepared",
                responseRevision: 3,
                occurredAt: "2026-08-31T12:00:00.000Z",
                skill: "writing",
                questionType: "writing_task_2",
                band: 6.5,
                authority: "ai_provisional",
                criteria: [
                  {
                    criterion: "task_response",
                    band: 6,
                    authority: "ai_provisional",
                  },
                ],
              },
            ],
            publishedTeacherFeedback: [
              {
                reviewId: "review-prepared",
                userId: "learner-1",
                classId: "class-ielts",
                attemptId: "attempt-prepared",
                responseId: "response-prepared",
                responseRevision: 3,
                skill: "writing",
                status: "published",
                publishedAt: "2026-08-31T13:00:00.000Z",
                skillBand: 7,
                criteria: [{ criterion: "task_response", band: 6.5 }],
                summary: null,
              },
            ],
            assignedWork: [],
          };
        },
        loadAccessScope: unavailableLegacyRead,
        loadGoal: unavailableLegacyRead,
        loadRecentAttempts: unavailableLegacyRead,
        loadPublishedTeacherFeedback: unavailableLegacyRead,
        loadAssignedWork: unavailableLegacyRead,
      }),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("expected prepared IELTS context");
    assert.equal(preparedReads, 1);
    assert.equal(legacyReads, 0);
    assert.equal(result.context.recentAttempts[0]?.band, 7);
    assert.equal(
      result.context.recentAttempts[0]?.authority,
      "teacher_confirmed",
    );
  }

  // A valid snapshot preserves locale, applies published teacher authority, and
  // projects only learner-safe evidence fields.
  {
    const result = await loadIeltsCoachContext({
      request: REQUEST,
      repository: repository(),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("expected IELTS context");
    assert.equal(result.context.locale, "vi");
    assert.equal(result.context.recentAttempts.length, 1);
    assert.equal(result.context.recentAttempts[0]?.band, 7);
    assert.equal(
      result.context.recentAttempts[0]?.authority,
      "teacher_confirmed",
    );
    assert.deepEqual(
      result.context.recentAttempts[0]?.criteria.map((row) => [
        row.criterion,
        row.band,
        row.authority,
      ]),
      [
        ["taskResponse", 6.5, "teacher_confirmed"],
        ["lexicalResource", 7, "ai_provisional"],
      ],
    );
    assert.deepEqual(
      result.context.teacherPublishedFeedback.map((row) => row.reviewId),
      ["review-published"],
    );
    assert.equal(
      result.context.teacherPublishedFeedback[0]?.criterionFeedback[0]
        ?.rationale,
      "State one clear position throughout the response.",
    );
    assert.deepEqual(
      result.context.assignedWork.map((row) => row.assignmentId),
      ["assignment-own-class"],
    );
    const serialized = JSON.stringify(result.context);
    assert.equal(serialized.includes("secret"), false);
    assert.equal(serialized.includes("raw learner response"), false);
    assert.equal(serialized.includes("Private draft note"), false);
    assert.equal(serialized.includes("Unrelated class content"), false);
    assert.equal(serialized.includes("Other class assignment"), false);
    assert.equal(serialized.includes("Debate assignment"), false);
  }

  // Task 1 and Task 2 responses in one attempt retain distinct evidence IDs.
  {
    const result = await loadIeltsCoachContext({
      request: { ...REQUEST, classId: null },
      repository: repository({
        async loadRecentAttempts() {
          return [1, 2].map((taskNumber) => ({
            attemptId: "attempt-both-writing-tasks",
            userId: "learner-1",
            responseId: `writing-response-${taskNumber}`,
            responseRevision: 1,
            occurredAt: `2026-08-2${taskNumber}T12:00:00.000Z`,
            skill: "writing" as const,
            questionType: `academic_task_${taskNumber}`,
            band: taskNumber === 1 ? 6 : 6.5,
            authority: "ai_provisional" as const,
            confidence: 0.7,
            criteria: [
              {
                criterion: "taskResponse",
                band: taskNumber === 1 ? 5.5 : 6,
                authority: "ai_provisional" as const,
                confidence: 0.7,
              },
            ],
          }));
        },
        async loadPublishedTeacherFeedback() {
          return [];
        },
      }),
    });
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error("expected IELTS context");
    assert.equal(result.context.recentAttempts.length, 2);
    const evidenceIds = result.context.recentAttempts.flatMap((attempt) =>
      attempt.criteria.map((criterion) => criterion.evidenceId),
    );
    assert.equal(new Set(evidenceIds).size, 2);
    assert.match(evidenceIds[0] ?? "", /writing-response-2/);
    assert.match(evidenceIds[1] ?? "", /writing-response-1/);
  }

  // A route cannot request another learner's evidence.
  {
    const result = await loadIeltsCoachContext({
      request: { ...REQUEST, sessionUserId: "learner-2" },
      repository: repository(),
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "learner_mismatch",
      retryable: false,
    });
  }

  // Product/subject ambiguity fails before any repository read.
  {
    let reads = 0;
    const result = await loadIeltsCoachContext({
      request: { ...REQUEST, subject: "debate" as "ielts" },
      repository: repository({
        async loadAccessScope() {
          reads += 1;
          return { learnerId: "learner-1", activeIeltsClassIds: [] };
        },
      }),
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "ambiguous_context",
      retryable: false,
    });
    assert.equal(reads, 0);
  }

  // Class selection must be inside an active IELTS enrollment.
  {
    const result = await loadIeltsCoachContext({
      request: { ...REQUEST, classId: "class-other" },
      repository: repository(),
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "unauthorized_class",
      retryable: false,
    });
  }

  // Transient evidence failures never fall back to partial or Debate context.
  {
    const result = await loadIeltsCoachContext({
      request: REQUEST,
      repository: repository({
        async loadRecentAttempts() {
          throw new Error("database timeout");
        },
      }),
    });
    assert.deepEqual(result, {
      ok: false,
      reason: "evidence_unavailable",
      retryable: true,
    });
  }

  // Persisted context is authoritative; legacy null context is Debate-only.
  assert.deepEqual(
    resolveCoachConversationContext({
      requested: { product: "ielts", subject: "ielts" },
      persisted: { product: "ielts", subject: "ielts" },
    }),
    { product: "ielts", subject: "ielts" },
  );
  assert.deepEqual(
    resolveCoachConversationContext({
      requested: { product: "debate", subject: "debate" },
      persisted: { product: null, subject: null },
    }),
    { product: "debate", subject: "debate" },
  );
  assert.throws(
    () =>
      resolveCoachConversationContext({
        requested: { product: "ielts", subject: "ielts" },
        persisted: { product: null, subject: null },
      }),
    (error) =>
      error instanceof CoachContextBoundaryError &&
      error.code === "COACH_CONTEXT_MISMATCH",
  );
  assert.throws(
    () =>
      resolveCoachConversationContext({
        requested: { product: "ielts", subject: "ielts" },
        persisted: { product: "ielts", subject: null },
      }),
    (error) =>
      error instanceof CoachContextBoundaryError &&
      error.code === "COACH_CONTEXT_AMBIGUOUS",
  );
}

void run();
