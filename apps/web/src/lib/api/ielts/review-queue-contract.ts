import type {
  IeltsClassGradebook,
  IeltsGradebookReviewTarget,
} from "./gradebook-repository";

export type IeltsReviewQueueKind = "writing" | "speaking" | "homework";

export interface IeltsReviewQueueItem {
  key: string;
  kind: IeltsReviewQueueKind;
  classId: string;
  clubId: string;
  studentId: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  dueAt: string | null;
  submittedAt: string | null;
  attemptId: string | null;
  responseId: string | null;
  revision: number | null;
  submissionId: string | null;
  state: "unreviewed" | "draft" | "returned";
  reviewTarget: IeltsGradebookReviewTarget | null;
}

function responseQueueItem(input: {
  gradebook: IeltsClassGradebook;
  studentId: string;
  studentName: string;
  assignmentId: string;
  assignmentTitle: string;
  dueAt: string | null;
  submittedAt: string | null;
  target: IeltsGradebookReviewTarget;
}): IeltsReviewQueueItem | null {
  if (input.target.currentReviewStatus === "published") return null;
  return {
    key: `${input.target.responseKind}:${input.target.responseId}:${input.target.revision}`,
    kind: input.target.responseKind,
    classId: input.gradebook.classId,
    clubId: input.gradebook.clubId,
    studentId: input.studentId,
    studentName: input.studentName,
    assignmentId: input.assignmentId,
    assignmentTitle: input.assignmentTitle,
    dueAt: input.dueAt,
    submittedAt: input.submittedAt,
    attemptId: input.target.attemptId,
    responseId: input.target.responseId,
    revision: input.target.revision,
    submissionId: null,
    state:
      input.target.currentReviewStatus === "draft"
        ? "draft"
        : input.target.currentReviewStatus === "returned"
          ? "returned"
          : "unreviewed",
    reviewTarget: input.target,
  };
}

/** Flatten every scoreable source into one stable teacher queue. */
export function buildIeltsReviewQueue(
  gradebook: IeltsClassGradebook,
): IeltsReviewQueueItem[] {
  const items: IeltsReviewQueueItem[] = [];
  for (const student of gradebook.rows) {
    for (const assignment of student.assignments) {
      for (const target of assignment.reviewTargets) {
        const item = responseQueueItem({
          gradebook,
          studentId: student.userId,
          studentName: student.displayName,
          assignmentId: assignment.assignmentId,
          assignmentTitle: assignment.title,
          dueAt: assignment.dueAt,
          submittedAt: assignment.submittedAt,
          target,
        });
        if (item) items.push(item);
      }
      if (
        assignment.homework.submissionId &&
        assignment.homework.submitted &&
        assignment.homework.gradeStatus !== "graded"
      ) {
        items.push({
          key: `homework:${assignment.homework.submissionId}`,
          kind: "homework",
          classId: gradebook.classId,
          clubId: gradebook.clubId,
          studentId: student.userId,
          studentName: student.displayName,
          assignmentId: assignment.assignmentId,
          assignmentTitle: assignment.title,
          dueAt: assignment.dueAt,
          submittedAt: assignment.homework.submittedAt,
          attemptId: null,
          responseId: null,
          revision: null,
          submissionId: assignment.homework.submissionId,
          state:
            assignment.homework.gradeStatus === "returned"
              ? "returned"
              : "unreviewed",
          reviewTarget: null,
        });
      }
    }
  }
  return items.sort((left, right) => {
    const leftTime = left.submittedAt ?? left.dueAt ?? "9999";
    const rightTime = right.submittedAt ?? right.dueAt ?? "9999";
    return leftTime.localeCompare(rightTime) || left.key.localeCompare(right.key);
  });
}
