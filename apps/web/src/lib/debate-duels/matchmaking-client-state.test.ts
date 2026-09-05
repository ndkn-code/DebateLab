import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createMatchmakingRequestGuard } from "./matchmaking-client-state";

test("invalidating a ticket suppresses late poll, entry, and AI results", () => {
  const guard = createMatchmakingRequestGuard();
  const entry = guard.begin("entry");

  guard.activateTicket("ticket-a");
  const poll = guard.begin("poll");
  const ai = guard.begin("ai");

  assert.equal(guard.isCurrent(entry), false);
  assert.equal(guard.isCurrent(poll), true);
  assert.equal(guard.isCurrent(ai), true);

  guard.invalidate();
  assert.equal(guard.isCurrent(poll), false);
  assert.equal(guard.isCurrent(ai), false);
});

test("a newer ticket cannot be overwritten by an older cached response", () => {
  const guard = createMatchmakingRequestGuard();
  guard.activateTicket("ticket-a");
  const oldPoll = guard.begin("poll");
  guard.activateTicket("ticket-b");

  assert.equal(guard.isCurrent(oldPoll), false);
  assert.equal(guard.isCurrent(guard.begin("poll")), true);
});

test("human queue has no timer-driven AI backfill path", () => {
  const source = readFileSync(
    new URL(
      "../../components/debates/duel-matchmaking-page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  // One declaration and one event binding: no timer, effect, or indirect
  // scheduling reference may invoke the paid action.
  assert.equal(source.match(/\btriggerAiBackfill\b/g)?.length, 2);
  assert.equal(source.match(/matchmaking\/ai-backfill/g)?.length, 1);
  assert.equal(source.includes("AI_BACKFILL_AUTO_SECONDS"), false);
  assert.equal(
    source.includes("queueElapsed >= AI_BACKFILL_AUTO_SECONDS"),
    false,
  );
  assert.equal(source.includes("onClick={triggerAiBackfill}"), true);
});

for (const kind of ["entry", "poll", "ai"] as const) {
  test(`a deferred ${kind} result cannot navigate after cancellation`, async () => {
    const guard = createMatchmakingRequestGuard();
    guard.activateTicket("ticket-a");
    const request = guard.begin(kind);
    let release!: (value: string) => void;
    const response = new Promise<string>((resolve) => {
      release = resolve;
    });
    const navigations: string[] = [];
    const consume = response.then((code) => {
      if (guard.isCurrent(request)) navigations.push(code);
    });
    guard.invalidate();
    release("LATE01");
    await consume;
    assert.deepEqual(navigations, []);
  });
}
