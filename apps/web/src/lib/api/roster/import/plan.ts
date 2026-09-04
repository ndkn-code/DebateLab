/**
 * Pure roster-import planner (B3) — phase 1 of three.
 *
 * Parse + map + validate, with no database and no I/O, so the whole validation
 * surface is unit-testable and the teacher sees every problem *before* anything
 * is written. Phase 2 (`resolveRosterImport`) adds the DB reads; phase 3
 * (`commitRosterImport`) writes in chunks.
 *
 * Failure is per row, never all-or-nothing: a bad date on row 7 blocks row 7
 * and nothing else. The teacher downloads the error sheet, fixes those rows,
 * re-imports the same file, and the already-applied rows come back `skipped`.
 * That loop is the feature.
 */
import type { ParsedSheet } from "@/lib/api/ielts/import/workbook";
import { ROSTER_FIELDS, type RosterFieldId } from "../columns";
import type { RosterColumnMapping } from "./column-map";
import {
  cleanName,
  cleanText,
  nameMatchKey,
  normalizeDate,
  normalizeEmail,
  normalizePhone,
} from "./normalize";
import type {
  PlannedRosterRow,
  RosterImportPlan,
  RosterRecordInput,
  RosterRowIssue,
} from "./types";

/**
 * `ParsedSheet.rows` is keyed by header text, which loses a duplicated or blank
 * header. Destination-led mapping addresses columns by index, so rebuild the
 * positional grid and warn about headers that cannot be addressed.
 */
export function sheetToGrid(sheet: ParsedSheet): {
  headers: string[];
  grid: string[][];
  warnings: string[];
} {
  const warnings: string[] = [];
  const seen = new Map<string, number>();
  // Per position: the header to read, or null when this column is unreadable
  // (blank header, or a later duplicate whose values `ParsedSheet` already lost
  // to the first occurrence). A duplicate must read empty, not silently mirror
  // the first column's value.
  const readable: Array<string | null> = sheet.headers.map((header, index) => {
    const key = header.trim();
    if (!key) {
      warnings.push(`Column ${index + 1} has no header and cannot be mapped.`);
      return null;
    }
    const first = seen.get(key);
    if (first !== undefined) {
      warnings.push(
        `Header "${key}" appears in columns ${first + 1} and ${index + 1}; only the first is readable.`,
      );
      return null;
    }
    seen.set(key, index);
    return header;
  });
  const grid = sheet.rows.map((row) =>
    readable.map((header) => (header === null ? "" : (row[header] ?? ""))),
  );
  return { headers: [...sheet.headers], grid, warnings };
}

function issue(
  field: RosterFieldId | null,
  code: RosterRowIssue["code"],
  detail?: string,
): RosterRowIssue {
  return detail === undefined ? { field, code } : { field, code, detail };
}

function readCell(row: readonly string[], index: number | null): string {
  if (index === null || index < 0 || index >= row.length) return "";
  return row[index] ?? "";
}

const STUDENT_CODE_RE = /^[\w.\-/]{1,64}$/;

