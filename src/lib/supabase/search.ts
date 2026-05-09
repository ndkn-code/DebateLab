import { normalizeSearchTerm } from "@/lib/api/request-validation";

export function escapeIlikePattern(value: string) {
  return normalizeSearchTerm(value)
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_");
}

export function containsIlikePattern(value: string) {
  return `%${escapeIlikePattern(value)}%`;
}

export function mergeUniqueById<T extends { id: string }>(
  lists: Array<readonly T[] | null | undefined>,
  limit: number
) {
  const byId = new Map<string, T>();
  for (const list of lists) {
    for (const item of list ?? []) {
      if (!byId.has(item.id)) byId.set(item.id, item);
      if (byId.size >= limit) return [...byId.values()];
    }
  }
  return [...byId.values()];
}
