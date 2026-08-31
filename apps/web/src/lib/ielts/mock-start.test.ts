import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareMockAttemptStart } from "./mock-start";

interface TestAttempt {
  attempt: { id: string };
  sections: Array<{ id: string; started_at: string | null }>;
}

const pendingAttempt: TestAttempt = {
  attempt: { id: "attempt-1" },
  sections: [{ id: "section-1", started_at: null }],
};

const enteredAttempt: TestAttempt = {
  attempt: { id: "attempt-1" },
  sections: [{ id: "section-1", started_at: "2026-08-31T00:00:00Z" }],
};

test("retains a newly created attempt before first-section entry", async () => {
  const events: string[] = [];

  await assert.rejects(
    prepareMockAttemptStart({
      retainedAttempt: null,
      createAttempt: async () => {
        events.push("create");
        return pendingAttempt;
      },
      retainAttempt: () => events.push("retain"),
      enterFirstSection: async () => {
        events.push("enter");
        throw new Error("entry failed");
      },
    }),
    /entry failed/,
  );

  assert.deepEqual(events, ["create", "retain", "enter"]);
});

test("retries section entry without creating a duplicate attempt", async () => {
  let createCalls = 0;

  const result = await prepareMockAttemptStart({
    retainedAttempt: pendingAttempt,
    createAttempt: async () => {
      createCalls += 1;
      return pendingAttempt;
    },
    retainAttempt: () => undefined,
    enterFirstSection: async (input) => {
      assert.deepEqual(input, {
        attemptId: "attempt-1",
        sectionId: "section-1",
      });
      return enteredAttempt;
    },
  });

  assert.equal(createCalls, 0);
  assert.equal(result.startedAttempt, pendingAttempt);
  assert.equal(result.readyAttempt, enteredAttempt);
});

test("does not re-enter a section that already started", async () => {
  let enterCalls = 0;

  const result = await prepareMockAttemptStart({
    retainedAttempt: enteredAttempt,
    createAttempt: async () => pendingAttempt,
    retainAttempt: () => undefined,
    enterFirstSection: async () => {
      enterCalls += 1;
      return enteredAttempt;
    },
  });

  assert.equal(enterCalls, 0);
  assert.equal(result.readyAttempt, enteredAttempt);
});
