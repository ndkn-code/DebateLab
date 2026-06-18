/**
 * Aggregate unit-test runner (WS-0.1).
 *
 * The repo has ~36 `test:*` scripts but no single entry point. CI gates on this
 * runner, which discovers every `test:*` script in the root package.json
 * (excluding `test:coverage:*`, which run separately under c8) and executes
 * them, reporting every failure. New `test:*` scripts are picked up
 * automatically — no need to edit CI.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const pkg = JSON.parse(
  readFileSync(path.join(repoRoot, "package.json"), "utf8"),
) as { scripts?: Record<string, string> };

const suites = Object.keys(pkg.scripts ?? {})
  .filter((name) => name.startsWith("test:"))
  .filter((name) => !name.startsWith("test:coverage"))
  .sort();

if (suites.length === 0) {
  console.error("run-all-tests: no test:* scripts found");
  process.exit(1);
}

console.log(`run-all-tests: running ${suites.length} test suites\n`);

const failed: string[] = [];
for (const name of suites) {
  console.log(`\n──── npm run ${name} ────`);
  try {
    execSync(`npm run ${name} --silent`, { stdio: "inherit", cwd: repoRoot });
  } catch {
    failed.push(name);
  }
}

if (failed.length > 0) {
  console.error(
    `\nrun-all-tests: ${failed.length} suite(s) FAILED -> ${failed.join(", ")}`,
  );
  process.exit(1);
}

console.log(`\nrun-all-tests: all ${suites.length} suites passed.`);
