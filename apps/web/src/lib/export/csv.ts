/**
 * CSV serialization for the shared export helper (B3).
 *
 * UTF-8 **with a BOM**: without it Excel on a Vietnamese Windows box reads the
 * file as the ANSI codepage and mangles every diacritic. `parseCsvSheet`
 * (lib/api/ielts/import/parse-csv.ts) already strips a leading BOM, so the
 * export → edit → re-import round trip works.
 *
 * CSV is the *secondary* format. XLSX is the default download because CSV
 * carries no encoding declaration and no list-separator declaration, and Excel
 * guesses both from the machine locale.
 */
import { cellText, type ExportSheet } from "./columns";

export const CSV_BOM = "﻿";
export const CSV_MIME_TYPE = "text/csv;charset=utf-8";

/**
 * Excel and LibreOffice evaluate a cell that starts with one of these as a
 * formula, which turns a free-text `notes` column into a script-injection
 * vector for anyone who later opens the sheet.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Neutralize a formula-leading text cell with a leading apostrophe — the
 * convention Excel itself writes. The roster importer strips one leading
 * apostrophe on the way back in (see `lib/api/roster/import/column-map.ts`),
 * so a guarded `+84…` phone still round-trips.
 */
function guardFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

function escapeField(value: string): string {
  const needsQuotes =
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r") ||
    value !== value.trim();
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

export interface CsvOptions {
  /**
   * Guard formula-leading text cells (default `true`). Turn it off only for a
   * machine round-trip artifact where byte fidelity beats spreadsheet safety.
   */
  formulaGuard?: boolean;
}

function serializeRow(
  cells: readonly string[],
  guard: boolean,
  numeric: readonly boolean[] = [],
): string {
  return cells
    .map((value, index) =>
      escapeField(guard && !numeric[index] ? guardFormula(value) : value),
    )
    .join(",");
}

/** One sheet as RFC-4180 CSV. No BOM — `buildExport` adds it. */
export function sheetToCsv(sheet: ExportSheet, options: CsvOptions = {}): string {
  const guard = options.formulaGuard !== false;
  const lines: string[] = [serializeRow(sheet.headers, guard)];
  for (const row of sheet.rows) {
    lines.push(
      serializeRow(
        row.map(cellText),
        guard,
        row.map((cell) => cell.kind === "number"),
      ),
    );
  }
  return lines.join("\r\n");
}

/**
 * CSV holds one grid. A single-sheet export is pure RFC-4180 and parses back
 * through `parseCsvSheet` byte for byte; a multi-sheet export appends the
 * remaining sheets after a blank line, each introduced by a one-cell name row,
 * so nothing is silently dropped. Multi-sheet data should prefer XLSX.
 */
export function sheetsToCsv(
  sheets: readonly ExportSheet[],
  options: CsvOptions = {},
): string {
  if (sheets.length === 0) return "";
  if (sheets.length === 1) return sheetToCsv(sheets[0], options);
  return sheets
    .map((sheet, index) =>
      index === 0
        ? sheetToCsv(sheet, options)
        : `\r\n${escapeField(sheet.name)}\r\n${sheetToCsv(sheet, options)}`,
    )
    .join("\r\n");
}
