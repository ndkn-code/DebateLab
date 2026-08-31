/**
 * Read-only production release gate for Supabase migrations.
 *
 * This deliberately runs `supabase db push --dry-run`; it never changes the
 * remote database. A Vercel deploy must not be started until this check reports
 * that there are no pending migrations.
 */
import { spawnSync } from "node:child_process";
import { pendingMigrationNames } from "./preflight-db-core";

const databaseUrl = process.env.SUPABASE_DB_URL?.trim();
const args = [
  "db",
  "push",
  "--dry-run",
  ...(databaseUrl ? ["--db-url", databaseUrl] : ["--linked"]),
];

const result = spawnSync("supabase", args, {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});
const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();

if (result.error || result.status !== 0) {
  console.error(
    "release:preflight: could not inspect the target Supabase migration history.",
  );
  console.error(
    databaseUrl
      ? "Check SUPABASE_DB_URL and database credentials."
      : "Link the production project (`supabase link`) or set SUPABASE_DB_URL.",
  );
  if (output) console.error(output.split("\n").slice(-3).join("\n"));
  process.exit(1);
}

const pendingMigrations = pendingMigrationNames(output);

if (pendingMigrations.length > 0) {
  console.error(
    "release:preflight: pending Supabase migrations detected; apply them before the Vercel deploy:",
  );
  for (const migration of pendingMigrations) {
    console.error(`- ${migration}`);
  }
  process.exit(1);
}

console.log("release:preflight: Supabase schema is current.");
