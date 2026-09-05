import type {
  ParentBandReport,
  ReportAssessment,
  ReportCriterion,
  ReportSkill,
  ReportSource,
} from "./contract";
import { localMidnight, reportPeriod } from "./request";
export type ParentReportAssessmentInput = Omit<
  ReportAssessment,
  "overallState"
> & { overallState?: ReportAssessment["overallState"] };
export type ParentReportModelInput = {
  generatedAt?: string;
  period: { month: string; timeZone?: string };
  context: ParentBandReport["context"];
  assessments?: ParentReportAssessmentInput[];
  criteria?: ReportCriterion[];
  attendance?: ParentBandReport["attendance"];
};
const skills: ReportSkill[] = ["listening", "reading", "writing", "speaking"];

const band = (value: unknown): number | null =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 9
    ? value
    : null;
const source = (value: unknown): ReportSource =>
  value === "objective" ||
  value === "ai" ||
  value === "teacher" ||
  value === "mixed"
    ? value
    : "none";
function normalizeAssessment(
  item: ParentReportAssessmentInput,
): ReportAssessment {
  const values = Object.fromEntries(
    skills.map((skill) => [skill, band(item.skills[skill])]),
  ) as Record<ReportSkill, number | null>;
  const count = skills.filter((skill) => values[skill] !== null).length;
  const overall =
    count === 4 && (!item.overallState || item.overallState === "complete")
      ? band(item.overall)
      : null;
  return {
    ...item,
    skills: values,
    overall,
    overallState:
      count < 4
        ? "missing_skills"
        : overall === null
          ? "awaiting_confirmation"
          : "complete",
    source: source(item.source),
  };
}
/** Preserve one response's rubric; never average different tasks or parts. */
export function latestReportCriterionGroup(
  criteria: ReportCriterion[],
  skill: "writing" | "speaking",
) {
  const available = criteria.filter((item) => item.skill === skill);
  const first = [...available].sort(
    (a, b) =>
      b.assessedAt.localeCompare(a.assessedAt) ||
      b.slot - a.slot ||
      b.revision - a.revision ||
      a.responseId.localeCompare(b.responseId),
  )[0];
  return first
    ? available
        .filter(
          (item) =>
            item.responseId === first.responseId &&
            item.revision === first.revision,
        )
        .slice(0, 4)
    : [];
}
function skillSource(
  item: ReportAssessment,
  skill: ReportSkill,
  criteria: ReportCriterion[],
): ReportSource {
  if (skill === "listening" || skill === "reading") return "objective";
  const values = new Set(
    criteria
      .filter(
        (criterion) =>
          criterion.attemptId === item.attemptId &&
          criterion.skill === skill &&
          criterion.band !== null,
      )
      .map((criterion) => criterion.source),
  );
  if (values.has("mixed") || (values.has("teacher") && values.has("ai")))
    return "mixed";
  if (values.has("teacher")) return "teacher";
  if (values.has("ai")) return "ai";
  return item.source;
}
export function normalizeParentBandReport(
  input: ParentReportModelInput,
  now = new Date(),
): ParentBandReport {
  const period = reportPeriod(
    input.period.month,
    now,
    input.period.timeZone ?? "Asia/Ho_Chi_Minh",
  );
  const historyStart = localMidnight(
    period.historyStart,
    period.timeZone,
  ).getTime();
  const currentStart = new Date(period.start).getTime();
  const all = (input.assessments ?? [])
    .map(normalizeAssessment)
    .filter((item) => {
      const time = Date.parse(item.submittedAt);
      return (
        Number.isFinite(time) &&
        time >= historyStart &&
        time < Date.parse(period.endCapped)
      );
    });
  const unique = [
    ...new Map(all.map((item) => [item.attemptId, item])).values(),
  ].sort(
    (a, b) =>
      a.submittedAt.localeCompare(b.submittedAt) ||
      a.attemptId.localeCompare(b.attemptId),
  );
  const current = unique.filter(
    (item) => Date.parse(item.submittedAt) >= currentStart,
  );
  const assessed = current.filter((item) =>
    skills.some((skill) => item.skills[skill] !== null),
  );
  const headlineAssessment = assessed.at(-1) ?? null;
  const criteria = (input.criteria ?? [])
    .filter(
      (item) =>
        Date.parse(item.assessedAt) >= currentStart &&
        Date.parse(item.assessedAt) < Date.parse(period.endCapped),
    )
    .map((item) => ({
      ...item,
      band: band(item.band),
      source:
        band(item.band) === null ? ("none" as const) : source(item.source),
    }));
  const latestSkills = skills.map((skill) => {
    const item = [...current]
      .reverse()
      .find((candidate) => candidate.skills[skill] !== null);
    return {
      skill,
      band: item?.skills[skill] ?? null,
      assessedAt: item?.submittedAt ?? null,
      attemptId: item?.attemptId ?? null,
      source: item ? skillSource(item, skill, criteria) : ("none" as const),
    };
  });
  const focusCandidates = [
    ...latestReportCriterionGroup(criteria, "writing"),
    ...latestReportCriterionGroup(criteria, "speaking"),
  ]
    .filter((item) => item.band !== null)
    .sort((a, b) => (a.band ?? 9) - (b.band ?? 9));
  const focus = [
    ...new Map(
      focusCandidates.map((item) => [`${item.skill}:${item.key}`, item]),
    ).values(),
  ].slice(0, 2);

  const attendance = input.attendance ?? {
    sessions: [],
    present: 0,
    late: 0,
    absent: 0,
    unmarked: 0,
    recordedSessions: 0,
    markedSessions: 0,
    rate: null,
    coverage: "recorded_sessions_only" as const,
  };
  const present = attendance.sessions.filter(
    (item) => item.status === "present",
  ).length;
  const late = attendance.sessions.filter(
    (item) => item.status === "late",
  ).length;
  const absent = attendance.sessions.filter(
    (item) => item.status === "absent",
  ).length;
  const unmarked = attendance.sessions.length - present - late - absent;
  const marked = present + late + absent;
  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt ?? now.toISOString(),
    scoreBasis: "latest_available_at_generation",
    period: {
      month: period.month,
      timeZone: input.period.timeZone ?? period.timeZone,
      start: period.start,
      end: period.end,
      isCurrentMonth: period.isCurrentMonth,
    },
    context: input.context,
    headlineAssessment,
    skills: latestSkills,
    trajectory: unique,
    criteria,
    attendance: {
      ...attendance,
      present,
      late,
      absent,
      unmarked,
      recordedSessions: attendance.sessions.length,
      markedSessions: marked,
      rate: marked ? (present + late) / marked : null,
    },
    nextFocus: focus.map((item) => ({
      criterionKey: `${item.skill}:${item.key}`,
      text: {
        en: `Practise ${item.label.en.toLowerCase()} in one timed ${item.skill === "writing" ? "written" : "spoken"} response.`,
        vi: `Luyện ${item.label.vi.toLocaleLowerCase("vi")} qua một bài ${item.skill === "writing" ? "viết" : "nói"} có bấm giờ.`,
      },
    })),
    availability: {
      assessedCount: assessed.length,
      pendingCount: current.filter(
        (item) =>
          item.overallState === "awaiting_confirmation" ||
          item.overallState === "missing_skills",
      ).length,
      missingSkills: headlineAssessment
        ? skills.filter((skill) => headlineAssessment.skills[skill] === null)
        : skills,
    },
  };
}
