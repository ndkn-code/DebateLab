/** Test-only PostgREST transport. No network or production credentials. */
// eslint-disable-next-line no-restricted-imports -- Offline test transport: dummy credentials and fixture-only fetch, never a production connection.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
export type FixtureRows = Record<string, Array<Record<string, unknown>>>;
export function fixtureClient(tables: FixtureRows, actor = "actor") {
  const requests: URL[] = [];
  const cost = { queries: 0, rows: 0, bytes: 0 };
  const client = createClient<Database>(
    "https://fixture.invalid",
    "fixture-only",
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: async (input, init) => {
          const url = new URL(String(input));
          requests.push(url);
          cost.queries += 1;
          const table = url.pathname.split("/").at(-1)!;
          let rows = [...(tables[table] ?? [])];
          for (const [key, value] of url.searchParams) {
            if (value.startsWith("eq."))
              rows = rows.filter((row) => String(row[key]) === value.slice(3));
            else if (value.startsWith("neq."))
              rows = rows.filter((row) => String(row[key]) !== value.slice(4));
            else if (value.startsWith("in.(")) {
              const values = new Set(value.slice(4, -1).split(","));
              rows = rows.filter((row) => values.has(String(row[key])));
            }
          }
          const order = url.searchParams.get("order")?.split(",") ?? [];
          rows.sort((a, b) => {
            for (const field of order) {
              const [key, direction] = field.split(".");
              const difference = String(a[key] ?? "").localeCompare(
                String(b[key] ?? ""),
              );
              if (difference)
                return direction === "desc" ? -difference : difference;
            }
            return 0;
          });
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const limit = Number(url.searchParams.get("limit") ?? 1000);
          rows = rows.slice(offset, offset + limit);
          cost.rows += rows.length;
          const single = new Headers(init?.headers)
            .get("accept")
            ?.includes("vnd.pgrst.object");
          const body = JSON.stringify(single ? (rows[0] ?? null) : rows);
          cost.bytes += new TextEncoder().encode(body).byteLength;
          return new Response(body, {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
      },
    },
  );
  const authorized = {
    from: client.from.bind(client),
    storage: client.storage,
    auth: {
      getUser: async () => ({
        data: { user: actor ? { id: actor } : null },
        error: null,
      }),
    },
  } as unknown as typeof client;
  return { client: authorized, requests, cost };
}
