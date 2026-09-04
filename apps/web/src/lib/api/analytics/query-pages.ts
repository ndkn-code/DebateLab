/** Bounded, exhaustive reads. Failures never return apparently complete totals. */
export const ANALYTICS_PAGE_SIZE = 500;
export const ANALYTICS_ID_CHUNK = 150;
export interface QueryPage<T> {
  data: T[] | null;
  error: { message: string } | null;
}
export interface QueryCost {
  queries: number;
  rows: number;
  bytes: number;
}
export async function readPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<QueryPage<T>>,
  cost?: QueryCost,
): Promise<QueryPage<T>> {
  const rows: T[] = [];
  for (let from = 0; from < 1_000_000; from += ANALYTICS_PAGE_SIZE) {
    const page = await fetchPage(from, from + ANALYTICS_PAGE_SIZE - 1);
    if (cost) {
      cost.queries += 1;
      cost.rows += page.data?.length ?? 0;
      cost.bytes += new TextEncoder().encode(
        JSON.stringify(page.data ?? []),
      ).byteLength;
    }
    if (page.error) return { data: null, error: page.error };
    rows.push(...(page.data ?? []));
    if ((page.data?.length ?? 0) < ANALYTICS_PAGE_SIZE)
      return { data: rows, error: null };
  }
  throw new Error(
    "Analytics input exceeds the safe read limit; no partial totals returned.",
  );
}
export function idChunks(ids: readonly string[]): string[][] {
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += ANALYTICS_ID_CHUNK)
    chunks.push(unique.slice(i, i + ANALYTICS_ID_CHUNK));
  return chunks;
}
/** Cartesian chunks keep every IN filter short, including progress and response histories. */
export async function readChunkedPages<T>(
  identifiers: readonly (readonly string[])[],
  fetchPage: (
    chunks: string[][],
    from: number,
    to: number,
  ) => PromiseLike<QueryPage<T>>,
  cost?: QueryCost,
): Promise<QueryPage<T>> {
  let combinations: string[][][] = [[]];
  for (const ids of identifiers)
    combinations = combinations.flatMap((prefix) =>
      idChunks(ids).map((chunk) => [...prefix, chunk]),
    );
  const rows: T[] = [];
  for (const chunks of combinations) {
    const result = await readPages(
      (from, to) => fetchPage(chunks, from, to),
      cost,
    );
    if (result.error) return { data: null, error: result.error };
    rows.push(...(result.data ?? []));
  }
  return { data: rows, error: null };
}
export function requireRows<T>(result: QueryPage<T>, source: string): T[] {
  if (result.error)
    throw new Error(`Analytics ${source} unavailable: ${result.error.message}`);
  return result.data ?? [];
}
