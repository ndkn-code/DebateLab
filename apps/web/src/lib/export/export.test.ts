/**
 * Unit tests for the shared export helper (B3). The load-bearing assertion is
 * the round trip: everything this module writes must parse back through the
 * IELTS import readers, because the roster import is an export → edit →
 * re-import loop and a one-way writer would break it silently.
 */
import assert from "node:assert/strict";
import { parseCsvSheet } from "@/lib/api/ielts/import/parse-csv";
import { parseXlsxWorkbook } from "@/lib/api/ielts/import/parse-xlsx";
import {
  buildExport,
  buildSheet,
  columnLetter,
  dateCell,
  dateTimeCell,
  decodeExportPayload,
  encodeExportPayload,
  exportBasename,
  numberCell,
  percentCell,
  boolCell,
  sheetToCsv,
  textCell,
  type ExportColumn,
} from "./index";

interface Student {
  name: string;
  code: string;
  band: number | null;
  attendance: number | null;
  dob: string | null;
  active: boolean;
  notes: string | null;
}

const COLUMNS: ReadonlyArray<ExportColumn<Student>> = [
  { key: "name", header: { en: "Full name", vi: "Họ và tên" }, value: (r) => textCell(r.name) },
  { key: "code", header: { en: "Student code", vi: "Mã học viên" }, value: (r) => textCell(r.code) },
  { key: "band", header: { en: "Band", vi: "Điểm" }, value: (r) => numberCell(r.band) },
  { key: "att", header: { en: "Attendance %", vi: "Chuyên cần %" }, value: (r) => percentCell(r.attendance) },
  { key: "dob", header: { en: "Date of birth", vi: "Ngày sinh" }, value: (r) => dateCell(r.dob) },
  { key: "active", header: { en: "Active", vi: "Đang học" }, value: (r, l) => boolCell(r.active, l) },
  { key: "notes", header: { en: "Notes", vi: "Ghi chú" }, value: (r) => textCell(r.notes) },
];

const ROWS: Student[] = [
  {
    name: "Nguyễn Thị Ánh Tuyết",
    code: "HV-001",
    band: 6.5,
    attendance: 92.55,
    dob: "2009-04-17",
    active: true,
    notes: 'Cần "chú ý", nghỉ 2 buổi',
  },
  {
    name: "Trần Văn Đức",
    code: "HV-002",
    band: null,
    attendance: null,
    dob: "2010-11-02T00:00:00.000Z",
    active: false,
    notes: null,
  },
];

// ---- buildSheet: bilingual headers, typed cells --------------------------
{
  const vi = buildSheet("Danh sách", COLUMNS, ROWS, "vi");
  assert.deepEqual(vi.headers, [
    "Họ và tên",
    "Mã học viên",
    "Điểm",
    "Chuyên cần %",
    "Ngày sinh",
    "Đang học",
    "Ghi chú",
  ]);
  const en = buildSheet("Roster", COLUMNS, ROWS, "en");
  assert.equal(en.headers[0], "Full name");
  assert.deepEqual(en.rows[0][2], { kind: "number", value: 6.5 });
  assert.deepEqual(en.rows[0][3], { kind: "number", value: 92.6 }, "percent rounds to 1dp");
  assert.deepEqual(en.rows[1][2], { kind: "text", value: "" }, "null number is an empty cell");
  assert.equal(en.rows[0][5].value, "Yes");
  assert.equal(vi.rows[0][5].value, "Có");
  assert.equal(vi.rows[1][5].value, "Không");
  assert.equal(vi.rows.length, 2);
}

// ---- dates are ISO text, never Excel serials -----------------------------
{
  assert.deepEqual(dateCell("2009-04-17"), { kind: "text", value: "2009-04-17" });
  assert.deepEqual(dateCell("2010-11-02T15:30:00.000Z"), { kind: "text", value: "2010-11-02" });
  assert.deepEqual(dateCell(new Date(Date.UTC(2026, 8, 4))), { kind: "text", value: "2026-09-04" });
  assert.deepEqual(dateCell(null), { kind: "text", value: "" });
  assert.deepEqual(dateTimeCell("2026-09-04T07:05:00.000Z"), {
    kind: "text",
    value: "2026-09-04 07:05",
  });
  assert.deepEqual(dateCell("not a date"), { kind: "text", value: "not a date" });
}

