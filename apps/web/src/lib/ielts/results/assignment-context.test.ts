import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { test } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const assignmentContextFile = resolve(here, "assignment-context.ts");

type Fixture = {
  attempt: { assignment_id: string | null } | null;
  error: { message: string } | null;
  assignments: Array<{
    assignmentId: string;
    title: string;
    className: string | null;
  }>;
  listError?: Error;
};

declare global {
  var __assignmentContextClientCreated: number;
  var __assignmentContextQueryCalls: Array<[string, string]>;
  var __assignmentContextFixture: Fixture;
}

let fixture: Fixture = {
  attempt: { assignment_id: "assignment-1" },
  error: null,
  assignments: [
    { assignmentId: "assignment-1", title: "Week 1 mock", className: "10A" },
  ],
};
let queryCalls: Array<[string, string]> = [];

async function loadModule() {
  const dir = await mkdtemp(join(tmpdir(), "thinkfy-assignment-context-"));
  const output = join(dir, "assignment-context.cjs");
  await build({
    entryPoints: [assignmentContextFile],
    outfile: output,
    bundle: true,
    format: "cjs",
    platform: "node",
    plugins: [
      {
        name: "assignment-context-test-doubles",
        setup(plugin) {
          plugin.onResolve({ filter: /^(server-only|@\/)/ }, (args) => ({
            path: args.path,
            namespace: "assignment-context-test-double",
          }));
          plugin.onLoad(
            { filter: /.*/, namespace: "assignment-context-test-double" },
            (args) => ({
              contents:
                args.path === "@/lib/supabase/server"
                  ? `export async function createTypedServerClient() {
                globalThis.__assignmentContextClientCreated++;
                return { from(table) {
                  if (table !== "ielts_attempts") throw new Error("unexpected table");
                  const query = { eq(column, value) {
                    globalThis.__assignmentContextQueryCalls.push([column, value]);
                    return { eq(column2, value2) {
                      globalThis.__assignmentContextQueryCalls.push([column2, value2]);
                      return { async maybeSingle() {
                        return {
                          data: globalThis.__assignmentContextFixture.attempt,
                          error: globalThis.__assignmentContextFixture.error,
                        };
                      } };
                    }};
                  }};
                  return { select() { return query; } };
                }};
              }
            `
                  : args.path ===
                      "@/lib/api/ielts/learner-assignments-repository"
                    ? `export async function listLearnerAssignedTests() {
                  if (globalThis.__assignmentContextFixture.listError) throw globalThis.__assignmentContextFixture.listError;
                  return globalThis.__assignmentContextFixture.assignments;
                }`
                    : "export {};",
              loader: "js",
            }),
          );
        },
      },
    ],
  });
  globalThis.__assignmentContextClientCreated = 0;
  globalThis.__assignmentContextQueryCalls = queryCalls;
  globalThis.__assignmentContextFixture = fixture;
  const loaded = await import(pathToFileURL(output).href + `?v=${Date.now()}`);
  return {
    dir,
    load: loaded.loadResultsAssignmentContext as (
      attemptId: string,
      userId: string,
    ) => Promise<unknown>,
  };
}

test("loadResultsAssignmentContext applies attempt and owner filters and returns exact assignment context", async () => {
  queryCalls = [];
  fixture = {
    attempt: { assignment_id: "assignment-1" },
    error: null,
    assignments: [
      { assignmentId: "other", title: "Other", className: null },
      { assignmentId: "assignment-1", title: "Week 1 mock", className: "10A" },
    ],
  };
  const { dir, load } = await loadModule();
  try {
    assert.deepEqual(await load("attempt-1", "learner-1"), {
      assignmentId: "assignment-1",
      title: "Week 1 mock",
      className: "10A",
    });
    assert.deepEqual(queryCalls, [
      ["id", "attempt-1"],
      ["user_id", "learner-1"],
    ]);
    assert.equal(globalThis.__assignmentContextClientCreated, 1);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("loadResultsAssignmentContext gracefully falls back for unavailable, deleted, mismatched, and failed reads", async () => {
  const cases: Fixture[] = [
    { attempt: null, error: null, assignments: [] },
    { attempt: { assignment_id: null }, error: null, assignments: [] },
    { attempt: { assignment_id: "deleted" }, error: null, assignments: [] },
    {
      attempt: { assignment_id: "assignment-1" },
      error: { message: "RLS denied" },
      assignments: [],
    },
    {
      attempt: { assignment_id: "assignment-1" },
      error: null,
      assignments: [],
      listError: new Error("temporary"),
    },
  ];
  for (const nextFixture of cases) {
    fixture = nextFixture;
    const { dir, load } = await loadModule();
    try {
      assert.equal(await load("attempt-1", "learner-1"), null);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
});
