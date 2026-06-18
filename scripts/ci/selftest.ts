/**
 * WS-0.1 acceptance self-test. Proves every quality gate FAILS on a deliberately
 * sub-bar fixture and PASSES on a compliant one — without touching prod or the
 * DB. CI runs this so the gates are themselves tested.
 *
 *   Tier 1 (pure, fast): RLS coverage, inline-query ban, typed score columns —
 *           exercised via their exported functions over throwaway tmp fixtures.
 *   Tier 2 (path-scoped): ESLint caps (max-lines / no-explicit-any /
 *           no-restricted-imports) and the coverage "missing test" guard —
 *           exercised with transient fixtures under apps/web/src (cleaned up).
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { findRlsViolations } from "./checks/rls-coverage";
import { findInlineQueryViolations } from "./checks/no-inline-supabase";
import { findUntypedScoreColumns } from "./checks/score-columns";

const repoRoot = process.cwd();
const webDir = path.join(repoRoot, "apps/web");
let passed = 0;
const check = (label: string, cond: boolean) => {
  assert.ok(cond, `SELFTEST FAILED: ${label}`);
  console.log(`  ✓ ${label}`);
  passed += 1;
};

function tmp(): string {
  return mkdtempSync(path.join(os.tmpdir(), "ws01-selftest-"));
}
function write(dir: string, rel: string, body: string): void {
  const full = path.join(dir, rel);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, body);
}

console.log("WS-0.1 self-test\n");

// ── Tier 1: RLS coverage ──────────────────────────────────────────────────
{
  const good = tmp();
  write(
    good,
    "001.sql",
    `create table public.demo_good (id uuid primary key);
     alter table public.demo_good enable row level security;
     create policy "owner" on public.demo_good for select using (true);`,
  );
  const noRls = tmp();
  write(noRls, "001.sql", `create table public.demo_norls (id uuid primary key);`);
  const noPolicy = tmp();
  write(
    noPolicy,
    "001.sql",
    `create table public.demo_np (id uuid primary key);
     alter table public.demo_np enable row level security;`,
  );

  check("RLS: compliant table (RLS + policy) passes", findRlsViolations(good).length === 0);
  check(
    "RLS: table without RLS fails",
    findRlsViolations(noRls).some((v) => v.table === "demo_norls" && v.reason === "no-rls"),
  );
  check(
    "RLS: RLS-enabled but policy-less table fails",
    findRlsViolations(noPolicy).some(
      (v) => v.table === "demo_np" && v.reason === "rls-without-policy",
    ),
  );
  [good, noRls, noPolicy].forEach((d) => rmSync(d, { recursive: true, force: true }));
}

// ── Tier 1: typed score columns ───────────────────────────────────────────
{
  const good = tmp();
  write(good, "001.sql", `create table public.s (overall_band numeric, raw_score integer);`);
  const bad = tmp();
  write(bad, "001.sql", `create table public.s (band_scores jsonb not null default '{}');`);

  check("ScoreColumns: typed numeric band/score passes", findUntypedScoreColumns(good).length === 0);
  check(
    "ScoreColumns: untyped jsonb score column fails",
    findUntypedScoreColumns(bad).some((v) => v.column === "band_scores"),
  );
  [good, bad].forEach((d) => rmSync(d, { recursive: true, force: true }));
}

// ── Tier 1: inline-query ban ──────────────────────────────────────────────
{
  const base = tmp();
  write(
    base,
    "app/[locale]/(protected)/demo/page.tsx",
    `import { createClient } from "@/lib/supabase/server";
     export default async function Page() {
       const supabase = await createClient();
       const { data } = await supabase.from("profiles").select("*");
       return data;
     }`,
  );
  write(
    base,
    "components/demo/good.tsx",
    `import { getProfileData } from "@/lib/api/profile";
     export function Good() { return getProfileData("u"); }`,
  );

  const violations = findInlineQueryViolations(base);
  check(
    "Inline-query: page with supabase.from() is flagged",
    violations.some((v) => v.file.endsWith("demo/page.tsx")),
  );
  check(
    "Inline-query: component using lib/api is clean",
    !violations.some((v) => v.file.endsWith("good.tsx")),
  );
  rmSync(base, { recursive: true, force: true });
}

// ── Tier 2: ESLint caps + coverage missing-test guard ─────────────────────
{
  const fxRel = "src/lib/scoring/__ws01_selftest__";
  const fxDir = path.join(webDir, fxRel);
  const eslintBin = [
    path.join(webDir, "node_modules/.bin/eslint"),
    path.join(repoRoot, "node_modules/.bin/eslint"),
  ].find(existsSync);

  try {
    rmSync(fxDir, { recursive: true, force: true });
    mkdirSync(fxDir, { recursive: true });
    writeFileSync(path.join(fxDir, "uses-any.ts"), `export const bad: any = 1;\n`);
    writeFileSync(
      path.join(fxDir, "raw-client.ts"),
      `import { createClient } from "@supabase/supabase-js";\nexport const c = createClient("u", "k");\n`,
    );
    writeFileSync(
      path.join(fxDir, "god-file.ts"),
      Array.from({ length: 420 }, (_, i) => `export const v${i} = ${i};`).join("\n") + "\n",
    );
    // Typed-factory enforcement: untyped wrapper must FAIL, typed must PASS.
    writeFileSync(
      path.join(fxDir, "untyped-factory.ts"),
      `import { createClient } from "@/lib/supabase/server";\nexport async function load() {\n  return (await createClient()).from("profiles");\n}\n`,
    );
    writeFileSync(
      path.join(fxDir, "typed-factory.ts"),
      `import { createTypedServerClient } from "@/lib/supabase/server";\nexport async function load() {\n  return (await createTypedServerClient()).from("profiles");\n}\n`,
    );

    assert.ok(eslintBin, "could not locate eslint binary");
    let eslintOut = "";
    try {
      eslintOut = execFileSync(eslintBin, [fxRel, "-f", "json"], {
        cwd: webDir,
        encoding: "utf8",
      });
    } catch (error) {
      // eslint exits non-zero when it reports errors; JSON is on stdout.
      eslintOut = String((error as { stdout?: Buffer | string }).stdout ?? "");
    }
    const results = JSON.parse(eslintOut) as Array<{
      filePath: string;
      messages: Array<{ ruleId: string | null }>;
    }>;
    const ruleIds = new Set<string>();
    const byFile = new Map<string, Set<string>>();
    for (const r of results) {
      const base = path.basename(r.filePath);
      const set = byFile.get(base) ?? new Set<string>();
      for (const m of r.messages) {
        if (m.ruleId) {
          ruleIds.add(m.ruleId);
          set.add(m.ruleId);
        }
      }
      byFile.set(base, set);
    }
    const rulesFor = (file: string) => byFile.get(file) ?? new Set<string>();

    check("ESLint: no-explicit-any fires on new scoped code", ruleIds.has("@typescript-eslint/no-explicit-any"));
    check("ESLint: max-lines fires on a god-file", ruleIds.has("max-lines"));
    check("ESLint: raw Supabase client import is banned", ruleIds.has("no-restricted-imports"));
    check(
      "ESLint: untyped createClient() wrapper is banned in IELTS code",
      rulesFor("untyped-factory.ts").has("no-restricted-imports"),
    );
    check(
      "ESLint: typed factory passes the import rule",
      !rulesFor("typed-factory.ts").has("no-restricted-imports"),
    );

    // Coverage missing-test guard: these fixtures have no sibling *.test.ts.
    let coverageExit = 0;
    try {
      execFileSync("tsx", ["../../scripts/ci/run-critical-coverage.ts"], {
        cwd: webDir,
        stdio: "pipe",
      });
    } catch {
      coverageExit = 1;
    }
    check("Coverage: scoring module without a sibling test fails", coverageExit === 1);
  } finally {
    rmSync(fxDir, { recursive: true, force: true });
  }
}

console.log(`\nWS-0.1 self-test: all ${passed} assertions passed.`);