// ---- CSV: BOM, RFC-4180 quoting, and a real round trip -------------------
{
  const sheet = buildSheet("Roster", COLUMNS, ROWS, "en");
  const file = buildExport([sheet], { format: "csv", basename: "roster" });
  assert.equal(file.filename, "roster.csv");
  assert.equal(file.mimeType, "text/csv;charset=utf-8");

  // Assert on bytes: TextDecoder silently swallows a leading BOM by default.
  assert.deepEqual(
    Array.from(file.bytes.slice(0, 3)),
    [0xef, 0xbb, 0xbf],
    "CSV must lead with a UTF-8 BOM or Excel on VN Windows mangles diacritics",
  );

  // parseCsvSheet strips the BOM, so the round trip is lossless.
  const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(file.bytes);
  assert.equal(text.charCodeAt(0), 0xfeff);
  const parsed = parseCsvSheet("Roster", text);
  assert.deepEqual(parsed.headers, sheet.headers);
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0]["Full name"], "Nguyễn Thị Ánh Tuyết", "diacritics survive");
  assert.equal(parsed.rows[0]["Notes"], 'Cần "chú ý", nghỉ 2 buổi', "quotes + commas survive");
  assert.equal(parsed.rows[0]["Band"], "6.5");
  assert.equal(parsed.rows[1]["Band"], "", "null stays empty, not 'null'");
  assert.equal(parsed.rows[1]["Date of birth"], "2010-11-02");
}

// ---- CSV formula injection guard ----------------------------------------
{
  interface Row {
    value: string;
  }
  const cols: ReadonlyArray<ExportColumn<Row>> = [
    { key: "v", header: { en: "Value", vi: "Giá trị" }, value: (r) => textCell(r.value) },
  ];
  const risky = buildSheet("S", cols, [{ value: "=cmd|'/c calc'!A0" }, { value: "+84901234567" }], "en");

  const guarded = sheetToCsv(risky);
  assert.ok(guarded.includes("'=cmd|'/c calc'!A0"), "formula cell is apostrophe-guarded");
  assert.ok(guarded.includes("'+84901234567"), "leading + is guarded so Excel keeps it as text");

  const raw = sheetToCsv(risky, { formulaGuard: false });
  assert.ok(!raw.includes("'+84901234567"), "guard is opt-out for machine round-trip artifacts");

  // Numeric cells are never guarded — they are not user text.
  const nums = buildSheet(
    "S",
    [{ key: "n", header: { en: "N", vi: "N" }, value: () => numberCell(-5) }],
    [{ value: "" }],
    "en",
  );
  assert.ok(sheetToCsv(nums).includes("-5") && !sheetToCsv(nums).includes("'-5"));
}

