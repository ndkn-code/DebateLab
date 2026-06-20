/**
 * Zero-dependency RFC-4180 CSV → ParsedSheet (WS-1.1). A robust front-end for
 * teachers who export a single template tab to CSV. Handles quoted fields with
 * embedded commas / newlines / escaped quotes.
 */
import type { ParsedSheet } from "./workbook";

function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  // strip a UTF-8 BOM if present
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      field = "";
      record = [];
    } else {
      field += ch;
    }
  }
  // flush a trailing field/record with no terminating newline
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export function parseCsvSheet(name: string, text: string): ParsedSheet {
  const records = parseRecords(text);
  if (records.length === 0) return { name, headers: [], rows: [] };
  const headers = records[0].map((h) => h.trim());
  const rows = records
    .slice(1)
    .filter((cells) => cells.some((c) => c.trim().length > 0))
    .map((cells) => {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = (cells[index] ?? "").trim();
      });
      return row;
    });
  return { name, headers, rows };
}
