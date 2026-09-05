import "server-only";
import {
  allRows,
  text,
  type Db,
  type ParentReportScope,
} from "./parent-report-query";
import { reportPeriod } from "@/lib/ielts/parent-report/request";
import { projectParentReportAttempt } from "./gradebook-repository";
import type { TeacherReviewRow } from "./teacher-review-repository";
import type {
  ReportAssessment,
  ReportCriterion,
} from "@/lib/ielts/parent-report/contract";
export async function historyForStudent(
  trusted: Db,
  context: ParentReportScope,
  studentId: string,
  month: string,
  now: Date,
) {
  const period = reportPeriod(month, now, context.timeZone);
  const historyMonth = new Date(`${month}-01T12:00:00Z`);
  historyMonth.setUTCMonth(historyMonth.getUTCMonth() - 5);
  const from = reportPeriod(
    historyMonth.toISOString().slice(0, 7),
    now,
    context.timeZone,
  ).start;
  const [attempts, assignments] = await Promise.all([
    allRows(
      trusted,
      "ielts_attempts",
      "id, user_id, assignment_id, submitted_at, status",
      (q) =>
        q
          .eq("class_id", context.classId)
          .eq("club_id", context.clubId)
          .eq("user_id", studentId)
          .gte("submitted_at", from)
          .lt("submitted_at", period.end)
          .lte("submitted_at", now.toISOString()),
    ),
    allRows(trusted, "club_assignments", "id, title", (q) =>
      q.eq("class_id", context.classId).eq("club_id", context.clubId),
    ),
  ]);
  const titles = new Map(
    assignments.map((row) => [text(row.id), text(row.title)]),
  );
  const assessments: ReportAssessment[] = [];
  const criteria: ReportCriterion[] = [];
  // Small IN batches avoid URL limits; each child reader still pages to exhaustion.
  for (let start = 0; start < attempts.length; start += 50) {
    const batch = attempts.slice(start, start + 50);
    const ids = batch.map((row) => text(row.id));
    const [effective, ai, writing, speaking, reviews] = await Promise.all([
      allRows(
        trusted,
        "ielts_effective_attempt_scores",
        "attempt_id, listening_band, reading_band, writing_band, speaking_band, overall_band, overall_is_provisional, score_source",
        (q) =>
          q
            .eq("class_id", context.classId)
            .eq("club_id", context.clubId)
            .in("attempt_id", ids),
        "attempt_id",
      ),
      allRows(
        trusted,
        "attempt_band_scores",
        "attempt_id, listening_band, reading_band, writing_band, speaking_band, overall_band",
        (q) => q.in("attempt_id", ids),
        "attempt_id",
      ),
      allRows(
        trusted,
        "writing_responses",
        "id, attempt_id, task_number, revision, status, updated_at, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, task_band",
        (q) => q.in("attempt_id", ids).eq("user_id", studentId),
      ),
      allRows(
        trusted,
        "speaking_responses",
        "id, attempt_id, part_number, revision, status, updated_at, fluency_coherence_band, lexical_resource_band, grammar_band, pronunciation_band, speaking_band",
        (q) => q.in("attempt_id", ids).eq("user_id", studentId),
      ),
      allRows(
        trusted,
        "ielts_teacher_reviews",
        "id, attempt_id, writing_response_id, speaking_response_id, revision, status, updated_at, task_response_band, coherence_cohesion_band, lexical_resource_band, grammar_band, fluency_coherence_band, pronunciation_band",
        (q) =>
          q
            .eq("class_id", context.classId)
            .eq("club_id", context.clubId)
            .eq("user_id", studentId)
            .in("attempt_id", ids),
      ),
    ]);
    for (const attempt of batch) {
      const attemptId = text(attempt.id);
      const assignmentId = text(attempt.assignment_id);
      const projection = projectParentReportAttempt({
        attemptId,
        assignmentId,
        effective: effective.find((row) => row.attempt_id === attemptId),
        ai: ai.find((row) => row.attempt_id === attemptId),
        writing: writing.filter((row) => row.attempt_id === attemptId),
        speaking: speaking.filter((row) => row.attempt_id === attemptId),
        reviews: reviews.filter(
          (row) => row.attempt_id === attemptId,
        ) as unknown as TeacherReviewRow[],
      });
      const score = projection.score;
      const bands = {
        listening: score.listening,
        reading: score.reading,
        writing: score.writing,
        speaking: score.speaking,
      };
      const assessment: ReportAssessment = {
        attemptId,
        assignmentId,
        title: titles.get(assignmentId) || "IELTS",
        submittedAt: text(attempt.submitted_at),
        skills: bands,
        overall: score.overall,
        overallState: Object.values(bands).some((band) => band === null)
          ? "missing_skills"
          : score.overall === null
            ? "awaiting_confirmation"
            : "complete",
        source: projection.source,
      };
      assessments.push(assessment);
      for (const target of projection.reviewTargets) {
        for (const criterion of target.criteria) {
          const teacher =
            criterion.reviewStatus === "published" &&
            criterion.teacherBand !== null;
          criteria.push({
            key: criterion.key,
            label: { vi: criterion.labelVi, en: criterion.labelEn },
            skill: target.responseKind,
            slot: target.taskNumber ?? target.partNumber ?? 0,
            attemptId,
            responseId: target.responseId,
            revision: target.revision,
            assessedAt: assessment.submittedAt,
            band: criterion.effectiveBand,
            source:
              criterion.effectiveBand === null
                ? "none"
                : teacher
                  ? "teacher"
                  : "ai",
          });
        }
      }
    }
  }
  return { assessments, criteria };
}
