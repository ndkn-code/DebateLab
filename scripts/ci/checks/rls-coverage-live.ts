/**
 * Authoritative RLS audit (WS-0.1) — LOCAL / branch use, not in required CI.
 *
 * Queries pg_catalog for the true RLS + policy state of every `public` table,
 * so it catches policy-less tables exactly (no SQL parsing). Point it at a
 * Supabase branch during schema work (WS-0.3):
 *
 *   SUPABASE_DB_URL='postgresql://...branch...' npm run rls:audit:live
 */
import { execFileSync } from "node:child_process";

const conn = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!conn) {
  console.warn(
    "rls:audit:live: set SUPABASE_DB_URL (or DATABASE_URL) to a Postgres " +
      "connection string (a branch, not prod). Skipping.",
  );
  process.exit(0);
}

const query = `
select c.relname || ' (' ||
  case when c.relrowsecurity then 'RLS on' else 'RLS OFF' end || ', ' ||
  count(p.polname) || ' policies)'
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and c.relkind = 'r'
group by c.relname, c.relrowsecurity
having c.relrowsecurity = false or count(p.polname) = 0
order by c.relname;
`;

try {
  const out = execFileSync("psql", [conn, "-At", "-c", query], {
    encoding: "utf8",
  });
  if (out.trim()) {
    console.error("rls:audit:live: tables lacking RLS or policies:");
    console.error(out.trim());
    process.exit(1);
  }
  console.log(
    "rls:audit:live: every public table has RLS enabled and >=1 policy.",
  );
} catch (error) {
  console.error(
    "rls:audit:live: psql failed (is psql installed and the connection valid?).",
  );
  console.error(String((error as Error).message ?? error).split("\n")[0]);
  process.exit(1);
}
