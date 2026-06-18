/**
 * RLS-coverage gate (WS-0.1). Static, DB-free, CI-safe.
 *
 * Scans ALL `supabase/migrations/*.sql` (aggregated, case-insensitive) and fails
 * if any `public` table either:
 *   - never runs `ENABLE ROW LEVEL SECURITY`, or
 *   - enables RLS but has NO policy (a silent deny-all footgun).
 *
 * Every new public table must ship RLS + >=1 policy in its own migration.
 * For an authoritative live check against a branch, use `npm run rls:audit:live`.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface RlsViolation {
  table: string;
  reason: "no-rls" | "rls-without-policy";
}

// Tables intentionally exempt (deliberately deny-all / service-role-only).
// Keep EMPTY unless justified; document every entry. This list only shrinks.
const ALLOWLIST = new Set<string>([]);

const NON_PUBLIC_SCHEMAS = new Set([
  "auth", "storage", "realtime", "vault", "extensions", "graphql",
  "graphql_public", "pgbouncer", "supabase_functions", "supabase_migrations",
  "cron", "net", "_analytics", "information_schema", "pg_catalog",
]);

export function findRlsViolations(migrationsDir: string): RlsViolation[] {
  const sql = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(path.join(migrationsDir, f), "utf8"))
    .join("\n")
    .toLowerCase();

  const created = new Set<string>();
  const createRe =
    /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:(\w+)\.)?(\w+)/g;
  for (const m of sql.matchAll(createRe)) {
    const schema = m[1];
    if (schema && NON_PUBLIC_SCHEMAS.has(schema)) continue;
    created.add(m[2]);
  }

  // A table dropped later need not carry RLS.
  const dropRe = /drop\s+table\s+(?:if\s+exists\s+)?(?:(\w+)\.)?(\w+)/g;
  for (const m of sql.matchAll(dropRe)) created.delete(m[2]);

  const violations: RlsViolation[] = [];
  for (const table of [...created].sort()) {
    if (ALLOWLIST.has(table)) continue;
    const rlsRe = new RegExp(
      `alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?(?:\\w+\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
    );
    const policyRe = new RegExp(
      `create\\s+policy\\s+(?:"[^"]*"|[\\w]+)\\s+on\\s+(?:\\w+\\.)?${table}\\b`,
    );
    if (!rlsRe.test(sql)) violations.push({ table, reason: "no-rls" });
    else if (!policyRe.test(sql)) {
      violations.push({ table, reason: "rls-without-policy" });
    }
  }
  return violations;
}

function isMain(): boolean {
  return (
    !!process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
  );
}

if (isMain()) {
  const dir = path.join(process.cwd(), "supabase/migrations");
  const violations = findRlsViolations(dir);
  if (violations.length > 0) {
    console.error(
      `RLS coverage: ${violations.length} public table(s) lack RLS/policies:`,
    );
    for (const v of violations) {
      console.error(
        `  - ${v.table}: ${
          v.reason === "no-rls"
            ? "RLS not enabled"
            : "RLS enabled but NO policy (deny-all)"
        }`,
      );
    }
    console.error(
      "\nEvery new public table needs ENABLE ROW LEVEL SECURITY + >=1 policy in its migration.",
    );
    process.exit(1);
  }
  console.log(
    "RLS coverage: all public tables enable RLS and have at least one policy.",
  );
}
