/**
 * Critical-path coverage gate (WS-0.1). Enforces coverage thresholds on
 * `src/lib/scoring/**` and `src/lib/payments/**` using Node's native V8 test
 * coverage (source-mapped through tsx) — no extra test-infra dependency.
 *
 * Two guards:
 *   1. Every non-test source module under those paths must have a sibling
 *      `*.test.ts` — a "missing test" cannot merge.
 *   2. Loaded scoring/payments code must meet line/function/branch thresholds.
 *
 * Node's `--test-coverage-*` flags take a PERCENT (0-100). Run with
 * cwd = apps/web (via `npm run test:coverage:critical`).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd(); // apps/web
const roots = ["src/lib/scoring", "src/lib/payments"];

const THRESHOLD_LINES = "90";
const THRESHOLD_FUNCS = "90";
const THRESHOLD_BRANCHES = "80";

// Exempt from the sibling-test rule (barrels / type-only modules).
const EXEMPT = /(?:\.test\.ts|\.types\.ts|index\.ts)$/;

function walk(rel: string): string[] {
  const abs = path.join(cwd, rel);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).flatMap((entry) => {
    const childRel = path.join(rel, entry);
    return statSync(path.join(cwd, childRel)).isDirectory()
      ? walk(childRel)
      : [childRel];
  });
}

const allFiles = roots.flatMap(walk);
const testFiles = allFiles.filter((f) => f.endsWith(".test.ts"));
const sourceFiles = allFiles.filter((f) => f.endsWith(".ts") && !EXEMPT.test(f));

// Guard 1: every source module has a sibling test.
const missing = sourceFiles.filter(
  (f) => !existsSync(path.join(cwd, f.replace(/\.ts$/, ".test.ts"))),
);
if (missing.length > 0) {
  console.error(
    `coverage:critical: ${missing.length} scoring/payments module(s) missing a sibling *.test.ts:`,
  );
  for (const f of missing) console.error(`  - ${f}`);
  process.exit(1);
}

if (testFiles.length === 0) {
  console.log("coverage:critical: no scoring/payments tests yet — skipping.");
  process.exit(0);
}

// Guard 2: coverage thresholds on loaded scoring/payments code.
const args = [
  "--import",
  "tsx",
  "--experimental-test-coverage",
  "--test-coverage-include=src/lib/scoring/**",
  "--test-coverage-include=src/lib/payments/**",
  "--test-coverage-exclude=**/*.test.ts",
  `--test-coverage-lines=${THRESHOLD_LINES}`,
  `--test-coverage-functions=${THRESHOLD_FUNCS}`,
  `--test-coverage-branches=${THRESHOLD_BRANCHES}`,
  "--test",
  ...testFiles,
];

try {
  execFileSync("node", args, { stdio: "inherit", cwd });
} catch {
  console.error(
    `\ncoverage:critical: thresholds not met (lines>=${THRESHOLD_LINES}%, functions>=${THRESHOLD_FUNCS}%, branches>=${THRESHOLD_BRANCHES}%).`,
  );
  process.exit(1);
}
console.log("\ncoverage:critical: thresholds met.");
