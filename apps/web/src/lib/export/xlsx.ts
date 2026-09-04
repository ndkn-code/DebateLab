/**
 * Minimal OOXML (.xlsx) writer — the write mirror of
 * `lib/api/ielts/import/parse-xlsx.ts`, sharing its fflate dependency and its
 * "just enough spreadsheet" scope. Inline strings only (no shared-string
 * table), numbers as numeric cells, dates as ISO text.
 *
 * XLSX is the default download: unlike CSV it carries its own encoding and
 * needs no list-separator guess, so Vietnamese diacritics survive Excel on any
 * machine locale. Anything this file emits parses back through
 * `parseXlsxWorkbook`, which is what the round-trip test asserts.
 */
import { strToU8, zipSync } from "fflate";
import { type ExportCell, type ExportSheet } from "./columns";

export const XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

/** Characters XML 1.0 cannot represent at all — dropped, not escaped. */
const ILLEGAL_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

function escapeXml(value: string): string {
  return value
    .replace(ILLEGAL_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 0 → A, 25 → Z, 26 → AA. Inverse of parse-xlsx's `columnIndex`. */
export function columnLetter(index: number): string {
  let rest = index;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (rest % 26)) + letters;
    rest = Math.floor(rest / 26) - 1;
  } while (rest >= 0);
  return letters;
}

/** Excel forbids `[]:*?/\`, caps names at 31 chars, and rejects duplicates. */
function sanitizeSheetName(name: string, index: number, taken: Set<string>): string {
  const base =
    name
      .replace(/[[\]:*?/\\]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31) || `Sheet${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate.toLowerCase())) {
    const room = 31 - String(suffix).length - 1;
    candidate = `${base.slice(0, room)} ${suffix}`;
    suffix += 1;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

function cellXml(cell: ExportCell, ref: string, styleIndex: number): string {
  const style = styleIndex > 0 ? ` s="${styleIndex}"` : "";
  if (cell.kind === "number") {
    return `<c r="${ref}"${style}><v>${cell.value}</v></c>`;
  }
  if (cell.value === "") return `<c r="${ref}"${style}/>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell.value)}</t></is></c>`;
}

/**
 * Column widths from content length. Without this every column is 8 characters
 * wide and a roster export looks broken on open — cheap polish, real payoff.
 */
function colsXml(sheet: ExportSheet): string {
  if (sheet.headers.length === 0) return "";
  const widths = sheet.headers.map((header, index) => {
    let longest = header.length;
    for (const row of sheet.rows) {
      const cell = row[index];
      if (!cell) continue;
      const length = cell.kind === "number" ? String(cell.value).length : cell.value.length;
      if (length > longest) longest = length;
    }
    return Math.min(50, Math.max(9, longest + 2));
  });
  const cols = widths
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  return `<cols>${cols}</cols>`;
}

function sheetXml(sheet: ExportSheet): string {
  const rows: string[] = [];
  if (sheet.headers.length > 0) {
    const cells = sheet.headers
      .map((header, index) => cellXml({ kind: "text", value: header }, `${columnLetter(index)}1`, 1))
      .join("");
    rows.push(`<row r="1">${cells}</row>`);
  }
  sheet.rows.forEach((row, rowIndex) => {
    const number = rowIndex + 2;
    const cells = row
      .map((cell, index) => cellXml(cell, `${columnLetter(index)}${number}`, 0))
      .join("");
    rows.push(`<row r="${number}">${cells}</row>`);
  });
  const freeze =
    sheet.headers.length > 0
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : "";
  return `${XML_DECL}<worksheet xmlns="${MAIN_NS}">${freeze}${colsXml(sheet)}<sheetData>${rows.join("")}</sheetData></worksheet>`;
}

/** Two cell formats: 0 = body, 1 = bold header. Excel requires 2 fills. */
function stylesXml(): string {
  return (
    `${XML_DECL}<styleSheet xmlns="${MAIN_NS}">` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
    '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
    '<fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    "</styleSheet>"
  );
}

function contentTypesXml(count: number): string {
  const overrides = Array.from(
    { length: count },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join("");
  return (
    `${XML_DECL}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    `${overrides}</Types>`
  );
}

function workbookXml(names: readonly string[]): string {
  const sheets = names
    .map((name, index) => `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  return `${XML_DECL}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><sheets>${sheets}</sheets></workbook>`;
}

function workbookRelsXml(count: number): string {
  const sheetRels = Array.from(
    { length: count },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="${REL_NS}/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join("");
  return (
    `${XML_DECL}<Relationships xmlns="${PKG_REL_NS}">${sheetRels}` +
    `<Relationship Id="rId${count + 1}" Type="${REL_NS}/styles" Target="styles.xml"/></Relationships>`
  );
}

/** Serialize sheets into .xlsx bytes. At least one sheet is always emitted. */
export function buildXlsx(sheets: readonly ExportSheet[]): Uint8Array {
  const input = sheets.length > 0 ? sheets : [{ name: "Sheet1", headers: [], rows: [] }];
  const taken = new Set<string>();
  const names = input.map((sheet, index) => sanitizeSheetName(sheet.name, index, taken));

  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(contentTypesXml(input.length)),
    "_rels/.rels": strToU8(
      `${XML_DECL}<Relationships xmlns="${PKG_REL_NS}">` +
        `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(workbookXml(names)),
    "xl/_rels/workbook.xml.rels": strToU8(workbookRelsXml(input.length)),
    "xl/styles.xml": strToU8(stylesXml()),
  };
  input.forEach((sheet, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet));
  });
  return zipSync(files, { level: 6 });
}
