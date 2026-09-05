/**
 * Unit tests for the roster importer (B3): normalization, scored column
 * mapping, the pure planner, and the template/error-sheet round trip.
 *
 * No DB — `execute.ts` is `server-only` and is exercised by typecheck. What is
 * tested here is everything a teacher's real spreadsheet can throw at us.
 */
import assert from "node:assert/strict";
import { parseCsvSheet } from "@/lib/api/ielts/import/parse-csv";
import { parseXlsxWorkbook } from "@/lib/api/ielts/import/parse-xlsx";
import { ROSTER_FIELDS } from "../columns";
import { buildRosterErrorExport, buildRosterTemplate } from "../template";
import {
  emptyMapping,
  guessedFields,
  mappingFromSuggestions,
  suggestColumnMapping,
} from "./column-map";
import { describeIssue } from "./messages";
import {
  cleanText,
  nameMatchKey,
  normalizeDate,
  normalizeEmail,
  normalizeKey,
  normalizePhone,
} from "./normalize";
import { planRosterSheet } from "./plan";
import type { RosterRowResult } from "./types";

// ---- normalizeKey: diacritics are the whole point ------------------------
{
  assert.equal(normalizeKey("Họ và tên"), "ho va ten");
  assert.equal(normalizeKey("SĐT phụ huynh"), "sdt phu huynh");
  assert.equal(normalizeKey("Ngày sinh"), "ngay sinh");
  assert.equal(normalizeKey("  E-MAIL  "), "e mail");
  assert.equal(normalizeKey("Đ"), "d");
}

// ---- phone: one number, many spellings -----------------------------------
{
  for (const input of [
    "0905123456",
    "0905 123 456",
    "0905.123.456",
    "+84 905 123 456",
    "84905123456",
    "905123456",
    "+84905123456",
  ]) {
    assert.equal(normalizePhone(input), "+84905123456", `failed for ${input}`);
  }
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone(null), null);
  assert.equal(normalizePhone("+1 415 555 0100"), "+14155550100", "non-VN kept intact");
}

// ---- dates: day-first, ISO, and Excel serials ----------------------------
{
  assert.deepEqual(normalizeDate("17/04/2009"), { ok: true, value: "2009-04-17" });
  assert.deepEqual(normalizeDate("05/04/2009"), { ok: true, value: "2009-04-05" }, "day first");
  assert.deepEqual(normalizeDate("17-04-2009"), { ok: true, value: "2009-04-17" });
  assert.deepEqual(normalizeDate("2009-04-17"), { ok: true, value: "2009-04-17" });
  assert.deepEqual(normalizeDate("17/4/09"), { ok: true, value: "2009-04-17" });
  // A real Excel date cell arrives as a serial, because parseXlsxWorkbook does
  // no number-format handling. 39920 = 2009-04-17.
  assert.deepEqual(normalizeDate("39920"), { ok: true, value: "2009-04-17" });
  assert.deepEqual(normalizeDate(""), { ok: true, value: null });
  assert.deepEqual(normalizeDate("32/13/2009"), { ok: false, raw: "32/13/2009" });
  assert.deepEqual(normalizeDate("hôm qua"), { ok: false, raw: "hôm qua" });
}

// ---- email + the formula-guard round trip --------------------------------
{
  assert.deepEqual(normalizeEmail(" Tuyet@Example.COM "), { ok: true, value: "tuyet@example.com" });
  assert.deepEqual(normalizeEmail(""), { ok: true, value: null });
  assert.deepEqual(normalizeEmail("not-an-email"), { ok: false, raw: "not-an-email" });
  // Our own CSV export guards a leading `+`; the importer must undo that or the
  // fix-and-re-import loop corrupts every phone number.
  assert.equal(cleanText("'+84905123456"), "+84905123456");
  assert.equal(normalizePhone("'+84905123456"), "+84905123456");
}

