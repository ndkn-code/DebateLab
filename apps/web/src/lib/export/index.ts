/**
 * Shared export helper (B3). The one place in the product that turns typed rows
 * into a downloadable spreadsheet.
 *
 * Consumers declare `ExportColumn<T>[]` once, call `buildSheet` per tab, and
 * hand the sheets to `buildExport`. Format lives at the edge, so adding a
 * format never touches a caller and CSV can never drift from XLSX.
 *
 *   const sheet = buildSheet("Roster", ROSTER_EXPORT_COLUMNS, rows, "vi");
 *   const file = buildExport([sheet], { format: "xlsx", basename: "roster" });
 *   return encodeExportPayload(file);   // server action returns this
 *
 * **Transport.** `scripts/ci/checks/no-new-vercel-functions.ts` forbids a new
 * route handler, so exports travel as base64 on an existing server action and
 * the browser rebuilds the file with `downloadExportFile` from
 * `@/lib/export/download`. That client module is deliberately NOT re-exported
 * here: it touches `document`, and this barrel is imported by server actions.
 */
import { CSV_BOM, CSV_MIME_TYPE, sheetsToCsv, type CsvOptions } from "./csv";
import { buildXlsx, XLSX_MIME_TYPE } from "./xlsx";
import type { ExportSheet } from "./columns";

export type {
  ExportCell,
  ExportColumn,
  ExportLocale,
  ExportSheet,
} from "./columns";
export {
  boolCell,
  buildSheet,
  cellText,
  dateCell,
  dateTimeCell,
  EMPTY_CELL,
  numberCell,
  percentCell,
  textCell,
} from "./columns";
export { CSV_BOM, CSV_MIME_TYPE, sheetToCsv, sheetsToCsv } from "./csv";
export { buildXlsx, columnLetter, XLSX_MIME_TYPE } from "./xlsx";

/** XLSX is the default: it declares its own encoding, CSV does not. */
export type ExportFormat = "xlsx" | "csv";

export interface ExportFile {
  filename: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface BuildExportOptions extends CsvOptions {
  format: ExportFormat;
  /** Filename stem, without extension. Sanitized; callers may include a date. */
  basename: string;
}

/** Strip anything that would break a Content-Disposition or a filesystem. */
function sanitizeBasename(basename: string): string {
  const cleaned = basename
    .replace(/[\u0000-\u001F\u007F<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : "export";
}

const encoder = new TextEncoder();

/** Serialize sheets into a named, typed, downloadable file. */
export function buildExport(
  sheets: readonly ExportSheet[],
  options: BuildExportOptions,
): ExportFile {
  const basename = sanitizeBasename(options.basename);
  if (options.format === "csv") {
    return {
      filename: `${basename}.csv`,
      mimeType: CSV_MIME_TYPE,
      bytes: encoder.encode(
        `${CSV_BOM}${sheetsToCsv(sheets, { formulaGuard: options.formulaGuard })}`,
      ),
    };
  }
  return {
    filename: `${basename}.xlsx`,
    mimeType: XLSX_MIME_TYPE,
    bytes: buildXlsx(sheets),
  };
}

/**
 * The wire shape a server action returns. Bytes cannot cross the server-action
 * boundary intact, so they travel base64-encoded.
 */
export interface ExportPayload {
  filename: string;
  mimeType: string;
  base64: string;
}

/** Isomorphic base64 encode — `Buffer` on the server, `btoa` in a browser. */
export function encodeExportPayload(file: ExportFile): ExportPayload {
  let base64: string;
  if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(file.bytes).toString("base64");
  } else {
    let binary = "";
    for (const byte of file.bytes) binary += String.fromCharCode(byte);
    base64 = btoa(binary);
  }
  return { filename: file.filename, mimeType: file.mimeType, base64 };
}

/** Inverse of `encodeExportPayload`. Used by the client download and by tests. */
export function decodeExportPayload(payload: ExportPayload): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(payload.base64, "base64"));
  }
  const binary = atob(payload.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** `roster-lop-ielts-1-2026-09-04` — a stem that sorts and never collides. */
export function exportBasename(
  parts: ReadonlyArray<string | null | undefined>,
  today: Date = new Date(),
): string {
  const stamp = today.toISOString().slice(0, 10);
  const slug = parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) =>
      part
        .normalize("NFD")
        .replace(/[\u0300-\u036F]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter((part) => part.length > 0)
    .join("-");
  return slug ? `${slug}-${stamp}` : `export-${stamp}`;
}
