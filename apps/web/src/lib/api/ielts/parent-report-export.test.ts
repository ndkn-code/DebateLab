import assert from "node:assert/strict";
import { parseXlsxWorkbook } from "@/lib/api/ielts/import/parse-xlsx";
import {
  buildParentBandReportExport,
  buildParentReportSheets,
} from "./parent-report-export";
import { createParentReportFixture } from "@/lib/ielts/parent-report/fixtures";

const report = createParentReportFixture("complete");

for (const locale of ["vi", "en"] as const) {
  const sheets = buildParentReportSheets(report, locale);
  assert.equal(sheets.length, 6);
  assert.equal(sheets[0].headers[0], locale === "vi" ? "Họ và tên" : "Name");
  assert.equal(
    sheets[0].rows[0].find(
      (cell) =>
        cell.kind === "text" && cell.value === report.context.studentName,
    )?.value,
    report.context.studentName,
  );
  const workbook = parseXlsxWorkbook(
    buildParentBandReportExport(report, locale).bytes,
  );
  assert.equal(workbook.sheets.length, 6);
  assert.equal(
    workbook.sheets[0].headers[0],
    locale === "vi" ? "Họ và tên" : "Name",
  );
  assert.equal(
    workbook.sheets[0].rows[0][locale === "vi" ? "Điểm tổng" : "Overall band"],
    "6.5",
  );
  assert.equal(
    workbook.sheets[0].rows[0][
      locale === "vi" ? "Chuyên cần %" : "Attendance %"
    ],
    "87.5",
  );
  assert.equal(
    workbook.sheets[0].rows[0][locale === "vi" ? "Chưa điểm danh" : "Unmarked"],
    "1",
  );
  assert.equal(
    workbook.sheets[1].rows[0][
      locale === "vi" ? "Điểm gần nhất trong tháng" : "Latest band this month"
    ],
    "7",
  );
  const trajectory = workbook.sheets.find(
    (sheet) => sheet.name === (locale === "vi" ? "Tiến trình" : "Trajectory"),
  );
  assert.ok(trajectory);
  assert.equal(trajectory.rows.length, 6);
  assert.ok(
    workbook.sheets
      .flatMap((sheet) => Object.values(sheet.rows[0] ?? {}))
      .some(
        (value) =>
          String(value).includes("Kết hợp giáo viên và AI") ||
          String(value).includes("Teacher and AI combined"),
      ),
  );
}

const partial = createParentReportFixture("partial");
const partialSheets = buildParentReportSheets(partial, "en");
const partialWorkbook = parseXlsxWorkbook(
  buildParentBandReportExport(partial, "en").bytes,
);
assert.equal(
  partialSheets[0].rows[0].find(
    (cell) => cell.kind === "number" && cell.value === null,
  ),
  undefined,
);
assert.equal(partialWorkbook.sheets[0].rows[0]["Overall band"], "");
assert.equal(
  partialWorkbook.sheets[1].rows.some(
    (row) => row["Latest band this month"] === "",
  ),
  true,
);

const attendance = createParentReportFixture("complete");
attendance.attendance.sessions = [
  "present",
  "late",
  "absent",
  "unmarked",
  "present",
  "present",
  "late",
  "absent",
].map((status, index) => ({
  sessionId: `session-${index}`,
  date: `2026-08-${String(index + 1).padStart(2, "0")}`,
  title: "Class",
  status: status as "present" | "late" | "absent" | "unmarked",
}));
attendance.attendance.present = 3;
attendance.attendance.late = 2;
attendance.attendance.absent = 2;
attendance.attendance.unmarked = 1;
attendance.attendance.recordedSessions = 8;
attendance.attendance.markedSessions = 7;
attendance.attendance.rate = 0.875;
const attendanceWorkbook = parseXlsxWorkbook(
  buildParentBandReportExport(attendance, "en").bytes,
);
assert.equal(attendanceWorkbook.sheets[0].rows[0]["Attendance %"], "87.5");
assert.equal(attendanceWorkbook.sheets[0].rows[0].Unmarked, "1");

const risky = buildParentBandReportExport(report, "en", [
  '=HYPERLINK("https://example.test")',
  "+unsafe",
]);
const riskyText = new TextDecoder().decode(risky.bytes);
assert.equal(
  riskyText.includes("<f>"),
  false,
  "custom next steps must be inline text, never formulas",
);
const riskyWorkbook = parseXlsxWorkbook(risky.bytes);
const nextSteps = riskyWorkbook.sheets.find(
  (sheet) => sheet.name === "Next steps",
);
assert.ok(nextSteps);
assert.equal(
  nextSteps.rows[0]["Practice focus"],
  '=HYPERLINK("https://example.test")',
);
assert.equal(nextSteps.rows[1]["Practice focus"], "+unsafe");

const boundary = createParentReportFixture("complete");
boundary.headlineAssessment!.submittedAt = "2026-08-31T17:30:00.000Z";
const boundaryWorkbook = parseXlsxWorkbook(
  buildParentBandReportExport(boundary, "en").bytes,
);
assert.equal(
  boundaryWorkbook.sheets[0].rows[0]["Latest assessment date"],
  "2026-09-01",
);
assert.equal(riskyText.includes("provisional"), false);
assert.equal(riskyText.includes("email"), false);
assert.equal(riskyText.includes("provider"), false);
console.log("parent report export tests passed");
