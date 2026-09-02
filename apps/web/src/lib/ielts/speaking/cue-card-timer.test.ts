import assert from "node:assert/strict";
import {
  CUE_CARD_IDLE,
  cueCardStorageKey,
  deserialize,
  isRunning,
  remainingSeconds,
  serialize,
  skipPrep,
  startPrep,
  stop,
  tick,
} from "./cue-card-timer";

const T0 = 1_700_000_000_000;

// idle → prep → speaking → done through natural expiry.
{
  let state = startPrep(T0, 60);
  assert.deepEqual(state, { phase: "prep", endsAt: T0 + 60_000 });
  assert.equal(isRunning(state), true);
  assert.equal(remainingSeconds(state, T0), 60);
  assert.equal(remainingSeconds(state, T0 + 59_100), 1);

  let result = tick(state, T0 + 30_000, 120);
  assert.equal(result.event, null);
  assert.equal(result.state, state);

  result = tick(state, T0 + 60_000, 120);
  assert.equal(result.event, "prepEnded");
  state = result.state;
  assert.deepEqual(state, { phase: "speaking", endsAt: T0 + 60_000 + 120_000 });
  assert.equal(remainingSeconds(state, T0 + 60_000), 120);

  result = tick(state, T0 + 100_000, 120);
  assert.equal(result.event, null);

  result = tick(state, T0 + 180_000, 120);
  assert.equal(result.event, "speakingEnded");
  assert.deepEqual(result.state, { phase: "done" });
  assert.equal(isRunning(result.state), false);
  assert.equal(remainingSeconds(result.state, T0 + 180_000), 0);
  // Ticking a finished timer is inert.
  assert.deepEqual(tick(result.state, T0 + 999_000, 120), { state: result.state, event: null });
  assert.deepEqual(tick(CUE_CARD_IDLE, T0, 120), { state: CUE_CARD_IDLE, event: null });
}

// Prep expiry after a long sleep still grants the full speaking time from `now`.
{
  const late = T0 + 600_000;
  const { state, event } = tick(startPrep(T0, 60), late, 120);
  assert.equal(event, "prepEnded");
  assert.deepEqual(state, { phase: "speaking", endsAt: late + 120_000 });
}

// skipPrep goes straight to speaking.
{
  const state = skipPrep(T0, 120);
  assert.deepEqual(state, { phase: "speaking", endsAt: T0 + 120_000 });
  assert.equal(remainingSeconds(state, T0 + 100_500), 20);
}

// stop mid-speaking (and mid-prep) → done; idle stays idle.
assert.deepEqual(stop(skipPrep(T0, 120)), { phase: "done" });
assert.deepEqual(stop(startPrep(T0, 60)), { phase: "done" });
assert.deepEqual(stop(CUE_CARD_IDLE), CUE_CARD_IDLE);
assert.deepEqual(stop({ phase: "done" }), { phase: "done" });

// serialize/deserialize round-trip; invalid → idle.
{
  const state = skipPrep(T0, 120);
  assert.deepEqual(deserialize(serialize(state)), state);
  assert.deepEqual(deserialize(serialize({ phase: "done" })), { phase: "done" });
  assert.deepEqual(deserialize(serialize(CUE_CARD_IDLE)), CUE_CARD_IDLE);
  assert.deepEqual(deserialize(null), CUE_CARD_IDLE);
  assert.deepEqual(deserialize(undefined), CUE_CARD_IDLE);
  assert.deepEqual(deserialize(""), CUE_CARD_IDLE);
  assert.deepEqual(deserialize("not json"), CUE_CARD_IDLE);
  assert.deepEqual(deserialize("42"), CUE_CARD_IDLE);
  assert.deepEqual(deserialize('{"phase":"warp"}'), CUE_CARD_IDLE);
  assert.deepEqual(deserialize('{"phase":"prep"}'), CUE_CARD_IDLE);
  assert.deepEqual(deserialize('{"phase":"speaking","endsAt":"soon"}'), CUE_CARD_IDLE);
}

assert.equal(cueCardStorageKey("att-1", "q-9"), "ielts:mock:att-1:cue-card:q-9");

console.log("cue-card-timer.test.ts ok");
