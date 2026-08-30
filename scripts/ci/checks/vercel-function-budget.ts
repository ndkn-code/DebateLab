/**
 * Enforces the frozen Vercel function surface. Existing entrypoints are
 * grandfathered at the recorded git commit; removals pass, additions fail.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface Surface {
  paths: Set<string>;
  contents: Map<string, string>;
  vercel: {
    functions?: Record<string, unknown>;
    crons?: unknown[];
  };
}

const routePattern = /(?:^|\/)pages\/api\/|(?:^|\/)route\.(?:ts|tsx|js|jsx)$/;
const workflowPattern = /^apps\/web\/src\/workflows\//;
const serverActionPattern = /["']use server["'];?/g;
const vercelPath = "apps/web/vercel.json";

function parseVercel(content: string | undefined): Surface["vercel"] {
  if (!content) return {};
  const parsed = JSON.parse(content) as Surface["vercel"];
  return { functions: parsed.functions ?? {}, crons: parsed.crons ?? [] };
}

export function readCurrentSurface(repoRoot: string): Surface {
  // Include committed files and newly authored, non-ignored files. Build tools
  // generate ignored route-like output (for example .well-known/workflow),
  // which is not source and must not consume the function budget.
  const listed = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repoRoot, encoding: "utf8" },
  );
  const paths = new Set(listed.split("\0").filter(Boolean));
  const contents = new Map<string, string>();
  for (const candidate of paths) {
    if (routePattern.test(candidate) || workflowPattern.test(candidate)) continue;
    if (/^apps\/web\/src\//.test(candidate) && /\.(?:ts|tsx|js|jsx)$/.test(candidate)) {
      const content = readFileSync(path.join(repoRoot, candidate), "utf8");
      if (content.includes("use server")) contents.set(candidate, content);
    }
  }
  const vercelContent = existsSync(path.join(repoRoot, vercelPath))
    ? readFileSync(path.join(repoRoot, vercelPath), "utf8")
    : undefined;
  return { paths, contents, vercel: parseVercel(vercelContent) };
}

export function readGitSurface(repoRoot: string, commit: string): Surface {
  const output = execFileSync("git", ["ls-tree", "-r", "--name-only", commit], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const paths = new Set(output.split("\n").filter(Boolean));
  const contents = new Map<string, string>();
  for (const candidate of paths) {
    if (!/^apps\/web\/src\//.test(candidate) || !/\.(?:ts|tsx|js|jsx)$/.test(candidate)) continue;
    const content = execFileSync("git", ["show", `${commit}:${candidate}`], {
      cwd: repoRoot,
      encoding: "utf8",
      maxBuffer: 5 * 1024 * 1024,
    });
    if (content.includes("use server")) contents.set(candidate, content);
  }
  let vercelContent: string | undefined;
  if (paths.has(vercelPath)) {
    vercelContent = execFileSync("git", ["show", `${commit}:${vercelPath}`], {
      cwd: repoRoot,
      encoding: "utf8",
    });
  }
  return { paths, contents, vercel: parseVercel(vercelContent) };
}

function directiveCount(content: string | undefined): number {
  return content?.match(serverActionPattern)?.length ?? 0;
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function findVercelSurfaceExpansions(baseline: Surface, current: Surface): string[] {
  const violations: string[] = [];
  for (const candidate of current.paths) {
    if ((routePattern.test(candidate) || workflowPattern.test(candidate)) && !baseline.paths.has(candidate)) {
      violations.push(`new entrypoint/workflow file: ${candidate}`);
    }
  }
  for (const [candidate, content] of current.contents) {
    const before = directiveCount(baseline.contents.get(candidate));
    const after = directiveCount(content);
    if (after > before) {
      violations.push(`new Server Action directive: ${candidate} (${before} -> ${after})`);
    }
  }

  const baselineFunctions = baseline.vercel.functions ?? {};
  for (const [name, config] of Object.entries(current.vercel.functions ?? {})) {
    if (!(name in baselineFunctions)) {
      violations.push(`new vercel.json function entry: ${name}`);
    } else if (stable(config) !== stable(baselineFunctions[name])) {
      violations.push(`expanded/changed vercel.json function config: ${name}`);
    }
  }
  const baselineCrons = new Set((baseline.vercel.crons ?? []).map(stable));
  for (const cron of current.vercel.crons ?? []) {
    if (!baselineCrons.has(stable(cron))) {
      violations.push(`new/changed vercel.json cron: ${stable(cron)}`);
    }
  }
  return violations.sort();
}

function main(): void {
  const repoRoot = process.cwd();
  const baselineFile = path.join(
    repoRoot,
    "scripts/ci/baselines/vercel-function-budget.json",
  );
  const { baselineCommit } = JSON.parse(readFileSync(baselineFile, "utf8")) as {
    baselineCommit: string;
  };
  let baseline: Surface;
  try {
    baseline = readGitSurface(repoRoot, baselineCommit);
  } catch {
    console.error(
      `Vercel function budget: baseline commit ${baselineCommit} is unavailable. Fetch full git history before running this check.`,
    );
    process.exit(1);
  }
  const violations = findVercelSurfaceExpansions(baseline, readCurrentSurface(repoRoot));
  if (violations.length) {
    console.error("Vercel function budget FAILED:\n" + violations.map((item) => `  - ${item}`).join("\n"));
    process.exit(1);
  }
  console.log("Vercel function budget: frozen surface preserved (removals remain allowed).");
}

if (process.argv[1]?.endsWith("vercel-function-budget.ts")) main();
