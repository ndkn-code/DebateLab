import assert from "node:assert/strict";
import test from "node:test";
import { runTeacherWorkspace } from "./teacher-workspace";
import type { TeacherRun } from "./contracts";

const run: TeacherRun = {
  requestKey: "request-1234",
  conversationId: "conversation-1",
  status: "running",
  stage: "loading_context",
  startedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function driver(
  overrides: Partial<Parameters<typeof runTeacherWorkspace>[0]["driver"]> = {},
) {
  const stages: string[] = [];
  let active = true;
  const completed: string[] = [];
  return {
    stages,
    completed,
    stop: () => {
      active = false;
    },
    driver: {
      start: async () => ({ run, leaseToken: "lease-1" }),
      stage: async (stage: string) => {
        stages.push(stage);
      },
      active: async () => active,
      complete: async (status: string) => {
        completed.push(status);
      },
      ...overrides,
    },
  } as const;
}

test("bounds a run and persists a timeout failure", async () => {
  const fixture = driver();
  await assert.rejects(
    runTeacherWorkspace({
      driver: fixture.driver,
      deadlineMs: 5,
      work: async () => new Promise(() => undefined),
    }),
    /TEACHER_RUN_TIMEOUT/,
  );
  assert.deepEqual(fixture.completed, ["failed"]);
});

test("a stopped lease cannot complete or mutate after a checkpoint", async () => {
  const fixture = driver();
  await assert.rejects(
    runTeacherWorkspace({
      driver: fixture.driver,
      work: async (checkpoint) => {
        fixture.stop();
        await checkpoint("thinking");
        return "late";
      },
    }),
    /TEACHER_RUN_STALE/,
  );
  assert.deepEqual(fixture.completed, ["failed"]);
});

test("successful runs checkpoint stages and complete once", async () => {
  const fixture = driver();
  const result = await runTeacherWorkspace({
    driver: fixture.driver,
    work: async (checkpoint) => {
      await checkpoint("reading_materials");
      return "answer";
    },
  });
  assert.equal(result, "answer");
  assert.deepEqual(fixture.stages, ["reading_materials", "completed"]);
  assert.deepEqual(fixture.completed, ["completed"]);
});

test("late work cannot cross a checkpoint after timeout even if persistence is unavailable", async () => {
  const fixture = driver({
    complete: async () => {
      throw new Error("offline");
    },
  });
  let checkpointLate: (() => Promise<void>) | undefined;
  await assert.rejects(
    runTeacherWorkspace({
      driver: fixture.driver,
      deadlineMs: 5,
      work: async (checkpoint) => {
        checkpointLate = () => checkpoint("saving");
        return new Promise(() => undefined);
      },
    }),
    /TEACHER_RUN_TIMEOUT/,
  );
  await assert.rejects(checkpointLate!(), /TEACHER_RUN_TIMEOUT/);
  assert.deepEqual(fixture.stages, []);
});
