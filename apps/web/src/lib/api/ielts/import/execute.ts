/**
 * Import executor (WS-1.1). Runs a planned workbook through the SAME canonical
 * create paths used by the admin UI (createPassage / createListeningSection /
 * createQuestion) — no divergent insert path. Idempotent by `metadata.importId`
 * (re-running skips already-imported rows), resolves passage/section links, and
 * returns a per-row report. Partial failures are reported, not fatal.
 */
import "server-only";
import type { Json } from "@/types/supabase";
import type { IeltsDbClient } from "../client";
import { createListeningSection } from "../listening-repository";
import { createPassage } from "../passages-repository";
import { createQuestion } from "../questions-repository";
import type { ImportPlan } from "./plan";
import type {
  ImportReport,
  ImportRowResult,
  MappedQuestion,
  MappedPassage,
  MappedSection,
} from "./types";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function importIdSet(rows: Array<{ metadata: Json }> | null): Set<string> {
  const set = new Set<string>();
  for (const row of rows ?? []) {
    const meta = row.metadata;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const id = (meta as Record<string, unknown>).importId;
      if (typeof id === "string" && id) set.add(id);
    }
  }
  return set;
}

async function loadExistingImportIds(supabase: IeltsDbClient, testId: string) {
  const [passages, sections, questions] = await Promise.all([
    supabase.from("passages").select("metadata").eq("test_id", testId),
    supabase.from("listening_sections").select("metadata").eq("test_id", testId),
    supabase.from("ielts_questions").select("metadata").eq("test_id", testId),
  ]);
  return {
    passages: importIdSet(passages.data),
    sections: importIdSet(sections.data),
    questions: importIdSet(questions.data),
  };
}

function questionTab(skill: string): string {
  if (skill === "reading") return "Reading Questions";
  if (skill === "listening") return "Listening Questions";
  if (skill === "writing") return "Writing Prompts";
  return "Speaking Prompts";
}

async function importPassages(
  items: MappedPassage[],
  testId: string,
  supabase: IeltsDbClient,
  existing: Set<string>,
) {
  const map = new Map<string, string>();
  const rows: ImportRowResult[] = [];
  let created = 0;
  for (const item of items) {
    const base = { tab: "Reading Passages", rowNumber: item.rowNumber, importId: item.importId, entity: "passage" as const };
    if (item.importId && existing.has(item.importId)) {
      rows.push({ ...base, outcome: "skipped", message: "already imported" });
      continue;
    }
    try {
      const passage = await createPassage({ testId, ...item.input }, supabase);
      if (item.importId) map.set(item.importId, passage.id);
      created++;
      rows.push({ ...base, outcome: "created" });
    } catch (error) {
      rows.push({ ...base, outcome: "error", message: errorMessage(error) });
    }
  }
  return { map, rows, created };
}

async function importSections(
  items: MappedSection[],
  testId: string,
  supabase: IeltsDbClient,
  existing: Set<string>,
) {
  const map = new Map<string, string>();
  const rows: ImportRowResult[] = [];
  let created = 0;
  for (const item of items) {
    const base = { tab: "Listening Scripts", rowNumber: item.rowNumber, importId: item.importId, entity: "listening_section" as const };
    if (item.importId && existing.has(item.importId)) {
      rows.push({ ...base, outcome: "skipped", message: "already imported" });
      continue;
    }
    try {
      const section = await createListeningSection({ testId, ...item.input }, supabase);
      if (item.importId) map.set(item.importId, section.id);
      created++;
      rows.push({ ...base, outcome: "created" });
    } catch (error) {
      rows.push({ ...base, outcome: "error", message: errorMessage(error) });
    }
  }
  return { map, rows, created };
}

function resolveLink(
  importId: string | null,
  map: Map<string, string>,
  rowNumber: number,
  kind: string,
  warnings: string[],
): string | null {
  if (!importId) return null;
  const id = map.get(importId);
  if (!id) {
    warnings.push(`Question row ${rowNumber}: ${kind} "${importId}" not found in this import.`);
    return null;
  }
  return id;
}

async function importQuestions(
  items: MappedQuestion[],
  testId: string,
  supabase: IeltsDbClient,
  existing: Set<string>,
  passageMap: Map<string, string>,
  sectionMap: Map<string, string>,
  warnings: string[],
) {
  const rows: ImportRowResult[] = [];
  let created = 0;
  for (const item of items) {
    const base = { tab: questionTab(item.input.skill), rowNumber: item.rowNumber, importId: item.importId, entity: "question" as const };
    if (item.importId && existing.has(item.importId)) {
      rows.push({ ...base, outcome: "skipped", message: "already imported" });
      continue;
    }
    const passageId = resolveLink(item.passageImportId, passageMap, item.rowNumber, "passage", warnings);
    const listeningSectionId = resolveLink(item.sectionImportId, sectionMap, item.rowNumber, "script", warnings);
    try {
      await createQuestion({ testId, passageId, listeningSectionId, ...item.input }, supabase);
      created++;
      rows.push({ ...base, outcome: "created" });
    } catch (error) {
      rows.push({ ...base, outcome: "error", message: errorMessage(error) });
    }
  }
  return { rows, created };
}

export async function executeImportPlan(
  plan: ImportPlan,
  testId: string,
  supabase: IeltsDbClient,
): Promise<ImportReport> {
  const existing = await loadExistingImportIds(supabase, testId);
  const warnings = [...plan.warnings];
  const passageResult = await importPassages(plan.passages, testId, supabase, existing.passages);
  const sectionResult = await importSections(plan.listeningSections, testId, supabase, existing.sections);
  const questionResult = await importQuestions(
    plan.questions,
    testId,
    supabase,
    existing.questions,
    passageResult.map,
    sectionResult.map,
    warnings,
  );
  const rows = [...passageResult.rows, ...sectionResult.rows, ...questionResult.rows];
  return {
    testId,
    created: {
      passages: passageResult.created,
      listeningSections: sectionResult.created,
      questions: questionResult.created,
    },
    skipped: rows.filter((r) => r.outcome === "skipped").length,
    errors: rows.filter((r) => r.outcome === "error").length,
    warnings,
    rows,
  };
}
