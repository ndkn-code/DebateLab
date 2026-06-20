/**
 * Pure import planner (WS-1.1). Turns a ParsedWorkbook into mapped passage /
 * section / question rows (example rows skipped) plus warnings. No DB, no
 * validation — fully unit-testable. execute.ts feeds these through the canonical
 * Zod create paths.
 */
import { IELTS_IMPORT_TABS, sheetRows, type ParsedWorkbook } from "./workbook";
import {
  mapListeningQuestionRow,
  mapPassageRow,
  mapReadingQuestionRow,
  mapSectionRow,
  mapSpeakingRow,
  mapWritingRow,
} from "./column-map";
import type { MappedPassage, MappedQuestion, MappedSection } from "./types";
import type { Row as CellRow } from "./cells";

export interface ImportPlan {
  passages: MappedPassage[];
  listeningSections: MappedSection[];
  questions: MappedQuestion[];
  warnings: string[];
}

function mapRows<T>(
  rows: Array<Record<string, string>>,
  mapper: (row: CellRow, rowNumber: number) => T | null,
): T[] {
  const out: T[] = [];
  rows.forEach((row, i) => {
    const mapped = mapper(row, i + 1);
    if (mapped !== null) out.push(mapped);
  });
  return out;
}

function collectSets(
  passages: MappedPassage[],
  sections: MappedSection[],
  questions: MappedQuestion[],
): string[] {
  const sets = new Set<string>();
  const add = (meta: Record<string, unknown>) => {
    const value = meta.set;
    if (typeof value === "string" && value.trim()) sets.add(value.trim());
  };
  passages.forEach((p) => add(p.input.metadata));
  sections.forEach((s) => add(s.input.metadata));
  questions.forEach((q) => add(q.input.metadata));
  return [...sets];
}

export function planWorkbookImport(workbook: ParsedWorkbook): ImportPlan {
  const passages = mapRows(sheetRows(workbook, IELTS_IMPORT_TABS.readingPassages), mapPassageRow);
  const listeningSections = mapRows(
    sheetRows(workbook, IELTS_IMPORT_TABS.listeningScripts),
    mapSectionRow,
  );
  const questions = [
    ...mapRows(sheetRows(workbook, IELTS_IMPORT_TABS.readingQuestions), mapReadingQuestionRow),
    ...mapRows(sheetRows(workbook, IELTS_IMPORT_TABS.listeningQuestions), mapListeningQuestionRow),
    ...mapRows(sheetRows(workbook, IELTS_IMPORT_TABS.writingPrompts), mapWritingRow),
    ...mapRows(sheetRows(workbook, IELTS_IMPORT_TABS.speakingPrompts), mapSpeakingRow),
  ];

  const warnings: string[] = [];
  const sets = collectSets(passages, listeningSections, questions);
  if (sets.length > 1) {
    warnings.push(
      `Workbook spans ${sets.length} sets (${sets.join(", ")}); all rows import into the one target test.`,
    );
  }
  if (passages.length + listeningSections.length + questions.length === 0) {
    warnings.push("No importable rows found — check the tab names match the template.");
  }
  return { passages, listeningSections, questions, warnings };
}