function normalizeRow(
  row: readonly string[],
  mapping: RosterColumnMapping,
): { values: RosterRecordInput; raw: Partial<Record<RosterFieldId, string>>; issues: RosterRowIssue[] } {
  const raw: Partial<Record<RosterFieldId, string>> = {};
  for (const field of ROSTER_FIELDS) {
    const cell = readCell(row, mapping[field.id]);
    if (cell) raw[field.id] = cell;
  }
  const issues: RosterRowIssue[] = [];

  const fullName = cleanName(raw.fullName);
  if (!fullName) {
    issues.push(issue("fullName", "missing_full_name"));
  }

  const email = normalizeEmail(raw.email);
  if (!email.ok) {
    issues.push(issue("email", "invalid_email", email.raw));
  }
  const guardianEmail = normalizeEmail(raw.guardianEmail);
  if (!guardianEmail.ok) {
    issues.push(issue("guardianEmail", "invalid_guardian_email", guardianEmail.raw));
  }
  const dateOfBirth = normalizeDate(raw.dateOfBirth);
  if (!dateOfBirth.ok) {
    issues.push(issue("dateOfBirth", "invalid_date", dateOfBirth.raw));
  }
  const studentCode = cleanText(raw.studentCode);
  if (studentCode && !STUDENT_CODE_RE.test(studentCode)) {
    issues.push(issue("studentCode", "invalid_student_code", studentCode));
  }

  return {
    values: {
      fullName: fullName ?? "",
      email: email.ok ? email.value : null,
      studentCode,
      dateOfBirth: dateOfBirth.ok ? dateOfBirth.value : null,
      phone: normalizePhone(raw.phone),
      guardianName: cleanName(raw.guardianName),
      guardianPhone: normalizePhone(raw.guardianPhone),
      guardianEmail: guardianEmail.ok ? guardianEmail.value : null,
      notes: cleanText(raw.notes),
    },
    raw,
    issues,
  };
}

/**
 * Within-file duplicates block **both** rows rather than picking a winner. Two
 * rows claiming one email is a mistake in the teacher's sheet, and guessing
 * which one is intended is exactly the kind of silent wrong answer that makes
 * people distrust an importer.
 */
function flagFileDuplicates(rows: PlannedRosterRow[]): void {
  const buckets: Array<{ key: (row: PlannedRosterRow) => string | null; code: RosterRowIssue["code"]; field: RosterFieldId; label: string }> = [
    { key: (row) => row.values.email, code: "duplicate_in_file", field: "email", label: "email" },
    {
      key: (row) => row.values.studentCode?.toLowerCase() ?? null,
      code: "duplicate_student_code",
      field: "studentCode",
      label: "student code",
    },
    {
      key: (row) =>
        row.values.fullName && row.values.dateOfBirth
          ? nameMatchKey(row.values.fullName, row.values.dateOfBirth)
          : null,
      code: "duplicate_in_file",
      field: "fullName",
      label: "name and date of birth",
    },
  ];
  for (const bucket of buckets) {
    const groups = new Map<string, PlannedRosterRow[]>();
    for (const row of rows) {
      const key = bucket.key(row);
      if (!key) continue;
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
    for (const [key, group] of groups) {
      if (group.length < 2) continue;
      const lines = group.map((row) => row.rowNumber).join(", ");
      for (const row of group) {
        row.issues.push(issue(bucket.field, bucket.code, `${bucket.label} "${key}" — ${lines}`));
      }
    }
  }
}

/**
 * Turn a parsed sheet plus a confirmed mapping into a validated plan.
 * `rowNumber` is 1-based over data rows, matching the importer's own error
 * sheet — not the spreadsheet's absolute row, which shifts with the header.
 */
export function planRosterSheet(
  sheet: ParsedSheet,
  mapping: RosterColumnMapping,
): RosterImportPlan {
  const { grid, warnings } = sheetToGrid(sheet);

  const rows: PlannedRosterRow[] = grid.map((cells, index) => {
    const { values, raw, issues } = normalizeRow(cells, mapping);
    return { rowNumber: index + 1, values, raw, issues, blocked: issues.length > 0 };
  });

  flagFileDuplicates(rows);
  for (const row of rows) row.blocked = row.issues.length > 0;

  if (mapping.fullName === null) {
    warnings.push("No column is mapped to Full name; nothing can be imported.");
  }
  if (rows.length === 0) {
    warnings.push("The sheet has no data rows.");
  }

  const ready = rows.filter((row) => !row.blocked);
  return {
    rows,
    warnings,
    counts: {
      total: rows.length,
      ready: ready.length,
      blocked: rows.length - ready.length,
      withEmail: ready.filter((row) => row.values.email !== null).length,
    },
  };
}
