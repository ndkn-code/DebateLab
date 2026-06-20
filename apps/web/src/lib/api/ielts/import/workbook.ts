/**
 * Normalized in-memory representation of the authoring workbook (WS-1.1).
 *
 * The bulk importer consumes a `ParsedWorkbook` — a plain, dependency-free shape
 * produced by either the xlsx or CSV front-end. Keeping the importer on this
 * normalized form (not a binary blob) makes the column→schema mapping fully
 * unit-testable.
 */

export interface ParsedSheet {
  name: string;
  headers: string[];
  /** One entry per data row: header text -> cell text (already trimmed). */
  rows: Array<Record<string, string>>;
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
}

/** Canonical tab names in the template (docs/ielts-content-authoring-template.xlsx). */
export const IELTS_IMPORT_TABS = {
  readingPassages: "Reading Passages",
  readingQuestions: "Reading Questions",
  listeningScripts: "Listening Scripts",
  listeningQuestions: "Listening Questions",
  writingPrompts: "Writing Prompts",
  speakingPrompts: "Speaking Prompts",
} as const;

export function normalizeSheetName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

export function findSheet(workbook: ParsedWorkbook, name: string): ParsedSheet | undefined {
  const target = normalizeSheetName(name);
  return workbook.sheets.find((sheet) => normalizeSheetName(sheet.name) === target);
}

/** Data rows for a tab (empty when the tab is absent). */
export function sheetRows(
  workbook: ParsedWorkbook,
  name: string,
): Array<Record<string, string>> {
  return findSheet(workbook, name)?.rows ?? [];
}