// ---- column mapping: scored, greedy, one source column per field ---------
{
  // A real centre sheet: extra columns, Vietnamese headers, no email.
  const headers = ["STT", "Họ và tên", "Ngày sinh", "SĐT phụ huynh", "Tên phụ huynh", "Học phí"];
  const suggestions = suggestColumnMapping(headers);
  const mapping = mappingFromSuggestions(suggestions);

  assert.equal(mapping.fullName, 1, "Họ và tên → fullName");
  assert.equal(mapping.dateOfBirth, 2);
  assert.equal(mapping.guardianPhone, 3, "SĐT phụ huynh must not be read as the student phone");
  assert.equal(mapping.guardianName, 4);
  assert.equal(mapping.email, null, "no email column in this sheet");
  assert.equal(mapping.phone, null, "student phone stays unmapped rather than stealing the parent's");

  // Every mapped source column is used at most once.
  const used = Object.values(mapping).filter((index): index is number => index !== null);
  assert.equal(new Set(used).size, used.length, "no source column feeds two fields");
}

// ---- the guardian/student email collision the substring approach loses ---
{
  const suggestions = suggestColumnMapping(["Email", "Email phụ huynh"]);
  const mapping = mappingFromSuggestions(suggestions);
  assert.equal(mapping.email, 0);
  assert.equal(mapping.guardianEmail, 1);
}

// ---- our own template auto-maps perfectly, with no guesses ---------------
{
  const template = buildRosterTemplate("vi", "xlsx");
  const workbook = parseXlsxWorkbook(template.bytes);
  assert.equal(workbook.sheets.length, 2, "data tab + guide tab");
  assert.equal(workbook.sheets[0].name, "Roster");
  assert.equal(workbook.sheets[0].rows.length, 0, "no example rows in the importable tab");

  const suggestions = suggestColumnMapping(workbook.sheets[0].headers);
  assert.equal(guessedFields(suggestions).length, 0, "template never produces a guess");
  for (const suggestion of suggestions) {
    assert.equal(suggestion.confidence, "exact", `${suggestion.field} should map exactly`);
  }
  // The guide tab carries the examples, where they cannot be imported.
  assert.equal(workbook.sheets[1].rows.length, ROSTER_FIELDS.length);

  const english = parseXlsxWorkbook(buildRosterTemplate("en", "xlsx").bytes);
  assert.equal(guessedFields(suggestColumnMapping(english.sheets[0].headers)).length, 0);
}

// ---- the planner: per-row validation, nothing all-or-nothing -------------
{
  const csv = [
    "Họ và tên,Email,Mã học viên,Ngày sinh,SĐT",
    "Nguyễn Thị Ánh Tuyết,tuyet@example.com,HV-001,17/04/2009,0905123456",
    ",missing@example.com,HV-002,01/01/2010,0905123457",
    "Trần Văn Đức,not-an-email,HV-003,17/04/2010,0905123458",
    "Lê Thị Hoa,hoa@example.com,HV-004,hôm qua,0905123459",
    "Phạm Minh Quân,quan@example.com,HV-005,,",
  ].join("\n");
  const sheet = parseCsvSheet("Roster", csv);
  const mapping = mappingFromSuggestions(suggestColumnMapping(sheet.headers));
  const plan = planRosterSheet(sheet, mapping);

  assert.equal(plan.counts.total, 5);
  assert.equal(plan.counts.blocked, 3, "missing name, bad email, bad date");
  assert.equal(plan.counts.ready, 2);
  assert.equal(plan.counts.withEmail, 2);

  assert.equal(plan.rows[0].blocked, false);
  assert.equal(plan.rows[0].values.phone, "+84905123456", "phone normalized on the way in");
  assert.equal(plan.rows[0].values.dateOfBirth, "2009-04-17");
  assert.equal(plan.rows[1].issues[0].code, "missing_full_name");
  assert.equal(plan.rows[2].issues[0].code, "invalid_email");
  assert.equal(plan.rows[3].issues[0].code, "invalid_date");
  assert.equal(plan.rows[4].blocked, false, "empty optional columns are fine");
  assert.equal(plan.rows[4].values.dateOfBirth, null);
}

// ---- within-file duplicates block BOTH rows ------------------------------
{
  const csv = [
    "Họ và tên,Email,Mã học viên",
    "Nguyễn Văn A,a@example.com,HV-1",
    "Nguyễn Văn B,a@example.com,HV-2",
    "Nguyễn Văn C,c@example.com,HV-3",
  ].join("\n");
  const sheet = parseCsvSheet("Roster", csv);
  const plan = planRosterSheet(sheet, mappingFromSuggestions(suggestColumnMapping(sheet.headers)));

  assert.equal(plan.rows[0].blocked, true, "first duplicate is blocked too, not silently kept");
  assert.equal(plan.rows[1].blocked, true);
  assert.equal(plan.rows[2].blocked, false);
  assert.equal(plan.rows[0].issues[0].code, "duplicate_in_file");
  assert.ok(plan.rows[0].issues[0].detail?.includes("1, 2"), "names both offending rows");
  assert.equal(plan.counts.ready, 1);
}

