/**
 * DB-types drift check (WS-0.1) — LOCAL / opt-in only (needs a linked Supabase
 * project; intentionally NOT in the required CI path, which stays DB-free).
 *
 * Regenerates the public schema types and compares against the committed file.
 * Run after applying migrations: `npm run db:types && git add` if this fails.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const target = "apps/web/src/types/supabase.ts";

let committed: string;
try {
  committed = readFileSync(target, "utf8");
} catch {
  console.error(`db:types:check: missing ${target} — run \`npm run db:types\`.`);
  process.exit(1);
}

let fresh: string;
try {
  fresh = execSync("supabase gen types typescript --linked --schema public", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
} catch (error) {
  // Not linked / not authed locally — skip rather than block unrelated work.
  console.warn(
    "db:types:check: could not regenerate types (is the project linked via " +
      "`supabase link`?). Skipping drift check.",
  );
  console.warn(String((error as Error).message ?? error).split("\n")[0]);
  process.exit(0);
}

if (committed.trim() !== fresh.trim()) {
  console.error(
    `db:types:check: ${target} is STALE. Run \`npm run db:types\` and commit the result.`,
  );
  process.exit(1);
}

console.log("db:types:check: DB types are up to date.");
