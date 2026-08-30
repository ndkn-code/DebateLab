import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  findVercelSurfaceExpansions,
  readCurrentSurface,
  type Surface,
} from "./vercel-function-budget";

function surface(overrides: Partial<Surface> = {}): Surface {
  return {
    paths: new Set(["apps/web/src/app/api/existing/route.ts"]),
    contents: new Map([["apps/web/src/app/actions.ts", '"use server";\n']]),
    vercel: {
      functions: { "src/app/api/queue/route.ts": { maxDuration: 30 } },
      crons: [{ path: "/api/old", schedule: "0 1 * * *" }],
    },
    ...overrides,
  };
}

test("unchanged and reduced surfaces pass", () => {
  const baseline = surface();
  const reduced = surface({
    paths: new Set(),
    contents: new Map(),
    vercel: { functions: {}, crons: [] },
  });
  assert.deepEqual(findVercelSurfaceExpansions(baseline, baseline), []);
  assert.deepEqual(findVercelSurfaceExpansions(baseline, reduced), []);
});

test("new route, workflow, Server Action, function config, and cron fail", () => {
  const current = surface({
    paths: new Set([
      "apps/web/src/app/api/existing/route.ts",
      "apps/web/src/app/api/new/route.ts",
      "apps/web/src/workflows/new.ts",
    ]),
    contents: new Map([["apps/web/src/app/actions.ts", '"use server";\n"use server";\n']]),
    vercel: {
      functions: {
        "src/app/api/queue/route.ts": { maxDuration: 60 },
        "src/app/api/new/route.ts": { maxDuration: 30 },
      },
      crons: [
        { path: "/api/old", schedule: "0 1 * * *" },
        { path: "/api/new", schedule: "0 2 * * *" },
      ],
    },
  });
  const violations = findVercelSurfaceExpansions(surface(), current);
  assert.equal(violations.length, 6);
  assert.ok(violations.some((item) => item.includes("new entrypoint/workflow file")));
  assert.ok(violations.some((item) => item.includes("new Server Action")));
  assert.ok(violations.some((item) => item.includes("new vercel.json function")));
  assert.ok(violations.some((item) => item.includes("changed vercel.json function")));
  assert.ok(violations.some((item) => item.includes("new/changed vercel.json cron")));
});

test("current inventory excludes ignored generated routes but includes authored untracked routes", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "vercel-budget-"));
  const write = (relative: string, content = "export const GET = () => null;\n") => {
    const absolute = path.join(root, relative);
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, content);
  };
  try {
    execFileSync("git", ["init", "-q"], { cwd: root });
    write(".gitignore", "apps/web/src/app/.well-known/workflow/\n");
    write("apps/web/src/app/api/tracked/route.ts");
    execFileSync("git", ["add", ".gitignore", "apps/web/src/app/api/tracked/route.ts"], {
      cwd: root,
    });

    write("apps/web/src/app/.well-known/workflow/generated/route.js");
    write("apps/web/src/app/api/authored/route.ts");

    const paths = readCurrentSurface(root).paths;
    assert.equal(paths.has("apps/web/src/app/api/tracked/route.ts"), true);
    assert.equal(paths.has("apps/web/src/app/api/authored/route.ts"), true);
    assert.equal(paths.has("apps/web/src/app/.well-known/workflow/generated/route.js"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