// ---- duplicate student codes are their own failure -----------------------
{
  const csv = ["Họ và tên,Mã học viên", "Nguyễn Văn A,HV-1", "Nguyễn Văn B,hv-1"].join("\n");
  const sheet = parseCsvSheet("Roster", csv);
  const plan = planRosterSheet(sheet, mappingFromSuggestions(suggestColumnMapping(sheet.headers)));
  assert.equal(plan.counts.blocked, 2, "student code match is case-insensitive");
  assert.equal(plan.rows[0].issues[0].code, "duplicate_student_code");
}

// ---- an unmapped required field is a sheet-level warning -----------------
{
  const sheet = parseCsvSheet("Roster", "Cột lạ,Cột khác\nx,y");
  const plan = planRosterSheet(sheet, emptyMapping());
  assert.ok(plan.warnings.some((w) => w.includes("Full name")));
  assert.equal(plan.counts.ready, 0);
}

// ---- blank and duplicated headers are reported, not silently dropped -----
{
  const sheet = { name: "Roster", headers: ["Họ và tên", "", "Họ và tên"], rows: [] };
  const plan = planRosterSheet(sheet, emptyMapping());
  assert.ok(plan.warnings.some((w) => w.includes("no header")));
  assert.ok(plan.warnings.some((w) => w.includes("appears in columns")));
}

// ---- issue messages are bilingual ----------------------------------------
{
  const issue = { field: "dateOfBirth", code: "invalid_date", detail: "hôm qua" } as const;
  assert.ok(describeIssue(issue, "vi").includes("hôm qua"));
  assert.ok(describeIssue(issue, "vi").includes("không phải ngày"));
  assert.ok(describeIssue(issue, "en").includes("is not a date"));
  assert.ok(!describeIssue(issue, "vi").includes("{detail}"), "placeholder is interpolated");
}

// ---- the error sheet is itself a valid re-import -------------------------
{
  const csv = [
    "Họ và tên,Email,Ngày sinh",
    "Nguyễn Thị Ánh Tuyết,tuyet@example.com,17/04/2009",
    "Trần Văn Đức,bad-email,17/04/2010",
  ].join("\n");
  const sheet = parseCsvSheet("Roster", csv);
  const plan = planRosterSheet(sheet, mappingFromSuggestions(suggestColumnMapping(sheet.headers)));

  const results: RosterRowResult[] = plan.rows.map((row) => ({
    rowNumber: row.rowNumber,
    fullName: row.values.fullName,
    email: row.values.email,
    outcome: row.blocked ? "error" : "created",
    studentRecordId: null,
    issues: row.issues,
  }));

  const errorFile = buildRosterErrorExport(results, plan.rows, "vi", "xlsx");
  const workbook = parseXlsxWorkbook(errorFile.bytes);
  const errorSheet = workbook.sheets[0];
  assert.equal(errorSheet.rows.length, 1, "only the failed row");
  assert.equal(errorSheet.rows[0]["Họ và tên"], "Trần Văn Đức");
  assert.equal(errorSheet.rows[0]["Email"], "bad-email", "the original bad value, to be fixed");
  assert.ok(errorSheet.rows[0]["Lỗi"].includes("không phải địa chỉ email hợp lệ"));

  // The critical property: fix the cell, re-upload this same file, and the
  // roster columns still auto-map exactly.
  const remapped = suggestColumnMapping(errorSheet.headers);
  assert.equal(guessedFields(remapped).length, 0);
  const mapping = mappingFromSuggestions(remapped);
  assert.notEqual(mapping.fullName, null);
  assert.notEqual(mapping.email, null);
  assert.notEqual(mapping.dateOfBirth, null);
}

// ---- name + DOB match key --------------------------------------------------
{
  assert.equal(nameMatchKey("Nguyễn Văn A", "2009-04-17"), "nguyen van a|2009-04-17");
  assert.equal(
    nameMatchKey("nguyen  van   a", "2009-04-17"),
    nameMatchKey("Nguyễn Văn A", "2009-04-17"),
    "diacritics and spacing do not create a false distinction",
  );
}

console.log("roster import tests passed");
