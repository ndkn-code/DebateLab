import type { IeltsGradebookAssignment } from "@/lib/api/ielts/gradebook-repository";
export function learnerWorkStatus(work: IeltsGradebookAssignment, now: string) {
  if (!["active", "published"].includes(work.status)) return "inactive";
  if (
    work.homework.gradeStatus === "resubmit_requested" ||
    work.reviewTargets.some(
      (target) => target.currentReviewStatus === "returned",
    )
  )
    return "resubmit";
  if (work.homework.gradeStatus === "returned") return "returned";
  const submitted = Boolean(work.submittedAt || work.homework.submitted);
  if (!submitted)
    return work.dueAt && Date.parse(work.dueAt) < Date.parse(now)
      ? "overdue"
      : work.attemptId
        ? "inProgress"
        : "notStarted";
  if (work.homework.submitted)
    return work.homework.gradeStatus === "graded" ? "graded" : "pending";
  if (work.needsTeacherReview) return "pending";
  return "completed";
}
