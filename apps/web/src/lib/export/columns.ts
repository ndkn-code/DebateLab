/**
 * Column contract for the shared export helper (B3).
 *
 * A column declares a stable machine `key`, a bilingual `header`, and a pure
 * `value` accessor. The same declaration drives every format, so CSV and XLSX
 * of the same data can never drift, and a template generator can emit exactly
 * the headers the importer will accept.
 *
 * Cells are typed rather than pre-stringified: numbers stay numeric so a
 * gradebook can be summed in Excel, everything else is text. Dates are ISO
 * text (never Excel date serials) — a serial is unreadable in CSV and locale
 * dependent in Excel.
 */

export type ExportLocale = "en" | "vi";

export type ExportCell =
  | { kind: "text"; value: string }
  | { kind: "number"; value: number };

export interface ExportColumn<T> {
  /** Stable machine key. Used by the roster template + importer as the header id. */
  key: string;
  header: Record<ExportLocale, string>;
  value: (row: T, locale: ExportLocale) => ExportCell;
}

export interface ExportSheet {
  /** Worksheet name as authored; sanitized at serialization time. */
  name: string;
  headers: string[];
  rows: ExportCell[][];
}

/** The empty cell. Emitted for null/undefined so columns stay aligned. */
export const EMPTY_CELL: ExportCell = { kind: "text", value: "" };

/** Text cell. `null`/`undefined` collapse to empty rather than "null". */
export function textCell(value: string | null | undefined): ExportCell {
  if (value === null || value === undefined) return EMPTY_CELL;
  const trimmed = String(value);
  return trimmed.length === 0 ? EMPTY_CELL : { kind: "text", value: trimmed };
}

/** Numeric cell — stays numeric in XLSX so Excel can aggregate it. */
export function numberCell(value: number | null | undefined): ExportCell {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return EMPTY_CELL;
  }
  return { kind: "number", value };
}

/** Percentage stored as a plain number (0-100), not an Excel percent format. */
export function percentCell(rate: number | null | undefined): ExportCell {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) {
    return EMPTY_CELL;
  }
  return { kind: "number", value: Math.round(rate * 10) / 10 };
}

function pad(value: number, size: number): string {
  return String(value).padStart(size, "0");
}

/** ISO calendar date (YYYY-MM-DD) as text. Timezone-naive by design. */
export function dateCell(value: string | Date | null | undefined): ExportCell {
  if (value === null || value === undefined || value === "") return EMPTY_CELL;
  if (typeof value === "string") {
    // Already a plain date or an ISO timestamp — keep the calendar part.
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return { kind: "text", value: match[1] };
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return textCell(String(value));
  return {
    kind: "text",
    value: `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`,
  };
}

/** ISO date + minute (YYYY-MM-DD HH:mm, UTC) as text. */
export function dateTimeCell(value: string | Date | null | undefined): ExportCell {
  if (value === null || value === undefined || value === "") return EMPTY_CELL;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return textCell(String(value));
  const day = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}`;
  return {
    kind: "text",
    value: `${day} ${pad(date.getUTCHours(), 2)}:${pad(date.getUTCMinutes(), 2)}`,
  };
}

const YES_NO: Record<ExportLocale, { yes: string; no: string }> = {
  en: { yes: "Yes", no: "No" },
  vi: { yes: "Có", no: "Không" },
};

/** Localized yes/no. Never a bare `true`/`false` in a teacher-facing sheet. */
export function boolCell(
  value: boolean | null | undefined,
  locale: ExportLocale,
): ExportCell {
  if (value === null || value === undefined) return EMPTY_CELL;
  const labels = YES_NO[locale];
  return { kind: "text", value: value ? labels.yes : labels.no };
}

/** Render a cell as plain text (CSV, comparison, tests). */
export function cellText(cell: ExportCell): string {
  return cell.kind === "number" ? String(cell.value) : cell.value;
}

/**
 * Project rows through columns into a serializable sheet. Pure — no DB, no DOM,
 * no format knowledge. `buildExport` turns the result into bytes.
 */
export function buildSheet<T>(
  name: string,
  columns: ReadonlyArray<ExportColumn<T>>,
  rows: readonly T[],
  locale: ExportLocale,
): ExportSheet {
  return {
    name,
    headers: columns.map((column) => column.header[locale] ?? column.key),
    rows: rows.map((row) => columns.map((column) => column.value(row, locale))),
  };
}
