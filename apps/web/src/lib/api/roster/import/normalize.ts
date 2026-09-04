/**
 * Cell normalization for the roster importer (B3). Pure, no DB, no I/O.
 *
 * These functions absorb what a real centre spreadsheet actually contains:
 * Vietnamese diacritics in headers, `0905…` / `+84 905 …` / `84905…` phone
 * spellings of the same number, day-first dates, and — the one that bites —
 * Excel date *serials*, because `parseXlsxWorkbook` reads a real date cell as
 * the raw number with no number-format handling.
 */

/** lowercase → NFD → strip marks → đ→d → collapse punctuation to single spaces. */
export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036F]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Excel writes a leading apostrophe to force a cell to text, and our own CSV
 * export adds one as a formula guard. Strip exactly one so the round trip is
 * clean; a name that genuinely starts with `'` is not a thing.
 */
export function stripCellGuard(value: string): string {
  return value.startsWith("'") ? value.slice(1) : value;
}

export function cleanText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = stripCellGuard(String(value)).replace(/\s+/g, " ").trim();
  return text.length > 0 ? text : null;
}

/** Collapse a person's name without destroying Vietnamese spelling. */
export function cleanName(value: string | null | undefined): string | null {
  return cleanText(value);
}

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Lowercased and trimmed, or `null` when absent. `invalid` when present but malformed. */
export function normalizeEmail(
  value: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; raw: string } {
  const text = cleanText(value);
  if (!text) return { ok: true, value: null };
  const candidate = text.toLowerCase().replace(/^mailto:/, "");
  if (!EMAIL_RE.test(candidate)) return { ok: false, raw: text };
  return { ok: true, value: candidate };
}

/**
 * Vietnamese mobile numbers to E.164. `0905123456`, `905123456`,
 * `84905123456`, `+84 905 123 456` and `0905.123.456` are all the same number,
 * and matching an existing student on phone only works if they normalize alike.
 * A number that does not look Vietnamese is kept verbatim (digits + leading `+`)
 * rather than mangled.
 */
export function normalizePhone(value: string | null | undefined): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const digits = text.replace(/[^\d+]/g, "");
  if (!digits) return null;
  const bare = digits.replace(/\D/g, "");
  if (digits.startsWith("+")) {
    return bare.startsWith("84") ? `+84${bare.slice(2).replace(/^0+/, "")}` : `+${bare}`;
  }
  if (bare.startsWith("84") && bare.length >= 10) return `+84${bare.slice(2).replace(/^0+/, "")}`;
  if (bare.startsWith("0")) return `+84${bare.replace(/^0+/, "")}`;
  if (bare.length === 9) return `+84${bare}`;
  return bare;
}

/** Excel's day 1 is 1900-01-01, offset by its 1900-leap-year bug → epoch 1899-12-30. */
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);
const MS_PER_DAY = 86_400_000;

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a date cell to `YYYY-MM-DD`.
 *
 * **Day-first.** `05/04/2009` is 5 April, the Vietnamese reading — the template
 * says so and the mapping step repeats it. Month-first would silently transpose
 * a third of every roster.
 */
export function normalizeDate(
  value: string | null | undefined,
): { ok: true; value: string | null } | { ok: false; raw: string } {
  const text = cleanText(value);
  if (!text) return { ok: true, value: null };

  // ISO first — unambiguous, and what our own export writes.
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (isoMatch) {
    const parsed = iso(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    return parsed ? { ok: true, value: parsed } : { ok: false, raw: text };
  }

  // Excel serial: a real date cell read through parseXlsxWorkbook is a number.
  if (/^\d{4,5}(\.\d+)?$/.test(text)) {
    const serial = Number(text);
    if (serial >= 1 && serial <= 60000) {
      return {
        ok: true,
        value: new Date(EXCEL_EPOCH_UTC + Math.round(serial) * MS_PER_DAY)
          .toISOString()
          .slice(0, 10),
      };
    }
  }

  const parts = text.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (parts) {
    const day = Number(parts[1]);
    const month = Number(parts[2]);
    let year = Number(parts[3]);
    if (parts[3].length === 2) year += year <= 30 ? 2000 : 1900;
    const parsed = iso(year, month, day);
    return parsed ? { ok: true, value: parsed } : { ok: false, raw: text };
  }

  return { ok: false, raw: text };
}

/** Match key for the soft `full_name + date_of_birth` rule. */
export function nameMatchKey(fullName: string, dateOfBirth: string | null): string {
  return `${normalizeKey(fullName)}|${dateOfBirth ?? ""}`;
}
