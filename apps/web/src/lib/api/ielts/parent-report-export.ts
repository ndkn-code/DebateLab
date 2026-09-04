import {
  ATTENDANCE_LONG_EXPORT_COLUMNS,
  CLASS_ROSTER_EXPORT_COLUMNS,
  IELTS_GRADEBOOK_EXPORT_COLUMNS,
} from "@/lib/api/class-exports";
import {
  buildExport,
  buildSheet,
  dateCell,
  exportBasename,
  numberCell,
  percentCell,
  textCell,
  type ExportCell,
  type ExportColumn,
  type ExportFile,
  type ExportSheet,
} from "@/lib/export";
import type {
  ParentBandReport,
  ReportAssessment,
  ReportAttendanceSession,
  ReportCriterion,
  ReportLocale,
  ReportSkill,
  ReportSource,
} from "@/lib/ielts/parent-report/contract";

const SOURCES: Record<ReportSource, Record<ReportLocale, string>> = {
  objective: { vi: "Chấm theo đáp án", en: "Answer-key score" },
  ai: { vi: "Ước tính bằng AI", en: "AI estimate" },
  teacher: { vi: "Giáo viên đã chấm", en: "Teacher reviewed" },
  mixed: { vi: "Kết hợp giáo viên và AI", en: "Teacher and AI combined" },
  none: { vi: "Chưa có kết quả", en: "Not available" },
};

/** Reuse B3's named column contract, adapting its value to the single-student DTO. */
function adaptColumn<S, T>(
  columns: readonly ExportColumn<S>[],
  key: string,
  value: (row: T, locale: ReportLocale) => ExportCell,
): ExportColumn<T> {
  const column = columns.find((candidate) => candidate.key === key);
  if (!column) throw new Error(`Missing shared export column: ${key}`);
  return { key: column.key, header: column.header, value };
}

function column<T>(
  key: string,
  vi: string,
  en: string,
  value: ExportColumn<T>["value"],
): ExportColumn<T> {
  return { key, header: { vi, en }, value };
}

