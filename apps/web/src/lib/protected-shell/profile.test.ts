import assert from "node:assert/strict";
import test from "node:test";
import { loadRequiredProfile } from "./profile";

test("only confirmed missing or incomplete profiles request onboarding", async () => {
  assert.deepEqual(await loadRequiredProfile(async () => ({ data: null, error: null })), { status: "onboarding" });
  assert.deepEqual(await loadRequiredProfile(async () => ({ data: { onboarding_completed: false }, error: null })), { status: "onboarding" });
  assert.deepEqual(await loadRequiredProfile(async () => ({ data: null, error: { status: 503 } })), { status: "unavailable" });
  assert.deepEqual(await loadRequiredProfile(async () => { throw new Error("fixture"); }), { status: "unavailable" });
  assert.deepEqual(await loadRequiredProfile(() => new Promise(() => {}), 10), { status: "unavailable" });
  const profile = { onboarding_completed: true };
  assert.deepEqual(await loadRequiredProfile(async () => ({ data: profile, error: null })), { status: "ready", profile });
});
