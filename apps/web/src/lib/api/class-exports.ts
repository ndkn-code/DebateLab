/**
 * Class export column sets (B3). The four surfaces the product needs to get
 * data *out*: roster, attendance, IELTS gradebook, and the roster-import error
 * sheet (that one lives with the importer).
 *
 * Column arrays are exported, not just the builders, so B4 (parent band report)
 * and O1/O4 (tuition, revenue) can compose their own sheets from the same
 * declarations instead of re-deriving header text and cell formatting.
 *
 * Pure: takes already-loaded view models, returns bytes. No DB, no auth — the
 * server action does both.
 */
import {
  buildExport,
  buildSheet,
  dateCell,
  exportBasename,
  numberCell,
  percentCell,
  textCell,
  type ExportColumn,
  type ExportFile,
  type ExportFormat,
  type ExportLocale,
} from "@/lib/export";
import type { IeltsClassGradebook, IeltsGradebookRow } from "@/lib/api/ielts/gradebook-repository";
import type {
  AdminClassAttendanceSession,
  AdminClassDetailData,
  AdminClassRosterRow,
  AttendanceStatus,
} from "@/lib/types/admin-classes";

export interface ClassExportOptions {
  locale: ExportLocale;
  format: ExportFormat;
}

// ---- roster ---------------------------------------------------------------

export const CLASS_ROSTER_EXPORT_COLUMNS: ReadonlyArray<ExportColumn<AdminClassRosterRow>> = [
  {
    key: "displayName",
    header: { en: "Name", vi: "Họ và tên" },
    value: (row) => textCell(row.displayName),
  },
  { key: "email", header: { en: "Email", vi: "Email" }, value: (row) => textCell(row.email) },
  {
    key: "memberRole",
    header: { en: "Role", vi: "Vai trò" },
    value: (row, locale) =>
      textCell(
        row.memberRole === "teacher"
          ? locale === "vi"
            ? "Giáo viên"
            : "Teacher"
          : locale === "vi"
            ? "Học viên"
            : "Student",
      ),
  },
  {
    key: "status",
    header: { en: "Status", vi: "Trạng thái" },
    value: (row, locale) =>
      textCell(
        row.status === "active"
          ? locale === "vi"
            ? "Đang học"
            : "Active"
          : locale === "vi"
            ? "Đã rời lớp"
            : "Removed",
      ),
  },
  {
    key: "joinedAt",
    header: { en: "Joined", vi: "Ngày vào lớp" },
    value: (row) => dateCell(row.joinedAt),
  },
  {
    key: "attendanceRate30d",
    header: { en: "Attendance 30d %", vi: "Chuyên cần 30 ngày %" },
    value: (row) => percentCell(row.attendanceRate30d),
  },
  {
    key: "present30d",
    header: { en: "Present 30d", vi: "Có mặt 30 ngày" },
    value: (row) => numberCell(row.present30d),
  },
  {
    key: "late30d",
    header: { en: "Late 30d", vi: "Đi muộn 30 ngày" },
    value: (row) => numberCell(row.late30d),
  },
  {
    key: "absent30d",
    header: { en: "Absent 30d", vi: "Vắng 30 ngày" },
    value: (row) => numberCell(row.absent30d),
  },
];

export function buildClassRosterExport(
  detail: AdminClassDetailData,
  options: ClassExportOptions,
): ExportFile {
  const name = options.locale === "vi" ? "Danh sách lớp" : "Roster";
  const sheet = buildSheet(name, CLASS_ROSTER_EXPORT_COLUMNS, detail.roster, options.locale);
  return buildExport([sheet], {
    format: options.format,
    basename: exportBasename(["roster", detail.classInfo.code || detail.classInfo.title]),
  });
}

// ---- attendance -----------------------------------------------------------

const ATTENDANCE_CODES: Record<AttendanceStatus, Record<ExportLocale, string>> = {
  present: { en: "P", vi: "C" },
  late: { en: "L", vi: "M" },
  absent: { en: "A", vi: "V" },
};

const ATTENDANCE_LABELS: Record<AttendanceStatus, Record<ExportLocale, string>> = {
  present: { en: "Present", vi: "Có mặt" },
  late: { en: "Late", vi: "Đi muộn" },
  absent: { en: "Absent", vi: "Vắng" },
};

type GridStudent = AdminClassDetailData["attendanceGrid"]["students"][number];

function sessionHeader(session: AdminClassAttendanceSession): string {
  const day = session.sessionDate.slice(0, 10);
  return session.title ? `${day} ${session.title}` : day;
}

/**
 * The grid tab: one row per student, one column per session, `P`/`L`/`A`.
 * This is the tab a teacher prints and marks by hand when the wifi is out.
 */
function buildAttendanceGridSheet(
  detail: AdminClassDetailData,
  locale: ExportLocale,
) {
  const sessions = detail.attendanceGrid.sessions;
  const columns: Array<ExportColumn<GridStudent>> = [
    {
      key: "displayName",
      header: { en: "Name", vi: "Họ và tên" },
      value: (row) => textCell(row.displayName),
    },
    {
      key: "attendanceRate30d",
      header: { en: "Rate 30d %", vi: "Tỷ lệ 30 ngày %" },
      value: (row) => percentCell(row.attendanceRate30d),
    },
    ...sessions.map((session) => ({
      key: `session:${session.id}`,
      header: { en: sessionHeader(session), vi: sessionHeader(session) },
      value: (row: GridStudent) => {
        const status = row.attendance[session.id];
        return textCell(status ? ATTENDANCE_CODES[status][locale] : "");
      },
    })),
  ];
  const name = locale === "vi" ? "Bảng điểm danh" : "Attendance grid";
  return buildSheet(name, columns, detail.attendanceGrid.students, locale);
}

