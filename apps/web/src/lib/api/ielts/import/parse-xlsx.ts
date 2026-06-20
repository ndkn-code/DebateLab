/**
 * Minimal, dependency-light .xlsx (OOXML) reader (WS-1.1). Uses fflate to unzip
 * and focused regex extraction to read the shared-string table + each worksheet
 * into a ParsedWorkbook. Scoped to exactly what the authoring template needs
 * (text/number cells, shared + inline strings); not a general spreadsheet engine.
 * Round-trip tested against an in-memory workbook (no binary fixture in git).
 */
import { strFromU8, unzipSync } from "fflate";
import type { ParsedSheet, ParsedWorkbook } from "./workbook";

function xmlUnescape(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : undefined;
}

function columnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/)?.[0] ?? "A";
  let index = 0;
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64);
  return index - 1;
}

/** Concatenate every <t>…</t> run inside an XML fragment, unescaped. */
function joinText(fragment: string): string {
  const parts = fragment.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [];
  return parts
    .map((t) => xmlUnescape(t.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, "")))
    .join("");
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return [];
  return (xml.match(/<si\b[^>]*>([\s\S]*?)<\/si>/g) ?? []).map((si) => joinText(si));
}

function cellValue(cell: string, shared: string[]): string {
  const type = attr(cell, "t");
  if (type === "inlineStr") {
    const is = cell.match(/<is>([\s\S]*?)<\/is>/);
    return is ? joinText(is[1]) : "";
  }
  const v = cell.match(/<v>([\s\S]*?)<\/v>/);
  if (!v) return "";
  const raw = xmlUnescape(v[1]);
  if (type === "s") {
    const idx = Number.parseInt(raw, 10);
    return shared[idx] ?? "";
  }
  return raw;
}

function parseRow(rowXml: string, shared: string[]): string[] {
  const cells = rowXml.match(/<c\b[^>]*\/>|<c\b[^>]*>[\s\S]*?<\/c>/g) ?? [];
  const out: string[] = [];
  for (const cell of cells) {
    const ref = attr(cell, "r");
    const index = ref ? columnIndex(ref) : out.length;
    while (out.length <= index) out.push("");
    out[index] = cellValue(cell, shared).trim();
  }
  return out;
}

function toSheet(name: string, xml: string, shared: string[]): ParsedSheet {
  const rowXmls = xml.match(/<row\b[^>]*>[\s\S]*?<\/row>/g) ?? [];
  const rows = rowXmls.map((row) => parseRow(row, shared));
  if (rows.length === 0) return { name, headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows
    .slice(1)
    .filter((cells) => cells.some((c) => c.length > 0))
    .map((cells) => {
      const record: Record<string, string> = {};
      headers.forEach((header, i) => {
        if (header) record[header] = cells[i] ?? "";
      });
      return record;
    });
  return { name, headers, rows: dataRows };
}

interface SheetRef {
  name: string;
  path: string;
}

function resolveSheetRefs(files: Record<string, Uint8Array>): SheetRef[] {
  const workbookXml = files["xl/workbook.xml"] ? strFromU8(files["xl/workbook.xml"]) : "";
  const relsXml = files["xl/_rels/workbook.xml.rels"]
    ? strFromU8(files["xl/_rels/workbook.xml.rels"])
    : "";
  const relMap = new Map<string, string>();
  for (const rel of relsXml.match(/<Relationship\b[^>]*\/>/g) ?? []) {
    const id = attr(rel, "Id");
    const target = attr(rel, "Target");
    if (id && target) relMap.set(id, `xl/${target.replace(/^\/?xl\//, "").replace(/^\//, "")}`);
  }
  const refs: SheetRef[] = [];
  for (const sheet of workbookXml.match(/<sheet\b[^>]*\/>/g) ?? []) {
    const name = attr(sheet, "name");
    const rid = attr(sheet, "r:id") ?? attr(sheet, "id");
    const path = rid ? relMap.get(rid) : undefined;
    if (name && path && files[path]) refs.push({ name, path });
  }
  return refs;
}

export function parseXlsxWorkbook(data: Uint8Array): ParsedWorkbook {
  const files = unzipSync(data);
  const shared = parseSharedStrings(
    files["xl/sharedStrings.xml"] ? strFromU8(files["xl/sharedStrings.xml"]) : undefined,
  );
  const sheets = resolveSheetRefs(files).map((ref) =>
    toSheet(ref.name, strFromU8(files[ref.path]), shared),
  );
  return { sheets };
}
