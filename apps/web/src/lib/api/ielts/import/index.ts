/**
 * Bulk-import entry point (WS-1.1). Parse a workbook (xlsx or CSV) into the
 * normalized shape, then plan + execute the import into a single target test
 * through the canonical create paths.
 */
import "server-only";
import type { IeltsDbClient } from "../client";
import { executeImportPlan } from "./execute";
import { planWorkbookImport } from "./plan";
import type { ImportReport } from "./types";
import type { ParsedWorkbook } from "./workbook";

export async function importIeltsWorkbook(
  workbook: ParsedWorkbook,
  testId: string,
  client: IeltsDbClient,
): Promise<ImportReport> {
  const plan = planWorkbookImport(workbook);
  return executeImportPlan(plan, testId, client);
}

export { planWorkbookImport } from "./plan";
export { parseXlsxWorkbook } from "./parse-xlsx";
export { parseCsvSheet } from "./parse-csv";
export type { ImportPlan } from "./plan";
export type { ImportReport, ImportRowResult } from "./types";
export type { ParsedWorkbook, ParsedSheet } from "./workbook";
