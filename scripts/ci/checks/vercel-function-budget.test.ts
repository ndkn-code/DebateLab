import assert from "node:assert/strict";
import test from "node:test";

import { findVercelSurfaceExpansions, type Surface } from "./vercel-function-budget";

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
