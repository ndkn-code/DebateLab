import {
  suggestColumnMapping,
  mappingFromSuggestions,
  type RosterColumnMapping,
} from "@/lib/api/roster/import/column-map";
import { planRosterSheet } from "@/lib/api/roster/import/plan";
import type { RosterImportPlan } from "@/lib/api/roster/import/types";

export type StagedSheet = {
  id: string;
  rows: unknown[][];
  status: string;
  created_at: string;
};
export type StagedRosterSheet = {
  headers: string[];
  rows: string[][];
  sheetNames: string[];
};

/** Sheets stages include a header row; B3 expects data rows separately. */
export function stagedSheetToRosterSheet(
  stage: StagedSheet,
): StagedRosterSheet {
  if (!Array.isArray(stage.rows))
    throw new Error("Staged sheet has invalid rows.");
  const rows = stage.rows.map((row) => {
    if (!Array.isArray(row))
      throw new Error("Staged sheet has an invalid row.");
    return row.map((cell) => (cell == null ? "" : String(cell)));
  });
  if (rows.length < 1 || rows[0].every((cell) => !cell.trim())) {
    throw new Error("Staged sheet has no header row.");
  }
  return { headers: rows[0], rows: rows.slice(1), sheetNames: [stage.id] };
}

export function planStagedRosterSheet(
  stage: StagedSheet,
  mapping: RosterColumnMapping,
  headers?: string[],
): RosterImportPlan {
  const sheet = stagedSheetToRosterSheet(stage);
  const actualHeaders = headers ?? sheet.headers;
  return planRosterSheet(
    {
      name: stage.id,
      headers: actualHeaders,
      rows: sheet.rows.map((row) => {
        const cells: Record<string, string> = Object.create(null);
        // Match B3's duplicate-header rule: keep the first column, never the last.
        actualHeaders.forEach((header, index) => {
          if (!Object.hasOwn(cells, header)) cells[header] = row[index] ?? "";
        });
        return cells;
      }),
    },
    mapping,
  );
}

export function defaultStagedMapping(
  headers: readonly string[],
): RosterColumnMapping {
  return mappingFromSuggestions(suggestColumnMapping(headers));
}
