/** Class-scoped homework projection. Missing evidence never becomes a zero. */
export interface ClassGradebookCell {
  submissionId: string | null;
  status: "not_submitted" | "awaiting_review" | "graded" | "unavailable";
  score: number | null;
  scoreMax: number;
}
export interface ClassGradebookData {
  students: Array<{ id: string; name: string }>;
  assessments: Array<{ id: string; title: string; maxScore: number }>;
  cells: Record<string, Record<string, ClassGradebookCell>>;
}
export interface ClassGradebookEvidence {
  submissionId: string;
  updatedAt: string;
  studentName: string;
  assignmentTitle: string;
  response: string | null;
  score: number | null;
  scoreMax: number;
  feedback: string | null;
  files: Array<{ id: string; name: string; url: string | null }>;
}
export interface GradebookSubmissionRow {
  id: string;
  user_id: string;
  assignment_id: string;
  submission_state: string;
  submitted_at: string | null;
  grade_status: string;
  score: number | null;
  score_max: number | null;
  updated_at: string;
}
export function buildClassGradebook(
  students: ClassGradebookData["students"],
  assessments: ClassGradebookData["assessments"],
  submissions: GradebookSubmissionRow[],
): ClassGradebookData {
  // Repositories supply newest submitted attempt first, with an ID tie-breaker.
  const cells: ClassGradebookData["cells"] = {};
  for (const student of students) {
    cells[student.id] = {};
    for (const assessment of assessments) {
      const row = submissions.find(
        (item) =>
          item.user_id === student.id &&
          item.assignment_id === assessment.id &&
          item.submission_state === "submitted" &&
          item.submitted_at,
      );
      const scoreMax = row?.score_max ?? assessment.maxScore;
      const graded = row?.grade_status === "graded";
      const validScore =
        typeof row?.score === "number" &&
        Number.isFinite(row.score) &&
        row.score >= 0 &&
        row.score <= scoreMax;
      const available =
        row &&
        row.updated_at &&
        scoreMax > 0 &&
        Number.isFinite(scoreMax) &&
        (!graded || validScore);
      cells[student.id][assessment.id] = {
        submissionId: row?.id ?? null,
        status: !row
          ? "not_submitted"
          : !available
            ? "unavailable"
            : graded
              ? "graded"
              : "awaiting_review",
        score: graded && validScore ? row.score : null,
        scoreMax,
      };
    }
  }
  return { students, assessments, cells };
}