function localDay(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function overallLabel(
  assessment: ReportAssessment | null,
  locale: ReportLocale,
) {
  if (!assessment)
    return locale === "vi" ? "Chưa có kết quả" : "No results yet";
  if (assessment.overallState === "missing_skills")
    return locale === "vi"
      ? "Chưa đủ kết quả của 4 kỹ năng"
      : "Results for all four skills are not available yet";
  if (assessment.overallState === "awaiting_confirmation")
    return locale === "vi"
      ? "Chưa có kết quả tổng hợp được xác nhận"
      : "A confirmed overall result is not available yet";
  return locale === "vi" ? "Đủ 4 kỹ năng" : "All four skills available";
}

/** Inspectable projection shared with the XLSX writer; no database or locale-dependent numbers. */
export function buildParentReportSheets(
  report: ParentBandReport,
  locale: ReportLocale,
  nextSteps?: string[],
): ExportSheet[] {
  const pick = (vi: string, en: string) => (locale === "vi" ? vi : en);
  const summaryColumns: ExportColumn<ParentBandReport>[] = [
    adaptColumn(CLASS_ROSTER_EXPORT_COLUMNS, "displayName", (r) =>
      textCell(r.context.studentName),
    ),
    column("centre", "Trung tâm", "Centre", (r) =>
      textCell(r.context.centreName),
    ),
    column("class", "Lớp", "Class", (r) => textCell(r.context.className)),
    column("month", "Tháng báo cáo", "Reporting month", (r) =>
      textCell(r.period.month),
    ),
    column("updated", "Cập nhật lúc (ISO)", "Updated at (ISO)", (r) =>
      textCell(r.generatedAt),
    ),
    column("timeZone", "Múi giờ", "Time zone", (r) =>
      textCell(r.period.timeZone),
    ),
    column("basis", "Cơ sở kết quả", "Result basis", () =>
      textCell(
        pick(
          "Kết quả luyện tập, gồm các cập nhật mới nhất khi lập báo cáo",
          "Practice results, including the latest corrections when generated",
        ),
      ),
    ),
    column(
      "assessmentDate",
      "Ngày đánh giá gần nhất",
      "Latest assessment date",
      (r) =>
        r.headlineAssessment
          ? dateCell(
              localDay(r.headlineAssessment.submittedAt, r.period.timeZone),
            )
          : textCell(null),
    ),
    adaptColumn(IELTS_GRADEBOOK_EXPORT_COLUMNS, "overall", (r) =>
      numberCell(r.headlineAssessment?.overall),
    ),
    column("coverage", "Mức độ đầy đủ", "Result coverage", (r, l) =>
      textCell(overallLabel(r.headlineAssessment, l)),
    ),
    column("source", "Nguồn đánh giá", "Assessment source", (r, l) =>
      textCell(SOURCES[r.headlineAssessment?.source ?? "none"][l]),
    ),
    adaptColumn(IELTS_GRADEBOOK_EXPORT_COLUMNS, "present", (r) =>
      numberCell(r.attendance.present),
    ),
    adaptColumn(IELTS_GRADEBOOK_EXPORT_COLUMNS, "late", (r) =>
      numberCell(r.attendance.late),
    ),
    adaptColumn(IELTS_GRADEBOOK_EXPORT_COLUMNS, "absent", (r) =>
      numberCell(r.attendance.absent),
    ),
    column("unmarked", "Chưa điểm danh", "Unmarked", (r) =>
      numberCell(r.attendance.unmarked),
    ),
    column("recorded", "Buổi có dữ liệu", "Recorded sessions", (r) =>
      numberCell(r.attendance.recordedSessions),
    ),
    column("marked", "Buổi đã điểm danh", "Marked sessions", (r) =>
      numberCell(r.attendance.markedSessions),
    ),
    adaptColumn(IELTS_GRADEBOOK_EXPORT_COLUMNS, "attendanceRate", (r) =>
      percentCell(r.attendance.rate === null ? null : r.attendance.rate * 100),
    ),
    column(
      "attendanceCoverage",
      "Phạm vi điểm danh",
      "Attendance coverage",
      () =>
        textCell(
          pick(
            "Tỷ lệ tính trên các buổi đã điểm danh; chưa xác nhận toàn bộ lịch học",
            "Rate uses marked sessions; coverage of the full timetable is not confirmed",
          ),
        ),
    ),
  ];
  const assessmentColumns: ExportColumn<ReportAssessment>[] = [
    column("date", "Ngày nộp", "Submission date", (r) =>
      dateCell(localDay(r.submittedAt, report.period.timeZone)),
    ),
    column("title", "Bài đánh giá", "Assessment", (r) => textCell(r.title)),
    ...(
      ["listening", "reading", "writing", "speaking", "overall"] as const
    ).map((key) =>
      adaptColumn(IELTS_GRADEBOOK_EXPORT_COLUMNS, key, (r: ReportAssessment) =>
        numberCell(key === "overall" ? r.overall : r.skills[key]),
      ),
    ),
    column("coverage", "Mức độ đầy đủ", "Result coverage", (r, l) =>
      textCell(overallLabel(r, l)),
    ),
    column("source", "Nguồn đánh giá", "Assessment source", (r, l) =>
      textCell(SOURCES[r.source][l]),
    ),
  ];
  const skillNames: Record<ReportSkill, Record<ReportLocale, string>> = {
    listening: { vi: "Nghe", en: "Listening" },
    reading: { vi: "Đọc", en: "Reading" },
    writing: { vi: "Viết", en: "Writing" },
    speaking: { vi: "Nói", en: "Speaking" },
  };
  const criteriaColumns: ExportColumn<ReportCriterion>[] = [
    column("skill", "Kỹ năng", "Skill", (r, l) =>
      textCell(skillNames[r.skill][l]),
    ),
    column("slot", "Bài / phần", "Task / part", (r) => numberCell(r.slot)),
    column("criterion", "Tiêu chí", "Criterion", (r, l) =>
      textCell(r.label[l]),
    ),
    column("band", "Điểm", "Band", (r) => numberCell(r.band)),
    column("date", "Ngày đánh giá", "Assessment date", (r) =>
      dateCell(localDay(r.assessedAt, report.period.timeZone)),
    ),
    column("source", "Nguồn đánh giá", "Assessment source", (r, l) =>
      textCell(SOURCES[r.source][l]),
    ),
  ];
  const attendanceColumns: ExportColumn<ReportAttendanceSession>[] = [
    adaptColumn(ATTENDANCE_LONG_EXPORT_COLUMNS, "sessionDate", (r) =>
      dateCell(r.date),
    ),
    adaptColumn(ATTENDANCE_LONG_EXPORT_COLUMNS, "sessionTitle", (r) =>
      textCell(r.title),
    ),
    adaptColumn(ATTENDANCE_LONG_EXPORT_COLUMNS, "status", (r, l) =>
      textCell(
        {
          present: { vi: "Có mặt", en: "Present" },
          late: { vi: "Đi muộn", en: "Late" },
          absent: { vi: "Vắng", en: "Absent" },
          unmarked: { vi: "Chưa điểm danh", en: "Unmarked" },
        }[r.status][l],
      ),
    ),
  ];
  const skillsColumns: ExportColumn<ParentBandReport["skills"][number]>[] = [
    column("skill", "Kỹ năng", "Skill", (r, l) =>
      textCell(skillNames[r.skill][l]),
    ),
    column("band", "Điểm gần nhất trong tháng", "Latest band this month", (r) =>
      numberCell(r.band),
    ),
    column("date", "Ngày đánh giá", "Assessment date", (r) =>
      r.assessedAt
        ? dateCell(localDay(r.assessedAt, report.period.timeZone))
        : textCell(null),
    ),
    column("source", "Nguồn đánh giá", "Assessment source", (r, l) =>
      textCell(SOURCES[r.source][l]),
    ),
  ];
  const steps =
    nextSteps ?? report.nextFocus.map((focus) => focus.text[locale]);
  return [
    buildSheet(pick("Tổng quan", "Summary"), summaryColumns, [report], locale),
    buildSheet(
      pick("Kỹ năng trong tháng", "Skills this month"),
      skillsColumns,
      report.skills,
      locale,
    ),
    buildSheet(
      pick("Tiến trình", "Trajectory"),
      assessmentColumns,
      report.trajectory,
      locale,
    ),
    buildSheet(
      pick("Chi tiết đánh giá", "Criteria"),
      criteriaColumns,
      report.criteria,
      locale,
    ),
    buildSheet(
      pick("Chuyên cần", "Attendance"),
      attendanceColumns,
      report.attendance.sessions,
      locale,
    ),
    buildSheet(
      pick("Luyện tập tiếp theo", "Next steps"),
      [
        column<string>("step", "Nội dung", "Practice focus", (r) =>
          textCell(r),
        ),
        column<string>("basis", "Nguồn", "Source", () =>
          textCell(
            nextSteps
              ? pick(
                  "Giáo viên nhập cho báo cáo này",
                  "Staff supplied for this report",
                )
              : pick(
                  "Gợi ý dựa trên kết quả hiện có",
                  "Suggested from available results",
                ),
          ),
        ),
      ],
      steps,
      locale,
    ),
  ];
}

export function buildParentBandReportExport(
  report: ParentBandReport,
  locale: ReportLocale,
  nextSteps?: string[],
): ExportFile {
  return buildExport(buildParentReportSheets(report, locale, nextSteps), {
    format: "xlsx",
    basename: exportBasename(
      [
        "parent-report",
        report.context.className,
        report.context.studentName,
        report.period.month,
        locale,
      ],
      new Date(report.generatedAt),
    ),
  });
}
