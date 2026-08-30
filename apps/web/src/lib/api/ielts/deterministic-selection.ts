export type SelectionRow = Record<string, unknown>;

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compareLatest(left: SelectionRow, right: SelectionRow): number {
  const revision = (numberValue(left.revision) ?? 0) - (numberValue(right.revision) ?? 0);
  if (revision !== 0) return revision;
  const leftTime = String(left.updated_at ?? left.submitted_at ?? left.created_at ?? "");
  const rightTime = String(right.updated_at ?? right.submitted_at ?? right.created_at ?? "");
  return leftTime.localeCompare(rightTime) || String(left.id ?? "").localeCompare(String(right.id ?? ""));
}

export function latestByKey(rows: SelectionRow[], keyParts: string[]): Map<string, SelectionRow> {
  const result = new Map<string, SelectionRow>();
  for (const row of rows) {
    const key = keyParts.map((part) => String(row[part])).join(":");
    const current = result.get(key);
    if (!current || compareLatest(row, current) > 0) result.set(key, row);
  }
  return result;
}

export function currentResponseRows(rows: SelectionRow[], key: "task_number" | "part_number") {
  const selected = new Map<string, SelectionRow>();
  for (const row of rows) {
    const logicalKey = String(row[key] ?? row.id);
    const current = selected.get(logicalKey);
    if (!current || compareLatest(row, current) > 0) selected.set(logicalKey, row);
  }
  return [...selected.values()];
}
