import type { ParentBandReport } from "./contract";
import { criteriaForReview } from "@/lib/ielts/teacher/rubric";
import { normalizeParentBandReport } from "./model";

const ids = {
  classId: "00000000-0000-4000-8000-000000000001",
  clubId: "00000000-0000-4000-8000-000000000002",
  studentId: "00000000-0000-4000-8000-000000000003",
};

export function createParentReportFixture(
  kind: "complete" | "partial" | "empty" = "complete",
): ParentBandReport {
  const assessment = {
    attemptId: "00000000-0000-4000-8000-000000000010",
    assignmentId: "00000000-0000-4000-8000-000000000011",
    title: "August practice test",
    submittedAt: "2026-08-18T09:00:00.000Z",
    skills: { listening: 7, reading: 6.5, writing: 6, speaking: 6.5 },
    overall: 6.5,
    overallState: "complete" as const,
    source: "mixed" as const,
  };
  return normalizeParentBandReport(
    {
      generatedAt: "2026-08-31T12:00:00.000Z",
      period: { month: "2026-08", timeZone: "Asia/Ho_Chi_Minh" },
      context: {
        ...ids,
        studentName: "Nguyễn Minh Anh",
        className: "IELTS Evening A",
        centreName: "Thinkfy Hà Nội",
      },
      assessments:
        kind === "empty"
          ? []
          : [0, 1, 2, 3, 4, 5].map((index) => ({
              ...assessment,
              attemptId: `00000000-0000-4000-8000-00000000001${index}`,
              submittedAt: `2026-0${3 + index}-18T09:00:00.000Z`,
              skills: {
                listening: 6 + Math.floor(index / 3),
                reading: 5.5 + Math.floor(index / 2) * 0.5,
                writing: 5.5 + Math.floor(index / 4) * 0.5,
                speaking: 5.5 + Math.floor(index / 2) * 0.5,
              },
              overall: index < 3 ? 5.5 : index < 5 ? 6 : 6.5,
              ...(kind === "partial" && index === 5
                ? {
                    skills: { ...assessment.skills, speaking: null },
                    overall: null,
                  }
                : {}),
            })),
      criteria:
        kind === "empty"
          ? []
          : (["writing", "speaking"] as const).flatMap((skill) =>
              criteriaForReview(skill, 2).map((criterion, index) => ({
                key: criterion.key,
                label: { en: criterion.labelEn, vi: criterion.labelVi },
                skill,
                slot: 2,
                attemptId: "00000000-0000-4000-8000-000000000015",
                responseId:
                  skill === "writing"
                    ? "writing-response"
                    : "speaking-response",
                revision: 1,
                assessedAt: assessment.submittedAt,
                band:
                  kind === "partial" && skill === "speaking"
                    ? null
                    : 6.5 - index / 2,
                source:
                  skill === "writing" ? ("teacher" as const) : ("ai" as const),
              })),
            ),
      attendance: {
        sessions:
          kind === "empty"
            ? []
            : Array.from({ length: 9 }, (_, index) => ({
                sessionId: `session-${index}`,
                date: `2026-08-${String(2 + index * 3).padStart(2, "0")}`,
                title: "IELTS",
                status:
                  index < 6
                    ? ("present" as const)
                    : index === 6
                      ? ("late" as const)
                      : index === 7
                        ? ("absent" as const)
                        : ("unmarked" as const),
              })),
        present: 0,
        late: 0,
        absent: 0,
        unmarked: 0,
        recordedSessions: 0,
        markedSessions: 0,
        rate: null,
        coverage: "recorded_sessions_only",
      },
    },
    new Date("2026-08-31T12:00:00.000Z"),
  );
}