// ---- XLSX: round trip through the IELTS reader ---------------------------
{
  const sheet = buildSheet("Danh sách", COLUMNS, ROWS, "vi");
  const file = buildExport([sheet], { format: "xlsx", basename: "roster" });
  assert.equal(file.filename, "roster.xlsx");
  assert.equal(
    file.mimeType,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  assert.ok(
    file.bytes[0] === 0x50 && file.bytes[1] === 0x4b,
    "xlsx bytes are a zip (PK) container",
  );

  const workbook = parseXlsxWorkbook(file.bytes);
  assert.equal(workbook.sheets.length, 1);
  assert.equal(workbook.sheets[0].name, "Danh sách");
  assert.deepEqual(workbook.sheets[0].headers, sheet.headers);
  assert.equal(workbook.sheets[0].rows.length, 2);
  assert.equal(workbook.sheets[0].rows[0]["Họ và tên"], "Nguyễn Thị Ánh Tuyết");
  assert.equal(workbook.sheets[0].rows[0]["Điểm"], "6.5", "numbers stay numeric cells");
  assert.equal(workbook.sheets[0].rows[0]["Ghi chú"], 'Cần "chú ý", nghỉ 2 buổi');
  assert.equal(workbook.sheets[1 - 1].rows[1]["Ngày sinh"], "2010-11-02");
}

// ---- XLSX: multi-sheet, XML escaping, sheet-name sanitization ------------
{
  interface Cellish {
    a: string;
  }
  const cols: ReadonlyArray<ExportColumn<Cellish>> = [
    { key: "a", header: { en: "A & B <c>", vi: "A & B <c>" }, value: (r) => textCell(r.a) },
  ];
  const one = buildSheet("Attendance: 2026/09", cols, [{ a: "x < y & \"z\"" }], "en");
  const two = buildSheet("Attendance: 2026/09", cols, [{ a: "second" }], "en");
  const file = buildExport([one, two], { format: "xlsx", basename: "attendance" });
  const workbook = parseXlsxWorkbook(file.bytes);

  assert.equal(workbook.sheets.length, 2);
  assert.equal(workbook.sheets[0].name, "Attendance 2026 09", "illegal chars replaced");
  assert.equal(workbook.sheets[1].name, "Attendance 2026 09 2", "duplicate names deduped");
  assert.equal(workbook.sheets[0].headers[0], "A & B <c>", "header XML round-trips");
  assert.equal(workbook.sheets[0].rows[0]["A & B <c>"], 'x < y & "z"');

  const long = buildSheet("x".repeat(60), cols, [{ a: "1" }], "en");
  assert.equal(parseXlsxWorkbook(buildXlsxName(long)).sheets[0].name.length, 31);
  function buildXlsxName(s: typeof long) {
    return buildExport([s], { format: "xlsx", basename: "n" }).bytes;
  }
}

// ---- CSV multi-sheet keeps every sheet ----------------------------------
{
  const cols: ReadonlyArray<ExportColumn<{ a: string }>> = [
    { key: "a", header: { en: "A", vi: "A" }, value: (r) => textCell(r.a) },
  ];
  const csv = new TextDecoder().decode(
    buildExport(
      [buildSheet("One", cols, [{ a: "1" }], "en"), buildSheet("Two", cols, [{ a: "2" }], "en")],
      { format: "csv", basename: "multi" },
    ).bytes,
  );
  assert.ok(csv.includes("Two"), "second sheet is not silently dropped");
  assert.ok(csv.includes("\r\n"), "CSV uses CRLF line endings");
}

// ---- empty data still produces a valid, openable file --------------------
{
  const sheet = buildSheet("Roster", COLUMNS, [], "en");
  const workbook = parseXlsxWorkbook(
    buildExport([sheet], { format: "xlsx", basename: "empty" }).bytes,
  );
  assert.deepEqual(workbook.sheets[0].headers, sheet.headers);
  assert.equal(workbook.sheets[0].rows.length, 0);
  assert.ok(buildExport([], { format: "xlsx", basename: "none" }).bytes.length > 0);
}

// ---- column letters mirror parse-xlsx's columnIndex ----------------------
{
  assert.equal(columnLetter(0), "A");
  assert.equal(columnLetter(25), "Z");
  assert.equal(columnLetter(26), "AA");
  assert.equal(columnLetter(51), "AZ");
  assert.equal(columnLetter(52), "BA");
}

// ---- base64 transport round trip ----------------------------------------
{
  const file = buildExport([buildSheet("Roster", COLUMNS, ROWS, "vi")], {
    format: "xlsx",
    basename: "roster",
  });
  const payload = encodeExportPayload(file);
  assert.equal(payload.filename, "roster.xlsx");
  assert.deepEqual(decodeExportPayload(payload), file.bytes);
}

// ---- filenames are safe and stable --------------------------------------
{
  assert.equal(
    buildExport([], { format: "csv", basename: "../../etc/passwd" }).filename,
    "etc-passwd.csv",
  );
  assert.equal(buildExport([], { format: "csv", basename: "  " }).filename, "export.csv");
  assert.equal(
    exportBasename(["Lớp IELTS 6.5", "Điểm số"], new Date(Date.UTC(2026, 9, 4))),
    "lop-ielts-6-5-diem-so-2026-10-04",
  );
  assert.equal(exportBasename([null, ""], new Date(Date.UTC(2026, 9, 4))), "export-2026-10-04");
}

console.log("export helper tests passed");
