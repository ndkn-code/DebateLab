import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeRepository } from "./fake-repository";
import { meterFeature } from "./meter";
import { METERED_FEATURES } from "./metering";

async function main() {
  const repo = new FakeRepository();
  const now = new Date("2026-06-19T12:00:00Z");

  // Free plan: aiWritingScore capped at 3 -> 3 allowed, 4th denied.
  for (let i = 1; i <= 3; i++) {
    const r = await meterFeature(repo, "u1", "free", METERED_FEATURES.aiWritingScore, now);
    assert.equal(r.allowed, true);
    assert.equal(r.usedCount, i);
    assert.equal(r.limitCount, 3);
  }
  const denied = await meterFeature(repo, "u1", "free", METERED_FEATURES.aiWritingScore, now);
  assert.equal(denied.allowed, false);
  assert.equal(denied.usedCount, 3);

  // Premium: unlimited -> never denied, no cap reported.
  for (let i = 0; i < 10; i++) {
    const r = await meterFeature(repo, "u2", "premium", METERED_FEATURES.aiWritingScore, now);
    assert.equal(r.allowed, true);
    assert.equal(r.limitCount, null);
  }

  // Weekly feature uses a Monday-anchored window (distinct key from monthly).
  const r = await meterFeature(repo, "u3", "free", METERED_FEATURES.bandPrediction, now);
  assert.equal(r.allowed, true);
  assert.equal(r.limitCount, 1);

  console.log("payments/meter tests passed");
}

test("payments/meter feature caps", main);