interface AttendanceLongRow {
  student: GridStudent;
  session: AdminClassAttendanceSession;
  status: AttendanceStatus | null;
}

export const ATTENDANCE_LONG_EXPORT_COLUMNS: ReadonlyArray<ExportColumn<AttendanceLongRow>> = [
  {
    key: "sessionDate",
    header: { en: "Session date", vi: "Ngày học" },
    value: (row) => dateCell(row.session.sessionDate),
  },
  {
    key: "sessionTitle",
    header: { en: "Session", vi: "Buổi học" },
    value: (row) => textCell(row.session.title ?? row.session.courseTitle),
  },
  {
    key: "displayName",
    header: { en: "Name", vi: "Họ và tên" },
    value: (row) => textCell(row.student.displayName),
  },
  { key: "email", header: { en: "Email", vi: "Email" }, value: (row) => textCell(row.student.email) },
  {
    key: "status",
    header: { en: "Status", vi: "Trạng thái" },
    value: (row, locale) =>
      textCell(row.status ? ATTENDANCE_LABELS[row.status][locale] : ""),
  },
];

/**
 * Two tabs, deliberately: the grid is for humans, the long form is for
 * pivot tables and for anything downstream that needs one fact per row.
 */
export function buildClassAttendanceExport(
  detail: AdminClassDetailData,
  options: ClassExportOptions,
): ExportFile {
  const longRows: AttendanceLongRow[] = [];
  for (const student of detail.attendanceGrid.students) {
    for (const session of detail.attendanceGrid.sessions) {
      longRows.push({ student, session, status: student.attendance[session.id] ?? null });
    }
  }
  const longName = options.locale === "vi" ? "Chi tiết" : "Detail";
  return buildExport(
    [
      buildAttendanceGridSheet(detail, options.locale),
      buildSheet(longName, ATTENDANCE_LONG_EXPORT_COLUMNS, longRows, options.locale),
    ],
    {
      format: options.format,
      basename: exportBasename(["attendance", detail.classInfo.code || detail.classInfo.title]),
    },
  );
}

// ---- IELTS gradebook ------------------------------------------------------

type BandKey = "listening" | "reading" | "writing" | "speaking" | "overall";

/** Mean of the bands actually scored across this student's assignments. */
function band(row: IeltsGradebookRow, key: BandKey): number | null {
  const scored = row.assignments
    .map((assignment) => assignment.score[key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (scored.length === 0) return null;
  return Math.round((scored.reduce((a, b) => a + b, 0) / scored.length) * 10) / 10;
}

export const IELTS_GRADEBOOK_EXPORT_COLUMNS: ReadonlyArray<ExportColumn<IeltsGradebookRow>> = [
  {
    key: "displayName",
    header: { en: "Name", vi: "Họ và tên" },
    value: (row) => textCell(row.displayName),
  },
  { key: "email", header: { en: "Email", vi: "Email" }, value: (row) => textCell(row.email) },
  {
    key: "membershipStatus",
    header: { en: "Membership", vi: "Trạng thái" },
    value: (row) => textCell(row.membershipStatus),
  },
  {
    key: "attendanceRate",
    header: { en: "Attendance %", vi: "Chuyên cần %" },
    value: (row) => percentCell(row.attendance.rate),
  },
  {
    key: "present",
    header: { en: "Present", vi: "Có mặt" },
    value: (row) => numberCell(row.attendance.present),
  },
  {
    key: "late",
    header: { en: "Late", vi: "Đi muộn" },
    value: (row) => numberCell(row.attendance.late),
  },
  {
    key: "absent",
    header: { en: "Absent", vi: "Vắng" },
    value: (row) => numberCell(row.attendance.absent),
  },
  {
    key: "overall",
    header: { en: "Overall band", vi: "Điểm tổng" },
    value: (row) => numberCell(band(row, "overall")),
  },
  {
    key: "listening",
    header: { en: "Listening", vi: "Nghe" },
    value: (row) => numberCell(band(row, "listening")),
  },
  {
    key: "reading",
    header: { en: "Reading", vi: "Đọc" },
    value: (row) => numberCell(band(row, "reading")),
  },
  {
    key: "writing",
    header: { en: "Writing", vi: "Viết" },
    value: (row) => numberCell(band(row, "writing")),
  },
  {
    key: "speaking",
    header: { en: "Speaking", vi: "Nói" },
    value: (row) => numberCell(band(row, "speaking")),
  },
  {
    key: "submitted",
    header: { en: "Submitted", vi: "Đã nộp" },
    value: (row) =>
      numberCell(row.assignments.filter((assignment) => assignment.submittedAt !== null).length),
  },
  {
    key: "assigned",
    header: { en: "Assigned", vi: "Được giao" },
    value: (row) => numberCell(row.assignments.length),
  },
  {
    key: "needsReview",
    header: { en: "Needs review", vi: "Cần chấm" },
    value: (row) =>
      numberCell(row.assignments.filter((assignment) => assignment.needsTeacherReview).length),
  },
];

/**
 * `rows` must already be the *whole* class: `loadIeltsClassGradebook` pages at
 * 25 and the caller has to follow `nextCursor` to exhaustion, or the export
 * silently ships the first page as if it were the class.
 */
export function buildIeltsGradebookExport(
  gradebook: Pick<IeltsClassGradebook, "classTitle" | "rows">,
  options: ClassExportOptions,
): ExportFile {
  const name = options.locale === "vi" ? "Bảng điểm" : "Gradebook";
  const sheet = buildSheet(name, IELTS_GRADEBOOK_EXPORT_COLUMNS, gradebook.rows, options.locale);
  return buildExport([sheet], {
    format: options.format,
    basename: exportBasename(["gradebook", gradebook.classTitle]),
  });
}
