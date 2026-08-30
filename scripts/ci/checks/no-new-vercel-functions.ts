/**
 * Repository ratchet for the approved Vercel runtime surface.
 *
 * Deleting an approved entrypoint is allowed. Adding one requires an explicit,
 * reviewed baseline update approved by Jack; background and independently
 * scalable work belongs in GCP Cloud Run + Pub/Sub instead.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const SECTION_NAMES = [
  "app-api-routes",
  "app-route-handlers-outside-api",
  "pages-api-routes",
  "server-action-modules",
  "workflow-entrypoints",
  "vercel-functions",
  "vercel-crons",
] as const;

type SectionName = (typeof SECTION_NAMES)[number];
type Inventory = Record<SectionName, Set<string>>;

const SOURCE_EXTENSION = /\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const ROUTE_FILE = /^route\.(?:ts|tsx|js|jsx|mjs|cjs)$/;
const TEST_FILE = /\.(?:test|spec|d)\.(?:ts|tsx|js|jsx|mjs|cjs)$/;

function emptyInventory(): Inventory {
  return Object.fromEntries(
    SECTION_NAMES.map((section) => [section, new Set<string>()]),
  ) as Inventory;
}

function walk(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function relative(repoRoot: string, absolute: string): string {
  return path.relative(repoRoot, absolute).split(path.sep).join("/");
}

function hasModuleDirective(source: string, directive: string): boolean {
  const prefix = source
    .replace(/^\uFEFF/, "")
    .replace(/^(?:\s|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, "");
  const escaped = directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^["']${escaped}["']\\s*;`).test(prefix);
}

function hasDirective(source: string, directive: string): boolean {
  const escaped = directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`["']${escaped}["']\\s*;`).test(source);
}

function loadBaseline(baselinePath: string): Inventory {
  const baseline = emptyInventory();
  let active: SectionName | null = null;

  for (const rawLine of readFileSync(baselinePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
    if (sectionMatch) {
      if (!SECTION_NAMES.includes(sectionMatch[1] as SectionName)) {
        throw new Error(`Unknown baseline section: ${sectionMatch[1]}`);
      }
      active = sectionMatch[1] as SectionName;
      continue;
    }
    if (!active) throw new Error(`Baseline entry has no section: ${line}`);
    baseline[active].add(line);
  }

  return baseline;
}

function collectCurrent(repoRoot: string): Inventory {
  const current = emptyInventory();
  const appRoot = path.join(repoRoot, "apps/web/src/app");
  const apiRoot = path.join(appRoot, "api");
  const sourceRoot = path.join(repoRoot, "apps/web/src");

  for (const file of walk(appRoot).filter((candidate) =>
    ROUTE_FILE.test(path.basename(candidate)),
  )) {
    const target = file.startsWith(`${apiRoot}${path.sep}`)
      ? "app-api-routes"
      : "app-route-handlers-outside-api";
    current[target].add(relative(repoRoot, file));
  }

  for (const file of walk(path.join(repoRoot, "apps/web/src/pages/api"))) {
    if (SOURCE_EXTENSION.test(file) && !TEST_FILE.test(file)) {
      current["pages-api-routes"].add(relative(repoRoot, file));
    }
  }

  for (const file of walk(sourceRoot).filter((candidate) =>
    SOURCE_EXTENSION.test(candidate),
  )) {
    const source = readFileSync(file, "utf8");
    if (hasModuleDirective(source, "use server")) {
      current["server-action-modules"].add(relative(repoRoot, file));
    }
    if (hasDirective(source, "use workflow")) {
      current["workflow-entrypoints"].add(relative(repoRoot, file));
    }
  }

  const vercelConfig = JSON.parse(
    readFileSync(path.join(repoRoot, "apps/web/vercel.json"), "utf8"),
  ) as {
    functions?: Record<string, unknown>;
    crons?: Array<{ path?: string }>;
  };
  for (const functionPath of Object.keys(vercelConfig.functions ?? {})) {
    current["vercel-functions"].add(functionPath);
  }
  for (const cron of vercelConfig.crons ?? []) {
    if (cron.path) current["vercel-crons"].add(cron.path);
  }

  return current;
}

const repoRoot = process.cwd();
const baselinePath = path.join(
  repoRoot,
  "scripts/ci/baselines/vercel-function-entrypoints.txt",
);
const approved = loadBaseline(baselinePath);
const current = collectCurrent(repoRoot);
const additions: Array<[SectionName, string[]]> = [];
let deletedCount = 0;

for (const section of SECTION_NAMES) {
  const newEntries = [...current[section]]
    .filter((entry) => !approved[section].has(entry))
    .sort();
  if (newEntries.length > 0) additions.push([section, newEntries]);
  deletedCount += [...approved[section]].filter(
    (entry) => !current[section].has(entry),
  ).length;
}

if (additions.length > 0) {
  console.error("No-new-Vercel-Functions gate: unapproved entrypoints found:");
  for (const [section, entries] of additions) {
    console.error(`\n[${section}]`);
    for (const entry of entries) console.error(`  + ${entry}`);
  }
  console.error(
    "\nMove new backend capability to GCP Cloud Run + Pub/Sub. Updating the " +
      "baseline requires explicit approval from Jack and code review.",
  );
  process.exit(1);
}

console.log(
  `No-new-Vercel-Functions gate: passed (${deletedCount} approved deletion(s) allowed).`,
);
