import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
export interface ParentReportScope {
  classId: string;
  clubId: string;
  timeZone: string;
}
export type Row = Record<string, unknown>;
// The existing gradebook uses this boundary for tables not yet in generated types.
export type Db = SupabaseClient;
type Query = ReturnType<ReturnType<Db["from"]>["select"]>;
const PAGE_SIZE = 500;
export const text = (value: unknown) =>
  typeof value === "string" ? value : "";
const asRows = (value: unknown): Row[] =>
  Array.isArray(value) ? (value as Row[]) : [];

export async function allRows(
  db: Db,
  table: string,
  columns: string,
  configure: (query: Query) => Query,
  orderKey = "id",
): Promise<Row[]> {
  const rows: Row[] = [];
  let previousPage = "";
  for (let page = 0; page < 100; page++) {
    const result = await configure(db.from(table).select(columns))
      .order(orderKey, { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (result.error) throw new Error(`Parent report could not load ${table}`);
    const current = asRows(result.data);
    const fingerprint = JSON.stringify(current);
    if (current.length && fingerprint === previousPage)
      throw new Error("Parent report pagination did not advance");
    rows.push(...current);
    if (current.length < PAGE_SIZE) return rows;
    previousPage = fingerprint;
  }
  throw new Error("Parent report pagination limit exceeded");
}
