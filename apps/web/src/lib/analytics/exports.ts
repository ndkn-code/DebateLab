import {
  buildExport,
  buildSheet,
  exportBasename,
  numberCell,
  textCell,
  percentCell,
  type ExportColumn,
  type ExportFormat,
  type ExportLocale,
  type ExportFile,
} from "@/lib/export";
import type {
  CriterionSummary,
  PostMockReport,
  SkillSummary,
} from "./contracts";
import { SKILL_LABELS } from "./class-rollup";
export const ANALYTICS_SKILL_COLUMNS: ReadonlyArray<
  ExportColumn<SkillSummary>
> = [
  {
    key: "skill",
    header: { en: "Skill", vi: "Kỹ năng" },
    value: (row, locale) => textCell(row.label[locale]),
  },
  {
    key: "band",
    header: { en: "Mean skill band", vi: "Điểm kỹ năng trung bình" },
    value: (row) => numberCell(row.meanBand),
  },
  {
    key: "learners",
    header: { en: "Learners with evidence", vi: "Học viên có bằng chứng" },
    value: (row) => numberCell(row.learnerCount),
  },
  {
    key: "coverage",
    header: { en: "Coverage %", vi: "Độ bao phủ %" },
    value: (row) => percentCell(row.coverage * 100),
  },
  {
    key: "provisional",
    header: { en: "Provisional learners", vi: "Học viên có điểm tạm thời" },
    value: (row) => numberCell(row.provisionalLearners),
  },
  {
    key: "confirmed",
    header: {
      en: "Confirmed or objective",
      vi: "Đã xác nhận hoặc chấm khách quan",
    },
    value: (row) => numberCell(row.confirmedLearners),
  },
];
export const ANALYTICS_CRITERION_COLUMNS: ReadonlyArray<
  ExportColumn<CriterionSummary>
> = [
  {
    key: "skill",
    header: { en: "Skill", vi: "Kỹ năng" },
    value: (row, locale) => textCell(SKILL_LABELS[row.skill][locale]),
  },
  {
    key: "task",
    header: { en: "Task", vi: "Phần thi" },
    value: (row, locale) =>
      textCell(
        row.task
          ? (locale === "vi" ? "Bài viết " : "Task ") +
              (row.task === "task1" ? "1" : "2")
          : "",
      ),
  },
  {
    key: "criterion",
    header: { en: "Criterion", vi: "Tiêu chí" },
    value: (row, locale) => textCell(row.label[locale]),
  },
  {
    key: "band",
    header: { en: "Mean criterion band", vi: "Điểm tiêu chí trung bình" },
    value: (row) => numberCell(row.meanBand),
  },
  {
    key: "learners",
    header: { en: "Learners", vi: "Học viên" },
    value: (row) => numberCell(row.learnerCount),
  },
  {
    key: "coverage",
    header: { en: "Coverage %", vi: "Độ bao phủ %" },
    value: (row) => percentCell(row.coverage * 100),
  },
  {
    key: "aiProvisional",
    header: { en: "AI provisional criteria", vi: "Tiêu chí AI tạm thời" },
    value: (row) => numberCell(row.provenance.aiProvisional),
  },
  {
    key: "aiAdjudicated",
    header: { en: "AI adjudicated criteria", vi: "Tiêu chí AI đã kiểm định" },
    value: (row) => numberCell(row.provenance.aiAdjudicated),
  },
  {
    key: "teacherConfirmed",
    header: {
      en: "Teacher-confirmed criteria",
      vi: "Tiêu chí giáo viên xác nhận",
    },
    value: (row) => numberCell(row.provenance.teacherConfirmed),
  },
];
/** Only accepts the privacy projection, never a named class model. */
export function buildPostMockExport(
  report: PostMockReport,
  locale: ExportLocale,
  format: ExportFormat = "xlsx",
): ExportFile {
  const vi = locale === "vi";
  const metadata = [
    { label: vi ? "Lớp" : "Class", value: textCell(report.classTitle) },
    {
      label: vi ? "Bài đánh giá" : "Assessment",
      value: textCell(report.title),
    },
    { label: vi ? "Từ" : "From", value: textCell(report.period.start) },
    { label: vi ? "Đến" : "To", value: textCell(report.period.end) },
    {
      label: vi ? "Múi giờ" : "Timezone",
      value: textCell(report.period.timezone),
    },
    {
      label: vi ? "Sĩ số hiện tại" : "Current roster",
      value: numberCell(report.rosterCount),
    },
    {
      label: vi ? "Học viên đã nộp" : "Submitted learners",
      value: numberCell(report.submittedLearners),
    },
    {
      label: vi ? "Học viên có điểm tạm thời" : "Provisional learners",
      value: numberCell(report.provisionalCount),
    },
    {
      label: vi ? "Phương pháp" : "Methodology",
      value: textCell(report.methodology[locale]),
    },
  ];
  const metadataColumns: ExportColumn<(typeof metadata)[number]>[] = [
    {
      key: "label",
      header: { en: "Measure", vi: "Chỉ số" },
      value: (row) => textCell(row.label),
    },
    {
      key: "value",
      header: { en: "Value", vi: "Giá trị" },
      value: (row) => row.value,
    },
  ];
  const comparison = [
    ...report.strengths.map((row) => ({
      ...row,
      kind: vi ? "Điểm mạnh tương đối" : "Relative strength",
    })),
    ...report.gaps.map((row) => ({
      ...row,
      kind: vi ? "Cần cải thiện tương đối" : "Relative gap",
    })),
  ];
  const comparisonColumns: ExportColumn<(typeof comparison)[number]>[] = [
    {
      key: "kind",
      header: { en: "Observation", vi: "Nhận xét" },
      value: (row) => textCell(row.kind),
    },
    {
      key: "skill",
      header: { en: "Skill", vi: "Kỹ năng" },
      value: (row) => textCell(SKILL_LABELS[row.skill][locale]),
    },
    {
      key: "band",
      header: { en: "Mean skill band", vi: "Điểm kỹ năng trung bình" },
      value: (row) => numberCell(row.meanBand),
    },
  ];
  const nextColumns: ExportColumn<PostMockReport["nextSteps"][number]>[] = [
    {
      key: "skill",
      header: { en: "Skill", vi: "Kỹ năng" },
      value: (row) => textCell(SKILL_LABELS[row.skill][locale]),
    },
    {
      key: "next",
      header: { en: "Reteach next", vi: "Nội dung cần dạy lại" },
      value: (row) => textCell(row.label[locale]),
    },
    {
      key: "learners",
      header: { en: "Affected learners", vi: "Học viên cần hỗ trợ" },
      value: (row) => numberCell(row.affectedLearners),
    },
  ];
  return buildExport(
    [
      buildSheet(
        vi ? "Tổng quan" : "Summary",
        metadataColumns,
        metadata,
        locale,
      ),
      buildSheet(
        vi ? "Kỹ năng" : "Skills",
        ANALYTICS_SKILL_COLUMNS,
        report.skillSummaries,
        locale,
      ),
      buildSheet(
        vi ? "Tiêu chí" : "Criteria",
        ANALYTICS_CRITERION_COLUMNS,
        report.criterionSummaries,
        locale,
      ),
      buildSheet(
        vi ? "Nhận xét" : "Observations",
        comparisonColumns,
        comparison,
        locale,
      ),
      buildSheet(
        vi ? "Dạy lại" : "Next teaching steps",
        nextColumns,
        report.nextSteps,
        locale,
      ),
    ],
    {
      format,
      basename: exportBasename(
        ["post-mock", report.classTitle, report.title],
        new Date(report.period.end),
      ),
    },
  );
}
