/**
 * Quality-bar static checks runner (WS-0.1). Gated in CI via `npm run ci:checks`.
 * Each check is DB-free and deterministic so it runs in CI without secrets.
 */
import { execSync } from "node:child_process";

const checks: Array<[label: string, file: string]> = [
  ["RLS coverage", "scripts/ci/checks/rls-coverage.ts"],
  ["No inline supabase in pages/components", "scripts/ci/checks/no-inline-supabase.ts"],
  ["Typed score columns (no untyped Json)", "scripts/ci/checks/score-columns.ts"],
];

const failed: string[] = [];
for (const [label, file] of checks) {
  console.log(`\n──── ${label} ────`);
  try {
    execSync(`tsx ${file}`, { stdio: "inherit" });
  } catch {
    failed.push(label);
  }
}

if (failed.length > 0) {
  console.error(`\nci:checks FAILED -> ${failed.join(", ")}`);
  process.exit(1);
}

console.log("\nci:checks: all checks passed.");
