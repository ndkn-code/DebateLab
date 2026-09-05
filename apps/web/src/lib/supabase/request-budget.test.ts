import assert from "node:assert/strict";
import test from "node:test";
import { budgetedFetch, currentRequestBudget, withServerRequestBudget } from "./request-budget";

test("request budgets isolate concurrent users and prevent late SDK retries", async () => {
  let first: AbortSignal | undefined;
  let second: AbortSignal | undefined;
  await Promise.all([
    assert.rejects(() => withServerRequestBudget(() => {
      first = currentRequestBudget();
      return new Promise(() => {});
    }, 10)),
    withServerRequestBudget(async () => {
      second = currentRequestBudget();
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.equal(second?.aborted, false);
    }, 100),
  ]);
  assert.notEqual(first, second);
  assert.equal(first?.aborted, true);
  assert.equal(currentRequestBudget(), undefined);
  let sent = false;
  const transport = budgetedFetch(first!, async () => { sent = true; return new Response(); });
  assert.throws(() => transport("https://fixture.invalid"));
  assert.equal(sent, false);
});
