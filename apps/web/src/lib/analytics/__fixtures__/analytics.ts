import type {
  IeltsGradebookRow,
  IeltsGradebookReviewTarget,
} from "@/lib/api/ielts/gradebook-repository";
import { criteriaForReview } from "@/lib/ielts/teacher/rubric";
import type {
  ClassAnalyticsInput,
  CentreAnalyticsInput,
  NormalizedCriterionEvidence,
} from "../contracts";
export const uuid = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;
export function classFixture(count = 150): ClassAnalyticsInput {
  const criterionEvidence: NormalizedCriterionEvidence[] = [];
  const rows: IeltsGradebookRow[] = Array.from(
    { length: count },
    (_, index) => {
      const id = uuid(index + 100);
      const attemptId = uuid(index + 1000);
      const reviewTargets: IeltsGradebookReviewTarget[] = ([1, 2] as const).map(
        (task) => {
          const responseId = uuid(3000 + index * 2 + task);
          const criteria = criteriaForReview("writing", task).map(
            (criterion, position) => {
              const band = position === 0 ? 5 : 6.5;
              criterionEvidence.push({
                learnerId: id,
                assignmentId: uuid(3),
                responseId,
                skill: "writing",
                criterion: criterion.key,
                band,
                revision: 0,
                stage: index % 3 === 0 ? "adjudicated" : "provisional",
                createdAt: "2026-09-02T02:00:00Z",
                task: task === 1 ? "task1" : "task2",
              });
              return {
                key: criterion.key,
                labelEn: criterion.labelEn,
                labelVi: criterion.labelVi,
                aiBand: band,
                teacherBand: index % 4 === 0 ? band + 0.5 : null,
                effectiveBand: index % 4 === 0 ? band + 0.5 : band,
                reviewStatus:
                  index % 4 === 0 ? ("published" as const) : ("none" as const),
                rationale: null,
              };
            },
          );
          return {
            responseKind: "writing",
            responseId,
            revision: 0,
            taskNumber: task,
            partNumber: null,
            attemptId,
            assignmentId: uuid(3),
            currentReviewId: null,
            currentReviewStatus: index % 4 === 0 ? "published" : "none",
            currentReviewNote: null,
            currentReview: null,
            scoringStatus: "scored",
            manualRetryAvailable: false,
            criteria,
            media: null,
          };
        },
      );
      return {
        userId: id,
        displayName:
          index % 2
            ? `Nguyễn Hoàng Minh Anh ${index + 1}`
            : `Learner ${index + 1}`,
        email: `student-${index}@example.test`,
        membershipStatus: "active",
        historical: false,
        attendance: { present: 4, late: 0, absent: 0, rate: 100 },
        courses: [],
        assignments: [
          {
            assignmentId: uuid(3),
            title: "Academic Mock · Đánh giá đầu tháng",
            assignmentType: "ielts_mock",
            dueAt: "2026-09-02T01:00:00Z",
            status: "published",
            attemptId,
            attemptStatus: "submitted",
            submittedAt: "2026-09-02T01:00:00Z",
            score: {
              listening: 6.5,
              reading: 6,
              writing: 5 + (index % 5) * 0.5,
              speaking: index % 5 === 0 ? null : 6,
              overall: null,
              provisional: 6,
              overallIsProvisional: true,
              source: "ai_provisional",
            },
            criteria: [],
            reviewTargets,
            needsTeacherReview: true,
            homework: {
              submissionId: null,
              submitted: false,
              status: null,
              gradeStatus: null,
              submittedAt: null,
              score: null,
              scoreMax: null,
            },
          },
        ],
      };
    },
  );
  return {
    classId: uuid(1),
    clubId: uuid(2),
    classTitle: "IELTS Academic · Lớp tối thứ hai",
    period: {
      days: 30,
      timezone: "Asia/Ho_Chi_Minh",
      start: "2026-08-05T17:00:00.000Z",
      end: "2026-09-04T15:00:00.000Z",
    },
    rows,
    criterionEvidence,
    weakSubskills: [],
    attendance: rows.map((row, index) => ({
      learnerId: row.userId,
      present: 4,
      late: 0,
      absent: index % 9 === 0 ? 2 : 0,
    })),
  };
}
export function centreFixture(): CentreAnalyticsInput {
  const input = classFixture(12);
  return {
    clubId: input.clubId,
    viewerId: uuid(900),
    period: input.period,
    classes: [
      {
        classId: input.classId,
        title: input.classTitle,
        teacherIds: [uuid(901)],
        activeLearnerIds: input.rows.map((row) => row.userId),
      },
    ],
    events: [
      {
        id: "session-1",
        kind: "session",
        occurredAt: "2026-09-02T01:00:00Z",
        classId: input.classId,
        teacherId: uuid(901),
        status: "completed",
      },
      ...input.rows.flatMap((row, index) => [
        {
          id: `activity-${index}`,
          kind: "activity" as const,
          occurredAt: "2026-09-02T01:00:00Z",
          learnerId: row.userId,
          classId: input.classId,
        },
        {
          id: `ai-${index}`,
          responseId: `response-${index}`,
          kind: "ai-grading" as const,
          skill: "writing" as const,
          taskNumber: 2,
          status: "scored",
          occurredAt: "2026-09-02T02:00:00Z",
          learnerId: row.userId,
          classId: input.classId,
        },
        {
          id: `feedback-${index}`,
          kind: "feedback" as const,
          status: "published",
          revision: 0,
          teacherId: uuid(901),
          occurredAt: "2026-09-03T02:00:00Z",
          learnerId: row.userId,
          classId: input.classId,
          turnedAroundHours: 25,
        },
      ]),
    ],
  };
}
