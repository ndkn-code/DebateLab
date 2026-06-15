import assert from "node:assert/strict";
import { shouldResetPracticeClientStateOnAuthChange } from "./practice-client-state";

assert.equal(shouldResetPracticeClientStateOnAuthChange(undefined, null), false);
assert.equal(shouldResetPracticeClientStateOnAuthChange(undefined, "user-a"), false);
assert.equal(shouldResetPracticeClientStateOnAuthChange(null, null), false);
assert.equal(shouldResetPracticeClientStateOnAuthChange("user-a", "user-a"), false);
assert.equal(shouldResetPracticeClientStateOnAuthChange(null, "user-a"), true);
assert.equal(shouldResetPracticeClientStateOnAuthChange("user-a", null), true);
assert.equal(shouldResetPracticeClientStateOnAuthChange("user-a", "user-b"), true);

console.info("practice client auth-state reset detection passed");
