import assert from "node:assert/strict";
import {
  __resetGeminiKeyPoolForTests,
  classifyGeminiError,
  GeminiKeyPoolUnavailableError,
  recordGeminiKeyFailure,
  runWithGeminiKeyPool,
  selectGeminiKeyAttempts,
} from "./key-pool";

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];

function test(name: string, fn: () => void | Promise<void>) {
  tests.push({ name, fn });
}

function resetWithKeys(keys = "slot-a,slot-b,slot-c") {
  process.env.GEMINI_API_KEYS = keys;
  delete process.env.GEMINI_API_KEY;
  __resetGeminiKeyPoolForTests();
}

test("classifies Gemini rate limit, high demand, and access errors", () => {
  assert.equal(
    classifyGeminiError({ status: 429, message: "RESOURCE_EXHAUSTED" }),
    "rate_limit"
  );
  assert.equal(
    classifyGeminiError({ status: 503, message: "model is experiencing high demand" }),
    "service_unavailable"
  );
  assert.equal(
    classifyGeminiError({ status: 403, message: "denied access to model" }),
    "access_denied"
  );
});

test("skips a cooling-down Gemini key slot", () => {
  resetWithKeys();
  recordGeminiKeyFailure(1, { status: 503, message: "high demand" });

  const attempts = selectGeminiKeyAttempts("same-user-same-route");
  assert.equal(attempts.some((attempt) => attempt.slot === 1), false);
  assert.equal(attempts[0]?.skippedCooldownCount, 1);
  assert.deepEqual(attempts[0]?.skippedCooldownSlots, [1]);
});

test("throws when every Gemini key slot is cooling down", () => {
  resetWithKeys("slot-a,slot-b");
  recordGeminiKeyFailure(0, { status: 429, message: "quota exceeded" });
  recordGeminiKeyFailure(1, { status: 503, message: "high demand" });

  assert.throws(
    () => selectGeminiKeyAttempts("all-cooldown"),
    GeminiKeyPoolUnavailableError
  );
});

test("rotates to the next key on retryable Gemini failure", async () => {
  resetWithKeys("slot-a,slot-b,slot-c");
  const triedSlots: number[] = [];

  const result = await runWithGeminiKeyPool({
    seed: "rotate-on-503",
    run: async (attempt) => {
      triedSlots.push(attempt.slot);
      if (triedSlots.length === 1) {
        throw { status: 503, message: "high demand" };
      }
      return `slot-${attempt.slot}`;
    },
  });

  assert.equal(triedSlots.length, 2);
  assert.notEqual(triedSlots[0], triedSlots[1]);
  assert.equal(result, `slot-${triedSlots[1]}`);
});

async function main() {
  for (const item of tests) {
    try {
      await item.fn();
      console.log(`ok - ${item.name}`);
    } catch (error) {
      console.error(`not ok - ${item.name}`);
      throw error;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
