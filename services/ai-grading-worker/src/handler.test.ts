import assert from "node:assert/strict";
import test from "node:test";
import type { CallerRole } from "./auth";
import { routeWorkerRequest } from "./handler";

const job = {
  schemaVersion: 1 as const,
  kind: "practice_analysis" as const,
  sourceId: "00000000-0000-4000-8000-000000000001",
  workflowRunId: "00000000-0000-4000-8000-000000000002",
};

test("Pub/Sub and Scheduler paths require their distinct identities", async () => {
  const verified: CallerRole[] = [];
  const verify = async (_authorization: string | undefined, role: CallerRole) => {
    verified.push(role);
  };
  const push = await routeWorkerRequest(
    {
      method: "POST",
      path: "/",
      authorization: "Bearer push-token",
      body: {
        message: {
          messageId: "message-1",
          data: Buffer.from(JSON.stringify(job)).toString("base64"),
        },
      },
    },
    { verify, processDelivery: async () => "completed" },
  );
  assert.equal(push.status, 204);
  const reconcile = await routeWorkerRequest(
    {
      method: "POST",
      path: "/internal/reconcile",
      authorization: "Bearer scheduler-token",
    },
    {
      verify,
      reconcile: async () => ({ scanned: 1, published: 1 }),
    },
  );
  assert.deepEqual(reconcile, {
    status: 200,
    body: { ok: true, scanned: 1, published: 1 },
  });
  assert.deepEqual(verified, ["pubsub", "scheduler"]);
});
test("failed identity verification executes no grading work", async () => {
  let processed = false;
  await assert.rejects(
    () =>
      routeWorkerRequest(
        {
          method: "POST",
          path: "/",
          authorization: "Bearer wrong-token",
          body: {},
        },
        {
          verify: async () => {
            throw new Error("identity mismatch");
          },
          processDelivery: async () => {
            processed = true;
            return "completed";
          },
        },
      ),
    /identity mismatch/,
  );
  assert.equal(processed, false);
});
