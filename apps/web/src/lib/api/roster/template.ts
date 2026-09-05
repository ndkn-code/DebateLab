/**
 * Roster template + error sheet (B3). Both generated from `ROSTER_FIELDS`, so
 * a template downloaded from the product always auto-maps at 100% on the way
 * back in, and an error sheet is itself a valid re-import.
 *
 * The data tab carries **headers only**. A template with example rows in it is
 * how "Nguyễn Văn A (ví dụ)" ends up enrolled in a real class; the examples go
 * on a separate guide tab where they cannot be imported by accident.
 */
import {
  buildExport,
  buildSheet,
  exportBasename,
  textCell,
  type ExportColumn,
  type ExportFile,
  type ExportFormat,
  type ExportLocale,
} from "@/lib/export";
import { ROSTER_FIELDS, ROSTER_TEMPLATE_SHEET, type RosterField } from "./columns";
import { describeIssues } from "./import/messages";
import type { PlannedRosterRow, RosterRowResult } from "./import/types";

const EXAMPLES: Record<string, string> = {
  fullName: "Nguyễn Thị Ánh Tuyết",
  email: "tuyet.nguyen@example.com",
  studentCode: "HV-001",
  dateOfBirth: "17/04/2009",
  phone: "0905 123 456",
  guardianName: "Nguyễn Văn Bình",
  guardianPhone: "0912 345 678",
  guardianEmail: "binh.nguyen@example.com",
  notes: "Học ca tối",
};

/** The empty data tab: our canonical headers, nothing else. */
function templateDataSheet(locale: ExportLocale) {
  const columns: Array<ExportColumn<never>> = ROSTER_FIELDS.map((field) => ({
    key: field.id,
    header: field.header,
    value: () => textCell(null),
  }));
  return buildSheet(ROSTER_TEMPLATE_SHEET, columns, [], locale);
}

const GUIDE_COLUMNS: ReadonlyArray<ExportColumn<RosterField>> = [
  {
    key: "column",
    header: { en: "Column", vi: "Cột" },
    value: (field, locale) => textCell(field.header[locale]),
  },
  {
    key: "required",
    header: { en: "Required", vi: "Bắt buộc" },
    value: (field, locale) =>
      textCell(field.required ? (locale === "vi" ? "Có" : "Yes") : locale === "vi" ? "Không" : "No"),
  },
  {
    key: "example",
    header: { en: "Example", vi: "Ví dụ" },
    value: (field) => textCell(EXAMPLES[field.id] ?? ""),
  },
  {
    key: "hint",
    header: { en: "Notes", vi: "Ghi chú" },
    value: (field, locale) => textCell(field.hint[locale]),
  },
];

/**
 * Mode A of the import: download this, fill it in, upload it. Mode B is
 * bringing your own sheet, which is why the mapping step exists at all.
 */
export function buildRosterTemplate(
  locale: ExportLocale,
  format: ExportFormat = "xlsx",
): ExportFile {
  const guideName = locale === "vi" ? "Hướng dẫn" : "Guide";
  return buildExport(
    [templateDataSheet(locale), buildSheet(guideName, GUIDE_COLUMNS, ROSTER_FIELDS, locale)],
    { format, basename: exportBasename(["roster-template"]) },
  );
}

interface ErrorRow {
  rowNumber: number;
  raw: PlannedRosterRow["raw"];
  problem: string;
}

/**
 * The fix-and-re-import artifact. Original values in our canonical columns, so
 * the teacher edits in place and uploads the same file — rows already applied
 * come back `skipped`, and only the fixed ones are written.
 */
export function buildRosterErrorExport(
  rows: readonly RosterRowResult[],
  planned: readonly PlannedRosterRow[],
  locale: ExportLocale,
  format: ExportFormat = "xlsx",
): ExportFile {
  const byRow = new Map(planned.map((row) => [row.rowNumber, row]));
  const failed: ErrorRow[] = rows
    .filter((row) => row.outcome === "error" || row.outcome === "needs_review")
    .map((row) => ({
      rowNumber: row.rowNumber,
      raw: byRow.get(row.rowNumber)?.raw ?? {},
      problem: describeIssues(row.issues, locale),
    }));

  const columns: Array<ExportColumn<ErrorRow>> = [
    {
      key: "rowNumber",
      header: { en: "Row", vi: "Dòng" },
      value: (row) => textCell(String(row.rowNumber)),
    },
    ...ROSTER_FIELDS.map((field) => ({
      key: field.id,
      header: field.header,
      value: (row: ErrorRow) => textCell(row.raw[field.id] ?? ""),
    })),
    {
      key: "problem",
      header: { en: "Problem", vi: "Lỗi" },
      value: (row: ErrorRow) => textCell(row.problem),
    },
  ];

  const name = locale === "vi" ? "Cần sửa" : "To fix";
  return buildExport([buildSheet(name, columns, failed, locale)], {
    format,
    basename: exportBasename(["roster-errors"]),
    // The teacher re-imports this file; a formula guard would leak an
    // apostrophe into the data. `stripCellGuard` handles it either way,
    // but keeping the artifact byte-clean is the honest default here.
    formulaGuard: false,
  });
}
